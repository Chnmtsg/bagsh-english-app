"""The reading strand (code) — ADR-0009.

Nation's four strands (2007) give a quarter of a course to meaning-focused
input, and this app had none of it. Everything else here is deliberate study:
grammar drills, word cards, repairs of your own errors. None of that grows a
vocabulary past a few thousand words — 3,000 to 9,000 is a reading job
(Nation 2006), and you cannot read your way anywhere without something to read.

What makes a text *graded* is measurable, so it is measured rather than
claimed. `coverage()` computes the share of running words a learner at a given
level should already know, against two sources in the order ADR-0005 fixed:

1. `knowledge/vocabulary.yaml` — the level authority. If the deck says
   `deposit` is B1, it is B1.
2. `knowledge/cefr_wordlist.json` — a frequency ranking, coverage only. Its own
   header warns it has no entry for *bread*, *milk*, *eat* or *hungry*, so it
   can never be the only judge of whether a word is easy.
3. A closed list of function words and numbers, which belong to no band.

Hu & Nation (2000) put unassisted comprehension at 98% coverage and assisted
comprehension at about 95%. `scripts/validate_readings.py` enforces 95% and
requires every remaining word to carry a gloss, so the effective figure at the
point of reading is 100%. A text that cannot meet that is not graded, and the
build says so instead of shipping it.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache

import yaml

from .knowledge import KNOWLEDGE_DIR

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
MIN_COVERAGE = 0.95          # Hu & Nation (2000), assisted comprehension
WORDS_PER_MINUTE = 90        # a B1 reader in a second language, roughly

# Words that belong to no frequency band: grammar itself, plus the numbers and
# names a text is allowed to use freely.
FUNCTION_WORDS = {
    "a", "an", "the", "and", "but", "or", "so", "because", "if", "then",
    "that", "this", "these", "those", "there", "here", "when", "while",
    "what", "which", "who", "whom", "whose", "why", "how", "not", "no",
    "yes", "of", "in", "on", "at", "to", "from", "by", "for", "with",
    "without", "about", "into", "onto", "over", "under", "up", "down",
    "out", "off", "again", "very", "too", "also", "just", "only", "still",
    "now", "today", "tomorrow", "yesterday", "always", "never", "often",
    "sometimes", "usually", "already", "yet", "ever", "more", "most",
    "less", "least", "much", "many", "few", "some", "any", "all", "both",
    "each", "every", "other", "another", "same", "such", "than", "as",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us",
    "them", "my", "your", "his", "its", "our", "their", "mine", "yours",
    "hers", "ours", "theirs", "myself", "yourself", "himself", "herself",
    "itself", "ourselves", "themselves", "am", "is", "are", "was", "were",
    "be", "been", "being", "do", "does", "did", "done", "have", "has",
    "had", "having", "will", "would", "can", "could", "shall", "should",
    "may", "might", "must", "let", "s", "t", "re", "ll", "ve", "d", "m",
    # compounds of the above: grammar, not vocabulary
    "nobody", "somebody", "someone", "anybody", "anyone", "everybody",
    "everyone", "something", "anything", "everything", "nothing", "none",
    "somewhere", "anywhere", "everywhere", "nowhere", "cannot", "onto",
    "upon", "toward", "towards", "although", "though", "however", "instead",
    "perhaps", "maybe", "themselves", "each", "either", "neither", "whether",
    "until", "since", "during", "before", "after", "between", "through",
    "against", "around", "across", "behind", "beside", "below", "above",
    "inside", "outside", "together", "away", "back", "well", "even", "ago",
}

# Words that belong to no band because they are not vocabulary: the numbers,
# the calendar, and anything that is obviously a name.
NUMBERS = {
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million",
    "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
    "eighth", "ninth", "tenth", "half", "quarter", "once", "twice",
    "minus", "plus", "zero", "dozen", "percent",
}
CALENDAR = {
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
    "sunday", "january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november", "december",
}

# Irregular forms a suffix-stripper cannot reach. Without these, `went`,
# `said` and `told` all read as unknown vocabulary, which would make every
# past-tense text look far harder than it is.
IRREGULARS = {
    "was": "be", "were": "be", "been": "be", "am": "be", "is": "be",
    "are": "be", "went": "go", "gone": "go", "said": "say", "told": "tell",
    "made": "make", "came": "come", "took": "take", "taken": "take",
    "gave": "give", "given": "give", "got": "get", "gotten": "get",
    "knew": "know", "known": "know", "thought": "think", "brought": "bring",
    "bought": "buy", "caught": "catch", "found": "find", "heard": "hear",
    "held": "hold", "kept": "keep", "left": "leave", "lost": "lose",
    "met": "meet", "paid": "pay", "ran": "run", "saw": "see", "seen": "see",
    "sold": "sell", "sent": "send", "sat": "sit", "slept": "sleep",
    "spoke": "speak", "spoken": "speak", "spent": "spend", "stood": "stand",
    "taught": "teach", "understood": "understand", "wore": "wear",
    "worn": "wear", "won": "win", "wrote": "write", "written": "write",
    "drove": "drive", "driven": "drive", "ate": "eat", "eaten": "eat",
    "began": "begin", "begun": "begin", "broke": "break", "broken": "break",
    "chose": "choose", "chosen": "choose", "drank": "drink", "fell": "fall",
    "fallen": "fall", "felt": "feel", "forgot": "forget", "forgotten":
    "forget", "grew": "grow", "grown": "grow", "had": "have", "has": "have",
    "did": "do", "does": "do", "done": "do", "read": "read", "put": "put",
    "cut": "cut", "let": "let", "set": "set", "hurt": "hurt", "cost": "cost",
    "built": "build", "sent": "send", "meant": "mean", "lent": "lend",
    "slept": "sleep", "swam": "swim", "rose": "rise", "risen": "rise",
    "woke": "wake", "woken": "wake", "threw": "throw", "thrown": "throw",
    "flew": "fly", "flown": "fly", "children": "child", "men": "man",
    "women": "woman", "feet": "foot", "teeth": "tooth", "people": "person",
    "lives": "life", "wives": "wife", "worse": "bad", "worst": "bad",
    "better": "good", "best": "good", "further": "far", "furthest": "far",
}

_TOKEN = re.compile(r"[a-z]+(?:'[a-z]+)?")
_CAPITALISED = re.compile(r"(?<![.!?]\s)(?<!^)\b([A-Z][a-z]{2,})\b", re.M)


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def proper_nouns(text: str) -> set[str]:
    """Words capitalised mid-sentence — names of people, places, companies.
    A name is not vocabulary: a text may use `Canada` without teaching it."""
    return {word.lower() for word in _CAPITALISED.findall(text)}


def stems(word: str) -> list[str]:
    """Candidate dictionary forms, longest guess first. Deliberately crude —
    a real lemmatiser is a dependency this app does not need. Anything this
    misses simply shows up as out-of-band, where a curator sees it and either
    glosses it or rewrites the sentence."""
    out = [word]
    if word in IRREGULARS:
        out.append(IRREGULARS[word])
    if "'" in word:
        out.append(word.split("'")[0])
    rules = [
        ("ies", "y"), ("ied", "y"), ("ier", "y"), ("iest", "y"),
        ("sses", "ss"), ("shes", "sh"), ("ches", "ch"), ("xes", "x"),
        ("es", ""), ("s", ""),
        ("ing", ""), ("ing", "e"), ("ed", ""), ("ed", "e"),
        ("er", ""), ("er", "e"), ("est", ""), ("est", "e"),
        ("ly", ""), ("nning", "n"), ("tting", "t"), ("pping", "p"),
        ("gging", "g"), ("mming", "m"), ("nned", "n"), ("tted", "t"),
        ("pped", "p"), ("gged", "g"),
    ]
    for suffix, replacement in rules:
        if word.endswith(suffix) and len(word) - len(suffix) >= 2:
            out.append(word[: -len(suffix)] + replacement)
    return out


@lru_cache(maxsize=1)
def _deck_levels() -> dict[str, str]:
    from .quiz import geology_bank, vocab_bank
    levels = {}
    for entry in list(vocab_bank()) + list(geology_bank()):
        levels[entry["word"].lower()] = entry.get("level", "B1")
    return levels


@lru_cache(maxsize=1)
def _taught_levels() -> dict[str, str]:
    """Words this app has already put in front of a learner, at the band it
    put them there.

    The frequency list cannot be trusted on everyday English — it has no entry
    for *bus*, *snow* or *sister* while ranking *shall* and *county* at A2 —
    but the repo is full of curated, level-tagged English that a learner at
    that band has demonstrably met: the conversation dialogues carry a level,
    and every pattern and lesson example belongs to a category with a CEFR
    band. Using our own teaching as the coverage baseline is both more honest
    and more accurate than trusting a legal-corpus ranking.
    """
    from .knowledge import (
        cefr_bands, load_conversations, load_grammar_lessons, load_patterns,
        categories,
    )
    levels: dict[str, str] = {}

    def add(text: str, level: str) -> None:
        if level not in LEVELS:
            return
        for token in tokenize(text):
            if token not in levels or rank(level) < rank(levels[token]):
                levels[token] = level

    for dialogue in load_conversations():
        level = dialogue["level"]
        for line in dialogue["lines"]:
            add(line["en"], level)
        for phrase in dialogue.get("key_phrases", []):
            add(phrase["en"], level)

    bands = cefr_bands()
    for pattern in load_patterns():
        add(pattern["right"], bands.get(pattern.get("category", ""), "B1"))
    for name, lesson in load_grammar_lessons().items():
        band = bands.get(name, "B1")
        for example in lesson.get("extra_examples", []):
            add(example["right"], band)
    for name, category in categories().items():
        example = category.get("example", {})
        if example.get("right"):
            add(example["right"], bands.get(name, "B1"))
    return levels


@lru_cache(maxsize=1)
def _core_levels() -> dict[str, str]:
    """The everyday words a text may use unglossed at each band.

    A grading list, and *only* a grading list: it says what a text may assume,
    never what a word's level is (ADR-0005 leaves that to the deck) and never
    anything about the learner's ladder. It exists because neither the deck nor
    the frequency list knows the word *snow*, and a graded reader for Mongolian
    learners that cannot say `snow` is not worth shipping.
    """
    with open(KNOWLEDGE_DIR / "core_words.yaml", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)["levels"]
    levels: dict[str, str] = {}
    for level in LEVELS:
        for word in data.get(level, []) or []:
            # YAML 1.1 turns bare `true`, `no` and `on` into booleans, and they
            # are all real English words — str() keeps them words
            levels.setdefault(str(word).lower(), level)
    return levels


@lru_cache(maxsize=1)
def _band_levels() -> dict[str, str]:
    with open(KNOWLEDGE_DIR / "cefr_wordlist.json", encoding="utf-8") as fh:
        data = json.load(fh)
    levels: dict[str, str] = {}
    for level in LEVELS:                      # easiest band wins a duplicate
        for word in data["levels"].get(level, []):
            levels.setdefault(word.lower(), level)
    return levels


def _lookup(source: dict[str, str], word: str) -> str | None:
    """The easiest level any form of this word is listed at. Taking the first
    stem to hit instead would make `went` an A2 word — the frequency list has
    the surface form at A2 and the lemma `go` at A1."""
    found = [source[form] for form in stems(word) if form in source]
    return min(found, key=rank) if found else None


def word_level(word: str) -> str | None:
    """The level a learner needs to know this word, or None if no source knows
    of it.

    The curated deck is the authority and wins outright (ADR-0005). Everything
    else is evidence of the same kind, so the *easiest* justified level wins: a
    word taught in a B2 dialogue is not a B2 word if a frequency ranking puts
    it in the first six hundred. Taking the first source to answer instead of
    the easiest would make `read` a B2 word because of where we happened to
    teach it.
    """
    deck = _lookup(_deck_levels(), word)
    if deck is not None:
        return deck
    found = [level for level in (_lookup(_core_levels(), word),
                                 _lookup(_taught_levels(), word),
                                 _lookup(_band_levels(), word))
             if level is not None]
    return min(found, key=rank) if found else None


def rank(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else len(LEVELS)


def coverage(text: str, level: str) -> dict:
    """What share of the running words a learner at `level` already has.

    Returns the figure plus the unknown types, because the number alone is not
    actionable: a curator needs the list of words to gloss or replace.
    """
    tokens = tokenize(text)
    free = FUNCTION_WORDS | NUMBERS | CALENDAR | proper_nouns(text)
    known = 0
    unknown: dict[str, int] = {}
    for token in tokens:
        # stems too, so `fewer` counts as the function word `few`
        if any(form in free for form in stems(token)):
            known += 1
            continue
        found = word_level(token)
        if found is not None and rank(found) <= rank(level):
            known += 1
        else:
            unknown[token] = unknown.get(token, 0) + 1
    total = len(tokens) or 1
    return {
        "tokens": len(tokens),
        "known": known,
        "coverage": known / total,
        "unknown": dict(sorted(unknown.items(), key=lambda kv: (-kv[1], kv[0]))),
    }


@lru_cache(maxsize=1)
def load_readings() -> list[dict]:
    with open(KNOWLEDGE_DIR / "readings.yaml", encoding="utf-8") as fh:
        texts = yaml.safe_load(fh)["texts"]
    for text in texts:
        text["words"] = len(tokenize(text["body"]))
        text["minutes"] = max(1, round(text["words"] / WORDS_PER_MINUTE))
    return texts


def readings_for(level: str) -> list[dict]:
    """Texts at or below the learner's level, easiest last — a learner opens
    the hardest thing they can still read, not the easiest thing they can."""
    return sorted(
        (t for t in load_readings() if rank(t["level"]) <= rank(level)),
        key=lambda t: (-rank(t["level"]), t["id"]),
    )


def glossary(text: dict) -> dict[str, dict]:
    """Every glossed word in this text, plus whatever the curated deck already
    knows about it — the deck's Mongolian is reused rather than re-authored,
    because every Mongolian string in this repo still needs a native speaker to
    check it (the rule ADR-0006 set)."""
    from .quiz import vocab_bank
    deck = {w["word"].lower(): w for w in vocab_bank()}
    out: dict[str, dict] = {}
    for word, gloss in (text.get("glosses") or {}).items():
        entry = {"word": word, "gloss_en": gloss}
        card = deck.get(word.lower())
        if card:
            entry["gloss_mn"] = card.get("gloss_mn", "")
            entry["stress"] = card.get("stress", "")
            entry["in_deck"] = True
        out[word.lower()] = entry
    return out


# ── what the learner has read ────────────────────────────────────────
#
# Reading is the one strand with no scheduler: you do not review a text, you
# read the next one. So this store is a log, not a queue — how much has been
# read, and how the comprehension questions went.

PROGRESS_DECK = "reading"


def load_progress(learner_id: str) -> dict:
    from . import srs
    store = srs.load_store(learner_id, PROGRESS_DECK)
    store.setdefault("texts", {})
    store.setdefault("words_read", 0)
    return store


def save_progress(learner_id: str, store: dict) -> None:
    from . import srs
    srs.save_store(learner_id, PROGRESS_DECK, store)


def record_reading(store: dict, text: dict, correct: int, asked: int,
                   today: str) -> dict:
    row = store["texts"].setdefault(
        text["id"], {"reads": 0, "correct": 0, "asked": 0, "last": None})
    row["reads"] += 1
    row["correct"] += correct
    row["asked"] += asked
    row["last"] = today
    store["words_read"] = int(store.get("words_read", 0)) + int(text["words"])
    store.setdefault("days", {})
    store["days"][today] = store["days"].get(today, 0) + int(text["words"])
    return row


def reading_summary(store: dict) -> dict:
    texts = store.get("texts", {})
    asked = sum(t["asked"] for t in texts.values())
    correct = sum(t["correct"] for t in texts.values())
    return {
        "texts_read": len(texts),
        "words_read": int(store.get("words_read", 0)),
        "comprehension": round_pct(correct, asked),
        "library": len(load_readings()),
    }


def round_pct(part: int, whole: int) -> int | None:
    from . import srs
    return srs.round_half_up(100 * part / whole) if whole else None


def new_words(text: dict, known_words: set[str]) -> list[str]:
    """Glossed words the learner has not yet marked known — the candidates for
    'add this to my deck', which is how the input strand feeds the study one."""
    return [w for w in (text.get("glosses") or {}) if w.lower() not in known_words]
