"""End-to-end graph tests with the stub client. These verify STRUCTURE:
routing, the distress gate, the display cap — not model quality."""

import json

from src.graph import build_graph
from src.llm import LLMError


def _base_state(text: str, level: str = "B1") -> dict:
    return {
        "entry_id": "test",
        "text": text,
        "learner": {"learner_id": "test", "level": level, "entries_count": 0,
                    "error_counts": {}, "error_recurrence": {},
                    "category_entries": {}, "weak_points": [],
                    "fossilised": [], "accuracy_history": []},
    }


def test_normal_entry_produces_feedback_and_reply(stub_llm):
    graph = build_graph()
    result = graph.invoke(_base_state(
        "i am geologist. He work here. We collected three sample."))
    assert result["teacher_feedback"]
    assert result["coach_reply"]
    assert result["pattern_edits"]
    shown = [e for e in result["labelled_edits"] if e.get("displayed")]
    assert 0 < len(shown) <= 3


def test_acute_entry_skips_grammar_entirely(stub_llm):
    stub_llm.overrides["distress_classifier"] = json.dumps(
        {"risk": "acute", "signals": ["test"]})
    graph = build_graph()
    result = graph.invoke(_base_state("I am very sad about my life."))
    assert result["distress"]["risk"] == "acute"
    assert result["coach_reply"]
    # the grammar path must not have run at all
    assert "pattern_edits" not in result or not result["pattern_edits"]
    assert not result.get("teacher_feedback")
    assert not result.get("drills")
    # and the wellbeing prompt was used, not the normal coach
    assert any(c["tag"] == "coach_wellbeing" for c in stub_llm.calls)
    assert all(c["tag"] not in ("corrector", "tutor", "teacher", "drills")
               for c in stub_llm.calls)


def test_keyword_floor_forces_acute_even_if_classifier_says_none(stub_llm):
    # stub classifier answers "none"; the deterministic floor must win
    graph = build_graph()
    result = graph.invoke(_base_state("I don't want to live anymore."))
    assert result["distress"]["risk"] == "acute"
    assert not result.get("teacher_feedback")


def test_broken_english_distress_still_acute(stub_llm):
    graph = build_graph()
    result = graph.invoke(_base_state("I am too tired for living."))
    assert result["distress"]["risk"] == "acute"


def test_classifier_failure_fails_toward_safety(stub_llm):
    stub_llm.overrides["distress_classifier"] = LLMError("api down")
    graph = build_graph()
    result = graph.invoke(_base_state("Normal day at work today, all fine."))
    assert result["distress"]["risk"] == "elevated"
    # elevated still gets grammar feedback — only acute skips it
    assert result.get("teacher_feedback")


def test_coach_never_sees_grammar(stub_llm):
    graph = build_graph()
    graph.invoke(_base_state("i am geologist. He work here."))
    coach_calls = [c for c in stub_llm.calls if c["tag"] == "coach"]
    assert coach_calls
    for call in coach_calls:
        assert "edit" not in call["user"].lower()
        assert "grammar" not in call["user"].lower()
        assert "correct" not in call["user"].lower()


def test_fluency_gated_below_b1(stub_llm):
    graph = build_graph()
    result = graph.invoke(_base_state("He work here.", level="A2"))
    assert result["fluency_notes"] == []
    assert all(c["tag"] != "fluency" for c in stub_llm.calls)


def test_corrector_failure_is_visible_not_silent(stub_llm):
    stub_llm.overrides["corrector"] = LLMError("api down")
    graph = build_graph()
    result = graph.invoke(_base_state("He work here."))
    assert any("corrector_failed" in e for e in result.get("errors", []))
    # pattern edits still flow to the learner
    assert result["pattern_edits"]


def test_over_rewrite_triggers_retry_then_pattern_only(stub_llm):
    stub_llm.overrides["corrector"] = (
        "<corrected>Something completely different was written here today "
        "by another person entirely.</corrected>")
    graph = build_graph()
    result = graph.invoke(_base_state("He work here. We collected three sample."))
    corrector_calls = [c for c in stub_llm.calls if c["tag"] == "corrector"]
    assert len(corrector_calls) == 2  # one retry, then give up
    assert result["model_edits"] == []
    assert result["pattern_edits"]  # deterministic layer survives
    assert any("over_rewrite" in e for e in result.get("errors", []))


def test_teacher_llm_failure_falls_back_to_taxonomy_wording(stub_llm):
    stub_llm.overrides["teacher"] = LLMError("api down")
    graph = build_graph()
    result = graph.invoke(_base_state("He work here."))
    assert "He work" in result["teacher_feedback"]  # template fallback
