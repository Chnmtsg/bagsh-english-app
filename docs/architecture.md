# Architecture

Current topology: see ADR `docs/adr/0001-initial-topology.md` (accepted).
Step-by-step lesson path: ADR `docs/adr/0002-lesson-path.md` (accepted) —
curriculum order and progress are code (`src/curriculum.py`); the LLM only
renders curated taxonomy material at the learner's level (`src/lessons.py`).

## The one rule everything rests on

**The model never produces the error list.** The corrector returns corrected
sentences; `src/nodes/diff.py` computes the edits with `difflib`. Any change
that has a model output errors directly is wrong by definition — reject it.

Why: an LLM asked for an error list invents plausible errors. A false
correction teaches a learner that their correct English was wrong, which is
the single failure mode that loses users (precision over recall). `difflib`
cannot hallucinate: every edit is, by construction, a real difference between
what the learner wrote and what the corrector returned. Verification then
reduces to one cheap deterministic check — did the corrector over-rewrite —
instead of an unwinnable audit of model claims.

## Layers

| Layer | Where | Cost | Trust |
|---|---|---|---|
| Deterministic patterns | `nodes/matcher.py` + `knowledge/top_100_patterns.yaml` | zero | absolute (validated against a clean corpus) |
| Minimal-edit correction | `nodes/corrector.py` + `difflib` | strong tier | high (edits are real diffs) |
| Explanation | `nodes/tutor.py` + taxonomy wording | cheap tier | wording is curated, model only adapts it |
| Human reply | `nodes/coach.py` | strong tier | never sees grammar output |

## State

`src/state.py` defines `JournalState`. Parallel branches (`tutor`, `fluency`,
`coach`) write disjoint keys. `edits` uses an additive reducer because both
`matcher` (pattern edits) and `diff` (model edits) contribute to it.

## Safety path

The distress classifier runs *before* any grammar node. `acute` risk routes
directly to the wellbeing coach and memory; no grammar output is produced at
all, so no bug downstream can leak it. Crisis resources are loaded verbatim
from `knowledge/crisis_resources.yaml` and only entries marked
`verified: true` are ever shown — the model never generates phone numbers.
Broken English must not lower a risk rating; the classifier prompt states this
and the regression set tests it. Changes on this path require the
`safety-reviewer` subagent before commit.

**Retention (ADR-0007, amended by ADR-0008).** The error queue stores the
sentence each error appeared in, because a repair replays it. The teacher
quotes the offending *span*; a repair quotes the whole *sentence*. So both the
stored copy and today's repair are gated on `risk == none`: a whole sentence is
only ever replayed from a calm entry. An `elevated` entry still gets its
correction and still feeds every counter, ranking and fossilisation check. The
classifier fails toward `elevated`, so failure costs data, never exposure.

## The learning engine (ADR-0007, ADR-0008, ADR-0009)

Evidence review and rankings: `docs/learning-engine.md`. Four modules, all in
the code layer:

| Module | Owns |
|---|---|
| `src/srs.py` | The criterion scheduler. Mastery = 3 correct on 3 *distinct* days; a lapse enters relearning and keeps the item's history; 4 lapses make a leech, which leaves rotation and routes to its lesson. |
| `src/error_queue.py` | The error-type scheduler: every journal error gets a due date, keyed `category:normalised-span` (the same key as fossilisation). Treatable errors come back as **repairs** — the learner's own sentence with the span blanked; untreatable ones as **exposures**, read and never scored (ADR-0008). Graduation needs the criterion *and* absence from recent entries. |
| `src/session.py` | The mixed daily session, and the fluency-minute pool. Review interleaved across decks; new material blocked, one deck per day; a miss re-asked later in the same session; new intake stops above `BACKLOG_CAP`. |
| `src/reading.py` | The input strand. Grades a text by measured lexical coverage against the deck, the core word list, our own curated content and the frequency ranking — in that order of authority, easiest justified level winning between the last three. `scripts/validate_readings.py` gates the library on 95% coverage with every remaining word glossed. |
| `src/metrics.py` | Proficiency separated from habit. Errors/100 words *with* entry length, delayed first-attempt accuracy, productive mature count, categories graduated, fluency-round speed. XP and streaks are shown, and never used to answer "am I improving?". |

Two rules that are easy to break by accident: a **pretest guess is never
scored** (`srs.introduce`, not `srs.review` — a wrong guess at an untaught item
would otherwise spend a lapse), and a **fluency round never reschedules and
never counts as recall** (its log rows carry `fl`, which `first_attempts`
drops).

`webapp/app.js` mirrors the scheduler and the session builder for the offline
PWA; `tests/grader_parity.js` runs both implementations against the same cases
and fails on drift.

## Determinism boundary

In code, never in the LLM: level thresholds and promotion, streaks, drill
scheduling, diffing, span validation (every edit's `original` must be a real
substring of the entry), error-frequency counts and `weak_points` ranking,
fossilisation detection (category recurring ≥3 sessions), word counts,
over-rewrite ratio, error-queue state and graduation, session composition,
every proficiency metric.

The repair prompt is a substring operation over text the learner wrote — the
model is not asked to phrase it, because a generated prompt would put model
text into an answer key.

In the LLM: minimal-edit correction, adapting taxonomy wording to the
learner's level, naturalness judgement (B1+ fluency), the human reply,
drill generation.

## Prompt versioning

Every file in `prompts/` carries `version:` frontmatter. The version is
attached to every stored analysis row so a complaint can be traced to the
prompt that produced it. Bump the version on every behavioural edit.
