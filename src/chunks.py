"""Word partners — prepositions and collocations (ADR-0014).

The two things a Mongolian learner cannot derive from any rule, and which both
local courses spend pages on: which preposition a word takes (`depend ON`,
`interested IN`) and which verb goes with which noun (`MAKE a mistake`, `DO
homework`). There is nothing to work out. English decided, and the only way in
is to meet the whole phrase often enough.

That is also why the taxonomy marks `prepositions` and `collocation`
**untreatable** (ADR-0007): when a learner gets one wrong there is no rule to
drill them on, so the error queue shows a natural alternative instead of a
correction. Repairing an error and teaching the chunk in the first place are
different jobs, and this module is the second one.

The drill is a typed cloze over a real sentence — the phrase with one word
missing:

    It depends ___ the weather.        on
    I ___ three mistakes in the form.  made

The missing word is stored in the form the sentence uses (`made`, not `make`)
and must appear exactly once in it, so the blank can never be ambiguous.
"""

from __future__ import annotations

import re
from functools import lru_cache

import yaml

from .knowledge import KNOWLEDGE_DIR

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
BLANK = "_____"


@lru_cache(maxsize=1)
def load_chunks() -> list[dict]:
    with open(KNOWLEDGE_DIR / "chunks.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["chunks"]


def rank(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else len(LEVELS)


def occurrences(answer: str, sentence: str) -> int:
    """How many times the answer stands as a whole word in the sentence.
    Whole-word, so `on` in `on Monday` does not also match the `on` inside
    `London` — a blank the learner could fill two ways teaches nothing."""
    return len(re.findall(rf"\b{re.escape(answer)}\b", sentence, re.IGNORECASE))


def blank_out(answer: str, sentence: str) -> str:
    return re.sub(rf"\b{re.escape(answer)}\b", BLANK, sentence, count=1,
                  flags=re.IGNORECASE)


def drill_bank(profile: dict | None = None) -> list[dict]:
    level = (profile or {}).get("level", "C2")
    bank = []
    for entry in load_chunks():
        if rank(entry["level"]) > rank(level):
            continue
        bank.append({
            "id": "c_" + re.sub(r"[^a-z]+", "_", entry["chunk"].lower()).strip("_"),
            "chunk": entry["chunk"],
            "kind": entry["kind"],
            "level": entry["level"],
            "prompt": blank_out(entry["answer"], entry["example"]),
            "answer": entry["answer"],
            "example": entry["example"],
            "note": entry.get("note", ""),
        })
    return bank


@lru_cache(maxsize=1)
def by_id() -> dict[str, dict]:
    return {item["id"]: item for item in drill_bank()}


def summary() -> dict:
    chunks = load_chunks()
    kinds: dict[str, int] = {}
    levels: dict[str, int] = {}
    for entry in chunks:
        kinds[entry["kind"]] = kinds.get(entry["kind"], 0) + 1
        levels[entry["level"]] = levels.get(entry["level"], 0) + 1
    return {"chunks": len(chunks), "by_kind": kinds, "by_level": levels,
            "with_notes": sum(1 for c in chunks if c.get("note"))}
