"""Human coach (llm, strong tier): responds to the CONTENT of the entry as a
person. Never sees grammar output; never mentions English, grammar, spelling
or the writing — not even to praise it. On acute distress it switches to the
wellbeing variant, and crisis resources come verbatim from the verified
entries in knowledge/crisis_resources.yaml — never from the model.

Changes to the wellbeing path require safety-reviewer approval before commit.
"""

from __future__ import annotations

import logging

from ..knowledge import load_crisis_resources, verified_crisis_resources
from ..llm import LLMError, get_client
from ..prompts import load_prompt, render
from ..state import JournalState

logger = logging.getLogger(__name__)

_FALLBACK_REPLY = "Thank you for writing today. I read every word."


def _resources_block() -> str:
    lines = []
    for r in verified_crisis_resources():
        lines.append(f"- {r['name']}: {r['contact']}")
    data = load_crisis_resources()
    msg = data.get("supportive_message", {})
    for lang in ("mn", "en"):
        if msg.get(lang):
            lines.append(msg[lang])
    return "\n".join(lines)


def coach(state: JournalState) -> dict:
    risk = state.get("distress", {}).get("risk", "none")
    level = state.get("learner", {}).get("level", "B1")
    text = state.get("text", "")

    prompt_name = "coach_wellbeing" if risk == "acute" else "coach"
    meta, body = load_prompt(prompt_name)
    system = render(body, level=level)
    user = render("Journal entry:\n{{text}}", text=text)

    try:
        reply = get_client().complete(
            system=system, user=user, tier="strong", tag=prompt_name,
        )
    except LLMError as exc:
        logger.warning("coach failed, using fallback: %s", exc)
        reply = _FALLBACK_REPLY

    if risk == "acute":
        # Resources are appended by CODE from the verified list. The model
        # never produces them, so it can never get a digit wrong.
        block = _resources_block()
        if block:
            reply = f"{reply}\n\n{block}"

    return {
        "coach_reply": reply,
        "prompt_versions": {prompt_name: str(meta["version"])},
    }
