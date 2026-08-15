"""Tests for ADR-0010 — every word the study list can hold has a meaning.

The promise this file guards: a learner who says "I don't know this word"
gets told what it means, offline, without a dictionary. If the coverage test
fails, that promise is broken for somebody.
"""

import json
import re

import pytest

from src.glossary import coverage_of, explain, load_glosses
from src.knowledge import KNOWLEDGE_DIR
from src.reading import stems

WORDLIST = json.loads(
    (KNOWLEDGE_DIR / "cefr_wordlist.json").read_text(encoding="utf-8"))["levels"]
GLOSSES = load_glosses()

# The frequency list is built from a corpus with legal citations in it, so it
# carries stray single letters. They are not vocabulary and the app filters
# them out of the Coverage Check rather than glossing them.
JUNK = {"b", "c", "p", "s", "d", "e", "f", "g", "h", "j", "k", "l", "n",
        "o", "q", "r", "t", "u", "v", "w", "x", "y", "z"}


def _real(level: str) -> list[str]:
    return [w.lower() for w in WORDLIST[level] if w.lower() not in JUNK]


# ── the promise ──────────────────────────────────────────────────────

@pytest.mark.parametrize("level", ["A1", "A2", "B1"])
def test_every_word_a_learner_can_meet_is_explained(level):
    report = coverage_of(_real(level))
    assert report["pct"] == 100, (
        f"{level} has {len(report['missing'])} words with no explanation: "
        + ", ".join(report["missing"][:20]))


def test_the_bands_above_are_honestly_incomplete():
    """B2 and above are not glossed yet. This test exists so the gap is a
    recorded fact rather than a surprise — when someone fills it, they should
    tighten this into the parametrised test above."""
    report = coverage_of(_real("B2"))
    assert report["pct"] < 100, "B2 is covered now — move it into the test above"


def test_inflections_find_their_base():
    for word, base in [("workers", "work"), ("years", "year"),
                       ("happened", "happen"), ("referred", "refer"),
                       ("thoughts", "thought"), ("goes", "go")]:
        entry = explain(word)
        assert entry, word
        assert entry.get("base", entry["word"]) == base or base in stems(word)


def test_a_deck_word_brings_its_mongolian_and_example():
    entry = explain("deposit")
    assert entry["source"] == "deck"
    assert entry["gloss_mn"] and entry["stress"] and entry["example"]


def test_an_unknown_word_is_none_not_a_guess():
    assert explain("brimtle") is None
    assert explain("") is None
    assert explain("   ") is None


# ── house style ──────────────────────────────────────────────────────

def test_no_gloss_defines_a_word_with_itself():
    """"work: to do work" teaches nothing. The stem check catches the sneakier
    version — "worker: somebody who works"."""
    from src.reading import FUNCTION_WORDS, IRREGULARS, NUMBERS
    # Grammar words and numbers are shown working rather than described —
    # "of: belonging to, or made of" is the clearest gloss there is — and an
    # irregular form may name its base ("thought: ... the past of think").
    shown_in_use = FUNCTION_WORDS | NUMBERS
    bad = []
    for word, gloss in GLOSSES.items():
        if word in shown_in_use:
            continue
        # a quoted example is allowed to use the word — showing `of` working
        # is more use than describing it. Only the explanation itself is checked.
        explanation = re.sub(r'"[^"]*"', " ", gloss.lower())
        tokens = set(explanation.replace(",", " ").replace(";", " ")
                     .replace("—", " ").split())
        forms = {s for s in stems(word) if len(s) > 3} | {word}
        forms -= {IRREGULARS.get(word, '')}
        if tokens & forms:
            bad.append(f"{word}: {gloss}")
    assert not bad, "circular glosses:\n" + "\n".join(bad[:15])


def test_glosses_are_short_enough_to_read_and_long_enough_to_help():
    bad = [f"{w}: {g}" for w, g in GLOSSES.items()
           if not 1 <= len(g.split()) <= 18]
    assert not bad, "badly sized glosses:\n" + "\n".join(bad[:15])


def test_glosses_are_plain_text():
    for word, gloss in GLOSSES.items():
        assert isinstance(word, str) and word == word.lower().strip(), word
        assert gloss.strip() == gloss and not gloss.endswith("."), word


def test_no_mongolian_is_invented_in_the_gloss_files():
    """Mongolian comes from vocabulary.yaml, where a native speaker can check
    it. A Cyrillic character in these files means somebody wrote new
    Mongolian here, which ADR-0006 forbids."""
    for word, gloss in GLOSSES.items():
        assert not any("Ѐ" <= ch <= "ӿ" for ch in gloss), word


def test_the_glossary_covers_the_reading_library_too():
    from src.reading import load_readings
    for text in load_readings():
        for word in (text.get("glosses") or {}):
            assert explain(word), f"{text['id']} glosses {word} but nothing explains it"
