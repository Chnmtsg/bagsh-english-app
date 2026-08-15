"""Spaced repetition (code): criterion scheduler (ADR-0003, revised by
ADR-0007).

Two things separate this from the SM-2-lite it replaces, both from
`docs/learning-engine.md` §2/§13a:

**Mastery is a criterion, not an answer.** An item is known after
MASTERY_STREAK correct answers on *different days* — successive relearning
(Rawson & Dunlosky 2011), not one lucky guess. Two correct answers on the
same day advance `reps`, but only the first advances the criterion: the
second is massed practice against something still in working memory.

**A lapse enters relearning; it does not erase the item.** The interval drops
to 0 so the item comes back today, but `ease`, `days` and `lapses` survive.
After LEECH_LAPSES failures the item stops being scheduled at all — repeatedly
failing an item is not a desirable difficulty, it is evidence the knowledge
isn't there, and the answer to that is the lesson, not another quiz.

State per learner+deck lives in data/srs/<learner>_<deck>.json:
    {item_id: {"ease": 2.5, "interval": 3, "reps": 2, "streak": 2,
               "days": ["2026-08-12", "2026-08-14"], "lapses": 0,
               "due": "2026-08-16"}}
Older stores need no migration — every new field defaults on first touch.

Mirrored in webapp/app.js (srsReview / srsPick / srsMastered); the parity
harness in tests/grader_parity.js runs both against the same cases.
"""

from __future__ import annotations

import json
import math
import os
from datetime import date, timedelta
from pathlib import Path

MIN_EASE = 1.3
MAX_EASE = 3.0
NEW_PER_SESSION = 3
NEW_WHEN_IDLE = 6       # day one has no reviews to do — meet more, not three
MASTERY_STREAK = 3      # correct answers, on that many distinct days
LEECH_LAPSES = 4        # failures before an item is pulled out of rotation
BACKLOG_CAP = 30        # due items above which no new material is served
FUZZ_FROM = 7           # intervals shorter than this are left alone
FUZZ = 0.15             # ±15%, deterministic per item


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


def round_half_up(value: float) -> int:
    """Round half UP, which is what JS `Math.round` does. Python's built-in
    `round` rounds half to even (2.5 -> 2), so any number that lands exactly on
    .5 would come out one apart in the two implementations. Rare, and exactly
    the kind of drift the parity harness exists to prevent — so every number
    the learner sees from both sides goes through this."""
    return math.floor(value + 0.5)


def _hash(text: str) -> int:
    """Small deterministic string hash. Python's own hash() is salted per
    process and JS has none, so both sides implement this one."""
    h = 0
    for ch in text:
        h = (h * 31 + ord(ch)) % 1000003
    return h


def _fuzzed(interval: int, item_id: str) -> int:
    """Spread a cohort learned on the same day so it does not come back on the
    same day forever. Deterministic, so Python and JS agree."""
    if interval < FUZZ_FROM:
        return interval
    offset = ((_hash(item_id) % 21) - 10) / 10.0   # -1.0 .. 1.0
    return max(1, interval + round_half_up(interval * FUZZ * offset))


def mastered(rec: dict | None) -> bool:
    """Criterion reached: MASTERY_STREAK correct answers on distinct days."""
    return bool(rec) and rec.get("streak", 0) >= MASTERY_STREAK


def is_leech(rec: dict | None) -> bool:
    return bool(rec) and rec.get("lapses", 0) >= LEECH_LAPSES


def review(store: dict, item_id: str, correct: bool, today: date | None = None) -> dict:
    """Fold one answer into the store. Returns the item's new record."""
    today = today or date.today()
    stamp = today.isoformat()
    rec = store.get(item_id, {"ease": 2.5, "interval": 0, "reps": 0})
    rec.setdefault("streak", 0)
    rec.setdefault("lapses", 0)
    rec.setdefault("days", [])

    if correct:
        rec["reps"] = rec.get("reps", 0) + 1
        if stamp not in rec["days"]:          # only a new day advances the criterion
            rec["days"] = (rec["days"] + [stamp])[-MASTERY_STREAK:]
            rec["streak"] = rec["streak"] + 1
        if rec["reps"] == 1:
            rec["interval"] = 1
        elif rec["reps"] == 2:
            rec["interval"] = 3
        else:
            rec["interval"] = max(1, round_half_up(rec["interval"] * rec["ease"]))
        rec["ease"] = min(MAX_EASE, rec.get("ease", 2.5) + 0.05)
    else:
        rec["lapses"] = rec["lapses"] + 1
        rec["streak"] = 0        # the criterion clock restarts
        rec["days"] = []
        rec["reps"] = 0
        rec["interval"] = 0      # due again today — it comes back this session
        rec["ease"] = max(MIN_EASE, rec.get("ease", 2.5) - 0.2)

    rec["due"] = (today + timedelta(days=_fuzzed(rec["interval"], item_id))).isoformat()
    store[item_id] = rec
    return rec


def introduce(store: dict, item_id: str, today: date | None = None) -> dict:
    """First meeting with an item, after a pretest guess (ADR-0008).

    The learner is asked to guess *before* being taught, because a wrong guess
    followed by the answer beats being told first (Richland, Kornell & Kao
    2009). That guess must not be scored: the item has never been taught, so
    a miss is ignorance, not forgetting, and counting it would spend a lapse —
    four of which make a leech — on a word the app had not yet shown anyone.

    So the first encounter *introduces*: met once, due tomorrow, criterion
    clock still at zero. The first real test is the next day.
    """
    today = today or date.today()
    rec = store.get(item_id, {"ease": 2.5, "interval": 0, "reps": 0})
    rec.setdefault("streak", 0)
    rec.setdefault("lapses", 0)
    rec.setdefault("days", [])
    if rec["reps"] == 0:
        rec["reps"] = 1
        rec["interval"] = 1
        rec["due"] = (today + timedelta(days=1)).isoformat()
    store[item_id] = rec
    return rec


def due_ids(store: dict, all_ids: list[str], today: date | None = None) -> list[str]:
    """Everything scheduled for today or earlier, most overdue first.
    Leeches are excluded: they need re-teaching, not another attempt."""
    stamp = (today or date.today()).isoformat()
    return sorted(
        (i for i in all_ids
         if i in store and store[i]["due"] <= stamp and not is_leech(store[i])),
        key=lambda i: store[i]["due"],
    )


def leeches(store: dict, all_ids: list[str] | None = None) -> list[str]:
    ids = all_ids if all_ids is not None else list(store)
    return [i for i in ids if is_leech(store.get(i))]


def pick_session(store: dict, all_ids: list[str], n: int,
                 today: date | None = None) -> list[str]:
    """Due items first (most overdue first), then new material — but only
    while the backlog is under control. An SRS that keeps adding new items
    while the learner is drowning in due ones is how people quit."""
    due = due_ids(store, all_ids, today)
    session = due[:n]
    room = n - len(session)
    if room > 0 and len(due) < BACKLOG_CAP:
        fresh = [i for i in all_ids if i not in store]
        session.extend(fresh[:min(room, NEW_PER_SESSION)])
    room = n - len(session)
    if room > 0:  # nothing else to do? pull the nearest-future items forward
        upcoming = sorted(
            (i for i in all_ids
             if i in store and i not in session and not is_leech(store[i])),
            key=lambda i: store[i]["due"],
        )
        session.extend(upcoming[:room])
    return session
