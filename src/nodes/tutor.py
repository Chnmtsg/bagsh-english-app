"""Error tutor (llm, cheap tier): labels and explains difflib-computed edits.
It cannot add, remove or dispute an edit. Categories come from the closed
taxonomy enum; explanations adapt the taxonomy's rule wording. Pattern edits
arrive already labelled and skip the model entirely.
"""

from __future__ import annotations

import json
import logging

from ..knowledge import categories
from ..llm import LLMError, get_client, parse_json
from ..prompts import load_prompt, render
from ..state import Edit, JournalState

logger = logging.getLogger(__name__)


def _rules_block(level: str) -> str:
    key = "rule_a2" if level in ("A0", "A1", "A2") else "rule_b1"
    lines = []
    for name, cat in categories().items():
        lines.append(f"- {name}: {cat[key]}")
    return "\n".join(lines)


def tutor(state: JournalState) -> dict:
    pattern_edits = list(state.get("pattern_edits", []))
    model_edits = list(state.get("model_edits", []))
    level = state.get("learner", {}).get("level", "B1")

    if not model_edits:
        return {"labelled_edits": pattern_edits}

    meta, body = load_prompt("tutor")
    system = render(body, level=level, category_rules=_rules_block(level))
    payload = [
        {"index": i, "original": e["original"], "corrected": e["corrected"]}
        for i, e in enumerate(model_edits)
    ]
    user = render(
        "Entry:\n{{text}}\n\nEdits to label (JSON):\n{{edits}}",
        text=state.get("text", ""),
        edits=json.dumps(payload, ensure_ascii=False),
    )

    valid = set(categories().keys())
    labelled: list[Edit] = [dict(e) for e in model_edits]  # type: ignore[misc]
    try:
        reply = get_client().complete(system=system, user=user, tier="cheap", tag="tutor")
        for item in parse_json(reply):
            idx = int(item.get("index", -1))
            if not 0 <= idx < len(labelled):
                continue
            category = str(item.get("category", ""))
            if category not in valid:
                logger.warning("tutor invented category %r — dropped", category)
                category = ""
            labelled[idx]["category"] = category
            labelled[idx]["severity"] = str(item.get("severity", "medium"))
            labelled[idx]["explanation"] = str(item.get("explanation", ""))
    except (LLMError, ValueError) as exc:
        # degrade: edits stay unlabelled; teacher falls back to generic wording
        logger.warning("tutor failed, edits left unlabelled: %s", exc)

    return {
        "labelled_edits": pattern_edits + labelled,
        "prompt_versions": {"tutor": str(meta["version"])},
    }
