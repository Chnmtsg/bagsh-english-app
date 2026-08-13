# 0001. Initial pipeline topology

## Status: accepted

## Context

First build of the journal pipeline. Three source documents constrain the design:

- `CLAUDE.md` standing rules (model never produces the error list; code before
  model; grammar and empathy never mix; precision over recall; ≤3 shown
  corrections; taxonomy-sourced rules; versioned prompts).
- The Bagsh v2 master prompt proposes a single LLM call that detects, classifies
  and explains in one JSON response. **Rejected** for this app: it has the model
  output the error list directly, which violates standing rule 1. Its
  linguistic content (30 interference codes, fossilisation protocol, language
  policy, determinism boundary in its Appendix A) is adopted as source material.
- The contrastive guide (`knowledge/contrastive-guide.md`) supplies the Top-100
  checklist and the L1 bridges.

## Decision

A `StateGraph` over `JournalState` with this topology:

```
ingest
  └─ triage        (code)   length, language share, sentence split
       └─ distress (llm, cheap)  risk: none | elevated | acute
            ├─ acute ──► coach_wellbeing path: coach (wellbeing prompt)
            │            └─ memory ─► END        ← NO grammar nodes run
            └─ else ───► matcher   (code)  deterministic pattern edits
                          └─ corrector (llm, strong)  minimal-edit rewrite
                               └─ diff    (code)  difflib token alignment → model edits
                                    └─ verify (code)  over-rewrite guard, span check
                                         ├─ tutor   (llm, cheap)  labels model edits
                                         ├─ fluency (llm, cheap)  gated at B1+
                                         └─ coach   (llm, strong) content-only reply
                                              └─ memory  (code)  profile fold/write
                                                   └─ teacher (llm, strong) ≤3 corrections
                                                        └─ drills (llm, cheap)
                                                             └─ END
```

- **Distress gate is structural, not prompt-level.** When risk is `acute`, the
  conditional edge routes around every grammar node. A prompt promising to be
  gentle is not a gate; an edge is.
- A deterministic keyword pre-check in code runs before the classifier and can
  only *raise* risk, never lower it (code before model; recall over precision
  on this one path — the single place where that priority inverts).
- `tutor`, `fluency`, `coach` run as parallel branches and write disjoint keys
  (`labelled_edits`, `fluency_notes`, `coach_reply`).
- Pattern edits from `matcher` carry `source: "pattern"` with category,
  severity and explanation filled from the taxonomy. They skip the tutor.
- Level estimation is **code** (accuracy trend in `memory`), per the
  determinism boundary. `prompts/level_estimator.md` exists only for the
  cold-start case: a brand-new learner's first entry, where there is no trend.
- Weekly review is a separate offline flow (`scripts/`), not a per-entry node.

## Consequences

- Two LLM calls minimum per entry (distress + corrector), five typical. At
  1,000 DAU this is the dominant cost; the cheap tier carries distress, tutor,
  fluency and drills to compensate.
- Corrector retry on over-rewrite adds a strong-tier call in the worst case;
  bounded at one retry, then the entry fails visibly rather than passing
  through a rewrite.
- The parallel fan-out means state keys are contractual. Any new branch node
  must claim a fresh key or declare a reducer — see node contract table in
  `docs/architecture.md`.
- Cold-start level estimation costs one extra cheap call on a learner's first
  entry only.

## Node contract

| Node      | Kind | Tier   | Reads                          | Writes                              | Failure mode |
|-----------|------|--------|--------------------------------|-------------------------------------|--------------|
| triage    | code | —      | text                           | triage                              | never fails; flags |
| distress  | llm  | cheap  | text                           | distress                            | on error: risk=`elevated` (fail toward safety) |
| matcher   | code | —      | text                           | pattern_edits                       | never fails |
| corrector | llm  | strong | text                           | corrected_text                      | retry ×1, then entry fails with error set |
| diff      | code | —      | text, corrected_text           | model_edits                         | never fails |
| verify    | code | —      | text, corrected_text, edits    | verify                              | flags over_rewrite → one corrector retry |
| tutor     | llm  | cheap  | model_edits, learner           | labelled_edits                      | degrade: edits keep taxonomy default wording |
| fluency   | llm  | cheap  | text, learner.level            | fluency_notes                       | degrade: empty list |
| coach     | llm  | strong | text, distress                 | coach_reply                         | degrade: short generic reply, never grammar |
| memory    | code | —      | edits, learner                 | learner, profile file               | must not fail; on IO error, log + skip write |
| teacher   | llm  | strong | edits, learner, taxonomy       | teacher_feedback, displayed edits   | degrade: template from taxonomy wording |
| drills    | llm  | cheap  | top pattern, learner           | drills                              | degrade: empty list |
