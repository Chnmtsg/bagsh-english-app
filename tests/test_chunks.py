"""Tests for ADR-0014 — word partners.

The content claim is small and checkable: the phrase is real, the blank has
exactly one answer, and the sentence teaches the phrase it says it teaches.
"""

import pytest

from src.chunks import BLANK, blank_out, by_id, drill_bank, load_chunks, occurrences
from src.quiz import check_answer

CHUNKS = load_chunks()
BANK = drill_bank()


@pytest.mark.parametrize("entry", CHUNKS, ids=[c["chunk"] for c in CHUNKS])
def test_the_blank_has_exactly_one_answer(entry):
    """If the answer appears twice in the sentence, the learner can fill the
    blank correctly and still be marked wrong — or fill it wrongly and be
    marked right. Either way the item is broken."""
    assert occurrences(entry["answer"], entry["example"]) == 1, entry["example"]


PLACEHOLDERS = {"a", "an", "the", "somebody", "something", "your"}


@pytest.mark.parametrize("entry", CHUNKS, ids=[c["chunk"] for c in CHUNKS])
def test_the_example_contains_the_phrase_it_teaches(entry):
    """A sentence that does not use the chunk is not an example of it — and
    both halves of the partnership must be there, or the sentence teaches
    nothing about which words go together.

    Inflection is expected: `make a mistake` shows up as `made three
    mistakes`, so this matches through the stemmer rather than on the
    surface."""
    from src.reading import stems, tokenize

    sentence_forms = {form for word in tokenize(entry["example"])
                      for form in stems(word)}
    for word in entry["chunk"].lower().split():
        if word in PLACEHOLDERS or not word.isalpha():
            continue   # `since 2019` — the year is an illustration, not a word
        assert any(form in sentence_forms for form in stems(word)), (
            f"{entry['chunk']}: '{word}' never appears in {entry['example']!r}")


@pytest.mark.parametrize("entry", CHUNKS, ids=[c["chunk"] for c in CHUNKS])
def test_fields_are_sane(entry):
    assert isinstance(entry["answer"], str), f"{entry['chunk']}: YAML ate the answer"
    assert entry["kind"] in ("preposition", "collocation")
    assert entry["level"] in ("A2", "B1", "B2")
    assert entry["example"].strip().endswith((".", "?"))
    assert len(entry["example"].split()) >= 4


def test_no_duplicate_chunks_or_ids():
    phrases = [c["chunk"] for c in CHUNKS]
    assert len(set(phrases)) == len(phrases)
    ids = [i["id"] for i in BANK]
    assert len(set(ids)) == len(ids)


def test_both_kinds_are_well_represented():
    kinds = {}
    for entry in CHUNKS:
        kinds[entry["kind"]] = kinds.get(entry["kind"], 0) + 1
    assert kinds["preposition"] >= 40, kinds
    assert kinds["collocation"] >= 40, kinds


def test_the_prompt_hides_the_answer():
    for item in BANK:
        assert BLANK in item["prompt"], item["id"]
        assert occurrences(item["answer"], item["prompt"]) == 0, item["id"]


def test_the_grader_accepts_the_answer():
    for item in BANK:
        assert check_answer(item["answer"], item["answer"], None, True), item["id"]


def test_blanking_is_case_insensitive_but_keeps_the_sentence():
    assert blank_out("on", "It depends on the weather.") == f"It depends {BLANK} the weather."
    # a whole-word match only: `on` must not blank the `on` inside `London`
    assert blank_out("on", "He works in London.") == "He works in London."


def test_the_make_do_trap_is_covered():
    """`do a mistake` and `make homework` are the two errors this deck exists
    for. Both partnerships must be teachable."""
    phrases = {c["chunk"] for c in CHUNKS}
    assert "make a mistake" in phrases
    assert "do homework" in phrases


def test_the_hardest_prepositions_are_covered():
    phrases = {c["chunk"] for c in CHUNKS}
    for phrase in ("depend on", "interested in", "good at", "married to",
                   "arrive at", "listen to", "explain to"):
        assert phrase in phrases, phrase


def test_lookup_by_id_matches_the_bank():
    table = by_id()
    assert len(table) == len(BANK)
    assert table["c_depend_on"]["answer"] == "on"


def test_level_filtering_narrows_the_bank():
    a2 = drill_bank({"level": "A2"})
    assert all(i["level"] == "A2" for i in a2)
    assert 0 < len(a2) < len(BANK)
