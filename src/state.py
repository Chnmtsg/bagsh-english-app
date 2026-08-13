"""JournalState — the single state object flowing through the graph.

Parallel branches (tutor, fluency, coach) MUST write disjoint keys, or the
key needs an explicit reducer. `errors` and `prompt_versions` have reducers
because more than one node contributes to them.
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, Literal, TypedDict


class Edit(TypedDict, total=False):
    """One correction. Computed by matcher (source='pattern') or by
    difflib over the corrector's output (source='model') — never authored
    by a model directly."""

    source: Literal["pattern", "model"]
    original: str        # exact substring of the entry text
    corrected: str
    start: int           # char offsets into the entry text
    end: int
    category: str        # closed enum from knowledge/error_taxonomy.yaml
    severity: str        # high | medium | low
    explanation: str
    pattern_id: int      # set when source == 'pattern'
    displayed: bool      # did the teacher show this edit?


class LearnerProfile(TypedDict, total=False):
    learner_id: str
    level: str                            # A0..C1; default B1
    domain: str | None                    # e.g. "geology and mining"
    goal: str                             # default "work" (Bagsh v2 §2)
    known_words: int                      # default 3000 (Bagsh v2 §2)
    strictness: str                       # low | normal | high (Bagsh v2 §6.1)
    entries_count: int
    error_counts: dict[str, int]          # category -> lifetime count
    error_recurrence: dict[str, int]      # "category:span" -> count
    category_entries: dict[str, list[str]]  # category -> entry ids seen in
    weak_points: list[str]                # top categories by incidence
    fossilised: list[str]                 # "category:span" keys seen >= 3 entries
    accuracy_history: list[float]         # errors-per-100-words, most recent last
    lessons_done: list[str]               # curriculum categories studied
    last_entry_date: str | None
    # gamification (ADR-0003) — all computed in code
    xp: int
    streak_days: int
    last_active_date: str | None
    badges: list[str]
    quiz_correct: int
    vocab_correct: int


def _merge_dicts(a: dict | None, b: dict | None) -> dict:
    out = dict(a or {})
    out.update(b or {})
    return out


class JournalState(TypedDict, total=False):
    entry_id: str
    text: str
    learner: LearnerProfile

    triage: dict[str, Any]        # word_count, sentences, too_short, mostly_mongolian
    distress: dict[str, Any]      # {"risk": "none"|"elevated"|"acute", "signals": [...]}

    pattern_edits: list[Edit]     # matcher (code)
    corrected_text: str           # corrector (llm)
    ambiguities: list[str]        # corrector flagged rather than guessed
    model_edits: list[Edit]       # diff (code)
    verify: dict[str, Any]        # {"over_rewrite": bool, "ratio": float, "attempts": int}

    labelled_edits: list[Edit]    # tutor branch
    fluency_notes: list[dict]     # fluency branch
    coach_reply: str              # coach branch

    teacher_feedback: str
    drills: list[dict]

    errors: Annotated[list[str], operator.add]
    prompt_versions: Annotated[dict[str, str], _merge_dicts]


SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}
