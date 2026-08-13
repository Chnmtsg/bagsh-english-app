"""Drills (llm, cheap tier): 2–3 micro-questions targeting the top pattern
of today's entry. Degrades to an empty list on failure.
"""

from __future__ import annotations

import logging
from collections import Counter

from ..knowledge import categories
from ..llm import LLMError, get_client, parse_json
from ..prompts import load_prompt, render
from ..state import JournalState

logger = logging.getLogger(__name__)


def drills(state: JournalState) -> dict:
    edits = state.get("labelled_edits", [])
    cats = Counter(e.get("category", "") for e in edits if e.get("category"))
    if not cats:
        return {"drills": []}
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
                    "category": top_category,
                    "question": str(item["question"]),
                    "answer": str(item.get("answer", "")),
                })
    except (LLMError, ValueError) as exc:
        logger.warning("drills failed, degrading to empty: %s", exc)

    return {
        "drills": items[:3],
        "prompt_versions": {"drills": str(meta["version"])},
    }
