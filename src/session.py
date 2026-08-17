"""The mixed daily session (code) — ADR-0007.

Practice used to be organised by tab: a grammar session, a vocabulary session,
a talk session. That is blocked practice, and blocking is the wrong shape for
review — inside a block the exercise itself announces which rule applies, so
the learner never practises *choosing* one, which is the only thing free
writing asks of them (`docs/learning-engine.md` §5).

So:

- **Review is interleaved.** One queue built from due dates across the error
  queue and all three decks, round-robined so consecutive items rarely come
  from the same deck.
- **Introduction stays blocked.** New material comes from one deck per
  session, delivered together. The SLA evidence on interleaving *new* forms is
  mixed, and this follows the caveat rather than the maths literature.
- **A miss comes back in the same session**, `LAG` items later — the
  within-session half of successive relearning (§13a).
- **New intake stops when the backlog is deep.** Over `srs.BACKLOG_CAP` due
  items, the session serves review only. An SRS that keeps adding while the
  learner is drowning is how people quit.

Mirrored in webapp/app.js (buildToday / interleave / requeue).
"""

from __future__ import annotations

from datetime import date

from . import error_queue, srs
from .quiz import grammar_items_for, talk_bank, vocab_items_for
from .verbs import drill_bank
from .state import LearnerProfile

DEFAULT_N = 12
LAG = 3            # how many items later a missed item is asked again
PRACTICE_DECKS = ("grammar", "vocab", "talk", "verbs")


def _pool(profile: LearnerProfile, deck: str) -> list[str]:
    if deck == "grammar":
        return [i["id"] for i in grammar_items_for(profile)]
    if deck == "vocab":
        return [w["word"] for w in vocab_items_for(profile)]
    if deck == "verbs":
        return [i["id"] for i in drill_bank(profile)]
    return [i["id"] for i in talk_bank()]


def interleave(queues: list[list[str]]) -> list[tuple[int, str]]:
    """Round-robin across queues, so consecutive items come from different
    decks wherever the queues allow. Returns (queue index, item id)."""
    remaining = [list(q) for q in queues]
    out: list[tuple[int, str]] = []
    while any(remaining):
        for index, queue in enumerate(remaining):
            if queue:
                out.append((index, queue.pop(0)))
    return out


def plan(profile: LearnerProfile, n: int = DEFAULT_N,
         today: date | None = None) -> dict:
    """Today's session. Deterministic given the stores and the date."""
    today = today or date.today()
    learner_id = str(profile.get("learner_id", "default"))

    decks = ["errors", *PRACTICE_DECKS]
    due_by_deck: list[list[str]] = []
    fresh_by_deck: dict[str, list[str]] = {}
    backlog = 0

    queue = error_queue.load(learner_id)
    due_by_deck.append([i["key"] for i in error_queue.due(queue, n=n, today=today)])
    backlog += len(due_by_deck[0])

    for deck in PRACTICE_DECKS:
        store = srs.load_store(learner_id, deck)
        ids = _pool(profile, deck)
        due = srs.due_ids(store, ids, today)
        backlog += len(due)
        due_by_deck.append(due)
        fresh_by_deck[deck] = [i for i in ids if i not in store]

    review = [{"deck": decks[d], "id": i, "kind": "review"}
              for d, i in interleave(due_by_deck)][:n]

    new: list[dict] = []
    room = n - len(review)
    if room > 0 and backlog < srs.BACKLOG_CAP:
        # one deck per session, rotating by date: new material stays blocked
        candidates = [d for d in PRACTICE_DECKS if fresh_by_deck[d]]
        if candidates:
            deck = candidates[today.toordinal() % len(candidates)]
            # nothing due means nothing to crowd: day one meets more material
            take = min(room, srs.NEW_PER_SESSION if backlog else srs.NEW_WHEN_IDLE)
            new = [{"deck": deck, "id": i, "kind": "new"}
                   for i in fresh_by_deck[deck][:take]]

    # untreatable errors ride along as one read-only note; they are not
    # scored, so they neither fill a review slot nor count towards the backlog
    notes = [{"deck": "errors", "id": item["key"], "kind": "exposure"}
             for item in error_queue.exposures(queue, n=1, today=today)]

    return {
        "items": review + new + notes,
        "review": review,
        "new": new,
        "notes": notes,
        "backlog": backlog,
        "capped": backlog >= srs.BACKLOG_CAP,
    }


def fluency_pool(profile: LearnerProfile) -> list[dict]:
    """Items for the fluency minute (ADR-0008): already mastered, and
    answerable by typing.

    Nation's fourth strand is speed on material you already know — practice at
    the edge of your knowledge builds knowledge, practice inside it builds
    automaticity (DeKeyser 2007), and the app had no way to train the second.
    Only mastered items qualify, because the point is *not* to learn anything
    here; nothing in this pool is rescheduled by how it goes.
    """
    learner_id = str(profile.get("learner_id", "default"))
    typed = {
        "grammar": _pool(profile, "grammar"),
        "vocab": _pool(profile, "vocab"),
        "verbs": _pool(profile, "verbs"),
        # a `reply` drill is multiple choice; only cloze items are produced
        "talk": [i["id"] for i in talk_bank() if i["kind"] == "cloze"],
    }
    pool: list[dict] = []
    for deck, ids in typed.items():
        store = srs.load_store(learner_id, deck)
        pool += [{"deck": deck, "id": i, "kind": "fluency"}
                 for i in ids if srs.mastered(store.get(i))]
    return pool


def requeue(items: list[dict], index: int, lag: int = LAG) -> list[dict]:
    """Put a missed item back into the running session, `lag` items later.
    Successive relearning wants the second attempt inside the session, but not
    immediately — an answer echoed straight back is not a retrieval."""
    item = dict(items[index])
    item["kind"] = "relearn"
    out = list(items)
    out.insert(min(index + lag + 1, len(out)), item)
    return out


def counts(plan_result: dict) -> str:
    """One line for the session header."""
    by_deck: dict[str, int] = {}
    for item in plan_result["items"]:
        by_deck[item["deck"]] = by_deck.get(item["deck"], 0) + 1
    parts = [f"{n} {deck}" for deck, n in by_deck.items()]
    tail = "  (review only — backlog is deep)" if plan_result["capped"] else ""
    return ", ".join(parts) + tail if parts else "nothing due"
