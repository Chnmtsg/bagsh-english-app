# ADR-0015 — Small Step gets the learner's-own-errors queue, with a corrector

**Status:** accepted, built · **Date:** 2026-08-23
**Depends on:** ADR-0007 (the error-type scheduler), ADR-0008 (exposures)
**Scope:** `boldoo/` only. `src/`, `webapp/` and the parent tests are untouched.

## Context

Small Step (`boldoo/`) was built with no model anywhere: every exercise is
generated and graded by code from transcribed content. Its evidence review
(`boldoo/LEARNING.md`, Part 4) named the cost of that choice — there is no
learner-specific error signal, so the strongest personalisation mechanism in
the research (schedule the learner's *own* errors; Ferris 1999, Bitchener &
Knoch 2010, Lyster & Ranta 1997) could not exist. The owner asked for it.

The journal app already has the mechanism (ADR-0007): corrector LLM →
`difflib` → queue keyed by category + form → repair-first drills → graduation
by absence. The question is how much of that survives a move to a browser
with no server, no bundler, no distress classifier, and a learner-supplied
API key.

## Decision

Port ADR-0007 to `boldoo/`, with the standing rule intact and three
deliberate narrowings.

**The model does two things and nothing else.**

1. `correct(text)` — returns the learner's text with clear errors fixed.
   `prompts/corrector.md` v1.0.0, verbatim, plus one rule: the Mongolian
   source sentence is supplied *for meaning only* and must not pull the
   English toward a translation.
2. `label(edits)` — assigns each **code-computed** edit a category from the
   closed 24-value enum. It classifies; it cannot detect and cannot invent.

The edit list comes from `CORRECT.diff()`, a port of `src/nodes/diff.py`
(same tokenizer; LCS alignment; a parity fixture generated from Python's
`difflib` is in `boldoo/tests/diff_cases.json`). A mis-labelled edit is a
misfiled drill; an invented error is impossible by construction.

**The queue is `src/error_queue.py` in JavaScript** (`boldoo/errors.js`):
key = category + normalised form; new items due *tomorrow*; repair = the
learner's own sentence with the span blanked; one item per category per
session; criterion = three distinct days; graduation needs the criterion
*and* absence from the next two checked drafts; untreatable categories are
never drilled and return as a read-only exposure; four lapses make a leech.
Scheduling uses Small Step's interval ladder rather than the Python's ease
factor so the app has one scheduler, not two.

**Three narrowings, stated:**

- **Only the Write screen's translation drafts are sent.** These are book
  prompts, not personal journaling, so the distress path (ADR-0008 §5) is not
  entered and the safety-reviewer's domain is not touched. Free journaling
  stays in Багш, where the classifier exists. If Small Step ever gains a free
  text box, that is a new ADR and a safety review, not an extension of this
  one.
- **Insertions are keyed on the inserted word** (`articles:+a`), not on the
  empty form. The Python keys every insertion in a category to one item;
  that collapses "missing *a*" and "missing *the*" and was judged a defect
  worth diverging on. The parent may adopt it; not decided here.
- **The learner can dispute a correction.** A repair the learner marks as
  "my version was right" moves to `disputed` and is never drilled or
  re-queued. This is the precision-over-recall rule applied to the one place
  model text becomes an answer key.

**Transport** is a raw `fetch` to `POST /v1/messages` — there is no bundler,
so no SDK; there is no server, so the key is the learner's own, stored under
`boldoo.apikey.v1` and excluded from progress export. The request sends the
`anthropic-dangerous-direct-browser-access: true` header the API requires
from a browser origin (*uncertain — verify against the current docs if the
call is rejected with a CORS error*). Model: `claude-opus-5`; no sampling
parameters; `output_config.effort` `medium` for the corrector, `low` for the
labeller. Two calls per checked draft, the second skipped when there are no
edits.

## Consequences

- Small Step's design rule 1 changes from "nothing is produced by a model at
  runtime" to "the model never produces the error list, and never writes an
  answer for a book item". The repair answer is model text; that is named in
  `errors.js`, `README.md` and the Write screen, and the dispute button is
  the remedy.
- The app is still fully usable with no key: every other screen is
  unchanged, and the Write screen says where the key goes.
- Storage: `boldoo.errors.v1` (queue), `boldoo.apikey.v1` (key). Reset
  clears the queue; export does not include the key.
- `knowledge/error_taxonomy.yaml` is now consumed by two apps. It is copied,
  not edited: `python scripts/build_boldoo_taxonomy.py` regenerates
  `boldoo/content/taxonomy.js`, and the linguistics-curator remains the
  owner.
- Cost is the learner's. Two short calls per checked draft at Opus 5 rates;
  a draft is one or two sentences. No batching, no caching — the system
  prompt is under the cacheable minimum.

## Not done, and why

- **Deterministic patterns before the corrector** (`top_100_patterns.yaml`,
  standing rule 2). They would catch the most common Mongolian-L1 errors at
  zero cost before any call. Deferred: the pattern file is Python-regex with
  per-pattern false-positive validation against a corpus; porting it without
  that validation would ship unvalidated patterns. A `build_boldoo_patterns`
  step with the same corpus check is the right follow-up.
- **Tutor explanations at the learner's level.** The taxonomy's `rule_a2`
  and `bridge` are shown as written. The labeller is not asked to explain
  (ADR-0007's tutor is); one fewer thing a model writes to a learner.
- **Category-level graduation on the Progress screen** is computed
  (`categoriesGraduated`) but only listed, not charted — the numbers are too
  small to plot honestly for months.
