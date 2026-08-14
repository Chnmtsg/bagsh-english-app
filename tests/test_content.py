"""Integrity of the expanded lesson and conversation content (curated —
these tests are what 'curated' means in practice)."""

from src.knowledge import (
    categories,
    cefr_bands,
    load_advanced_grammar,
    load_conversations,
    load_grammar_lessons,
)

LEVELS = {"A1", "A2", "B1", "B2"}
ALL_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}


def test_supplementary_grammar_completes_b1_to_c2():
    topics = load_advanced_grammar()
    by_level = {}
    for t in topics:
        assert t["cefr"] in ("B1", "B2", "C1", "C2"), t["id"]
        assert t["id"].startswith("adv_"), "supplementary ids must not collide with categories"
        assert t["id"] not in categories(), "supplementary topics are not error categories"
        assert len(t.get("explain", "")) > 100, f"{t['id']}: explain too thin"
        assert t.get("bridge") and t.get("tip"), t["id"]
        assert len(t.get("how", [])) >= 3, f"{t['id']}: needs build steps"
        assert t.get("watch_out"), f"{t['id']}: needs a watch_out"
        assert len(t.get("examples", [])) >= 2, t["id"]
        for q in t.get("quiz", []):
            assert q["wrong"] != q["right"], t["id"]
            assert q.get("explanation"), t["id"]
        by_level.setdefault(t["cefr"], []).append(t["id"])
    assert len(by_level.get("B1", [])) >= 2   # narrative tenses, gerund/infinitive
    assert len(by_level.get("B2", [])) >= 3   # deduction, wishes, causative
    assert len(by_level.get("C1", [])) >= 4
    assert len(by_level.get("C2", [])) >= 3


def test_every_category_has_a_cefr_band():
    bands = cefr_bands()
    assert set(bands.keys()) == set(categories().keys())
    assert set(bands.values()) <= LEVELS
    # every band teaches something — no empty level
    for level in LEVELS:
        assert any(b == level for b in bands.values()), f"{level} band is empty"


def test_a1_band_holds_the_foundations():
    bands = cefr_bands()
    assert bands["copula"] == "A1"
    assert bands["word_order"] == "A1"
    assert bands["reported_speech"] == "B2"


def test_grammar_lessons_cover_all_24_categories():
    lessons = load_grammar_lessons()
    assert set(lessons.keys()) == set(categories().keys())


def test_every_grammar_lesson_is_complete():
    for name, lesson in load_grammar_lessons().items():
        assert len(lesson.get("explain_b1", "")) > 100, f"{name}: explain_b1 too thin"
        assert lesson.get("explain_a2"), f"{name}: missing explain_a2"
        assert len(lesson.get("how", [])) >= 3, f"{name}: needs build steps"
        assert lesson.get("watch_out"), f"{name}: needs a watch_out"
        assert len(lesson.get("extra_examples", [])) >= 2, f"{name}: needs examples"
        for ex in lesson["extra_examples"]:
            assert ex.get("wrong") and ex.get("right"), f"{name}: bad example"
        assert lesson.get("tip"), f"{name}: missing tip"


def test_dialogues_are_complete_and_leveled():
    dialogues = load_conversations()
    assert len(dialogues) >= 18
    ids = [d["id"] for d in dialogues]
    assert len(ids) == len(set(ids))
    for d in dialogues:
        assert d["level"] in ALL_LEVELS, f"{d['id']}: bad level"
        assert d.get("title_en") and d.get("title_mn") and d.get("situation")
        assert len(d["lines"]) >= 4, f"{d['id']}: dialogue too short"
        for line in d["lines"]:
            assert line["sp"] in ("A", "B")
            assert line.get("en") and line.get("mn"), f"{d['id']}: line missing en/mn"
        assert len(d.get("key_phrases", [])) >= 2
        practice = d["practice"]
        assert practice.get("situation")
        corrects = [o for o in practice["options"] if o.get("correct")]
        assert len(corrects) == 1, f"{d['id']}: exactly one correct option required"
        for option in practice["options"]:
            assert option.get("why"), f"{d['id']}: every option needs a 'why'"


def test_dialogue_levels_span_all_bands():
    levels = {d["level"] for d in load_conversations()}
    assert ALL_LEVELS <= levels  # every level A1–C2 has talks
