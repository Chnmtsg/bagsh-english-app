"""One place to ask "what does this word mean?" (ADR-0010).

The study list used to answer that question with "look it up in a dictionary".
An app that can tell a learner a word is missing from their vocabulary, and
then cannot tell them what it means, is doing half a job — especially offline,
where there is no dictionary to look it up in.

Four sources, richest first:

1. `knowledge/vocabulary.yaml` — a full card: stress, English gloss, Mongolian
   gloss, example sentence.
2. `knowledge/readings.yaml` — the gloss a text already carries for the word.
3. `knowledge/glosses/*.yaml` — plain-English definitions for the frequency
   bands, which is what this ADR added.
4. The same three again through `reading.stems`, so `workers` finds `worker`
   finds `work`, and the answer says which word it found.

No Mongolian is ever written here. Where a word is already a deck card its
Mongolian comes along; where it is not, the gloss is English-in-English, which
is what ADR-0009 settled for the reading glosses and for the same reason: every
Mongolian string in this repo still needs a native speaker to check it.
"""

from __future__ import annotations

from functools import lru_cache

import yaml

from .knowledge import KNOWLEDGE_DIR
from .reading import stems

GLOSS_DIR = KNOWLEDGE_DIR / "glosses"


@lru_cache(maxsize=1)
def load_glosses() -> dict[str, str]:
    """Every plain-English gloss, merged. An easier band wins a duplicate:
    the A1 wording is the one a struggling learner should see."""
    out: dict[str, str] = {}
    for path in sorted(GLOSS_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        for word, gloss in (data.get("words") or {}).items():
            out.setdefault(str(word).lower(), str(gloss))
    return out


@lru_cache(maxsize=1)
def _deck() -> dict[str, dict]:
    from .quiz import geology_bank, vocab_bank
    return {w["word"].lower(): w for w in list(vocab_bank()) + list(geology_bank())}


@lru_cache(maxsize=1)
def _reading_glosses() -> dict[str, str]:
    from .reading import load_readings
    out: dict[str, str] = {}
    for text in load_readings():
        for word, gloss in (text.get("glosses") or {}).items():
            out.setdefault(word.lower(), gloss)
    return out


def _entry(word: str, found: str) -> dict | None:
    """Build the answer for `word`, where `found` is the form that matched."""
    card = _deck().get(found)
    if card:
        entry = {
            "word": word, "base": found,
            "gloss_en": card["gloss_en"], "gloss_mn": card.get("gloss_mn", ""),
            "stress": card.get("stress", ""), "example": card.get("example", ""),
            "source": "deck",
        }
    elif found in _reading_glosses():
        entry = {"word": word, "base": found,
                 "gloss_en": _reading_glosses()[found], "source": "reading"}
    elif found in load_glosses():
        entry = {"word": word, "base": found,
                 "gloss_en": load_glosses()[found], "source": "glossary"}
    else:
        return None
    if entry["base"] == word:
        entry.pop("base")
    return entry


def explain(word: str) -> dict | None:
    """What this word means, or None if nothing in the repo knows it."""
    lowered = (word or "").strip().lower()
    if not lowered:
        return None
    for form in stems(lowered):          # the word itself is stems()[0]
        entry = _entry(lowered, form)
        if entry:
            return entry
    return None


def explain_all(words: list[str]) -> dict[str, dict]:
    """Glosses for a whole list, skipping what nothing knows."""
    out = {}
    for word in words:
        entry = explain(word)
        if entry:
            out[word.lower()] = entry
    return out


def coverage_of(words: list[str]) -> dict:
    """How much of a word list this app can actually explain — the number that
    decides whether the study list is useful or is sending people to a
    dictionary they do not have."""
    known = [w for w in words if explain(w)]
    return {
        "words": len(words),
        "explained": len(known),
        "missing": sorted(set(w for w in words if not explain(w))),
        "pct": round(100 * len(known) / len(words)) if words else 0,
    }
