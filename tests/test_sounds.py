"""Tests for ADR-0012 — the spelling→sound tables.

The tables make two kinds of claim. That `ea` is one of the spellings of /iː/
is a claim about English, and `see, meet, need` had better contain the letters
they are filed under. That /iː/ is close to Mongolian `ий` is a claim about
Mongolian, and no test can check it — only a native speaker can, which is what
`mongolian_verified` is for.
"""

import pytest

from src import sounds
from src.reading import _band_levels, _core_levels, _deck_levels, _taught_levels, stems

GROUPS = sounds.groups()
SPELLINGS = sounds.spelling_examples()


def _known_words() -> set[str]:
    return (set(_deck_levels()) | set(_core_levels())
            | set(_taught_levels()) | set(_band_levels()))


# ── claims about English, which are checkable ────────────────────────

@pytest.mark.parametrize("sound_id,pattern,word", SPELLINGS,
                         ids=[f"{i}:{p}:{w}" for i, p, w in SPELLINGS])
def test_every_example_contains_its_spelling(sound_id, pattern, word):
    assert sounds.matches(pattern, word), f"{word} has no '{pattern}'"


def test_the_split_digraph_notation_works():
    assert sounds.matches("a_e", "late") and sounds.matches("a_e", "make")
    assert sounds.matches("i_e", "time") and not sounds.matches("i_e", "sit")
    assert sounds.matches("o_e", "note") and not sounds.matches("o_e", "on")


def test_examples_are_mostly_words_the_app_teaches():
    """A pronunciation example must be the clearest example of the sound
    first — `sheep`/`ship` earns its place even though neither is a card. But
    if the tables drift into unfamiliar words wholesale, they stop being
    practice and become a phonetics lecture."""
    known = _known_words()
    words = {w for _, _, w in sounds.all_examples()}
    familiar = [w for w in words
                if any(s in known for s in stems(w.lower()))]
    share = len(familiar) / len(words)
    assert share >= 0.85, f"only {share:.0%} of example words are ones we teach"


def test_minimal_pairs_are_pairs():
    for sound_id, first, second in sounds.minimal_pairs():
        assert first != second, sound_id
        assert first.isalpha() and second.isalpha(), sound_id


def test_every_sound_has_an_ipa_and_a_name():
    for group in GROUPS:
        assert group.get("ipa"), group["id"]
        assert group.get("name"), group["id"]
        assert group["section"] in ("vowels", "consonants", "endings")


def test_ids_are_unique():
    ids = [g["id"] for g in GROUPS]
    assert len(set(ids)) == len(ids)


def test_the_hard_contrasts_from_the_guide_are_all_here():
    """The contrastive guide names the pairs that decide whether two English
    sounds have collapsed into one Mongolian one. If the tables lose one of
    them, a learner loses the contrast that matters most."""
    pairs = {tuple(sorted((a, b))) for _, a, b in sounds.minimal_pairs()}
    for expected in [("sheep", "ship"), ("leave", "live"), ("bad", "bed"),
                     ("think", "sink"), ("fine", "pine"), ("vest", "west")]:
        assert tuple(sorted(expected)) in pairs, expected


def test_the_endings_cover_all_three_sounds():
    endings = {g["id"]: g for g in GROUPS if g["section"] == "endings"}
    assert set(endings) == {"ed_ending", "s_ending"}
    assert {r["sound"] for r in endings["ed_ending"]["rules"]} == {"/t/", "/d/", "/ɪd/"}
    assert {r["sound"] for r in endings["s_ending"]["rules"]} == {"/s/", "/z/", "/ɪz/"}


# ── claims about Mongolian, which are not ────────────────────────────

def test_the_mongolian_is_flagged_until_somebody_checks_it():
    """This test exists to fail the day the flag is flipped without the work
    being done, and to be deleted the day it is."""
    data = sounds.load_sounds()
    assert "mongolian_verified" in data
    if not data["mongolian_verified"]:
        assert sounds.mongolian_strings(), "nothing to verify — is the file empty?"


def test_every_sound_offers_a_mongolian_foothold():
    for group in GROUPS:
        if group["section"] == "endings":
            assert all(r.get("cy") for r in group["rules"]), group["id"]
        else:
            assert group.get("cy"), f"{group['id']} has no Cyrillic"


def test_the_review_list_finds_every_cyrillic_string():
    """`play sounds --review` is how a native speaker does the job, so it must
    not miss a string."""
    listed = {text for _, _, text in sounds.mongolian_strings()}
    for group in GROUPS:
        if group.get("cy"):
            assert group["cy"] in listed, group["id"]
        if group.get("hint"):
            assert group["hint"] in listed, group["id"]


def test_cyrillic_is_actually_cyrillic():
    for sound_id, field, text in sounds.mongolian_strings():
        assert any("Ѐ" <= ch <= "ӿ" for ch in text), f"{sound_id}.{field}: {text}"


def test_english_hints_exist_wherever_a_mongolian_hint_does():
    """If the Cyrillic turns out to be wrong, the English must still carry the
    lesson. No row may depend on the unverified half."""
    for group in GROUPS:
        if group.get("hint"):
            assert group.get("hint_en"), f"{group['id']} has Mongolian but no English"
