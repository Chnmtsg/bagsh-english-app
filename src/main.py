"""CLI entry: run one journal entry through the pipeline.

    python -m src.main "Today I go to site. We collected three sample." \
        [--learner ID]
"""

from __future__ import annotations

import argparse
import logging
import uuid

from .graph import build_graph
from .nodes.memory import load_profile


def main() -> None:
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
        print("\n=== Teacher feedback ===")
        print(result.get("teacher_feedback", ""))
        notes = result.get("fluency_notes") or []
        if notes:
            print("\n=== More natural (not errors) ===")
            for n in notes:
                print(f'- "{n["original"]}" → "{n["natural"]}" ({n["reason"]})')
        items = result.get("drills") or []
        if items:
            print("\n=== Practice ===")
            for i, d in enumerate(items, 1):
                print(f"{i}. {d['question']}")
        for a in result.get("ambiguities") or []:
            print(f"\n(One part was ambiguous: {a})")

    if result.get("errors"):
        print("\n[warnings]")
        for e in result["errors"]:
            print(f"- {e}")


if __name__ == "__main__":
    main()
