# 0007. The learning engine v1: repair, criterion, queue, mix

## Status: accepted

Evidence and rankings: `docs/learning-engine.md` (Parts 1–6). This ADR records
only what is built and why, in this repo's terms.

## Context

The app has an unusually good correction pipeline and an unusually good
taxonomy, and spends both on **showing** the learner their errors. Four gaps,
in descending order of evidence × impact ÷ cost:

1. **Feedback is a recast.** The teacher displays the corrected sentence. In
   the corrective-feedback literature recasts draw the lowest uptake of any
   move — learners read the correction, agree, change nothing (Lyster & Ranta
   1997). Prompts, which make the learner produce the repair, do far better.
   Reading a correction is not retrieval; retrieval is the single most
   replicated effect we have (Roediger & Karpicke 2006).
2. **One right answer meant "known".** `srs.review` treats a single correct
   answer as evidence, and a wrong answer resets `interval` and `reps` to 0,
   throwing away the item's history. The applied-memory result that beats both
   is successive relearning — retrieval **to a criterion**, re-spaced across
   days (Rawson & Dunlosky 2011).
3. **The journal's error data was a counter, not a queue.** `error_counts`,
   `error_recurrence` and `fossilised` are computed every entry and then used
   only to *rank* things. Nothing schedules a re-exposure, so an error the
   learner made three weeks ago never comes back unless they happen to make it
   again. `drills` looked only at today's entry.
4. **Practice is blocked by tab.** Grammar, Words and Talk are three separate
   sessions. Blocking is defensible for *introducing* a form (the SLA evidence
   is mixed there) but not for review, where interleaving forces the learner to
   choose the rule instead of being told it by the tab they tapped.

## Decision

Four changes, all in code, plus one measurement module. No graph topology
change: ADR-0001 stands, and no node is added or removed.

### 1. `drills` becomes code-first and repair-shaped

`nodes/drills.py` asks `error_queue.due()` for up to three scheduled items and
renders each as a **repair**: the learner's own sentence with the error span
blanked, their wrong form named, the answer withheld until they attempt it.
Prompt text, rule and bridge come from the taxonomy; the sentence comes from
their entry. **Zero LLM cost and zero hallucination risk** on the common path.
The existing LLM generation stays as the fallback for when the queue is empty
(a first entry, or a learner with nothing due).

`main.py` prints the repairs **before** the teacher's explanation, and asks for
each answer when stdin is a terminal. Order matters: printing the correction
first turns the repair back into a recast.

### 2. `srs.review` gets a criterion and relearning steps

`src/srs.py`, mirrored in `webapp/app.js`:

- **Mastery is `MASTERY_STREAK` (3) correct answers on three distinct days.**
  `rec["days"]` holds the distinct dates; a second correct answer on the same
  day does not advance the criterion (it is massed practice).
- **A lapse enters relearning, it does not reset the item.** `interval` goes to
  0 (due again today — the existing contract), but `ease` and `days` survive,
  `lapses` increments, and the item must clear the criterion again.
- **`LEECH_LAPSES` (4) makes an item a leech.** It stops being scheduled.
  Repeatedly failing an item is not a desirable difficulty, it is evidence the
  knowledge is absent — the answer is the lesson, not another quiz.
- **Intervals get ±15% deterministic fuzz** keyed off the item id, so a cohort
  of items learned on the same day does not come back on the same day forever.

Existing stores need no migration: `review()` fills the new fields from
defaults on first touch, exactly as `loadProfile` merges over a blank.

### 3. `src/error_queue.py` — the error-type scheduler

Full specification in `docs/learning-engine.md` Part 4. In short:

- One store per learner, `data/srs/<learner>_errors.json`, keyed
  `category:normalised-span` — the same key shape `_fossil_key` already uses,
  so an error made twice lands on the same item. That *is* the fossilisation
  signal.
- `fold()` is called by `nodes/memory.py` on every entry (deterministic, in the
  code layer where every other count already lives). A new item is due
  **tomorrow**, never today: same-day re-drilling of an error just explained is
  massed practice against an explanation still in working memory.
- `due()` ranks by `blocking × recurrence × treatability ÷ (1 + days_to_due)`
  and returns **at most one item per category** per session.
- **Graduation needs two conditions**: the criterion met on three distinct days
  **and** the form absent from the last two journal entries. A learner can pass
  any drill; only free production is evidence.
- Categories marked `treatable: false` are never drilled and never scored —
  they graduate by absence alone.

### 4. `treatable:` on every taxonomy category

`knowledge/error_taxonomy.yaml` gains one boolean per category. Rule-governed,
closed-class errors (articles, copula, agreement, plurals…) respond to explicit
correction; idiomatic ones (word_choice, collocation, register) do not — there
is no rule to look up, and drilling them mostly teaches the learner they are
bad at English (Ferris 1999; Bitchener & Knoch 2010). The flag decides whether
an error becomes a drill or an exposure.

### 5. `src/session.py` and the PWA "Today" tab

One interleaved queue across grammar, vocabulary and talk, built from due dates
rather than from which tab was tapped:

- **Review is interleaved, introduction stays blocked.** New items are grouped
  by topic and delivered together; due items are mixed. This follows the SLA
  caveat rather than the maths literature — interleaving helps discrimination,
  which is a review problem, not a first-encounter problem.
- **A miss is re-asked in the same session**, three items later, and must be
  answered correctly before the session ends. This is the within-session half
  of successive relearning.
- **New intake throttles on backlog.** Over `BACKLOG_CAP` (30) items due, the
  session serves no new material at all. An SRS that keeps adding while the
  learner drowns is how people quit.

### 6. `src/metrics.py` — proficiency separated from habit

Four numbers, all computed in code, none of them gameable by tapping:
errors per 100 words *paired with entry length*, delayed first-attempt accuracy
(items with an interval ≥ 7 days, first try only), productive mature count
(interval ≥ 21 days, last answered by typing), and categories graduated with
leeches outstanding.

XP, streak and badges are **kept** — they are habit scaffolding and ADR-0003's
reasoning still holds — but they are moved out of the answer to "am I
improving?" and shown separately, labelled as habit.

### 7. Retention gate on the queue (safety path)

The queue stores **the sentence** an error appeared in, because a repair drill
replays it back to the learner ("You wrote: …"). That is more than the profile
kept before — `error_recurrence` holds spans, not sentences — so:

- Errors are folded into the queue **only from entries the distress classifier
  rated `none`.** An `elevated` entry still feeds every counter, ranking and
  fossilisation check; it simply never comes back as a grammar exercise weeks
  later. `acute` was already excluded by the surrounding branch.
- The classifier fails toward `elevated`, so a transient LLM failure costs one
  entry's worth of queue data and never risks replaying a hard sentence.
- The store lives in `data/srs/`, which `.gitignore` already excludes.

This is a data-retention change on the safety path, so it wants a
`safety-reviewer` pass before commit even though no distress code changed.

## Consequences

- The common feedback path gets **cheaper**: the top-ranked pedagogical fix
  removes an LLM call rather than adding one, because the span and the target
  were already computed deterministically by `diff.py`.
- Errors now have a **memory across weeks**. The app can finally answer "did
  this error stop happening", which is the only question the product is
  actually for.
- `profile.error_counts` / `error_recurrence` / `fossilised` stay exactly as
  they are. The queue is a new store beside them, not a migration of them:
  `teacher`'s §7.3 selection rule still reads the same fields it always did.
- Mastery is now harder to reach — three days, not one answer. Learners who
  compare against an old profile will see their "known" counts *fall*. That is
  the correction, not a regression, and the Stats screen says so.
- Leeches are visible. Some learners will accumulate a few and feel bad about
  them; the wording routes them to the lesson rather than presenting a score.
- Two graders and two schedulers now exist in both Python and JS.
  `tests/grader_parity.js` is extended to cover the scheduler and the session
  builder, so drift fails a test instead of a learner.

## Alternatives rejected

- **FSRS instead of the criterion scheduler.** Its documented advantage is
  lower error in *predicting recall* on large Anki logs — not a demonstrated
  learning gain — and it needs a review history this app has not accumulated.
  Successive relearning captures most of the same benefit for a fraction of the
  work. Revisit at ~10k reviews.
- **A new `repair` node in the graph.** Repairs are pure code over edits that
  already exist in state; a node would add topology for no capability. ADR-0001
  stays untouched.
- **Letting the model write the repair prompts.** The blank is a substring
  operation on the learner's own sentence. Generating it would put model text
  into an answer key, which standing rule 1 forbids.
- **Dropping XP and streaks.** ADR-0003 adopted them deliberately and the
  retention argument is real. The defect was never their existence — it was
  their promotion to *progress*. Demoting them costs nothing and keeps the
  habit loop.
- **A reading strand in this iteration.** It is the largest gap in the app
  (Nation's input strand is at 0%) and the largest build: a graded library is a
  content project. Shipping four texts nobody reads would not close it. It is
  v2's headline, and `docs/learning-engine.md` says so out loud rather than
  hiding it in a backlog.
