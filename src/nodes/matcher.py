"""Matcher (code): the deterministic patterns run before the corrector at
zero cost and zero hallucination risk. Edits carry source='pattern' with
category, severity and explanation filled directly from the taxonomy file —
they skip the tutor entirely.
"""

from __future__ import annotations

import re
from functools import lru_cache

from ..knowledge import deterministic_patterns
from ..state import Edit, JournalState


@lru_cache(maxsize=1)
def _compiled() -> list[tuple[dict, re.Pattern[str]]]:
    out = []
    for pattern in deterministic_patterns():
        flags = 0 if pattern.get("case_sensitive") else re.IGNORECASE
        out.append((pattern, re.compile(pattern["find"], flags)))
    return out


def matcher(state: JournalState) -> dict:
    text = state.get("text", "") or ""
    edits: list[Edit] = []
    claimed: list[tuple[int, int]] = []

    for pattern, regex in _compiled():
        for m in regex.finditer(text):
            span = (m.start(), m.end())
            if any(s < span[1] and span[0] < e for s, e in claimed):
                continue  # first pattern wins an overlapping span
            corrected = m.expand(pattern["replace"])
            if corrected == m.group(0):
                continue
            claimed.append(span)
            edits.append(Edit(
                source="pattern",
                original=m.group(0),
                corrected=corrected,
                start=span[0],
                end=span[1],
                category=pattern["category"],
                severity=pattern.get("severity", "low"),
                explanation=pattern.get("explanation", ""),
                pattern_id=pattern["id"],
                displayed=False,
            ))

    edits.sort(key=lambda e: e["start"])
    return {"pattern_edits": edits}
