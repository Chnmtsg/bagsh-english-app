"""Tests for ADR-0003: SRS scheduler, quiz banks, vocabulary deck,
gamification. All deterministic — no LLM anywhere in the games."""

import random
import re
from datetime import date

from src import srs
from src.game import BADGES, record_activity, stats_line
from src.knowledge import categories
from src.quiz import (
    check_answer,
    check_word,
    cloze,
    geology_bank,
    grammar_bank,
    grammar_items_for,
    meaning_options,
    vocab_bank,
    vocab_items_for,
)

TODAY = date(2026, 8, 13)


def _profile(**overrides) -> dict:
    base = {"learner_id": "t", "level": "B1", "weak_points": [],
            "error_counts": {}, "xp": 0, "streak_days": 0,
            "last_active_date": None, "badges": [],
            "quiz_correct": 0, "vocab_correct": 0}
    base.update(overrides)
    return base


# ── SRS ──────────────────────────────────────────────────────────────

def test_correct_answers_space_out():
    store = {}
    rec = srs.review(store, "g1", True, TODAY)
    assert rec["interval"] == 1
    rec = srs.review(store, "g1", True, TODAY)
    assert rec["interval"] == 3
    rec = srs.review(store, "g1", True, TODAY)
    assert rec["interval"] > 3  # interval * ease


def test_wrong_answer_resets_and_returns_today():
    store = {}
    srs.review(store, "g1", True, TODAY)
    srs.review(store, "g1", True, TODAY)
    rec = srs.review(store, "g1", False, TODAY)
    assert rec["interval"] == 0
    assert rec["due"] == TODAY.isoformat()
    assert rec["ease"] < 2.5


def test_ease_never_below_floor():
    store = {}
    for _ in range(20):
        srs.review(store, "g1", False, TODAY)
    assert store["g1"]["ease"] == srs.MIN_EASE


def test_session_prefers_due_then_introduces_new():
    store = {}
    srs.review(store, "a", False, TODAY)          # due today
    srs.review(store, "b", True, TODAY)           # due tomorrow
    ids = ["a", "b", "c", "d", "e", "f", "g"]
    session = srs.pick_session(store, ids, 4, TODAY)
    assert session[0] == "a"                      # overdue first
    assert "b" not in session[:1]
    new_items = [i for i in session if i not in ("a", "b")]
    assert 0 < len(new_items) <= srs.NEW_PER_SESSION


def test_store_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGSH_DATA_DIR", str(tmp_path))
    store = {}
    srs.review(store, "g1", True, TODAY)
    srs.save_store("t", "grammar", store)
    assert srs.load_store("t", "grammar") == store


# ── grammar game bank ────────────────────────────────────────────────

def test_grammar_bank_excludes_professional_and_covers_categories():
    bank = grammar_bank()
    assert len(bank) >= 90
    assert all("Mt" not in q["prompt"] for q in bank)      # §CC items are out
    covered = {q["category"] for q in bank}
    assert covered == set(categories().keys())  # the game covers all 24 systems


def test_weak_categories_come_first():
    profile = _profile(weak_points=["punctuation"])
    items = grammar_items_for(profile)
    assert items[0]["category"] == "punctuation"


def test_check_answer_normalises_but_stays_strict():
    assert check_answer("I am a geologist.", "I am a geologist.")
    assert check_answer("I am a geologist", "I am a geologist.")   # final stop forgiven
    assert check_answer("I  am a geologist.", "I am a geologist.")
    assert check_answer("It’s ready.", "It's ready.")              # curly quote
    assert not check_answer("I am geologist.", "I am a geologist.")
    assert not check_answer("i am a geologist.", "I am a geologist.")  # caps matter


# ── vocabulary deck ──────────────────────────────────────────────────

def test_every_word_is_complete_and_stress_marked():
    for w in vocab_bank() + geology_bank():
        for field in ("word", "stress", "gloss_en", "gloss_mn", "example",
                      "deck", "level"):
            assert w.get(field), f"{w.get('word')} missing {field}"
        assert re.search(r"[A-Z]", w["stress"]), \
            f"{w['word']}: stress must mark the stressed syllable"
        assert re.search(re.escape(w["word"]), w["example"], re.IGNORECASE), \
            f"{w['word']}: example must contain the word (cloze depends on it)"


def test_general_deck_is_a_level_ladder():
    # the basic app is for everyone: general words only, 30 per level
    by_level = {}
    for w in vocab_bank():
        assert w["deck"] == "general", f"{w['word']}: professional word in core deck"
        by_level.setdefault(w["level"], []).append(w["word"])
    assert set(by_level) == {"A1", "A2", "B1", "B2"}
    for level, words in by_level.items():
        assert len(words) == 30, f"{level} has {len(words)} words, expected 30"


def test_geology_deck_only_joins_for_geology_domain():
    everyone = vocab_items_for(_profile())
    assert all(w["deck"] == "general" for w in everyone)
    geologist = vocab_items_for(_profile(domain="geology and mining"))
    assert any(w["deck"] == "geology" for w in geologist)


def test_cloze_blanks_the_word():
    w = next(x for x in vocab_bank() if x["word"] == "decision")
    blanked = cloze(w)
    assert "_____" in blanked
    assert "decision" not in blanked.lower()


def test_meaning_options_contain_answer_once():
    rng = random.Random(42)
    w = vocab_bank()[0]
    options = meaning_options(w, rng=rng)
    assert options.count(w["gloss_en"]) == 1
    assert len(options) == 4
    assert len(set(options)) == 4


def test_check_word_is_case_insensitive():
    assert check_word("Deposit", "deposit")
    assert not check_word("deposits", "deposit")


# ── gamification ─────────────────────────────────────────────────────

def test_xp_and_counters_accumulate():
    profile = _profile()
    record_activity(profile, 10, TODAY, counters={"quiz_correct": 1})
    record_activity(profile, 5, TODAY)
    assert profile["xp"] == 15
    assert profile["quiz_correct"] == 1


def test_streak_grows_on_consecutive_days_and_resets_after_gap():
    profile = _profile()
    record_activity(profile, 1, date(2026, 8, 10))
    record_activity(profile, 1, date(2026, 8, 11))
    record_activity(profile, 1, date(2026, 8, 11))  # same day: no double count
    record_activity(profile, 1, date(2026, 8, 12))
    assert profile["streak_days"] == 3
    record_activity(profile, 1, date(2026, 8, 20))  # gap
    assert profile["streak_days"] == 1


def test_badges_awarded_once():
    profile = _profile()
    new = record_activity(profile, 100, TODAY)
    ids = {b["id"] for b in new}
    assert {"first_step", "xp_100"} <= ids
    again = record_activity(profile, 1, TODAY)
    assert not {b["id"] for b in again} & ids


def test_badge_predicates_all_callable():
    profile = _profile(xp=10_000, streak_days=100, quiz_correct=999,
                       vocab_correct=999, entries_count=99,
                       last_active_date=TODAY.isoformat())
    record_activity(profile, 0, TODAY)
    assert len(profile["badges"]) == len(BADGES)
    assert "Badges" in stats_line(profile)


def test_journal_pipeline_awards_xp(stub_llm):
    from src.graph import build_graph
    graph = build_graph()
    result = graph.invoke({
        "entry_id": "e1", "text": "Today I worked hard at the site office.",
        "learner": _profile(entries_count=0, error_recurrence={},
                            category_entries={}, fossilised=[],
                            accuracy_history=[], lessons_done=[]),
    })
    assert result["learner"]["xp"] >= 15
    assert result["learner"]["streak_days"] == 1
