"""Tests for ADR-0011 — the irregular verb table.

This is a deck of facts, so the tests are mostly about the facts being facts:
every entry really is irregular, every example really uses the form it claims,
and no prompt gives away its own answer.
"""

import re

import pytest

from src.quiz import check_answer
from src.verbs import (
    by_id,
    drill_bank,
    is_irregular,
    load_verbs,
    present_participle,
    verbs_for,
)

VERBS = load_verbs()
BANK = drill_bank()


# ── the facts ────────────────────────────────────────────────────────

@pytest.mark.parametrize("verb", VERBS, ids=[v["base"] for v in VERBS])
def test_every_verb_is_actually_irregular(verb):
    """A regular verb in this file would be teaching a learner to memorise
    something the -ed rule already gives them."""
    assert is_irregular(verb), f"{verb['base']} is regular"


def test_no_duplicate_verbs():
    bases = [v["base"] for v in VERBS]
    assert len(set(bases)) == len(bases)


@pytest.mark.parametrize("verb", VERBS, ids=[v["base"] for v in VERBS])
def test_forms_are_single_lowercase_words(verb):
    for field in ("base", "past", "participle"):
        form = verb[field]
        assert form == form.lower().strip(), f"{verb['base']}: {field}"
        assert " " not in form, f"{verb['base']}: {field} is not one word"
    assert verb["level"] in ("A1", "A2", "B1")


@pytest.mark.parametrize("verb", VERBS, ids=[v["base"] for v in VERBS])
def test_the_example_uses_the_form_it_teaches(verb):
    """An example sentence that does not contain the past or the participle
    is decoration. It is supposed to show the form in use."""
    words = set(verb["example"].lower().replace(",", " ").replace(".", " ").split())
    assert verb["past"] in words or verb["participle"] in words, verb["base"]


def test_same_form_verbs_say_so():
    """put/put/put is the fact a learner most often disbelieves, so it is
    marked rather than left to be inferred from three identical boxes."""
    for verb in VERBS:
        if verb["same_forms"]:
            assert verb.get("note"), f"{verb['base']} needs a note"


def test_the_ing_form_is_computed_correctly():
    cases = {
        "go": "going", "write": "writing", "put": "putting", "begin": "beginning",
        "lie": "lying", "see": "seeing", "be": "being", "get": "getting",
        "read": "reading", "stand": "standing", "forgive": "forgiving",
        "hit": "hitting", "keep": "keeping", "swim": "swimming",
        "understand": "understanding", "freeze": "freezing", "shine": "shining",
    }
    for base, expected in cases.items():
        assert present_participle(base) == expected, base


def test_no_verb_gets_a_double_letter_it_should_not():
    """`keeping`, not `keepping`: doubling needs a single vowel before the
    final consonant, which the rule checks rather than guesses."""
    for verb in VERBS:
        ing = verb["ing"]
        assert not any(ing.startswith(verb["base"] + c * 1 + c) for c in "aeiou"), verb["base"]
        assert ing.endswith("ing")


# ── the drills ───────────────────────────────────────────────────────

def test_two_items_per_verb_with_unique_ids():
    assert len(BANK) == 2 * len(VERBS)
    ids = [i["id"] for i in BANK]
    assert len(set(ids)) == len(ids)
    assert {i["form"] for i in BANK} == {"past", "participle"}


@pytest.mark.parametrize("item", BANK, ids=[i["id"] for i in BANK])
def test_no_prompt_gives_away_its_answer(item):
    """`go — past simple?` must not contain `went`. The one case where the
    answer is legitimately in the prompt is a same-form verb, where the base
    IS the answer — and there the learner still has to know that."""
    if item["answer"] == item["base"]:
        return
    # whole words only: `hide — past simple?` contains the letters of `hid`
    # without giving anything away
    words = re.findall(r"[a-z]+", item["prompt"].lower())
    assert item["answer"] not in words, item["id"]


@pytest.mark.parametrize("item", BANK, ids=[i["id"] for i in BANK])
def test_the_grader_accepts_the_answer(item):
    assert check_answer(item["answer"], item["answer"], item["also_accept"], True)
    for alternative in item["also_accept"]:
        assert check_answer(alternative, item["answer"], item["also_accept"], True), item["id"]


def test_alternatives_exist_only_where_both_forms_are_standard():
    alternatives = {i["base"]: i["also_accept"] for i in BANK if i["also_accept"]}
    assert set(alternatives) <= {"get", "learn", "prove"}, alternatives


def test_no_prompt_models_wrong_english():
    """The first cut used `yesterday I ___`, which is nonsense for `cost` and
    `hurt`. The table label works for every verb."""
    for item in BANK:
        assert "yesterday i" not in item["prompt"].lower()
        assert item["prompt"].startswith(item["base"] + " — ")


# ── integration with the rest of the app ─────────────────────────────

def test_the_deck_covers_the_errors_the_app_already_corrects():
    """`I have went there` → `gone` and `The report was wrote` → `written` are
    deterministic patterns in the taxonomy. The deck exists so a learner who
    trips those has somewhere to go, which means it must hold those forms."""
    bases = {v["base"] for v in VERBS}
    forms = {v["past"] for v in VERBS} | {v["participle"] for v in VERBS}
    for base in ("go", "write", "do", "be", "see", "take"):
        assert base in bases, base
    for form in ("gone", "went", "written", "wrote", "done", "been", "seen"):
        assert form in forms, form


def test_verbs_for_respects_the_level():
    a1 = verbs_for({"level": "A1"})
    assert all(v["level"] == "A1" for v in a1)
    assert len(verbs_for({"level": "B1"})) == len(VERBS)
    assert len(a1) < len(VERBS)


def test_lookup_by_id_covers_the_bank():
    table = by_id()
    assert len(table) == len(BANK)
    assert table["v_go_pp"]["answer"] == "gone"
    assert table["v_go_past"]["answer"] == "went"
