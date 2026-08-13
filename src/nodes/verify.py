"""Verifier (code): over-rewrite guard and span validation.

- over_rewrite: more than 45% of tokens changed → one corrector retry, then
  the model edits are dropped and the entry proceeds on pattern edits only
  (precision over recall — a suspicious rewrite must not reach the learner).
- span check: every edit's `original` must equal text[start:end] exactly.
  Invalid edits are dropped and logged, never repaired.
"""

from __future__ import annotations

import difflib
import logging
import re

from ..state import Edit, JournalState

logger = logging.getLogger(__name__)

_TOKEN = re.compile(r"\w+[\w']*|[^\w\s]", re.UNICODE)
OVER_REWRITE_THRESHOLD = 0.45
MAX_ATTEMPTS = 2  # first pass + one retry


def _change_ratio(a: str, b: str) -> float:
    a_tokens = _TOKEN.findall(a)
    b_tokens = _TOKEN.findall(b)
    if not a_tokens:
        return 0.0
    sm = difflib.SequenceMatcher(a=a_tokens, b=b_tokens, autojunk=False)
    equal = sum(a1 - a0 for op, a0, a1, _, _ in sm.get_opcodes() if op == "equal")
    return 1.0 - (equal / len(a_tokens))


def verify(state: JournalState) -> dict:
    text = state.get("text", "") or ""
    corrected = state.get("corrected_text", text)
    attempts = int(state.get("verify", {}).get("attempts", 0)) + 1

    ratio = _change_ratio(text, corrected)
    over = ratio > OVER_REWRITE_THRESHOLD

    model_edits: list[Edit] = []
    for edit in state.get("model_edits", []):
        span_text = text[edit["start"]:edit["end"]]
        if span_text != edit["original"]:
            logger.warning("dropping edit with invalid span: %r", edit)
            continue
        model_edits.append(edit)

    result: dict = {
        "verify": {"over_rewrite": over, "ratio": round(ratio, 3), "attempts": attempts},
    }
    if over and attempts >= MAX_ATTEMPTS:
        # retried and still over-rewriting: drop model edits, keep patterns
        result["model_edits"] = []
        result["corrected_text"] = text
        result["errors"] = [
            f"over_rewrite_persisted: ratio={ratio:.2f}, model edits discarded"
        ]
        result["verify"]["over_rewrite"] = False  # do not loop again
    else:
        result["model_edits"] = model_edits
    return result
