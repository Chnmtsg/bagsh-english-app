"""Fluency (llm, cheap tier): correct-but-unnatural phrasing, gated at B1+.
Tracked separately from errors. A failed call degrades to an empty list.
"""

from __future__ import annotations

import logging

from ..llm import LLMError, get_client, parse_json
from ..prompts import load_prompt, render
from ..state import JournalState

logger = logging.getLogger(__name__)

_GATED_BELOW = ("A0", "A1", "A2")


def fluency(state: JournalState) -> dict:
    level = state.get("learner", {}).get("level", "B1")
    if level in _GATED_BELOW:
        return {"fluency_notes": []}

    meta, body = load_prompt("fluency")
    user = render("Journal entry:\n{{text}}", text=state.get("text", ""))
    notes: list[dict] = []
    try:
        reply = get_client().complete(system=body, user=user, tier="cheap", tag="fluency")
        for item in parse_json(reply):
            if not isinstance(item, dict):
                continue
            original = str(item.get("original", ""))
            if original and original in state.get("text", ""):
                notes.append({
                    "original": original,
                    "natural": str(item.get("natural", "")),
                    "reason": str(item.get("reason", "")),
                })
    except (LLMError, ValueError) as exc:
        logger.warning("fluency failed, degrading to empty: %s", exc)

    return {
        "fluency_notes": notes[:3],
        "prompt_versions": {"fluency": str(meta["version"])},
    }
