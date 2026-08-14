"""Quiz banks and answer checking (code, ADR-0003). All content comes from
curated YAML — a model never writes a quiz answer.
"""

from __future__ import annotations

import random
import re
import unicodedata
from functools import lru_cache

import yaml

from .knowledge import (
    KNOWLEDGE_DIR,
    categories,
    load_conversations,
    load_patterns,
)
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
            "also_accept": p.get("also_accept", []),
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
                "also_accept": [],
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


# Contraction ↔ full form. A learner who types "It's very cold today." has
# produced correct English; marking it wrong against "It is very cold today."
# is exactly the false correction standing rule 4 forbids. Ambiguous forms
# list every reading ("he's" is he is OR he has) — the answer is accepted if
# ANY reading of what they typed matches ANY reading of the target.
#
# This table is the single source of truth: build_webapp_data.py ships it to
# the PWA as data.contractions so the two graders cannot drift apart.
CONTRACTIONS: dict[str, list[str]] = {
    "i'm": ["i am"],
    "you're": ["you are"], "we're": ["we are"], "they're": ["they are"],
    "it's": ["it is", "it has"],
    "he's": ["he is", "he has"], "she's": ["she is", "she has"],
    "that's": ["that is"], "there's": ["there is", "there has"],
    "what's": ["what is"], "who's": ["who is"], "let's": ["let us"],
    "i've": ["i have"], "you've": ["you have"],
    "we've": ["we have"], "they've": ["they have"],
    "i'll": ["i will"], "you'll": ["you will"], "he'll": ["he will"],
    "she'll": ["she will"], "it'll": ["it will"],
    "we'll": ["we will"], "they'll": ["they will"],
    "i'd": ["i would", "i had"], "you'd": ["you would", "you had"],
    "he'd": ["he would", "he had"], "she'd": ["she would", "she had"],
    "we'd": ["we would", "we had"], "they'd": ["they would", "they had"],
    "don't": ["do not"], "doesn't": ["does not"], "didn't": ["did not"],
    "isn't": ["is not"], "aren't": ["are not"],
    "wasn't": ["was not"], "weren't": ["were not"],
    "can't": ["cannot", "can not"], "couldn't": ["could not"],
    "won't": ["will not"], "wouldn't": ["would not"],
    "shouldn't": ["should not"], "mustn't": ["must not"],
    "haven't": ["have not"], "hasn't": ["has not"], "hadn't": ["had not"],
}

_CONTRACTION_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in
                      sorted(CONTRACTIONS, key=len, reverse=True)) + r")",
    re.IGNORECASE,
)

MAX_READINGS = 12


def readings(text: str) -> set[str]:
    """Every way of writing `text` with its contractions spelled out.
    Capitalisation is preserved, so case still matters to the grader."""
    seen = {text}
    queue = [text]
    while queue and len(seen) < MAX_READINGS:
        current = queue.pop(0)
        match = _CONTRACTION_RE.search(current)
        if not match:
            continue
        head, tail = current[:match.start()], current[match.end():]
        for expansion in CONTRACTIONS[match.group(1).lower()]:
            if match.group(1)[0].isupper():
                expansion = expansion[0].upper() + expansion[1:]
            variant = head + expansion + tail
            if variant not in seen and len(seen) < MAX_READINGS:
                seen.add(variant)
                queue.append(variant)
    return seen


def check_answer(user: str, right: str,
                 also_accept: list[str] | None = None,
                 ignore_case: bool = False) -> bool:
    """True when the learner produced the target sentence, a contraction of
    it, or one of the item's documented alternative answers. A missing final
    full stop is forgiven (typing, not punctuation, is being tested there).

    Deliberately still strict about wording — accepting a second correct
    answer is right, accepting a wrong one teaches wrong English. Capitals
    matter unless `ignore_case`, which the talk drills set: a phrase blanked
    out of the middle of a line is testing the chunk, and capitalisation has
    its own taxonomy category to be tested by."""
    fold = (lambda s: s.lower()) if ignore_case else (lambda s: s)
    typed = readings(fold(_normalise(user)))
    for target in [right, *(also_accept or [])]:
        for form in readings(fold(_normalise(target))):
            if form in typed:
                return True
            if form.endswith(".") and form[:-1].rstrip() in typed:
                return True
    return False


# ── everyday conversation drills (ADR-0006) ──────────────────────────

def _phrase_stems(phrase: str) -> list[str]:
    """A key phrase like "Is there a … near here?" is a template, not a
    quotable string. Its stems are the literal fragments around the ellipsis
    and slash, longest first — those ARE quotable."""
    parts = re.split(r"…|\.\.\.|/", phrase)
    return sorted((p.strip(" ,?.!") for p in parts), key=len, reverse=True)


def _locate(phrase: str, lines: list[dict]) -> tuple[dict, int, int] | None:
    """Find the line containing this phrase (or its longest stem) and the
    exact span it occupies, so the drill's answer is always text a curator
    wrote, never something this function assembled."""
    for candidate in [phrase.strip(" …"), *_phrase_stems(phrase)]:
        if len(candidate.split()) < 2:
            continue
        for line in lines:
            at = line["en"].lower().find(candidate.lower())
            if at >= 0:
                return line, at, at + len(candidate)
    return None


@lru_cache(maxsize=1)
def talk_bank() -> list[dict]:
    """Production drills for the conversation strand.

    Two kinds, both derived in code from knowledge/conversations.yaml — no
    new content, and in particular no new Mongolian, since every Mongolian
    string in the repo still needs native-speaker verification:

    - `cloze`  — the dialogue's own Mongolian line as the cue, its English
                 line with the key phrase blanked out. The learner TYPES the
                 chunk. This is the strand's first production item.
    - `reply`  — the existing "choose the best reply" question, one attempt,
                 scored into the SRS instead of looping until right.
    """
    bank: list[dict] = []
    for dialogue in load_conversations():
        seen: set[str] = set()
        for i, phrase in enumerate(dialogue.get("key_phrases", [])):
            found = _locate(phrase["en"], dialogue["lines"])
            if not found:
                continue  # X/Y placeholder templates have no fixed form
            line, start, end = found
            answer = line["en"][start:end]
            if answer.lower() in seen:
                continue
            seen.add(answer.lower())
            bank.append({
                "id": f"tk_{dialogue['id']}_{i}",
                "dialogue": dialogue["id"],
                "level": dialogue["level"],
                "kind": "cloze",
                "situation": dialogue["situation"],
                "cue_mn": line["mn"],
                "prompt": line["en"][:start] + "_____" + line["en"][end:],
                "answer": answer,
                "note": phrase.get("note", ""),
            })
        practice = dialogue.get("practice") or {}
        if practice.get("options"):
            bank.append({
                "id": f"tk_{dialogue['id']}_reply",
                "dialogue": dialogue["id"],
                "level": dialogue["level"],
                "kind": "reply",
                "situation": practice["situation"],
                "options": practice["options"],
            })
    return bank


# ── vocabulary trainer ───────────────────────────────────────────────

@lru_cache(maxsize=1)
def vocab_bank() -> list[dict]:
    """The general deck — the basic app is for everyone."""
    with open(KNOWLEDGE_DIR / "vocabulary.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["words"]


@lru_cache(maxsize=1)
def geology_bank() -> list[dict]:
    """Optional professional deck; merged only for a geology/mining domain."""
    with open(KNOWLEDGE_DIR / "vocabulary_geology.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)["words"]


def vocab_items_for(profile: LearnerProfile) -> list[dict]:
    """Easier levels first; the geology deck joins only when the learner's
    domain asks for it."""
    order = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4}
    pool = list(vocab_bank())
    domain = (profile.get("domain") or "").lower()
    if "geolog" in domain or "mining" in domain:
        pool.extend(geology_bank())

    def key(w: dict) -> tuple:
        return (order.get(w.get("level", "B1"), 2), w["word"])

    return sorted(pool, key=key)


def cloze(word_entry: dict) -> str:
    """The example sentence with the word blanked out."""
    pattern = re.compile(re.escape(word_entry["word"]), re.IGNORECASE)
    return pattern.sub("_____", word_entry["example"], count=1)


_LEVEL_RANK = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4, "C2": 5}


def distractor_tiers(word_entry: dict, others: list[dict]) -> list[list[dict]]:
    """Candidate pools, best first. Sampling uniformly from the whole deck
    makes the round free: a B2 noun offered against "white drink from cows"
    and "this day" can be answered without knowing the word. Matching part of
    speech and level forces the learner to actually read the glosses.

    Five buckets are too thin to fill from level+pos alone (A1 verb has 3
    cards), so this degrades one constraint at a time instead of failing."""
    level, pos = word_entry.get("level"), word_entry.get("pos")

    def near(w: dict) -> bool:
        return abs(_LEVEL_RANK.get(w.get("level"), 9)
                   - _LEVEL_RANK.get(level, 9)) <= 1

    return [
        [w for w in others if w.get("level") == level and w.get("pos") == pos],
        [w for w in others if w.get("pos") == pos and near(w)],
        [w for w in others if w.get("pos") == pos],
        [w for w in others if w.get("level") == level],
        others,
    ]


def meaning_options(word_entry: dict, k: int = 3,
                    rng: random.Random | None = None) -> list[str]:
    """The right gloss plus k wrong ones, shuffled. Distractors come from the
    same part of speech and level wherever the deck can supply them."""
    rng = rng or random.Random()
    others = [w for w in vocab_bank() if w["word"] != word_entry["word"]]
    chosen: list[str] = []
    seen = {word_entry["gloss_en"]}
    for tier in distractor_tiers(word_entry, others):
        pool = [w["gloss_en"] for w in tier if w["gloss_en"] not in seen]
        rng.shuffle(pool)
        for gloss in pool:
            if len(chosen) >= k:
                break
            chosen.append(gloss)
            seen.add(gloss)
        if len(chosen) >= k:
            break
    options = chosen[:k] + [word_entry["gloss_en"]]
    rng.shuffle(options)
    return options


def check_word(user: str, word: str) -> bool:
    return _normalise(user).lower() == _normalise(word).lower()
