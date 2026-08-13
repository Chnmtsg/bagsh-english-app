"""Gamification (code): XP, daily streak, badges (ADR-0003).

Adopted from the habit mechanics that demonstrably work (see
docs/app-review.md); deliberately WITHOUT hearts, lives or leaderboards —
mistakes are information, not punishable offences.

Every surface (journal, lesson, grammar game, vocab trainer) calls
record_activity, so any five minutes of study keeps the streak alive.
"""

from __future__ import annotations

from datetime import date, timedelta

from .state import LearnerProfile

XP = {
    "journal_entry": 15,
    "lesson_done": 10,
    "quiz_correct": 4,
    "quiz_attempt": 1,
    "vocab_correct": 3,
    "vocab_attempt": 1,
}

# (id, icon, name, requirement description, predicate)
BADGES: list[tuple] = [
    ("first_step", "🐫", "Эхний алхам — First step",
     "earn any XP", lambda p: p.get("xp", 0) > 0),
    ("streak_3", "🔥", "Гурав дараалан — 3-day streak",
     "study 3 days in a row", lambda p: p.get("streak_days", 0) >= 3),
    ("streak_7", "🔥🔥", "Долоо хоног — 7-day streak",
     "study 7 days in a row", lambda p: p.get("streak_days", 0) >= 7),
    ("streak_30", "🌋", "Сар бүтэн — 30-day streak",
     "study 30 days in a row", lambda p: p.get("streak_days", 0) >= 30),
    ("xp_100", "⛏️", "Чулуу цуглуулагч — Rock collector",
     "reach 100 XP", lambda p: p.get("xp", 0) >= 100),
    ("xp_500", "💎", "Эрдэнэс — Treasure",
     "reach 500 XP", lambda p: p.get("xp", 0) >= 500),
    ("grammar_25", "🧱", "Дүрэм баригч — Grammar builder",
     "25 correct grammar answers", lambda p: p.get("quiz_correct", 0) >= 25),
    ("vocab_50", "📚", "Үгийн сан — Word bank",
     "50 correct vocabulary answers", lambda p: p.get("vocab_correct", 0) >= 50),
    ("journal_10", "✍️", "Тэмдэглэлч — Journal keeper",
     "write 10 journal entries", lambda p: p.get("entries_count", 0) >= 10),
]


def record_activity(profile: LearnerProfile, xp: int,
                    today: date | None = None,
                    counters: dict[str, int] | None = None) -> list[dict]:
    """Add XP, advance the daily streak, bump counters. Returns newly
    earned badges (each {id, icon, name})."""
    today = today or date.today()
    profile["xp"] = int(profile.get("xp", 0)) + xp

    last = profile.get("last_active_date")
    if last != today.isoformat():
        if last == (today - timedelta(days=1)).isoformat():
            profile["streak_days"] = int(profile.get("streak_days", 0)) + 1
        else:
            profile["streak_days"] = 1
        profile["last_active_date"] = today.isoformat()

    for key, amount in (counters or {}).items():
        profile[key] = int(profile.get(key, 0)) + amount  # type: ignore[literal-required]

    earned = list(profile.get("badges", []))
    new: list[dict] = []
    for badge_id, icon, name, _req, predicate in BADGES:
        if badge_id not in earned and predicate(profile):
            earned.append(badge_id)
            new.append({"id": badge_id, "icon": icon, "name": name})
    profile["badges"] = earned
    return new


def stats_line(profile: LearnerProfile) -> str:
    streak = profile.get("streak_days", 0)
    flame = "🔥" if streak else ""
    return (f"XP: {profile.get('xp', 0)}   "
            f"Streak: {streak} day{'s' if streak != 1 else ''} {flame}  "
            f"Badges: {len(profile.get('badges', []))}/{len(BADGES)}")
