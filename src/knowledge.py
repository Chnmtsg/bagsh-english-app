"""Loaders for the curated knowledge files. Read-only at runtime; owned by
linguistics-curator at build time."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = REPO_ROOT / "knowledge"


@lru_cache(maxsize=None)
def load_taxonomy() -> dict:
    with open(KNOWLEDGE_DIR / "error_taxonomy.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


@lru_cache(maxsize=None)
def load_patterns() -> list[dict]:
    with open(KNOWLEDGE_DIR / "top_100_patterns.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["patterns"]


def deterministic_patterns() -> list[dict]:
    return [p for p in load_patterns() if p.get("tier") == "deterministic"]


@lru_cache(maxsize=None)
def load_grammar_lessons() -> dict:
    with open(KNOWLEDGE_DIR / "grammar_lessons.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["lessons"]


@lru_cache(maxsize=None)
def load_advanced_grammar() -> list[dict]:
    """C1/C2 lesson topics — curriculum only, never error categories."""
    with open(KNOWLEDGE_DIR / "advanced_grammar.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["topics"]


@lru_cache(maxsize=None)
def load_pseudowords() -> list[str]:
    """Non-words for the Coverage Check's honesty anchor (ADR-0008). Never
    teachable content — see the header of the file for the rules."""
    with open(KNOWLEDGE_DIR / "pseudowords.yaml", encoding="utf-8") as fh:
        return list(yaml.safe_load(fh)["words"])


@lru_cache(maxsize=None)
def load_conversations() -> list[dict]:
    with open(KNOWLEDGE_DIR / "conversations.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["dialogues"]


@lru_cache(maxsize=None)
def load_crisis_resources() -> dict:
    with open(KNOWLEDGE_DIR / "crisis_resources.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def verified_crisis_resources() -> list[dict]:
    """Only human-verified entries may ever be shown to a user."""
    data = load_crisis_resources()
    return [r for r in data.get("resources", []) if r.get("verified") is True]


def categories() -> dict[str, dict]:
    return load_taxonomy()["categories"]


def cefr_bands() -> dict[str, str]:
    """Which CEFR level each grammar category belongs to (EGP-style)."""
    return load_taxonomy()["cefr_bands"]
