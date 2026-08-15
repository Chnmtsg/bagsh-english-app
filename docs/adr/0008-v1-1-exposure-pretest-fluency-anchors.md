# 0008. v1.1: exposure, pretest, fluency, anchors

## Status: accepted

Follows ADR-0007. Evidence and rankings: `docs/learning-engine.md` Part 2,
items #5, #6, #7 and #9.

## Context

ADR-0007 shipped the four mechanisms that carried most of the available gain,
and named the rest. Four of those remainders were cheap, well-evidenced, and —
in one case — a promise the code did not keep:

1. **Untreatable errors had nowhere to go.** ADR-0007 §4.4 says word choice,
   collocation and register are "shown as a more natural way to say it and
   never scored". Nothing did that. `error_queue.due()` filtered them out and
   no other surface picked them up, so five of the twenty-four categories were
   tracked, counted — and silently never seen again.
2. **The new-word card taught before it asked.** Guessing first and being told
   after beats being told first, even though every guess is wrong (Richland,
   Kornell & Kao 2009; Kornell, Hays & Bjork 2009). The card did it backwards.
3. **Nothing trained speed.** Nation's fourth strand is fluency development —
   easy, known material under mild time pressure — and skill acquisition
   research is clear that automatization comes from practising *inside* your
   knowledge, not at its edge (DeKeyser 1997, 2007). Every drill in the app was
   untimed and pitched at the frontier.
4. **The Coverage Check believed the learner.** Self-report checklists inflate:
   people tick words they half-know. Vocabulary-size tests handle this by
   planting words that do not exist and discounting the estimate by how many
   get claimed (Anderson & Freebody 1981). Ours had no anchor, so "3,412
   recognised" meant an unknown number.

## Decision

### 1. Untreatable errors come back as exposures

`error_queue.exposures()` returns due untreatable items; `to_exposure()`
renders one as a note — *you wrote X, more natural: Y* — with the L1 bridge.
`mark_shown()` pushes it out by a fixed 4-day step, capped at 30.

Three properties, all deliberate:

- **Never scored.** No answer, no XP, no attempt logged. The CLI session runner
  now distinguishes "shown" from "asked" by letting an asker return `None`, so
  an exposure cannot inflate a session score.
- **Never mastery.** `mark_shown` leaves `streak` and `days` untouched. Reading
  is not retrieval, and an item that has only ever been read must never reach
  the criterion.
- **Still graduates by absence.** Unchanged from ADR-0007: three clean entries
  and it is done.

One note per session, at the end, in `play errors`, `play today` and the
journal's own feedback.

### 2. The new-word card guesses first — and the guess is not scored

The PWA card is flipped: options first, then the full teach card. The CLI
already asked first; what was wrong there was the bookkeeping.

`srs.introduce()` is the new entry point for a first meeting: `reps = 1`,
due tomorrow, criterion clock at zero, **`lapses` untouched**. A wrong pretest
guess must not spend a lapse — four of those make a leech, and a learner would
have accumulated them on words the app had not yet shown anyone. The first real
test is the typed round the next day.

Inside a session this composes with ADR-0007's requeue: a wrong guess brings
the word back three items later, by which time it has been taught and renders
as typed recall. Guess → feedback → teach → immediate retrieval, which is the
sequence Part 3 of the design document specifies.

### 3. The fluency minute

`session.fluency_pool()` returns items that are **mastered** and **typed** —
multiple-choice talk items are excluded, because you cannot get faster at
producing something you only ever picked from a list. Sixty seconds, one item
at a time, auto-advancing.

**Nothing in it touches a scheduler.** A fast round must not move intervals
that were earned slowly, and the pool is by definition material that is not
due. Timings are logged with an `fl` flag which:

- **excludes them from `first_attempts()`**, and therefore from delayed
  accuracy — answering something you have already mastered, fast, is not
  evidence that you would have remembered it cold;
- **feeds `metrics.fluency()`**, which reports the median of the last round
  against the one before it. Expect a fast drop, then a long flat tail; flat
  from the start means the items are too varied to automatize.

It unlocks at six mastered items. Before that the screen says why, rather than
hiding.

### 4. Pseudoword anchors in the Coverage Check

`knowledge/pseudowords.yaml` holds 48 curated non-words. Two ride in every
round of twenty. Ticking one increments `profile.anchors.ticked`; the coverage
figure is then shown twice — raw, and `raw × (1 − ticked/shown)`.

- Anchors **never** enter `knownWords`, the study list or any deck.
- They are **revealed at the end of each round**. Hiding them permanently would
  make the feature a trick played on the learner rather than a measurement they
  can see the point of.
- `tests/test_content.py` checks every anchor against the CEFR frequency list,
  both vocabulary decks and all curated content. A "fake" word that turned out
  to be real would punish an honest advanced learner for knowing English —
  precisely the failure the anchors exist to prevent.

### 5. Safety amendment to ADR-0007

ADR-0007 gated what the error queue **stores** on `risk == none`. Reviewing the
whole path for this change surfaced the other half: `_todays_repairs` built a
repair out of the current entry regardless of risk. A repair quotes the
learner's whole **sentence** back at them, where the teacher only ever quotes
the **span**.

So `_todays_repairs` now carries the same gate. On an `elevated` entry the
grammar feedback still happens in full — the teacher corrects, the counters
count, fossilisation still tracks — it simply does not hand someone their own
hard sentence back as an exercise. Stated as one rule:

> A whole sentence is only ever replayed from an entry rated `none`.

## Consequences

- Five previously invisible categories (prepositions, collocation, word choice,
  register, tense_aspect) are now met again on a schedule, without ever being
  turned into a quiz that has no right answer to teach.
- Mastery counts move again: a first meeting no longer produces a lapse, so
  leech counts for new learners fall.
- `metrics.fluency()` changed shape — it now reports rounds, not a lifetime
  median over any timed answer. No stored data changes; the `fl` flag simply
  did not exist before, so old logs contribute nothing to it.
- The Coverage Check is two questions longer per round for the same eighteen
  real words. That is the cost of the number meaning something.
- `profile.anchors` is new in the PWA profile and defaults in over stored
  profiles, as `srs` and `log` already do. No migration.
- One more Python/JS pair to keep in step (`srs.introduce` /`srsIntroduce`);
  the parity harness covers it with two pretest sequences.

## Alternatives rejected

- **Drilling untreatable errors anyway**, on the grounds that some are
  partly rule-governed. Ferris (1999) is the whole reason the `treatable` flag
  exists; adding a quiz with no learnable rule behind it teaches a learner that
  their English is bad without telling them what to do differently.
- **Scoring the pretest guess.** It is the cleanest way to get a "free" data
  point, and it is wrong: the item has never been taught, so a miss measures
  the app's ignorance, not the learner's forgetting.
- **Letting the fluency minute reschedule items.** Tempting — they are real
  answers — but it would let a burst of easy speed push a genuinely shaky item
  weeks into the future.
- **Hiding the pseudowords permanently.** Better statistics, worse product: a
  learner who never learns why their number was discounted has been tricked
  rather than measured.
