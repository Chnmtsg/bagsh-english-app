"""ADR-0004: strictness display policy and the §7.3 priority rule."""

from src.nodes.memory import load_profile
from src.nodes.teacher import pattern_groups, select_edits
from src.state import Edit


def _edit(category, severity, original, start=0) -> Edit:
    return Edit(source="pattern", category=category, severity=severity,
                original=original, corrected="x", start=start, end=start + 1)


EDITS = [
    _edit("articles", "low", "I am geologist", 0),
    _edit("articles", "low", "bought car", 10),
    _edit("word_order", "high", "I the samples analysed", 20),
    _edit("punctuation", "medium", "tired, I'll", 30),
    _edit("register", "low", "I want", 40),
    _edit("plurals", "low", "three sample", 50),
]


def test_profile_defaults_include_v2_fields():
    profile = load_profile("brand_new")
    assert profile["strictness"] == "normal"
    assert profile["goal"] == "work"
    assert profile["known_words"] == 3000


def test_high_strictness_shows_everything():
    shown = select_edits(EDITS, {}, "high")
    assert len(shown) == len(EDITS)
    assert shown[0]["category"] == "word_order"  # blocking still ranks first


def test_low_strictness_shows_blocking_plus_one():
    shown = select_edits(EDITS, {}, "low")
    assert shown[0]["category"] == "word_order"
    assert len(shown) == 2


def test_normal_prefers_distinct_categories():
    shown = select_edits(EDITS, {"error_counts": {"articles": 30}}, "normal")
    assert len(shown) == 3
    cats = [e["category"] for e in shown]
    assert len(set(cats)) == 3          # one per system, not articles twice
    assert cats[0] == "word_order"      # blocking first
    assert "articles" in cats           # frequency pulls articles in next


def test_fossilised_outranks_same_blocking_level():
    profile = {
        "fossilised": ["register:i want"],
        "error_counts": {"articles": 50},
    }
    shown = select_edits(EDITS, profile, "normal")
    low_edits = [e for e in shown if e["severity"] == "low"]
    # among the low-blocking errors, the fossilised one wins despite
    # articles having far higher frequency (v2 §7.3 rule 2)
    assert low_edits[0]["category"] == "register"


def test_pattern_groups_counted_in_code():
    text = pattern_groups(EDITS)
    assert "articles ×2" in text
    assert "word_order" not in text     # singles are not a pattern