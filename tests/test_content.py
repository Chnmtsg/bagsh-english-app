"""Integrity of the expanded lesson and conversation content (curated —
these tests are what 'curated' means in practice)."""

from src.knowledge import categories, load_conversations, load_grammar_lessons

LEVELS = {"A1", "A2", "B1", "B2"}


def test_grammar_lessons_cover_all_24_categories():
    lessons = load_grammar_lessons()
    assert set(lessons.keys()) == set(categories().keys())


def test_every_grammar_lesson_is_complete():
    for name, lesson in load_grammar_lessons().items():
        assert len(lesson.get("explain_b1", "")) > 100, f"{name}: explain_b1 too thin"
        assert lesson.get("explain_a2"), f"{name}: missing explain_a2"
        assert len(lesson.get("extra_examples", [])) >= 2, f"{name}: needs examples"
        for ex in lesson["extra_examples"]:
            assert ex.get("wrong") and ex.get("right"), f"{name}: bad example"
        assert lesson.get("tip"), f"{name}: missing tip"


def test_dialogues_are_complete_and_leveled():
    dialogues = load_conversations()
    assert len(dialogues) >= 8
    ids = [d["id"] for d in dialogues]
    assert len(ids) == len(set(ids))
    for d in dialogues:
        assert d["level"] in LEVELS, f"{d['id']}: bad level"
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


def test_dialogue_levels_span_beginner_to_intermediate():
    levels = {d["level"] for d in load_conversations()}
    assert "A1" in levels and "B1" in levels
