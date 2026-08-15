"""Study games (ADR-0003, revised by ADR-0007) — fun, bite-size, offline,
zero LLM cost.

    python -m src.play today     # THE session: everything due, interleaved
    python -m src.play errors    # repair your own sentences (error queue)
    python -m src.play grammar   # fix-the-sentence game (all 24 systems)
    python -m src.play vocab     # word trainer (meaning + spelling rounds)
    python -m src.play talk      # conversation drills (say the missing chunk)
    python -m src.play fluency   # 60 timed seconds on what you already know
    python -m src.play read      # read something at your level (input strand)
    python -m src.play library   # what there is to read
    python -m src.play define --word snow   # what a word means
    python -m src.play progress  # what you can do — the honest metrics
    python -m src.play stats     # XP, streak, badges
    options: --n 5  --learner ID

Wrong answers are never punished — they come back later in this session, and
again on a later day, until they are right three days running (successive
relearning). Every session feeds the same streak as journaling and lessons.
"""

from __future__ import annotations

import argparse
import json
import random
import time

from . import error_queue, metrics, session, srs
from .console import utf8_output
from .game import BADGES, XP, record_activity, stats_line
from .knowledge import categories
from .quiz import (
    check_answer,
    check_word,
    cloze,
    grammar_items_for,
    meaning_options,
    talk_bank,
    vocab_items_for,
)
from .state import LearnerProfile

_RIGHT = ["✅ Гоё! (Nice!)", "✅ Exactly right.", "✅ That's the one.",
          "✅ Зөв! (Correct!)", "✅ Clean fix."]
_WRONG = ["Almost — here it is:", "Not this time. The answer:",
          "Close one. Correct form:", "This one comes back later. Answer:"]

DECK_LABEL = {"errors": "✍️  your sentence", "grammar": "🧱 grammar",
              "vocab": "📚 word", "talk": "🗣️  talk"}


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


# ── one item, one answer ─────────────────────────────────────────────
#
# Each asker renders a single item, grades it, folds the result into that
# deck's scheduler and logs the attempt for the metrics. Returning a bool lets
# the session runner re-ask a miss later without knowing anything about decks.

def _record(profile: LearnerProfile, deck: str, item_id: str, store: dict,
            correct: bool, produced: bool) -> list[dict]:
    """Schedule + log + score, in the one place all four decks share."""
    before = int((store.get(item_id) or {}).get("interval", 0))
    srs.review(store, item_id, correct)
    metrics.log_attempt(profile["learner_id"], deck, item_id, before,
                        correct, produced)
    counter = {"grammar": "quiz_correct", "vocab": "vocab_correct"}.get(deck)
    xp = XP["quiz_correct"] if correct else XP["quiz_attempt"]
    if deck == "vocab":
        xp = XP["vocab_correct"] if correct else XP["vocab_attempt"]
    return record_activity(profile, xp,
                           counters={counter: 1} if (correct and counter) else {})


def ask_grammar(profile: LearnerProfile, item_id: str, store: dict,
                rng: random.Random, badges: list) -> bool:
    item = {i["id"]: i for i in grammar_items_for(profile)}[item_id]
    print(f"   Fix this sentence:\n   ❌ {item['prompt']}")
    answer = _ask("   ✏️  ")
    ok = check_answer(answer, item["answer"], item.get("also_accept"))
    print(f"   {rng.choice(_RIGHT) if ok else rng.choice(_WRONG)}")
    if not ok:
        print(f"   ✅ {item['answer']}")
    print(f"   💡 {item['explanation']}")
    if not ok and item["bridge"]:
        print(f"   🇲🇳 {item['bridge']}")
    badges += _record(profile, "grammar", item_id, store, ok, produced=True)
    return ok


def ask_vocab(profile: LearnerProfile, word_id: str, store: dict,
              rng: random.Random, badges: list) -> bool:
    w = {x["word"]: x for x in vocab_items_for(profile)}[word_id]
    seen_before = word_id in store and store[word_id].get("reps", 0) > 0
    if seen_before:  # recall round: type the word into its sentence
        print(f"   {w['gloss_en']}  ({w['gloss_mn']})")
        print(f"   {cloze(w)}")
        answer = _ask("   ✏️  the word: ")
        ok = check_word(answer, w["word"])
    else:  # first meeting: GUESS first, then be taught (ADR-0008)
        options = meaning_options(w, rng=rng)
        print(f"   New word — have a guess, wrong is fine:")
        print(f"   {w['word']}  ({w['stress']})")
        print(f"   {cloze(w)}")
        for i, option in enumerate(options, 1):
            print(f"     {i}) {option}")
        answer = _ask("   ✏️  number: ")
        ok = (answer.isdigit() and 1 <= int(answer) <= len(options)
              and options[int(answer) - 1] == w["gloss_en"])
    if ok:
        print(f"   {rng.choice(_RIGHT)}")
    else:
        print(f"   {rng.choice(_WRONG)} {w['word']} — {w['gloss_en']}")
    print(f"   🔊 say it: {w['stress']}   🇲🇳 {w['gloss_mn']}")
    print(f"   e.g. {w['example']}")

    if seen_before:
        badges += _record(profile, "vocab", word_id, store, ok, produced=True)
        return ok
    # the guess is logged but never scheduled as a lapse — see srs.introduce
    srs.introduce(store, word_id)
    metrics.log_attempt(profile["learner_id"], "vocab", word_id, 0, ok,
                        produced=False)
    badges += record_activity(
        profile, XP["vocab_correct"] if ok else XP["vocab_attempt"],
        counters={"vocab_correct": 1} if ok else {})
    return ok


def ask_talk(profile: LearnerProfile, item_id: str, store: dict,
             rng: random.Random, badges: list) -> bool:
    item = {i["id"]: i for i in talk_bank()}[item_id]
    print(f"   {item['situation']}")
    if item["kind"] == "cloze":
        print(f"   🇲🇳 {item['cue_mn']}")
        print(f"   {item['prompt']}")
        answer = _ask("   ✏️  ")
        ok = check_answer(answer, item["answer"], None, True)
        if not ok:
            print(f"   ✅ {item['answer']}")
        if item["note"]:
            print(f"   💡 {item['note']}")
    else:
        options = list(item["options"])
        rng.shuffle(options)
        for n_opt, option in enumerate(options, 1):
            print(f"   {n_opt}) {option['text']}")
        raw = _ask("   Your choice: ")
        chosen = (options[int(raw) - 1]
                  if raw.isdigit() and 1 <= int(raw) <= len(options) else None)
        ok = bool(chosen and chosen.get("correct"))
        if chosen:
            print(f"   💡 {chosen['why']}")
        if not ok:
            best = next(o for o in item["options"] if o.get("correct"))
            print(f"   ✅ {best['text']}")
    print(f"   {rng.choice(_RIGHT) if ok else rng.choice(_WRONG)}")
    badges += _record(profile, "talk", item_id, store, ok,
                      produced=item["kind"] == "cloze")
    return ok


def show_exposure(profile: LearnerProfile, key: str, queue: dict) -> None:
    """An untreatable error — word choice, collocation, register. There is no
    rule to drill, so this is read, not answered, and nothing is scored."""
    note = error_queue.to_exposure(queue["items"][key])
    print(f"   You wrote:  {note['your_version']}")
    print(f"   More natural:  \"{note['natural']}\"  (you wrote \"{note['yours']}\")")
    if note["bridge"]:
        print(f"   🇲🇳 {note['bridge']}")
    print("   Nothing to answer here — this one is learned by meeting it.")
    error_queue.mark_shown(queue, key)


def ask_error(profile: LearnerProfile, key: str, queue: dict,
              rng: random.Random, badges: list) -> bool | None:
    """A repair, not a recast: the learner's own sentence, their error taken
    out, the target withheld until they have produced one."""
    item = queue["items"].get(key)
    if item is None:
        return True
    if not item.get("treatable", True):
        show_exposure(profile, key, queue)
        return None            # shown, not asked: nothing to score
    drill = error_queue.to_drill(item)
    level = profile.get("level", "B1")
    rule = drill["rule_a2"] if level in ("A0", "A1", "A2") else drill["rule"]

    print(f"   You wrote:  {drill['your_version']}")
    print("   " + ("Type the missing words:" if drill["mode"] == "chunk"
                   else "Type it without the marked words:"))
    print(f"   {drill['prompt']}")
    answer = _ask("   ✏️  ")
    ok = check_answer(answer, drill["answer"], None, True)
    print(f"   {rng.choice(_RIGHT) if ok else rng.choice(_WRONG)}")
    if not ok:
        print(f"   ✅ {drill['answer']}")
        if drill["bridge"]:
            print(f"   🇲🇳 {drill['bridge']}")
    print(f"   💡 {rule}")
    if drill["seen"] > 1:
        print(f"   (you have written this one {drill['seen']} times)")

    before = int(item.get("interval", 0))
    error_queue.record(queue, key, ok)
    metrics.log_attempt(profile["learner_id"], "errors", key, before, ok,
                        produced=True)
    badges += record_activity(
        profile, XP["quiz_correct"] if ok else XP["quiz_attempt"])
    if item["state"] == "graduated":
        print("   🎓 Cleared — this error has stopped showing up in your writing.")
    elif item["state"] == "leech":
        print("   📖 This one needs the lesson again, not another quiz: "
              f"python -m src.main --help  →  study '{item['category']}'.")
    return ok


# ── the session runner ───────────────────────────────────────────────

def run_session(profile: LearnerProfile, items: list[dict], header: str) -> None:
    """Ask every item; a miss comes back LAG items later and the session is
    not over until it has been answered again (successive relearning)."""
    if not items:
        print("Nothing due — маргааш уулзъя! (See you tomorrow.)")
        return
    rng = random.Random()
    learner_id = profile["learner_id"]
    stores = {deck: srs.load_store(learner_id, deck)
              for deck in ("grammar", "vocab", "talk")}
    queue = error_queue.load(learner_id)
    badges: list[dict] = []
    print(header + "\n")

    correct, asked, index = 0, 0, 0
    while index < len(items):
        entry = items[index]
        deck, item_id = entry["deck"], entry["id"]
        tag = "  ↻" if entry.get("kind") == "relearn" else ""
        print(f"{index + 1}. {DECK_LABEL.get(deck, deck)}{tag}")
        if deck == "errors":
            ok = ask_error(profile, item_id, queue, rng, badges)
        elif deck == "grammar":
            ok = ask_grammar(profile, item_id, stores["grammar"], rng, badges)
        elif deck == "vocab":
            ok = ask_vocab(profile, item_id, stores["vocab"], rng, badges)
        else:
            ok = ask_talk(profile, item_id, stores["talk"], rng, badges)
        print()
        if ok is None:          # an exposure was shown, not answered
            index += 1
            continue
        asked += 1
        correct += 1 if ok else 0
        if not ok and entry.get("kind") != "relearn":
            items = session.requeue(items, index)
        index += 1

    for deck, store in stores.items():
        srs.save_store(learner_id, deck, store)
    error_queue.save(learner_id, queue)
    _finish(profile, correct, asked, badges)


# ── reading (ADR-0009) ───────────────────────────────────────────────

def play_read(profile: LearnerProfile, text_id: str | None = None) -> None:
    """Meaning-focused input: read something, then answer two questions about
    what it meant. No scoring, no scheduling — the strand exists to be read."""
    from . import reading

    level = profile.get("level", "B1")
    learner_id = profile["learner_id"]
    store = reading.load_progress(learner_id)
    library = reading.readings_for(level)
    if not library:
        print("No texts at your level yet.")
        return

    if text_id:
        chosen = next((t for t in library if t["id"] == text_id), None)
        if chosen is None:
            print(f"No text called '{text_id}'. Available:")
            for t in library:
                print(f"  {t['level']}  {t['id']:<24} {t['title']}")
            return
    else:
        unread = [t for t in library if t["id"] not in store["texts"]]
        chosen = (unread or library)[0]

    glossary = reading.glossary(chosen)
    print(f"\n{'=' * 60}")
    print(f"{chosen['title']}   [{chosen['level']}] "
          f"{chosen['words']} words, about {chosen['minutes']} min")
    print("=" * 60)
    print()
    print(chosen["body"].strip())
    print()
    if glossary:
        print("── Words ──")
        for word, entry in sorted(glossary.items()):
            line = f"  {entry['word']}: {entry['gloss_en']}"
            if entry.get("gloss_mn"):
                line += f"   🇲🇳 {entry['gloss_mn']}"
            print(line)
        print()
    _ask("Press Enter when you have finished reading… ")

    correct = 0
    questions = chosen.get("questions") or []
    rng = random.Random()
    for i, question in enumerate(questions, 1):
        options = list(question["options"])
        rng.shuffle(options)
        print(f"\n{i}. {question['q']}")
        for n, option in enumerate(options, 1):
            print(f"   {n}) {option['text']}")
        raw = _ask("   Your answer: ")
        picked = (options[int(raw) - 1]
                  if raw.isdigit() and 1 <= int(raw) <= len(options) else None)
        ok = bool(picked and picked.get("correct"))
        correct += 1 if ok else 0
        if ok:
            print(f"   {rng.choice(_RIGHT)}")
        else:
            best = next(o for o in question["options"] if o.get("correct"))
            print(f"   Not quite. → {best['text']}")

    from datetime import date
    reading.record_reading(store, chosen, correct, len(questions),
                           date.today().isoformat())
    reading.save_progress(learner_id, store)
    summary = reading.reading_summary(store)

    # unknown words go to the study list, which is where the input strand
    # hands over to the deliberate-study one
    study = list(profile.get("study_list") or [])
    added = [w for w in glossary if w not in study]
    profile["study_list"] = (study + added)[:200]

    record_activity(profile, XP["lesson_done"])
    _save_profile(profile)
    print(f"\n── {correct}/{len(questions)} — "
          f"{summary['words_read']} words read in total ──")
    if added:
        print(f"{len(added)} words from this text went to your study list.")
    print("Next text: python -m src.play read")


def define_word(word: str | None) -> None:
    """What a word means, from the same glossary the study list uses."""
    from . import glossary
    if not word:
        print("Which word? python -m src.play define --word snow")
        return
    entry = glossary.explain(word)
    if not entry:
        print(f"{word}: nothing in the app explains this one yet.")
        return
    base = f"  (from {entry['base']})" if entry.get("base") else ""
    print(f"{entry['word']}{base}")
    if entry.get("stress"):
        print(f"  🔊 {entry['stress']}")
    print(f"  {entry['gloss_en']}")
    if entry.get("gloss_mn"):
        print(f"  🇲🇳 {entry['gloss_mn']}")
    if entry.get("example"):
        print(f"  e.g. {entry['example']}")


def list_readings(profile: LearnerProfile) -> None:
    from . import reading
    store = reading.load_progress(profile["learner_id"])
    print("📖 Reading — Уншлага\n")
    for text in reading.readings_for(profile.get("level", "B1")):
        row = store["texts"].get(text["id"])
        mark = "✓" if row else " "
        print(f" {mark} {text['level']}  {text['id']:<24} {text['title']:<32}"
              f" {text['words']:>4}w")
    summary = reading.reading_summary(store)
    print(f"\n{summary['texts_read']}/{summary['library']} texts, "
          f"{summary['words_read']} words read"
          + (f", {summary['comprehension']}% of the questions right"
             if summary["comprehension"] is not None else ""))


# ── the fluency minute (ADR-0008) ────────────────────────────────────

FLUENCY_SECONDS = 60
FLUENCY_MIN_POOL = 6


def _flash(profile: LearnerProfile, entry: dict) -> tuple[bool, int]:
    """One speed item: show it, time the answer, grade it. Nothing here
    touches a scheduler — the pool is material already mastered, and letting
    a fast round move intervals would corrupt the spacing that earned them."""
    deck, item_id = entry["deck"], entry["id"]
    if deck == "grammar":
        item = {i["id"]: i for i in grammar_items_for(profile)}[item_id]
        print(f"   ❌ {item['prompt']}")
        started = time.monotonic()
        answer = _ask("   ✏️  ")
        ok = check_answer(answer, item["answer"], item.get("also_accept"))
        target = item["answer"]
    elif deck == "vocab":
        w = {x["word"]: x for x in vocab_items_for(profile)}[item_id]
        print(f"   {w['gloss_en']}  —  {cloze(w)}")
        started = time.monotonic()
        answer = _ask("   ✏️  ")
        ok = check_word(answer, w["word"])
        target = w["word"]
    else:
        item = {i["id"]: i for i in talk_bank()}[item_id]
        print(f"   🇲🇳 {item['cue_mn']}")
        print(f"   {item['prompt']}")
        started = time.monotonic()
        answer = _ask("   ✏️  ")
        ok = check_answer(answer, item["answer"], None, True)
        target = item["answer"]

    ms = int((time.monotonic() - started) * 1000)
    print(f"   {'✅' if ok else '→ ' + target}   {ms} ms\n")
    metrics.log_attempt(profile["learner_id"], deck, item_id, 0, ok,
                        produced=True, ms=ms, fluency=True)
    return ok, ms


def play_fluency(profile: LearnerProfile, seconds: int = FLUENCY_SECONDS) -> None:
    pool = session.fluency_pool(profile)
    if len(pool) < FLUENCY_MIN_POOL:
        print(f"⏱  Not yet — the fluency minute runs on what you have already "
              f"mastered, and that is {len(pool)} item"
              f"{'' if len(pool) == 1 else 's'} so far "
              f"(needs {FLUENCY_MIN_POOL}).")
        print("   Keep doing `python -m src.play today`; this unlocks itself.")
        return

    random.Random().shuffle(pool)
    print(f"⏱  Fluency minute — {seconds} seconds on {len(pool)} things you "
          f"already know.\n   Speed is the point. Nothing here is rescheduled, "
          f"nothing is punished.\n")
    input("   Press Enter to start… ")

    deadline = time.monotonic() + seconds
    correct, times, index = 0, [], 0
    while time.monotonic() < deadline and index < len(pool):
        left = int(deadline - time.monotonic())
        print(f"{index + 1}.  ⏱ {left}s left")
        ok, ms = _flash(profile, pool[index])
        correct += 1 if ok else 0
        times.append(ms)
        index += 1

    if times:
        typical = sorted(times)[len(times) // 2]
        print(f"── {correct}/{len(times)} right, {typical} ms typical ──")
        print("Speed on known material is the fourth strand: it is not new "
              "learning, it is the same knowledge getting cheaper to use.")
        record_activity(profile, XP["quiz_attempt"] * len(times))
        _save_profile(profile)
    print("Trend: python -m src.play progress")


def _deck_session(profile: LearnerProfile, deck: str, n: int) -> list[dict]:
    pool = session._pool(profile, deck)
    store = srs.load_store(profile["learner_id"], deck)
    return [{"deck": deck, "id": i, "kind": "review"}
            for i in srs.pick_session(store, pool, n)]


def play_today(profile: LearnerProfile, n: int) -> None:
    plan = session.plan(profile, n)
    header = (f"🐫 Today — {session.counts(plan)}\n"
              "   Everything that is due, mixed on purpose: choosing the rule "
              "is the skill.")
    if plan["capped"]:
        header += "\n   (No new material today — clear the backlog first.)"
    run_session(profile, plan["items"], header)


def play_errors(profile: LearnerProfile, n: int) -> None:
    queue = error_queue.load(profile["learner_id"])
    items = [{"deck": "errors", "id": i["key"], "kind": "review"}
             for i in error_queue.due(queue, n=n)]
    # one untreatable note per session, at the end: it is reading, not testing
    items += [{"deck": "errors", "id": i["key"], "kind": "exposure"}
              for i in error_queue.exposures(queue, n=1)]
    summary = error_queue.summary(queue)
    run_session(profile, items,
                f"✍️  Your own sentences — {summary['queued']} in the queue, "
                f"{summary['graduated']} cleared, {summary['leeches']} waiting "
                f"for a lesson")


def play_grammar(profile: LearnerProfile, n: int) -> None:
    run_session(profile, _deck_session(profile, "grammar", n),
                "🧱 Grammar game — fix each sentence")


def play_vocab(profile: LearnerProfile, n: int) -> None:
    run_session(profile, _deck_session(profile, "vocab", n),
                "📚 Word trainer — stress marks matter!")


def play_talk(profile: LearnerProfile, n: int) -> None:
    run_session(profile, _deck_session(profile, "talk", n),
                "🗣️  Everyday talk")


def show_progress(profile: LearnerProfile) -> None:
    print(metrics.format_report(metrics.report(profile)))


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
    print("\n(Those are habit numbers. For what you can actually do: "
          "python -m src.play progress)")


def main() -> None:
    from .nodes.memory import load_profile

    utf8_output()

    parser = argparse.ArgumentParser(description="Bagsh study games")
    parser.add_argument("mode", choices=["today", "errors", "grammar", "vocab",
                                         "talk", "fluency", "read", "library",
                                         "define", "progress", "stats"])
    parser.add_argument("--n", type=int, default=None,
                        help="questions per session (default 12 for today, "
                             "else 5)")
    parser.add_argument("--learner", default="default")
    parser.add_argument("--id", help="which text to read")
    parser.add_argument("--word", help="the word to explain")
    args = parser.parse_args()

    profile = load_profile(args.learner)
    n = args.n or (session.DEFAULT_N if args.mode == "today" else 5)
    if args.mode == "today":
        play_today(profile, n)
    elif args.mode == "errors":
        play_errors(profile, n)
    elif args.mode == "grammar":
        play_grammar(profile, n)
    elif args.mode == "vocab":
        play_vocab(profile, n)
    elif args.mode == "talk":
        play_talk(profile, n)
    elif args.mode == "fluency":
        play_fluency(profile)
    elif args.mode == "read":
        play_read(profile, args.id)
    elif args.mode == "library":
        list_readings(profile)
    elif args.mode == "define":
        define_word(args.word)
    elif args.mode == "progress":
        show_progress(profile)
    else:
        show_stats(profile)


if __name__ == "__main__":
    main()
