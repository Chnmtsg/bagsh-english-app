"""Unit tests for the deterministic nodes: triage, matcher, diff, verify,
memory, and the teacher's selection logic."""

from src.nodes.diff import diff
from src.nodes.matcher import matcher
from src.nodes.memory import memory
from src.nodes.teacher import select_edits
from src.nodes.triage import triage
from src.nodes.verify import verify
from src.state import Edit


# ── triage ───────────────────────────────────────────────────────────

def test_triage_counts_and_flags():
    out = triage({"text": "Tired today."})
    assert out["triage"]["word_count"] == 2
    assert out["triage"]["too_short"] is True


def test_triage_detects_mongolian():
    out = triage({"text": "Өнөөдөр би маш их ажилласан бөгөөд ядарсан байна."})
    assert out["triage"]["mostly_mongolian"] is True


def test_triage_mixed_entry_is_not_mostly_mongolian():
    out = triage({"text": "Today I went to уулзалт with my boss and we talked."})
    assert out["triage"]["mostly_mongolian"] is False


# ── matcher ──────────────────────────────────────────────────────────

def test_matcher_fires_on_known_errors():
    text = "i am geologist. He work here. We collected three sample. She don't know."
    edits = matcher({"text": text})["pattern_edits"]
    fired = {e["pattern_id"] for e in edits}
    assert {79, 23, 13, 24} <= fired
    for e in edits:
        assert e["source"] == "pattern"
        assert text[e["start"]:e["end"]] == e["original"]
        assert e["category"]
        assert e["explanation"]


def test_matcher_silent_on_correct_english():
    text = ("Yesterday I went to the site with my colleagues. "
            "We collected three samples and the weather was good.")
    assert matcher({"text": text})["pattern_edits"] == []


def test_matcher_leaves_mongolian_alone():
    text = "Today I went to уулзалт with my boss."
    assert matcher({"text": text})["pattern_edits"] == []


# ── diff ─────────────────────────────────────────────────────────────

def test_diff_produces_model_edits():
    state = {
        "text": "I am geologist and I like my job.",
        "corrected_text": "I am a geologist and I like my job.",
        "pattern_edits": [],
    }
    edits = diff(state)["model_edits"]
    assert len(edits) == 1
    assert edits[0]["source"] == "model"
    assert "a" in edits[0]["corrected"]


def test_diff_identical_text_no_edits():
    state = {"text": "All good here.", "corrected_text": "All good here.",
             "pattern_edits": []}
    assert diff(state)["model_edits"] == []


def test_diff_skips_spans_owned_by_patterns():
    text = "He work here."
    state = {
        "text": text,
        "corrected_text": "He works here.",
        "pattern_edits": [Edit(source="pattern", original="He work",
                               start=0, end=7, corrected="He works")],
    }
    assert diff(state)["model_edits"] == []


# ── verify ───────────────────────────────────────────────────────────

def test_verify_flags_over_rewrite():
    state = {
        "text": "Today I go to work and see my friend there.",
        "corrected_text": "This morning the author travelled to the office.",
        "model_edits": [],
        "verify": {},
    }
    assert verify(state)["verify"]["over_rewrite"] is True


def test_verify_accepts_minimal_edit():
    state = {
        "text": "I am geologist and I like my job very much.",
        "corrected_text": "I am a geologist and I like my job very much.",
        "model_edits": [],
        "verify": {},
    }
    out = verify(state)
    assert out["verify"]["over_rewrite"] is False


def test_verify_drops_invalid_spans():
    text = "She like it."
    state = {
        "text": text,
        "corrected_text": "She likes it.",
        "model_edits": [Edit(source="model", original="NOT IN TEXT",
                             start=0, end=11, corrected="x")],
        "verify": {},
    }
    assert verify(state)["model_edits"] == []


def test_verify_gives_up_after_retry():
    state = {
        "text": "Today I go to work and see my friend there.",
        "corrected_text": "This morning the author travelled to the office.",
        "model_edits": [],
        "verify": {"attempts": 1},  # second pass
    }
    out = verify(state)
    assert out["verify"]["over_rewrite"] is False  # disarmed
    assert out["model_edits"] == []
    assert out["corrected_text"] == state["text"]
    assert out["errors"]


# ── memory ───────────────────────────────────────────────────────────

def _edit(category: str, original: str) -> Edit:
    return Edit(source="pattern", category=category, original=original,
                corrected="x", severity="low", start=0, end=1)


def test_memory_folds_counts_and_detects_fossilisation():
    profile = {"learner_id": "t1", "level": "B1", "entries_count": 0,
               "error_counts": {}, "error_recurrence": {},
               "category_entries": {}, "weak_points": [], "fossilised": [],
               "accuracy_history": []}
    state = {"entry_id": "e1", "learner": profile, "distress": {"risk": "none"},
             "triage": {"word_count": 50},
             "labelled_edits": [_edit("articles", "I am geologist")]}
    for i in range(3):
        state["entry_id"] = f"e{i}"
        state["learner"] = memory(state)["learner"]
    learner = state["learner"]
    assert learner["error_counts"]["articles"] == 3
    assert learner["fossilised"] == ["articles:i am geologist"]
    assert learner["entries_count"] == 3
    assert "articles" in learner["weak_points"]


def test_memory_skips_error_folding_on_acute():
    profile = {"learner_id": "t2", "level": "B1", "entries_count": 0,
               "error_counts": {}, "error_recurrence": {},
               "category_entries": {}, "weak_points": [], "fossilised": [],
               "accuracy_history": []}
    state = {"entry_id": "e1", "learner": profile,
             "distress": {"risk": "acute"}, "triage": {"word_count": 20},
             "labelled_edits": [_edit("articles", "x")]}
    learner = memory(state)["learner"]
    assert learner["error_counts"] == {}
    assert learner["entries_count"] == 1


# ── teacher selection ────────────────────────────────────────────────

def test_teacher_selects_at_most_three_by_severity_then_recurrence():
    edits = [
        Edit(category="articles", severity="low", start=0, original="a"),
        Edit(category="word_order", severity="high", start=5, original="b"),
        Edit(category="punctuation", severity="medium", start=10, original="c"),
        Edit(category="plurals", severity="low", start=15, original="d"),
        Edit(category="copula", severity="high", start=20, original="e"),
    ]
    profile = {"error_counts": {"articles": 30, "plurals": 2}}
    chosen = select_edits(edits, profile)
    assert len(chosen) == 3
    assert {e["category"] for e in chosen[:2]} == {"word_order", "copula"}
    assert chosen[2]["category"] == "punctuation"
