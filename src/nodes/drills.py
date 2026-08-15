"""Drills (code first, llm only as a fallback) — ADR-0007.

What the learner practises is now, in order of preference:

1. **Their own sentences, as repairs.** Today's displayed errors and anything
   the error queue has scheduled, rendered as the learner's own sentence with
   the error span blanked. A prompt, not a recast: they produce the fix before
   the target is revealed (Lyster & Ranta 1997). Built with string operations
   over text the learner wrote — zero cost, zero hallucination risk.
2. **Generated micro-questions**, the previous behaviour, kept for the case the
   repair path cannot serve: a first entry with no history, or an entry whose
   edits carry no locatable span.

Degrades to an empty list on failure, as before.
"""

from __future__ import annotations

import logging
from collections import Counter

from .. import error_queue
from ..knowledge import categories
from ..llm import LLMError, get_client, parse_json
from ..prompts import load_prompt, render
from ..state import JournalState

logger = logging.getLogger(__name__)

MAX_DRILLS = 3
MAX_FROM_TODAY = 2     # the rest of the slots belong to what is scheduled
MAX_EXPOSURES = 1      # untreatable errors: read, never answered, never scored


def _todays_repairs(state: JournalState) -> list[dict]:
    """The errors the teacher is about to show, as repair prompts. Displayed
    BEFORE the explanation by src/main.py — printing the correction first turns
    the repair back into a recast.

    Gated on `risk == none`, the same rule the error queue stores under: a
    repair quotes the learner's whole SENTENCE back at them, where the teacher
    only ever quotes the span. On an entry carrying any distress signal that is
    not a difference worth taking — the grammar feedback still happens, it just
    does not hand someone their own hard sentence back as an exercise.
    """
    if state.get("distress", {}).get("risk") != "none":
        return []
    text = state.get("text", "")
    out: list[dict] = []
    seen: set[str] = set()
    for edit in state.get("labelled_edits", []):
        if not edit.get("displayed") or not edit.get("category"):
            continue
        category = edit["category"]
        if category in seen:
            continue
        if not categories().get(category, {}).get("treatable", True):
            continue  # idiomatic errors get an alternative, never a drill
        repair = error_queue.build_repair(text, edit)
        if repair is None:
            continue
        seen.add(category)
        cat = categories().get(category, {})
        out.append({
            "source": "today",
            "key": error_queue.key_for(category, edit.get("original", "")),
            "category": category,
            "question": ("Type the missing words."
                         if repair["mode"] == "chunk"
                         else "Type the sentence without the marked words.")
                        + "\n" + repair["prompt"],
            "prompt": repair["prompt"],
            "answer": repair["answer"],
            "mode": repair["mode"],
            "your_version": repair["sentence"],
            "rule": cat.get("rule_b1", ""),
            "rule_a2": cat.get("rule_a2", ""),
            "bridge": cat.get("bridge", ""),
            "seen": 1,
        })
        if len(out) >= MAX_FROM_TODAY:
            break
    return out


def _queue(state: JournalState) -> dict | None:
    learner_id = state.get("learner", {}).get("learner_id", "default")
    try:
        return error_queue.load(learner_id)
    except (OSError, ValueError) as exc:
        logger.warning("error queue unreadable, skipping scheduled items: %s", exc)
        return None


def _scheduled(store: dict | None, exclude: set[str], room: int) -> list[dict]:
    if room <= 0 or store is None:
        return []
    return [
        error_queue.to_drill(item)
        for item in error_queue.due(store, n=room + len(exclude))
        if item["category"] not in exclude
    ][:room]


def _exposures(store: dict | None) -> list[dict]:
    """Untreatable errors come back as something to read, not to answer
    (ADR-0007 §4.4). They are never scored, so they do not compete for the
    MAX_DRILLS slots — one note, alongside whatever is being drilled."""
    if store is None:
        return []
    return [error_queue.to_exposure(item)
            for item in error_queue.exposures(store, n=MAX_EXPOSURES)]


def _generated(state: JournalState) -> tuple[list[dict], dict | None]:
    edits = state.get("labelled_edits", [])
    cats = Counter(e.get("category", "") for e in edits if e.get("category"))
    if not cats:
        return [], None
    top_category, _ = cats.most_common(1)[0]
    taxonomy_entry = categories().get(top_category, {})
    profile = state.get("learner", {})

    meta, body = load_prompt("drills")
    system = render(
        body,
        level=profile.get("level", "B1"),
        domain=profile.get("domain") or "everyday life",
    )
    examples = "; ".join(
        f'"{e.get("original", "")}" -> "{e.get("corrected", "")}"'
        for e in edits if e.get("category") == top_category
    )
    user = render(
        "Target category: {{category}}\nRule: {{rule}}\n"
        "Today's examples: {{examples}}",
        category=top_category,
        rule=taxonomy_entry.get("rule_b1", ""),
        examples=examples,
    )

    items: list[dict] = []
    try:
        reply = get_client().complete(system=system, user=user, tier="cheap", tag="drills")
        for item in parse_json(reply):
            if isinstance(item, dict) and item.get("question"):
                items.append({
                    "source": "model",
                    "category": top_category,
                    "question": str(item["question"]),
                    "answer": str(item.get("answer", "")),
                })
    except (LLMError, ValueError) as exc:
        logger.warning("drills failed, degrading to empty: %s", exc)
    return items[:MAX_DRILLS], meta


def drills(state: JournalState) -> dict:
    store = _queue(state)
    repairs = _todays_repairs(state)
    repairs += _scheduled(store, {d["category"] for d in repairs},
                          MAX_DRILLS - len(repairs))
    exposures = _exposures(store)

    if repairs or exposures:
        return {"drills": repairs[:MAX_DRILLS] + exposures}

    items, meta = _generated(state)
    if meta is None:
        return {"drills": []}
    return {"drills": items,
            "prompt_versions": {"drills": str(meta["version"])}}
