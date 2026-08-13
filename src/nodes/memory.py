"""Memory (code): profile read → fold → write. Deterministic by design —
counts, weak-point ranking, fossilisation detection and level movement are
computed here, never asked of a model.

Distress content is deliberately NOT stored in the profile (retention).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date
from pathlib import Path

from ..game import XP, record_activity
from ..state import JournalState, LearnerProfile

logger = logging.getLogger(__name__)

FOSSILISED_THRESHOLD = 3          # category:span seen in >= 3 entries
_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"]
_PROMOTE_BELOW = 3.0              # errors per 100 words, mean of last 10
_DEMOTE_ABOVE = 15.0
_TREND_WINDOW = 10


def _data_dir() -> Path:
    root = os.environ.get("BAGSH_DATA_DIR")
    if root:
        return Path(root) / "profiles"
    return Path(__file__).resolve().parents[2] / "data" / "profiles"


def load_profile(learner_id: str) -> LearnerProfile:
    path = _data_dir() / f"{learner_id}.json"
    if path.exists():
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    # Bagsh v2 §2: defaults are applied silently — never ask the learner.
    return LearnerProfile(
        learner_id=learner_id, level="B1", goal="work", known_words=3000,
        strictness="normal", entries_count=0,
        error_counts={}, error_recurrence={}, category_entries={},
        weak_points=[], fossilised=[], accuracy_history=[],
        lessons_done=[], last_entry_date=None,
    )


def _fossil_key(category: str, original: str) -> str:
    return f"{category}:{' '.join(original.lower().split())}"


def _adjust_level(profile: LearnerProfile) -> None:
    history = profile.get("accuracy_history", [])
    if len(history) < _TREND_WINDOW:
        return
    recent = history[-_TREND_WINDOW:]
    mean = sum(recent) / len(recent)
    idx = _LEVELS.index(profile.get("level", "B1"))
    if mean < _PROMOTE_BELOW and idx < len(_LEVELS) - 1:
        profile["level"] = _LEVELS[idx + 1]
        profile["accuracy_history"] = []  # restart the trend at the new band
    elif mean > _DEMOTE_ABOVE and idx > 0:
        profile["level"] = _LEVELS[idx - 1]
        profile["accuracy_history"] = []


def memory(state: JournalState) -> dict:
    profile: LearnerProfile = dict(state.get("learner") or {})  # type: ignore[assignment]
    if not profile:
        profile = load_profile("default")

    entry_id = state.get("entry_id", "unknown")
    profile["entries_count"] = int(profile.get("entries_count", 0)) + 1
    profile["last_entry_date"] = date.today().isoformat()
    record_activity(profile, XP["journal_entry"])  # journaling feeds the streak too

    edits = state.get("labelled_edits", [])
    word_count = int(state.get("triage", {}).get("word_count", 0))

    if state.get("distress", {}).get("risk") != "acute":
        counts = dict(profile.get("error_counts", {}))
        recurrence = dict(profile.get("error_recurrence", {}))
        cat_entries = {k: list(v) for k, v in profile.get("category_entries", {}).items()}

        for edit in edits:
            category = edit.get("category") or ""
            if not category:
                continue
            counts[category] = counts.get(category, 0) + 1
            key = _fossil_key(category, edit.get("original", ""))
            recurrence[key] = recurrence.get(key, 0) + 1
            seen = cat_entries.setdefault(category, [])
            if entry_id not in seen:
                seen.append(entry_id)

        profile["error_counts"] = counts
        profile["error_recurrence"] = recurrence
        profile["category_entries"] = cat_entries
        profile["weak_points"] = [
            c for c, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:5]
        ]
        profile["fossilised"] = sorted(
            k for k, n in recurrence.items() if n >= FOSSILISED_THRESHOLD
        )
        if word_count:
            rate = 100.0 * len(edits) / word_count
            history = list(profile.get("accuracy_history", []))
            history.append(round(rate, 2))
            profile["accuracy_history"] = history[-50:]
            _adjust_level(profile)

    try:
        directory = _data_dir()
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{profile.get('learner_id', 'default')}.json"
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(profile, fh, ensure_ascii=False, indent=2)
    except OSError as exc:
        logger.error("profile write failed (continuing): %s", exc)

    return {"learner": profile}
