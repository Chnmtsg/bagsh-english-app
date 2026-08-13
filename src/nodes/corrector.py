"""Corrector (llm, strong tier): minimal-edit correction.

Receives the ORIGINAL entry text (never a half-fixed one — the learner must
see their own sentence in the diff). Returns corrected text between
<corrected> tags; the edit list is computed later by diff.py. A failed call
fails the entry visibly — it does not silently pass the text through.
"""

from __future__ import annotations

import logging
import re

from ..llm import LLMError, get_client
from ..prompts import load_prompt, render
from ..state import JournalState

logger = logging.getLogger(__name__)

_CORRECTED = re.compile(r"<corrected>(.*?)</corrected>", re.DOTALL)
_AMBIGUOUS = re.compile(r"<ambiguity>(.*?)</ambiguity>", re.DOTALL)


def corrector(state: JournalState) -> dict:
    text = state.get("text", "") or ""
    attempts = int(state.get("verify", {}).get("attempts", 0))

    meta, body = load_prompt("corrector")
    user = render("Journal entry to correct:\n<entry>{{text}}</entry>", text=text)
    if attempts > 0:
        user += (
            "\n\nYour previous attempt rewrote too much of the entry. "
            "Make FEWER, smaller edits: fix only clear grammatical errors and "
            "leave everything else exactly as the learner wrote it."
        )

    try:
        reply = get_client().complete(
            system=body, user=user, tier="strong", tag="corrector",
        )
    except LLMError as exc:
        logger.error("corrector failed: %s", exc)
        return {
            "corrected_text": text,
            "errors": [f"corrector_failed: {exc}"],
            "prompt_versions": {"corrector": str(meta["version"])},
        }

    m = _CORRECTED.search(reply)
    corrected = m.group(1).strip() if m else reply.strip()
    ambiguities = [a.strip() for a in _AMBIGUOUS.findall(reply)]

    return {
        "corrected_text": corrected,
        "ambiguities": ambiguities,
        "prompt_versions": {"corrector": str(meta["version"])},
    }
