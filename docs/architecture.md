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

## Determinism boundary

In code, never in the LLM: level thresholds and promotion, streaks, drill
scheduling, diffing, span validation (every edit's `original` must be a real
substring of the entry), error-frequency counts and `weak_points` ranking,
fossilisation detection (category recurring ≥3 sessions), word counts,
over-rewrite ratio.

In the LLM: minimal-edit correction, adapting taxonomy wording to the
learner's level, naturalness judgement (B1+ fluency), the human reply,
drill generation.

## Prompt versioning

Every file in `prompts/` carries `version:` frontmatter. The version is
attached to every stored analysis row so a complaint can be traced to the
prompt that produced it. Bump the version on every behavioural edit.
