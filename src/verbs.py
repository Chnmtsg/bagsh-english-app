"""Irregular verbs — the four-form table (ADR-0011).

The app has corrected `I have went there` since the first commit: `verb_form`
is a taxonomy category with ten deterministic patterns behind it. What it never
did was teach the forms. A learner could be told they were wrong indefinitely
without ever meeting the table that would fix it.

Both courses Mongolian learners actually use drill that table in every lesson,
which is the evidence this is worth building. The forms themselves are facts;
nothing here is copied from either book.

Two drills per verb, both typed, both production:

    go  —  past simple?              went
    go  —  past participle (have …)?  gone

The cue is the table label rather than a sentence frame. "yesterday I ___"
reads naturally for `go` and produces nonsense for `cost` and `hurt`, and a
prompt that models wrong English is exactly what standing rule 4 forbids.

The present participle is computed, not stored: it is regular for every
irregular verb in English, so storing it would only add a column to get wrong.
"""

from __future__ import annotations

import re
from functools import lru_cache

import yaml

from .knowledge import KNOWLEDGE_DIR

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

# Consonant-doubling before -ing needs the vowel-consonant test, not a list.
_VOWELS = set("aeiou")
_NEVER_DOUBLE = set("wxy")
# The handful where the general rules do not predict the -ing form.
_ING_EXCEPTIONS = {
    "be": "being", "see": "seeing", "flee": "fleeing", "free": "freeing",
    "lie": "lying", "die": "dying", "tie": "tying",
    "begin": "beginning", "forget": "forgetting", "sit": "sitting",
    "run": "running", "put": "putting", "cut": "cutting", "get": "getting",
    "set": "setting", "hit": "hitting", "shut": "shutting", "quit": "quitting",
    "split": "splitting", "spit": "spitting", "stop": "stopping",
    "swim": "swimming", "win": "winning", "dig": "digging",
    "forgive": "forgiving", "travel": "travelling",
}


def present_participle(base: str) -> str:
    """The -ing form. Regular for every verb in the table, but 'regular' still
    means three rules and a short exception list."""
    if base in _ING_EXCEPTIONS:
        return _ING_EXCEPTIONS[base]
    if base.endswith("ie"):
        return base[:-2] + "ying"
    if base.endswith("e") and not base.endswith("ee"):
        return base[:-1] + "ing"
    # one syllable, ends consonant-vowel-consonant → double the last letter
    if (len(base) >= 3 and base[-1] not in _VOWELS and base[-1] not in _NEVER_DOUBLE
            and base[-2] in _VOWELS and base[-3] not in _VOWELS
            and len(re.findall(r"[aeiouy]+", base)) == 1):
        return base + base[-1] + "ing"
    return base + "ing"


@lru_cache(maxsize=1)
def load_verbs() -> list[dict]:
    with open(KNOWLEDGE_DIR / "irregular_verbs.yaml", encoding="utf-8") as fh:
        verbs = yaml.safe_load(fh)["verbs"]
    for verb in verbs:
        verb["ing"] = present_participle(verb["base"])
        verb["same_forms"] = verb["base"] == verb["past"] == verb["participle"]
    return verbs


def rank(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else len(LEVELS)


def verbs_for(profile: dict) -> list[dict]:
    """Verbs at or below the learner's level, commonest first — the file is
    written in rough frequency order within each band."""
    level = profile.get("level", "B1")
    return [v for v in load_verbs() if rank(v["level"]) <= rank(level)]


def drill_bank(profile: dict | None = None) -> list[dict]:
    """Two items per verb. The cue is the base form plus a frame, because a
    bare "go → ?" does not say which of the two forms is wanted, and the frame
    is how the form is actually used: `I have ___` selects the participle."""
    verbs = verbs_for(profile or {}) if profile else load_verbs()
    bank: list[dict] = []
    for verb in verbs:
        bank.append({
            "id": f"v_{verb['base']}_past",
            "base": verb["base"],
            "form": "past",
            "prompt": f"{verb['base']} — past simple?",
            "answer": verb["past"],
            "also_accept": list(verb.get("also_past", [])),
            "level": verb["level"],
            "example": verb["example"],
            "note": verb.get("note", ""),
            "same_forms": verb["same_forms"],
        })
        bank.append({
            "id": f"v_{verb['base']}_pp",
            "base": verb["base"],
            "form": "participle",
            "prompt": f"{verb['base']} — past participle (have …)?",
            "answer": verb["participle"],
            "also_accept": list(verb.get("also_participle", [])),
            "level": verb["level"],
            "example": verb["example"],
            "note": verb.get("note", ""),
            "same_forms": verb["same_forms"],
        })
    return bank


@lru_cache(maxsize=1)
def by_id() -> dict[str, dict]:
    return {item["id"]: item for item in drill_bank()}


def is_irregular(verb: dict) -> bool:
    """A verb belongs in this file only if the -ed rule would get it wrong."""
    base = verb["base"]
    regular = base + "d" if base.endswith("e") else base + "ed"
    if base.endswith("y") and len(base) > 2 and base[-2] not in _VOWELS:
        regular = base[:-1] + "ied"
    return not (verb["past"] == regular and verb["participle"] == regular)


def summary() -> dict:
    verbs = load_verbs()
    by_level: dict[str, int] = {}
    for verb in verbs:
        by_level[verb["level"]] = by_level.get(verb["level"], 0) + 1
    return {
        "verbs": len(verbs),
        "items": len(drill_bank()),
        "by_level": by_level,
        "same_forms": sum(1 for v in verbs if v["same_forms"]),
    }
