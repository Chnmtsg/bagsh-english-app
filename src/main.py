"""CLI entry: run one journal entry through the pipeline.

    python -m src.main "Today I go to site. We collected three sample." \
        [--learner ID]
"""

from __future__ import annotations

import argparse
import logging
import sys
import uuid

from . import error_queue, metrics
from .console import utf8_output
from .graph import build_graph
from .nodes.memory import load_profile
from .quiz import check_answer


def _practise(drills: list[dict], learner_id: str) -> None:
    """Repair-first feedback (ADR-0007): the learner fixes their own sentence
    BEFORE reading the explanation. Printing the correction first would turn
    the repair back into a recast, which is the feedback move with the lowest
    uptake in the literature (Lyster & Ranta 1997)."""
    repairs = [d for d in drills if d.get("answer") and d.get("prompt")]
    if not repairs:
        return
    interactive = sys.stdin.isatty()
    print("\n=== Fix these first ===")
    queue = error_queue.load(learner_id) if interactive else None
    for i, d in enumerate(repairs, 1):
        print(f"\n{i}. You wrote: {d['your_version']}")
        print("   " + ("Type the missing words:" if d.get("mode") == "chunk"
                       else "Type it without the marked words:"))
        print(f"   {d['prompt']}")
        if not interactive:
            continue
        try:
            answer = input("   ✏️  ").replace("﻿", "").strip()
        except EOFError:
            break
        ok = check_answer(answer, d["answer"], None, True)
        print("   ✅ Зөв! (Correct!)" if ok else f"   → {d['answer']}")
        if d.get("rule"):
            print(f"   💡 {d['rule']}")
        if queue is not None and d.get("key") in queue["items"]:
            before = int(queue["items"][d["key"]].get("interval", 0))
            error_queue.record(queue, d["key"], ok)
            metrics.log_attempt(learner_id, "errors", d["key"], before, ok,
                                produced=True)
    if queue is not None:
        error_queue.save(learner_id, queue)


def _show_exposures(drills: list[dict], learner_id: str) -> None:
    """Untreatable errors: shown, never asked, never scored (ADR-0007 §4.4).
    There is no rule to drill for word choice or collocation — the treatment
    is meeting the natural version again."""
    notes = [d for d in drills if d.get("kind") == "exposure"]
    if not notes:
        return
    print("\n=== A more natural way (not an error to fix) ===")
    try:
        queue = error_queue.load(learner_id)
    except (OSError, ValueError):
        queue = None
    for note in notes:
        print(f'- you wrote "{note["yours"]}" → more natural: '
              f'"{note["natural"]}"')
        if note.get("bridge"):
            print(f"  🇲🇳 {note['bridge']}")
        if queue is not None:
            error_queue.mark_shown(queue, note["key"])
    if queue is not None:
        error_queue.save(learner_id, queue)


def main() -> None:
    utf8_output()
    parser = argparse.ArgumentParser(description="Bagsh journal pipeline")
    parser.add_argument("text", help="the journal entry")
    parser.add_argument("--learner", default="default", help="learner id")
    parser.add_argument("--strictness", choices=["low", "normal", "high"],
                        default=None,
                        help="how many corrections to SHOW (all are always "
                             "detected); persists on the profile")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING)

    profile = load_profile(args.learner)
    if args.strictness:
        profile["strictness"] = args.strictness
        print(f"(strictness set to {args.strictness} — "
              f"{'all errors will be shown, grouped' if args.strictness == 'high' else 'display capped, everything still counted'})")

    graph = build_graph()
    state = {
        "entry_id": uuid.uuid4().hex[:12],
        "text": args.text,
        "learner": profile,
    }
    result = graph.invoke(state)

    risk = result.get("distress", {}).get("risk", "none")
    print("\n=== Reply ===")
    print(result.get("coach_reply", ""))

    if risk != "acute":
        items = result.get("drills") or []
        _practise(items, str(profile.get("learner_id", "default")))

        print("\n=== Teacher feedback ===")
        print(result.get("teacher_feedback", ""))
        notes = result.get("fluency_notes") or []
        if notes:
            print("\n=== More natural (not errors) ===")
            for n in notes:
                print(f'- "{n["original"]}" → "{n["natural"]}" ({n["reason"]})')
        _show_exposures(items, str(profile.get("learner_id", "default")))
        generated = [d for d in items if d.get("source") == "model"]
        if generated:
            print("\n=== Practice ===")
            for i, d in enumerate(generated, 1):
                print(f"{i}. {d['question']}")
        for a in result.get("ambiguities") or []:
            print(f"\n(One part was ambiguous: {a})")

    if result.get("errors"):
        print("\n[warnings]")
        for e in result["errors"]:
            print(f"- {e}")


if __name__ == "__main__":
    main()
