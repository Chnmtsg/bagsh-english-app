"""Quiz banks and answer checking (code, ADR-0003). All content comes from
curated YAML — a model never writes a quiz answer.
"""

from __future__ import annotations

import random
import re
import unicodedata
from functools import lru_cache

import yaml

from .knowledge import KNOWLEDGE_DIR, categories, load_patterns
from .state import LearnerProfile


# ── grammar game ─────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def grammar_bank() -> list[dict]:
    """One question per Top-100 item (professional tier excluded): the wrong
    form is the prompt, the right form is the answer, feedback carries the
    pattern explanation plus the category's Mongolian bridge."""
    bank = []
    cats = categories()
    for p in load_patterns():
        if p.get("tier") == "professional":
            continue
        bank.append({
            "id": f"g{p['id']}",
            "category": p["category"],
            "prompt": p["wrong"],
            "answer": p["right"],
            "explanation": p.get("explanation", ""),
            "bridge": cats.get(p["category"], {}).get("bridge", ""),
        })
    # categories the checklist doesn't reach get their taxonomy example,
    # so the game covers all 24 systems
    covered = {q["category"] for q in bank}
    for name, cat in cats.items():
        example = cat.get("example", {})
        if name not in covered and example.get("wrong"):
            bank.append({
                "id": f"t_{name}",
                "category": name,
                "prompt": example["wrong"],
                "answer": example["right"],
                "explanation": cat.get("rule_a2", ""),
                "bridge": cat.get("bridge", ""),
            })
    return bank


def grammar_items_for(profile: LearnerProfile) -> list[dict]:
    """Bank ordered by the learner's need: weak categories first, then the
    curriculum's priority order."""
    cats = categories()
    weak = {name: i for i, name in enumerate(profile.get("weak_points", []))}

    def key(item: dict) -> tuple:
        return (
            weak.get(item["category"], len(weak)),
            cats.get(item["category"], {}).get("priority", 99),
            item["id"],
        )

    return sorted(grammar_bank(), key=key)


def _normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("﻿", "").replace("​", "")  # BOM/zero-width
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"\s+", " ", text).strip()
    return text


def check_answer(user: str, right: str) -> bool:
    """Exact match after whitespace/quote normalisation; a missing final
    full stop is forgiven (typing, not punctuation, is being tested there)."""
    a, b = _normalise(user), _normalise(right)
    if a == b:
        return True
    return b.endswith(".") and a == b[:-1].rstrip()


# ── vocabulary trainer ───────────────────────────────────────────────

@lru_cache(maxsize=1)
def vocab_bank() -> list[dict]:
    with open(KNOWLEDGE_DIR / "vocabulary.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["words"]


def vocab_items_for(profile: LearnerProfile) -> list[dict]:
    """Work deck first when the learner has a domain, easier levels first."""
    order = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4}
    has_domain = bool(profile.get("domain"))

    def key(w: dict) -> tuple:
        deck_rank = 0 if (w["deck"] == "work") == has_domain else 1
        return (order.get(w.get("level", "B1"), 2), deck_rank, w["word"])

    return sorted(vocab_bank(), key=key)


def cloze(word_entry: dict) -> str:
    """The example sentence with the word blanked out."""
    pattern = re.compile(re.escape(word_entry["word"]), re.IGNORECASE)
    return pattern.sub("_____", word_entry["example"], count=1)


def meaning_options(word_entry: dict, k: int = 3,
                    rng: random.Random | None = None) -> list[str]:
    """The right gloss plus k wrong glosses from other words, shuffled."""
    rng = rng or random.Random()
    pool = [w["gloss_en"] for w in vocab_bank()
            if w["word"] != word_entry["word"]]
    options = rng.sample(pool, k) + [word_entry["gloss_en"]]
    rng.shuffle(options)
    return options


def check_word(user: str, word: str) -> bool:
    return _normalise(user).lower() == _normalise(word).lower()
