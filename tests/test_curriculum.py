from src.curriculum import (
    category_examples,
    curriculum_map,
    curriculum_order,
    mark_lesson_done,
    next_category,
)
from src.lessons import build_lesson, format_path
from src.llm import LLMError


def _profile(**overrides) -> dict:
    base = {"learner_id": "t", "level": "B1", "entries_count": 0,
            "error_counts": {}, "error_recurrence": {}, "category_entries": {},
            "weak_points": [], "fossilised": [], "accuracy_history": [],
            "lessons_done": []}
    base.update(overrides)
    return base


def test_order_follows_taxonomy_priority():
    order = curriculum_order()
    assert len(order) == 24
    assert order[0] == "copula"       # guide §1.8: best first lesson
    assert order[1] == "word_order"
    assert order[2] == "articles"


def test_new_learner_starts_at_the_top():
    assert next_category(_profile()) == "copula"


def test_weak_categories_jump_the_queue():
    profile = _profile(weak_points=["punctuation"],
                       error_counts={"punctuation": 9})
    assert next_category(profile) == "punctuation"


def test_done_lessons_are_skipped():
    profile = _profile(lessons_done=["copula"])
    assert next_category(profile) == "word_order"


def test_all_done_falls_back_to_review():
    profile = _profile(lessons_done=curriculum_order())
    assert next_category(profile) == "copula"


def test_map_covers_all_categories_with_status():
    rows = curriculum_map(_profile(weak_points=["articles"]))
    assert len(rows) == 24
    by_cat = {r["category"]: r for r in rows}
    assert by_cat["articles"]["status"] == "weak"
    assert by_cat["copula"]["status"] == "new"


def test_examples_come_from_checklist_and_exclude_professional():
    examples = category_examples("articles")
    assert examples and all(e["wrong"] and e["right"] for e in examples)
    register = category_examples("register", limit=10)
    assert all("Mt" not in e["wrong"] for e in register)  # §CC items are professional


def test_mark_lesson_done_is_idempotent():
    profile = _profile()
    mark_lesson_done(profile, "copula")
    mark_lesson_done(profile, "copula")
    assert profile["lessons_done"] == ["copula"]


def test_build_lesson_renders_via_llm(stub_llm):
    stub_llm.overrides["lesson"] = "RENDERED LESSON"
    assert build_lesson(_profile(), "articles") == "RENDERED LESSON"
    call = next(c for c in stub_llm.calls if c["tag"] == "lesson")
    assert "аль хэдийн" in call["user"] or "ыг" in call["user"]  # bridge passed through


def test_build_lesson_degrades_to_template(stub_llm):
    stub_llm.overrides["lesson"] = LLMError("api down")
    lesson = build_lesson(_profile(), "articles")
    assert "I am a geologist." in lesson       # curated example survives
    assert "Bridge:" in lesson


def test_format_path_shows_level_and_all_rows():
    text = format_path(_profile(level="A2"))
    assert "Level: A2" in text
    assert "copula" in text and "spelling" in text
