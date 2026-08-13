"""Study games (ADR-0003) — fun, bite-size, offline, zero LLM cost.

    python -m src.play grammar   # fix-the-sentence game (all 24 systems)
    python -m src.play vocab     # word trainer (meaning + spelling rounds)
    python -m src.play stats     # XP, streak, badges
    options: --n 5  --learner ID

Wrong answers are never punished — they just come back sooner (spaced
repetition). Every session feeds the same streak as journaling and lessons.
"""

from __future__ import annotations

import argparse
import json
import random

from . import srs
from .game import BADGES, XP, record_activity, stats_line
from .knowledge import categories
from .quiz import (
    check_answer,
    check_word,
    cloze,
    grammar_items_for,
    meaning_options,
    vocab_items_for,
)
from .state import LearnerProfile

_RIGHT = ["✅ Гоё! (Nice!)", "✅ Exactly right.", "✅ That's the one.",
          "✅ Зөв! (Correct!)", "✅ Clean fix."]
_WRONG = ["Almost — here it is:", "Not this time. The answer:",
          "Close one. Correct form:", "This one comes back later. Answer:"]


def _ask(prompt: str) -> str:
    return input(prompt).replace("﻿", "").strip()


def _save_profile(profile: LearnerProfile) -> None:
    from .nodes import memory as memory_module
    directory = memory_module._data_dir()
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{profile.get('learner_id', 'default')}.json"
    path.write_text(json.dumps(profile, ensure_ascii=False, indent=2),
                    encoding="utf-8")


def _finish(profile: LearnerProfile, correct: int, total: int,
            new_badges: list[dict]) -> None:
    print(f"\n── Session done: {correct}/{total} ──")
    print(stats_line(profile))
    for badge in new_badges:
        print(f"🏅 New badge: {badge['icon']} {badge['name']}")
    if correct == total and total > 0:
        print("Perfect round. Маргааш уулзацгаая! (See you tomorrow!)")
    _save_profile(profile)


def play_grammar(profile: LearnerProfile, n: int) -> None:
    rng = random.Random()
    items = {i["id"]: i for i in grammar_items_for(profile)}
    store = srs.load_store(profile["learner_id"], "grammar")
    session = srs.pick_session(store, list(items.keys()), n)
    print(f"🧱 Grammar game — fix each sentence ({len(session)} rounds)\n")

    correct, new_badges = 0, []
    for round_no, item_id in enumerate(session, 1):
        item = items[item_id]
        print(f"{round_no}. Fix this sentence:")
        print(f"   ❌ {item['prompt']}")
        answer = _ask("   ✏️  ")
        ok = check_answer(answer, item["answer"])
        if ok:
            correct += 1
            print(f"   {rng.choice(_RIGHT)}")
        else:
            print(f"   {rng.choice(_WRONG)}")
            print(f"   ✅ {item['answer']}")
        print(f"   💡 {item['explanation']}")
        if not ok and item["bridge"]:
            print(f"   🇲🇳 {item['bridge']}")
        print()
        srs.review(store, item_id, ok)
        xp = XP["quiz_correct"] if ok else XP["quiz_attempt"]
        new_badges += record_activity(
            profile, xp, counters={"quiz_correct": 1} if ok else {})

    srs.save_store(profile["learner_id"], "grammar", store)
    _finish(profile, correct, len(session), new_badges)


def play_vocab(profile: LearnerProfile, n: int) -> None:
    rng = random.Random()
    items = {w["word"]: w for w in vocab_items_for(profile)}
    store = srs.load_store(profile["learner_id"], "vocab")
    session = srs.pick_session(store, list(items.keys()), n)
    print(f"📚 Word trainer ({len(session)} rounds) — stress marks matter!\n")

    correct, new_badges = 0, []
    for round_no, word_id in enumerate(session, 1):
        w = items[word_id]
        seen_before = word_id in store and store[word_id].get("reps", 0) > 0
        if seen_before:  # recall round: type the word into its sentence
            print(f"{round_no}. {w['gloss_en']}  ({w['gloss_mn']})")
            print(f"   {cloze(w)}")
            answer = _ask("   ✏️  the word: ")
            ok = check_word(answer, w["word"])
        else:  # meet the word: choose the meaning
            options = meaning_options(w, rng=rng)
            print(f"{round_no}. {w['word']}  ({w['stress']})")
            print(f"   {cloze(w)}")
            for i, option in enumerate(options, 1):
                print(f"     {i}) {option}")
            answer = _ask("   ✏️  number: ")
            ok = (answer.isdigit() and 1 <= int(answer) <= len(options)
                  and options[int(answer) - 1] == w["gloss_en"])
        if ok:
            correct += 1
            print(f"   {rng.choice(_RIGHT)}")
        else:
            print(f"   {rng.choice(_WRONG)} {w['word']} — {w['gloss_en']}")
        print(f"   🔊 say it: {w['stress']}   🇲🇳 {w['gloss_mn']}")
        print(f"   e.g. {w['example']}\n")
        srs.review(store, word_id, ok)
        xp = XP["vocab_correct"] if ok else XP["vocab_attempt"]
        new_badges += record_activity(
            profile, xp, counters={"vocab_correct": 1} if ok else {})

    srs.save_store(profile["learner_id"], "vocab", store)
    _finish(profile, correct, len(session), new_badges)


def show_stats(profile: LearnerProfile) -> None:
    print(stats_line(profile))
    print(f"Level: {profile.get('level', 'B1')}   "
          f"journal entries: {profile.get('entries_count', 0)}   "
          f"lessons done: {len(profile.get('lessons_done') or [])}/{len(categories())}")
    earned = set(profile.get("badges", []))
    print("\nBadges:")
    for badge_id, icon, name, requirement, _ in BADGES:
        mark = icon if badge_id in earned else "🔒"
        print(f"  {mark}  {name} — {requirement}")


def main() -> None:
    from .nodes.memory import load_profile

    parser = argparse.ArgumentParser(description="Bagsh study games")
    parser.add_argument("mode", choices=["grammar", "vocab", "stats"])
    parser.add_argument("--n", type=int, default=5, help="questions per session")
    parser.add_argument("--learner", default="default")
    args = parser.parse_args()

    profile = load_profile(args.learner)
    if args.mode == "grammar":
        play_grammar(profile, args.n)
    elif args.mode == "vocab":
        play_vocab(profile, args.n)
    else:
        show_stats(profile)


if __name__ == "__main__":
    main()
