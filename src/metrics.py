"""Proficiency metrics (code) — ADR-0007, rationale in
`docs/learning-engine.md` Part 5.

XP, streaks and badges measure showing up. They are kept — habit scaffolding
works — but they must never be the answer to "am I improving?". These four are:

1. **Free-production error rate** — errors per 100 words, *always* reported
   with entry length, because the one way to game it is to write shorter,
   simpler sentences.
2. **Delayed first-attempt accuracy (DFA)** — of the items answered after an
   interval of at least a week, the share right on the first try. Grinding an
   item shortens its interval, so grinding cannot raise this number.
3. **Productive mature count** — items with an interval of three weeks or more
   whose last correct answer was *typed*. Recognition answers do not count:
   you get good at the operation you practise (Morris et al. 1977).
4. **Categories graduated / leeches outstanding** — from the error queue, where
   graduation requires the error to stop appearing in real writing.

The attempt log this reads is written by every practice surface. It holds no
text, only (date, deck, item id, interval, correct, was-it-typed, ms).
"""

from __future__ import annotations

import json
from datetime import date
from statistics import median

from . import error_queue, reading, srs
from .state import LearnerProfile

LOG_DECK = "log"
LOG_CAP = 2000
DELAYED_DAYS = 7      # an interval this long makes an answer "delayed"
MATURE_DAYS = 21      # ... and this long makes an item "mature"
TREND_WINDOW = 5


# ── the attempt log ──────────────────────────────────────────────────

def load_log(learner_id: str) -> list[dict]:
    store = srs.load_store(learner_id, LOG_DECK)
    return list(store.get("attempts", [])) if isinstance(store, dict) else []


def save_log(learner_id: str, attempts: list[dict]) -> None:
    srs.save_store(learner_id, LOG_DECK,
                   {"version": 1, "attempts": attempts[-LOG_CAP:]})


def log_attempt(learner_id: str, deck: str, item_id: str,
                interval_before: int, correct: bool, produced: bool,
                ms: int | None = None, fluency: bool = False,
                today: date | None = None) -> None:
    """One answer. `interval_before` is the item's scheduled interval *before*
    this answer — that is what makes the attempt delayed or not. `produced` is
    True when the learner typed the answer rather than choosing it. `fluency`
    marks a speed round on already-mastered material, which is timed but must
    never count as evidence of recall."""
    attempts = load_log(learner_id)
    attempts.append({
        "d": (today or date.today()).isoformat(),
        "deck": deck,
        "id": item_id,
        "iv": int(interval_before or 0),
        "ok": bool(correct),
        "prod": bool(produced),
        **({"ms": int(ms)} if ms is not None else {}),
        **({"fl": 1} if fluency else {}),
    })
    save_log(learner_id, attempts)


def first_attempts(attempts: list[dict]) -> list[dict]:
    """One row per item per day — a miss re-asked later in the same session is
    the same attempt continuing, not new evidence. Fluency rounds are dropped
    entirely: answering something you have already mastered, fast, says
    nothing about whether you would have remembered it cold."""
    seen: set[tuple[str, str, str]] = set()
    out = []
    for a in attempts:
        if a.get("fl"):
            continue
        key = (a["d"], a["deck"], a["id"])
        if key in seen:
            continue
        seen.add(key)
        out.append(a)
    return out


# ── the four numbers ─────────────────────────────────────────────────

def error_rate(profile: LearnerProfile) -> dict:
    """Errors per 100 words, paired with entry length. Never report one
    without the other: a falling error rate with falling length is avoidance,
    not learning."""
    rates = list(profile.get("accuracy_history", []))
    lengths = list(profile.get("length_history", []))
    recent = rates[-TREND_WINDOW:]
    earlier = rates[-2 * TREND_WINDOW:-TREND_WINDOW]
    out = {
        "entries": len(rates),
        "recent": round(sum(recent) / len(recent), 2) if recent else None,
        "previous": round(sum(earlier) / len(earlier), 2) if earlier else None,
        "words_recent": (round(sum(lengths[-TREND_WINDOW:])
                               / len(lengths[-TREND_WINDOW:]))
                         if lengths else None),
        "words_previous": (round(sum(lengths[-2 * TREND_WINDOW:-TREND_WINDOW])
                                 / len(lengths[-2 * TREND_WINDOW:-TREND_WINDOW]))
                           if len(lengths) > TREND_WINDOW else None),
    }
    if out["recent"] is not None and out["previous"] is not None:
        out["change"] = round(out["recent"] - out["previous"], 2)
        shrinking = (out["words_recent"] or 0) < 0.8 * (out["words_previous"] or 0)
        out["shorter_entries"] = bool(out["words_previous"] and shrinking)
    return out


def delayed_accuracy(attempts: list[dict]) -> dict:
    delayed = [a for a in first_attempts(attempts) if a["iv"] >= DELAYED_DAYS]
    if not delayed:
        return {"n": 0, "pct": None}
    correct = sum(1 for a in delayed if a["ok"])
    return {"n": len(delayed),
            "pct": srs.round_half_up(100 * correct / len(delayed))}


def productive_mature(learner_id: str, attempts: list[dict]) -> dict:
    """Mature items (interval >= MATURE_DAYS) whose last answer was typed."""
    last_typed: dict[tuple[str, str], bool] = {}
    for a in attempts:
        last_typed[(a["deck"], a["id"])] = a["prod"]

    mature = 0
    productive = 0
    for deck in ("grammar", "vocab", "talk", "verbs"):
        store = srs.load_store(learner_id, deck)
        for item_id, rec in store.items():
            if rec.get("interval", 0) >= MATURE_DAYS and not srs.is_leech(rec):
                mature += 1
                if last_typed.get((deck, item_id)):
                    productive += 1
    return {"mature": mature, "productive": productive}


def fluency(attempts: list[dict]) -> dict:
    """Median time to a correct answer in the fluency minute. Should fall as a
    power law if anything is automatizing (DeKeyser 2007) — fast early gains,
    then a long shallow tail. `previous` is the round before last, so the
    trend is visible without a chart."""
    rounds: dict[str, list[int]] = {}
    for a in attempts:
        if a.get("fl") and a.get("ms") is not None and a["ok"]:
            rounds.setdefault(a["d"], []).append(a["ms"])
    days = sorted(rounds)
    if not days:
        return {"n": 0, "median_ms": None, "previous_ms": None, "rounds": 0}
    latest = rounds[days[-1]]
    earlier = rounds[days[-2]] if len(days) > 1 else []
    return {
        "n": len(latest),
        "median_ms": srs.round_half_up(median(latest)),
        "previous_ms": srs.round_half_up(median(earlier)) if earlier else None,
        "rounds": len(days),
    }


def report(profile: LearnerProfile) -> dict:
    learner_id = str(profile.get("learner_id", "default"))
    attempts = load_log(learner_id)
    queue = error_queue.load(learner_id)
    summary = error_queue.summary(queue)
    return {
        "learner": learner_id,
        "error_rate": error_rate(profile),
        "delayed_accuracy": delayed_accuracy(attempts),
        "productive": productive_mature(learner_id, attempts),
        "errors": summary,
        "fluency": fluency(attempts),
        "reading": reading.reading_summary(reading.load_progress(learner_id)),
        "habit": {  # kept, clearly labelled, never mixed into the above
            "xp": profile.get("xp", 0),
            "streak_days": profile.get("streak_days", 0),
            "badges": len(profile.get("badges", []) or []),
        },
    }


def format_report(rep: dict) -> str:
    rate = rep["error_rate"]
    dfa = rep["delayed_accuracy"]
    prod = rep["productive"]
    err = rep["errors"]
    lines = ["── What you can do ──────────────────────────────"]

    if rate["recent"] is None:
        lines.append("Writing accuracy:  no journal entries yet.")
    else:
        trend = ""
        if rate.get("change") is not None:
            arrow = "↓ better" if rate["change"] < 0 else "↑ worse" if rate["change"] > 0 else "→ flat"
            trend = f"  ({arrow} {abs(rate['change'])} vs the 5 before)"
        lines.append(f"Errors per 100 words:  {rate['recent']}{trend}")
        if rate.get("words_recent"):
            lines.append(f"  average entry length:  {rate['words_recent']} words"
                         + ("   ⚠ your entries got shorter — a lower error rate"
                            " on shorter writing is avoidance, not progress"
                            if rate.get("shorter_entries") else ""))

    lines.append(
        f"Delayed accuracy:  {dfa['pct']}% right after a week or more"
        f"  (n={dfa['n']})" if dfa["pct"] is not None
        else "Delayed accuracy:  nothing has been away a week yet."
    )
    lines.append(f"Known for keeps:  {prod['productive']} items you can TYPE "
                 f"after 3+ weeks  (of {prod['mature']} mature)")
    read = rep["reading"]
    lines.append(f"Words read:  {read['words_read']}  "
                 f"across {read['texts_read']}/{read['library']} texts"
                 + (f", {read['comprehension']}% understood"
                    if read["comprehension"] is not None else ""))
    lines.append(f"Errors tracked:  {err['tracked']}  "
                 f"— {err['queued']} in the queue, {err['graduated']} gone, "
                 f"{err['leeches']} need the lesson again")
    if err["categories_graduated"]:
        lines.append("  cleared: " + ", ".join(err["categories_graduated"]))
    flu = rep["fluency"]
    if flu["median_ms"]:
        trend = ""
        if flu["previous_ms"]:
            delta = flu["median_ms"] - flu["previous_ms"]
            trend = (f"  ({'↓ faster' if delta < 0 else '↑ slower' if delta else '→ flat'}"
                     f" {abs(delta)} ms vs last round)")
        lines.append(f"Fluency minute:  {flu['median_ms']} ms per answer{trend}"
                     f"  — {flu['rounds']} round{'s' if flu['rounds'] != 1 else ''}")

    habit = rep["habit"]
    lines.append("")
    lines.append("── Habit (not progress) ─────────────────────────")
    lines.append(f"XP {habit['xp']} · streak {habit['streak_days']} d · "
                 f"badges {habit['badges']}")
    return "\n".join(lines)


def dumps(rep: dict) -> str:
    return json.dumps(rep, ensure_ascii=False, indent=2)
