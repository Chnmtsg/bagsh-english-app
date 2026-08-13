import re

from src.knowledge import categories, deterministic_patterns, load_patterns


def _compile(p):
    return re.compile(p["find"], 0 if p.get("case_sensitive") else re.IGNORECASE)


def test_ids_unique():
    ids = [p["id"] for p in load_patterns()]
    assert len(ids) == len(set(ids))


def test_all_categories_valid():
    valid = set(categories().keys())
    for p in load_patterns():
        assert p["category"] in valid, f"pattern {p['id']}: {p['category']}"


def test_deterministic_count_matches_design():
    # CLAUDE.md: "the 64 deterministic patterns run before the corrector"
    assert len(deterministic_patterns()) == 64


def test_every_deterministic_pattern_round_trips():
    for p in deterministic_patterns():
        regex = _compile(p)
        result = regex.sub(lambda m: m.expand(p["replace"]), p["wrong"])
        assert result == p["right"], (
            f"pattern {p['id']}: {p['wrong']!r} -> {result!r}, "
            f"expected {p['right']!r}"
        )


def test_no_pattern_matches_its_own_correction():
    for p in deterministic_patterns():
        assert not _compile(p).search(p["right"]), f"pattern {p['id']}"


def test_every_pattern_has_example_and_explanation():
    for p in load_patterns():
        assert p.get("wrong") and p.get("right"), f"pattern {p['id']}"
        assert p.get("explanation"), f"pattern {p['id']}"
        assert p.get("guide_ref"), f"pattern {p['id']}"
