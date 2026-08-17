# English journal app — project context

Daily English journaling for Mongolian speakers. A learner writes an entry; a
LangGraph pipeline corrects it minimally, explains the errors like a teacher,
replies to the content as a human, and tracks patterns across entries.

## Two layers of agents — do not confuse them

**Runtime agents** live in `prompts/` and `src/nodes/`. They run when a user
submits an entry. Corrector, error tutor, fluency, human coach, teacher voice,
drills, level estimator, weekly review, distress classifier.

**Build-time subagents** live in `.claude/agents/`. They run while developing.
Architect, graph-engineer, prompt-engineer, linguistics-curator, eval-runner,
safety-reviewer.

When a request says "the corrector agent", it means the runtime one. When it
says "the prompt engineer", it means the subagent.

## Layout

```
src/            graph.py, state.py, nodes/, llm.py
                srs.py, error_queue.py, session.py, metrics.py  (learning engine)
                reading.py, glossary.py, verbs.py, sounds.py
prompts/        runtime agent prompts, versioned frontmatter
knowledge/      error_taxonomy.yaml, top_100_patterns.yaml,
                contrastive-guide.md, crisis_resources.yaml,
                pseudowords.yaml (Coverage Check anchors — never teachable),
                readings.yaml + core_words.yaml (the graded library),
                glosses/*.yaml (plain-English meanings, ADR-0010),
                irregular_verbs.yaml (the four-form table, ADR-0011),
                sounds.yaml (spelling→sound; Mongolian UNVERIFIED, ADR-0012)
evals/          regression.jsonl, reports/
docs/           architecture.md, learning-engine.md, adr/, prompt-principles.md
scripts/        run_regression.py, validate_patterns.py, category_frequency.py
tests/
webapp/         offline PWA — mirrors the scheduler and session builder in JS
```

## Delegation

| Task | Subagent |
|---|---|
| Add a node, change state shape, change routing | `architect` first, then `graph-engineer` |
| Implement an accepted ADR | `graph-engineer` |
| Change what a runtime agent says | `prompt-engineer` |
| Add a category, rule, bridge, or regex pattern | `linguistics-curator` |
| Add a reading text or a core word | `linguistics-curator`, then `validate_readings.py` |
| Write or fix a word gloss | `linguistics-curator`; `tests/test_glossary.py` is the contract |
| Measure after any change | `eval-runner` |
| Anything touching distress, wellbeing or minors | `safety-reviewer`, before commit |

## Handoff is through files, not conversation

Subagents cannot talk to each other. Each one's output must be an artifact in
the repo:

```
architect            -> docs/adr/NNNN-*.md
prompt-engineer      -> prompts/*.md, version bumped
linguistics-curator  -> knowledge/*.yaml
graph-engineer       -> src/**
eval-runner          -> evals/reports/*.json
safety-reviewer      -> verdict in the conversation, blocking
```

A subagent's context starts fresh. When delegating, put the file paths, the ADR
number and the specific failing case ids in the prompt — the subagent cannot see
this conversation.

## Standing design rules

1. **The model never produces the error list.** The corrector returns corrected
   sentences; `difflib` computes the edits. This is the rule the whole app
   rests on. Reject any change that has a model output errors directly.
2. **Code before model.** The 64 deterministic patterns run before the corrector
   at zero cost and zero hallucination risk. Anything a model does not need to
   do, it should not do.
3. **Grammar and empathy never mix.** The human coach never mentions English.
   The teacher never performs comfort. Acute distress skips grammar entirely.
4. **Precision over recall.** A false correction teaches a learner their correct
   English was wrong. Missing an error costs almost nothing by comparison.
5. **At most 3 corrections shown** — by default. An overwhelmed learner
   stops writing. A learner who explicitly sets `strictness: high` has
   asked to see everything and gets all detected errors, grouped by
   pattern (Bagsh v2 §6.1, ADR-0004). Detection is always complete either
   way; only display varies.
6. **Rules come from the taxonomy, not the model.** Consistency across weeks
   beats freshness in any single response.
7. **Every prompt is versioned** and the version is stored on each feedback row.
8. **Prompt, don't recast** (ADR-0007). Feedback asks the learner to produce the
   fix before it shows one. A correction they only read is not retrieval.
9. **One right answer is not knowing.** Mastery is a criterion — correct on
   three different days — and it is measured by whether the error stopped
   appearing in free writing, not by a passed drill.
10. **Habit numbers are never progress.** XP, streaks and badges stay; they may
    never answer "am I improving?". That question is answered by
    `src/metrics.py` only.

## Commands

```bash
pytest tests/ -q
node tests/grader_parity.js        # the PWA's grader AND scheduler match Python
python scripts/build_webapp_data.py   # after any knowledge/*.yaml change
python scripts/run_regression.py --set evals/regression.jsonl
python scripts/validate_patterns.py --corpus data/clean_english.txt
python -m src.play today           # the learner's daily session
python -m src.play fluency         # timed round on mastered items
python -m src.play read            # the input strand
python -m src.play verbs           # irregular verb forms
python -m src.play sounds --review # the Cyrillic awaiting a native check
python -m src.play define --word X # what a word means
python scripts/validate_readings.py   # every text is graded, or the build fails
python -m src.play progress        # the honest metrics
```

Any change to scheduling, session composition or a metric exists twice —
`src/*.py` and `webapp/app.js`. Change both, then run the parity harness.

## Notes

Subagent definitions are loaded at startup — restart the session after adding or
editing one. `/agents` opens the management UI and is the easiest way to check
what is actually loaded and to verify tool names for your version.
