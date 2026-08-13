"""Spaced repetition (code): SM-2-lite scheduler (ADR-0003).

A correct answer pushes the item further into the future; a wrong answer
resets it so it comes back sooner. No hearts, no penalties — a mistake is
just information about when to ask again.

State per learner+deck lives in data/srs/<learner>_<deck>.json:
    {item_id: {"ease": 2.5, "interval": 3, "reps": 2, "due": "2026-08-16"}}
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

MIN_EASE = 1.3
MAX_EASE = 3.0
NEW_PER_SESSION = 3


def _srs_dir() -> Path:
    root = os.environ.get("BAGSH_DATA_DIR")
    base = Path(root) if root else Path(__file__).resolve().parents[1] / "data"
    return base / "srs"


def load_store(learner_id: str, deck: str) -> dict:
    path = _srs_dir() / f"{learner_id}_{deck}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_store(learner_id: str, deck: str, store: dict) -> None:
    directory = _srs_dir()
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{learner_id}_{deck}.json"
    path.write_text(json.dumps(store, indent=2), encoding="utf-8")


def review(store: dict, item_id: str, correct: bool, today: date | None = None) -> dict:
    """Fold one answer into the store. Returns the item's new record."""
    today = today or date.today()
    rec = store.get(item_id, {"ease": 2.5, "interval": 0, "reps": 0})
    if correct:
        rec["reps"] = rec.get("reps", 0) + 1
        if rec["reps"] == 1:
            rec["interval"] = 1
        elif rec["reps"] == 2:
            rec["interval"] = 3
        else:
            rec["interval"] = max(1, round(rec["interval"] * rec["ease"]))
        rec["ease"] = min(MAX_EASE, rec.get("ease", 2.5) + 0.05)
    else:
        rec["reps"] = 0
        rec["interval"] = 0  # due again today — it comes back this session
        rec["ease"] = max(MIN_EASE, rec.get("ease", 2.5) - 0.2)
    rec["due"] = (today + timedelta(days=rec["interval"])).isoformat()
    store[item_id] = rec
    return rec


def pick_session(store: dict, all_ids: list[str], n: int,
                 today: date | None = None) -> list[str]:
    """Due items first (most overdue first), then up to NEW_PER_SESSION new
    items in the given order (the caller passes ids in curriculum order)."""
    today = (today or date.today()).isoformat()
    due = sorted(
        (i for i in all_ids if i in store and store[i]["due"] <= today),
        key=lambda i: store[i]["due"],
    )
    fresh = [i for i in all_ids if i not in store]
    session = due[:n]
    room = n - len(session)
    if room > 0:
        session.extend(fresh[:min(room, NEW_PER_SESSION)])
    room = n - len(session)
    if room > 0:  # nothing else to do? pull the nearest-future items forward
        upcoming = sorted(
            (i for i in all_ids if i in store and i not in session),
            key=lambda i: store[i]["due"],
        )
        session.extend(upcoming[:room])
    return session
