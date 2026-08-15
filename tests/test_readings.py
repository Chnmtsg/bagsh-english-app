"""Tests for ADR-0009 — the reading strand.

The point of this file is that "graded" is a checkable property. If these
pass, every shipped text is one a learner at its level can actually read.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from src import reading  # noqa: E402
from src.knowledge import load_pseudowords  # noqa: E402
from validate_readings import check  # noqa: E402

TEXTS = reading.load_readings()
IDS = [t["id"] for t in TEXTS]


# ── the grading contract ─────────────────────────────────────────────

@pytest.mark.parametrize("text", TEXTS, ids=IDS)
def test_every_text_is_graded(text):
    problems = check(text)
    assert not problems, f"{text['id']}: " + "; ".join(problems)


@pytest.mark.parametrize("text", TEXTS, ids=IDS)
def test_coverage_meets_the_threshold(text):
    report = reading.coverage(text["body"], text["level"])
    assert report["coverage"] >= reading.MIN_COVERAGE, (
        f"{text['id']} is {report['coverage']:.1%} at {text['level']}")


@pytest.mark.parametrize("text", TEXTS, ids=IDS)
def test_questions_are_answerable(text):
    for question in text["questions"]:
        correct = [o for o in question["options"] if o.get("correct")]
        assert len(correct) == 1, f"{text['id']}: {question['q']}"
        assert len(question["options"]) >= 3
        texts = [o["text"] for o in question["options"]]
        assert len(set(texts)) == len(texts), "duplicate option"


def test_the_library_covers_the_bands_it_claims():
    by_level = {}
    for text in TEXTS:
        by_level.setdefault(text["level"], []).append(text["id"])
    for level in ("A1", "A2", "B1", "B2"):
        assert len(by_level.get(level, [])) >= 2, f"{level} has too few texts"


def test_ids_and_titles_are_unique():
    assert len(set(IDS)) == len(IDS)
    titles = [t["title"] for t in TEXTS]
    assert len(set(titles)) == len(titles)


def test_no_pseudoword_ever_appears_in_a_text():
    """The Coverage Check's anchors must not be words the app itself uses —
    a learner who met `brimtle` in a story and then ticked it would be
    penalised for paying attention."""
    fake = set(load_pseudowords())
    for text in TEXTS:
        assert not (fake & set(reading.tokenize(text["body"]))), text["id"]


# ── the coverage model ───────────────────────────────────────────────

def test_the_deck_outranks_every_other_source():
    """ADR-0005: the curated deck decides a word's level. The grading list
    must never override it, however inconvenient that is for a text."""
    deck = reading._deck_levels()
    for word, level in list(deck.items())[:200]:
        assert reading.word_level(word) == level, word


def test_the_easiest_justified_level_wins_between_the_rest():
    # `read` is A1 in the frequency list and appears in a B2 dialogue; taking
    # the first source to answer instead of the easiest made it a B2 word
    assert reading.word_level("read") == "A1"


def test_irregular_forms_are_not_mistaken_for_new_words():
    for form, base in [("went", "go"), ("said", "say"), ("told", "tell"),
                       ("children", "child"), ("felt", "feel")]:
        assert base in reading.stems(form), form
        assert reading.word_level(form) == reading.word_level(base)


def test_names_numbers_and_the_calendar_are_free():
    report = reading.coverage(
        "On Friday Batbayar drove ninety kilometres to Ulaanbaatar.", "A2")
    assert report["coverage"] == 1.0, report["unknown"]


def test_an_ungraded_text_is_caught():
    hard = {"id": "x", "level": "A1", "title": "x", "body":
            "The unprecedented metallurgical anomaly necessitated "
            "immediate subterranean reconnaissance.",
            "glosses": {}, "questions": []}
    problems = check(hard)
    assert any("coverage" in p for p in problems)


def test_a_gloss_for_a_word_that_is_not_there_is_caught():
    text = dict(TEXTS[0], glosses={**TEXTS[0]["glosses"], "zebra": "an animal"})
    assert any("zebra" in p for p in check(text))


# ── the core grading list ────────────────────────────────────────────

def test_core_words_are_clean():
    levels = reading._core_levels()
    for word, level in levels.items():
        assert word.isalpha() and word.islower(), word
        assert level in reading.LEVELS


def test_core_words_never_contradict_the_deck():
    """A word may be in both — but if the deck has it, the deck's level is
    what everything uses. This test documents that they are allowed to
    disagree and that the disagreement is harmless."""
    deck = reading._deck_levels()
    core = reading._core_levels()
    overlap = set(deck) & set(core)
    for word in overlap:
        assert reading.word_level(word) == deck[word]


# ── progress ─────────────────────────────────────────────────────────

def test_reading_progress_accumulates_words():
    store = reading.load_progress("t")
    assert store["words_read"] == 0
    text = TEXTS[0]
    reading.record_reading(store, text, 2, 2, "2026-08-15")
    reading.record_reading(store, text, 1, 2, "2026-08-16")
    assert store["words_read"] == text["words"] * 2
    assert store["texts"][text["id"]]["reads"] == 2
    summary = reading.reading_summary(store)
    assert summary["texts_read"] == 1
    assert summary["comprehension"] == 75


def test_readings_for_respects_the_learners_level():
    for text in reading.readings_for("A2"):
        assert reading.rank(text["level"]) <= reading.rank("A2")
    assert len(reading.readings_for("B2")) == len(TEXTS)
    # the hardest readable text comes first: a learner opens the hardest thing
    # they can still read, not the easiest
    assert reading.readings_for("B1")[0]["level"] == "B1"


def test_glossary_reuses_the_decks_mongolian_and_never_invents_it():
    from src.quiz import vocab_bank
    deck = {w["word"].lower(): w for w in vocab_bank()}
    for text in TEXTS:
        for word, entry in reading.glossary(text).items():
            assert entry["gloss_en"]
            if word in deck:
                assert entry["gloss_mn"] == deck[word]["gloss_mn"]
            else:
                assert "gloss_mn" not in entry, f"invented Mongolian for {word}"
