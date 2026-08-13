# 0002. Step-by-step lesson path (curriculum mode)

## Status: accepted

## Context

The journal pipeline teaches reactively: the learner writes, the pipeline
corrects. The product also needs a proactive mode — the learner opens the
app, sees their level and a step-by-step path of grammar topics, and studies
the next one. Text only: speaking and listening are out of scope (the audio
ban stands; word STRESS stays in, because stress is written).

The teaching order must not be invented per-session by a model. The guide
(§1.8) already prescribes sequencing by frequency × impact, and the taxonomy
carries it as `priority` 1–24.

## Decision

- **The curriculum is code, not model.** `src/curriculum.py` orders the 24
  taxonomy categories by `priority` and derives per-category status from the
  learner profile: `weak` (in `weak_points`), `seen` (errors recorded),
  `new` (never seen). Next lesson = first `weak` category in priority order,
  else first `new`, else the lowest-priority category as review.
- **Lesson content is curated-first.** A lesson is assembled from the
  taxonomy entry (rule at the learner's level + Mongolian bridge) and the
  checklist's wrong/right pairs for that category. The LLM (strong tier,
  `prompts/lesson.md`) only *renders* this material into the §5 teaching
  loop shape (notice → contrast → rule → examples → practice → close) at the
  learner's reading level. On LLM failure the lesson degrades to a
  deterministic template from the same material — a lesson is never skipped
  because the API was down.
- One grammar point per lesson. Practice questions must be produced by the
  learner (retrieval), answerable in under 10 seconds.
- Entry point: `python -m src.lessons [--learner ID] [--list]`. The journal
  pipeline is untouched; the two modes share the profile, so journal errors
  make the path re-rank (a category going weak pulls its lesson forward).

## Consequences

- One strong-tier call per lesson (zero when degraded). No new graph nodes;
  no change to ADR-0001 topology.
- Lesson progress lives in the profile (`lessons_done`), so the path
  advances even for a learner who never journals; but level movement still
  comes only from journal accuracy trends (ADR-0001, determinism boundary).
- The same taxonomy wording appears in lessons, tutor explanations and
  teacher feedback — consistency across surfaces, by construction.

## Node contract

Not a graph node. `build_lesson(profile, category)` — reads taxonomy +
patterns + profile; writes nothing but the rendered lesson; failure mode:
deterministic template fallback; tier: strong.
