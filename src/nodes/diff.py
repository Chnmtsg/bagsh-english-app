"""Diff engine (code): difflib token alignment between the learner's text
and the corrector's output. THIS is where the edit list comes from — never
from a model response. Model edits whose span overlaps a pattern edit are
dropped (the pattern already owns that span, with curated wording).
"""

from __future__ import annotations

import difflib
import re

from ..state import Edit, JournalState

_TOKEN = re.compile(r"\w+[\w']*|[^\w\s]", re.UNICODE)


def _tokenize(text: str) -> tuple[list[str], list[tuple[int, int]]]:
    tokens, spans = [], []
    for m in _TOKEN.finditer(text):
        tokens.append(m.group(0))
        spans.append((m.start(), m.end()))
    return tokens, spans


def diff(state: JournalState) -> dict:
    original = state.get("text", "") or ""
    corrected = state.get("corrected_text", original)
    pattern_spans = [(e["start"], e["end"]) for e in state.get("pattern_edits", [])]

    a_tokens, a_spans = _tokenize(original)
    b_tokens, _ = _tokenize(corrected)

    edits: list[Edit] = []
    matcher = difflib.SequenceMatcher(a=a_tokens, b=b_tokens, autojunk=False)
    for op, a0, a1, b0, b1 in matcher.get_opcodes():
        if op == "equal":
            continue
        if op == "insert":
            # anchor an insertion to the position before the next token
            pos = a_spans[a0][0] if a0 < len(a_spans) else len(original)
            start, end = pos, pos
        else:
            start, end = a_spans[a0][0], a_spans[a1 - 1][1]
        if any(s < end and start < e for s, e in pattern_spans) or (
            start == end and any(s <= start <= e for s, e in pattern_spans)
        ):
            continue  # span already owned by a deterministic pattern
        edits.append(Edit(
            source="model",
            original=original[start:end],
            corrected=" ".join(b_tokens[b0:b1]),
            start=start,
            end=end,
            displayed=False,
        ))

    return {"model_edits": edits}
