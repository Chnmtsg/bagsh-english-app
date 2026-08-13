"""Distress classification. A deterministic keyword pre-check runs first and
can only RAISE risk; the LLM classifier (cheap tier) runs on every entry.
On any classifier failure the entry is treated as `elevated` — this path
fails toward safety, never toward silence.

Changes here require safety-reviewer approval before commit.
"""

from __future__ import annotations

import logging

from ..llm import LLMError, get_client, parse_json
from ..prompts import load_prompt, render
from ..state import JournalState

logger = logging.getLogger(__name__)

_RISK_ORDER = {"none": 0, "elevated": 1, "acute": 2}

# Deterministic floor. Matching is substring, lowercase. Broken English must
# not lower a rating, so these are deliberately loose stems, tuned to
# over-trigger (a false positive costs a slightly odd response; a false
# negative costs much more).
_ACUTE_KEYWORDS = [
    "want to die", "wants to die", "kill myself", "end my life",
    "suicide", "suicidal", "not want to live", "don't want to live",
    "dont want to live", "no reason to live", "better without me",
    "tired for living", "tired of living", "hurt myself", "harm myself",
    "амиа хорлох", "үхмээр", "амьдрахыг хүсэхгүй", "амьдармааргүй",
]
_ELEVATED_KEYWORDS = [
    "depressed", "depression", "hopeless", "worthless", "can't go on",
    "cant go on", "panic attack", "so alone", "nobody cares", "no one cares",
    "сэтгэл гутрал", "найдваргүй", "ганцаардаж",
]


def _keyword_floor(text: str) -> str:
    lowered = text.lower()
    if any(k in lowered for k in _ACUTE_KEYWORDS):
        return "acute"
    if any(k in lowered for k in _ELEVATED_KEYWORDS):
        return "elevated"
    return "none"


def distress(state: JournalState) -> dict:
    text = state.get("text", "") or ""
    floor = _keyword_floor(text)
    signals: list[str] = [f"keyword_floor:{floor}"] if floor != "none" else []

    meta, body = load_prompt("distress_classifier")
    llm_risk = "elevated"  # default if the classifier fails
    try:
        reply = get_client().complete(
            system=body,
            user=render("Journal entry:\n{{text}}", text=text),
            tier="cheap",
            tag="distress_classifier",
        )
        data = parse_json(reply)
        candidate = str(data.get("risk", "")).lower()
        if candidate in _RISK_ORDER:
            llm_risk = candidate
            signals.extend(str(s) for s in data.get("signals", []))
        else:
            signals.append("classifier_bad_output")
    except (LLMError, ValueError) as exc:
        logger.warning("distress classifier failed, treating as elevated: %s", exc)
        signals.append("classifier_error")

    # The keyword floor can only raise risk, never lower it.
    risk = floor if _RISK_ORDER[floor] > _RISK_ORDER[llm_risk] else llm_risk

    return {
        "distress": {"risk": risk, "signals": signals},
        "prompt_versions": {"distress_classifier": str(meta["version"])},
    }
