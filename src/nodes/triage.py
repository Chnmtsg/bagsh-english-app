"""Triage (code): length, language share, sentence split. Never fails."""

from __future__ import annotations

import re

from ..state import JournalState

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_WORD = re.compile(r"[\w']+", re.UNICODE)
_CYRILLIC = re.compile(r"[Ѐ-ӿ]")
_LATIN = re.compile(r"[A-Za-z]")


def triage(state: JournalState) -> dict:
    text = state.get("text", "") or ""
    words = _WORD.findall(text)
    sentences = [s for s in _SENTENCE_SPLIT.split(text.strip()) if s]

    cyr = len(_CYRILLIC.findall(text))
    lat = len(_LATIN.findall(text))
    letters = cyr + lat
    cyrillic_share = (cyr / letters) if letters else 0.0

    return {
        "triage": {
            "word_count": len(words),
            "sentence_count": len(sentences),
            "sentences": sentences,
            "cyrillic_share": round(cyrillic_share, 3),
            "too_short": len(words) < 3,
            "mostly_mongolian": cyrillic_share > 0.5,
        }
    }
