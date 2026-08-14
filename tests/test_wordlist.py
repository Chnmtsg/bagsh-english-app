"""Integrity of the imported CEFR word list (knowledge/cefr_wordlist.json)."""

import json
import re
from pathlib import Path

WORDLIST = Path(__file__).resolve().parents[1] / "knowledge" / "cefr_wordlist.json"

EXPECTED = {"A1": 600, "A2": 700, "B1": 1500, "B2": 2000, "C1": 1000, "C2": 1000}
_WORD = re.compile(r"^[a-z][a-z'-]*$|^[ai]$")


def _load():
    return json.loads(WORDLIST.read_text(encoding="utf-8"))


def test_wordlist_levels_and_sizes():
    data = _load()
    assert data["source_url"], "attribution is mandatory (MIT source)"
    levels = data["levels"]
    assert set(levels) == set(EXPECTED)
    for name, count in EXPECTED.items():
        assert len(levels[name]) == count, f"{name}: {len(levels[name])}"


def test_cumulative_b1_matches_official_scale():
    levels = _load()["levels"]
    cumulative_b1 = sum(len(levels[l]) for l in ("A1", "A2", "B1"))
    # Cambridge B1 Preliminary list is ~2,500-3,000 words cumulative
    assert 2500 <= cumulative_b1 <= 3000


def test_words_are_clean_and_unique_across_levels():
    levels = _load()["levels"]
    seen: set[str] = set()
    for name, words in levels.items():
        for w in words:
            assert _WORD.match(w), f"{name}: bad token {w!r}"
            assert w not in seen, f"{w!r} appears in two levels"
            seen.add(w)


def test_a1_contains_core_words():
    a1 = set(_load()["levels"]["A1"])
    assert {"the", "and", "water", "good", "day"} <= a1
