from src.knowledge import categories, load_taxonomy

REQUIRED_FIELDS = {"family", "blocking", "frequency", "priority",
                   "rule_a2", "rule_b1", "bridge", "guide_ref", "example"}


def test_taxonomy_has_24_categories():
    assert len(categories()) == 24


def test_every_category_is_complete():
    for name, cat in categories().items():
        missing = REQUIRED_FIELDS - set(cat)
        assert not missing, f"{name} missing {missing}"
        assert cat["blocking"] in ("high", "medium", "low")


def test_priorities_are_unique_and_dense():
    priorities = sorted(c["priority"] for c in categories().values())
    assert priorities == list(range(1, 25))


def test_professional_content_is_excluded():
    excluded = load_taxonomy()["excluded_from_journal_app"]
    assert "pronunciation" in excluded
    assert "ielts_register" in excluded
