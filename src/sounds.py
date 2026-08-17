"""How English letters sound — the spelling→sound tables (ADR-0012).

`knowledge/contrastive-guide.md` §1.5–1.7 already covers word stress, the six
consonant enemies and the vowel contrasts. It covers them in English, and in
the sound→mouth direction: *how do I make /θ/*. That is the right direction for
a speaking lesson and the wrong one for a reader, whose question is the other
way round — *I can see `ea`, what sound is that?*

These tables are that direction, with a Mongolian approximation for each sound,
which is the part a learner cannot get from an English-only book and the part
this repo could not write without a native speaker. `mongolian_verified` says
whether one has read it yet; the app shows a notice while it is false.

Nothing here is scheduled. The app is text-only by design, it cannot hear the
learner, and a pronunciation deck it cannot mark would be a deck of guesses.
Showing is the most it can honestly do — see the ADR.
"""

from __future__ import annotations

import re
from functools import lru_cache

import yaml

from .knowledge import KNOWLEDGE_DIR


@lru_cache(maxsize=1)
def load_sounds() -> dict:
    with open(KNOWLEDGE_DIR / "sounds.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def verified() -> bool:
    """Has a native speaker checked the Cyrillic yet?"""
    return bool(load_sounds().get("mongolian_verified"))


def groups() -> list[dict]:
    """Every sound, in the order the file lists them, tagged with its section
    so one loop can render the whole page."""
    data = load_sounds()
    out = []
    for section in ("vowels", "consonants", "endings"):
        for entry in data.get(section) or []:
            out.append({**entry, "section": section})
    return out


def matches(pattern: str, word: str) -> bool:
    """Does this word really use this spelling pattern?

    `e_e` is the split-digraph notation: `a_e` matches `late` and `make` —
    a vowel, one consonant, then a silent e. Everything else is a plain
    substring, which is what a learner scanning a word is doing.
    """
    word = word.lower()
    if "_" in pattern:
        first, last = pattern.split("_", 1)
        return bool(re.search(f"{re.escape(first)}[a-z]{{1,2}}{re.escape(last)}\\b", word))
    return pattern.lower() in word


def spelling_examples() -> list[tuple[str, str, str]]:
    """(sound id, pattern, word) for the spelling tables — every one of these
    must really contain its pattern, and a test says so."""
    return [(group["id"], spelling["pattern"], word)
            for group in groups()
            for spelling in group.get("spellings") or []
            for word in spelling["examples"]]


def ending_examples() -> list[tuple[str, str, str]]:
    """(sound id, sound, word) for the -ed and -s tables. These are keyed by
    the SOUND the ending makes, not by a spelling, so the pattern check does
    not apply — `worked` does not contain "/t/"."""
    return [(group["id"], rule["sound"], word)
            for group in groups()
            for rule in group.get("rules") or []
            for word in rule["examples"]]


def all_examples() -> list[tuple[str, str, str]]:
    return spelling_examples() + ending_examples()


def minimal_pairs() -> list[tuple[str, str, str]]:
    """(sound id, word, word) for every contrast — the pairs that decide
    whether two English sounds have collapsed into one Mongolian one."""
    out = []
    for group in groups():
        contrast = group.get("contrast")
        if not contrast:
            continue
        for first, second in contrast.get("pairs") or []:
            out.append((group["id"], first, second))
    return out


def mongolian_strings() -> list[tuple[str, str, str]]:
    """(sound id, field, text) for everything a native speaker has to check.
    Printed by `python -m src.play sounds --review` so the job is a list, not
    a hunt through a YAML file."""
    out = []
    for group in groups():
        for field in ("cy", "hint"):
            if group.get(field):
                out.append((group["id"], field, group[field]))
        contrast = group.get("contrast") or {}
        if contrast.get("cy"):
            out.append((group["id"], "contrast.cy", contrast["cy"]))
        for rule in group.get("rules") or []:
            if rule.get("cy"):
                out.append((group["id"], f"rules[{rule['sound']}].cy", rule["cy"]))
    return out


def summary() -> dict:
    data = load_sounds()
    return {
        "vowels": len(data.get("vowels") or []),
        "consonants": len(data.get("consonants") or []),
        "endings": len(data.get("endings") or []),
        "examples": len(all_examples()),
        "spellings": len(spelling_examples()),
        "pairs": len(minimal_pairs()),
        "mongolian_strings": len(mongolian_strings()),
        "verified": verified(),
    }
