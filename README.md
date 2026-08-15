# Багш — English journal app for Mongolian speakers

A learner writes a daily journal entry in English. A LangGraph pipeline:

1. triages the entry (code),
2. classifies distress and, if acute, **skips grammar entirely** (safety gate),
3. matches known deterministic Mongolian-interference patterns (code, zero cost),
4. corrects the text with minimal edits (LLM),
5. computes the edit list with `difflib` — **the model never produces the error list**,
6. guards against over-rewriting (code),
7. in parallel: labels/explains edits (tutor), notes B1+ fluency issues, and replies
   to the *content* as a human (coach — never mentions English),
8. folds results into the learner profile (code),
9. composes teacher feedback — at most 3 corrections, taxonomy-worded — and drills.

## Setup

```bash
pip install -r requirements.txt
set ANTHROPIC_API_KEY=sk-...   # PowerShell: $env:ANTHROPIC_API_KEY="sk-..."
```

## Run

Journal mode (write, get corrected):

```bash
python -m src.main "Today I am go to site. We collected three sample."
```

Lesson mode (see your level and the step-by-step path, study the next topic):

```bash
python -m src.lessons                  # path + today's lesson
python -m src.lessons --list           # path only
python -m src.lessons --done copula    # mark a topic studied
```

Study (offline, free, no API key needed — spaced repetition, error repair and
honest metrics; the reasoning is in `docs/learning-engine.md`, the decisions in
ADR-0003 and ADR-0007):

```bash
python -m src.play today       # THE session: everything due, decks interleaved
python -m src.play errors      # repair YOUR sentences from the journal queue
python -m src.play grammar     # fix-the-sentence game, covers all 24 systems
python -m src.play vocab       # word trainer: meaning + spelling, stress-marked
python -m src.play talk        # conversation drills: type the missing chunk
python -m src.play fluency     # 60 timed seconds on what you already know
python -m src.play read        # read something graded to your level
python -m src.play library     # what there is to read
python -m src.play progress    # what you can actually do (not XP)
python -m src.play stats       # XP, streak, badges — habit, not progress
```

`today` is the one to run daily: it pulls whatever is due across all decks and
mixes them, because in real English nobody tells you which rule is coming. An
item is learned after three correct answers on three *different* days, a miss
comes back later in the same session, and four misses take an item out of
rotation — that one needs its lesson again, not another quiz.

All modes share the learner profile: errors in your journal become scheduled
repair drills, journaling/lessons/games all feed the same daily streak, and
your level rises automatically from journal accuracy — no speaking or listening
anywhere, by design (word stress is taught in text: `de-POS-it`). Vocabulary
grows by curation in `knowledge/vocabulary.yaml`; never let a model write into
it.

## Develop

```bash
pytest tests/ -q
python scripts/validate_patterns.py --corpus data/clean_english.txt
python scripts/run_regression.py --set evals/regression.jsonl
node tests/grader_parity.js      # PWA grader AND scheduler match Python
python scripts/validate_readings.py   # every reading text is really graded
```

Re-run `python scripts/build_webapp_data.py` after any `knowledge/*.yaml`
change and commit the regenerated `webapp/data.json`.

See `CLAUDE.md` for the standing design rules and `docs/architecture.md` for the
topology. Build-time subagents live in `.claude/agents/`.

## Sources

- `knowledge/contrastive-guide.md` — the English–Mongolian contrastive guide
  (five volumes, §1.1–§LL). Cited by `guide_ref` throughout the taxonomy.
- The Bagsh v2 master prompt informed the taxonomy, fossilisation handling and
  language policy. Its single-call JSON architecture was **not** adopted — it
  conflicts with standing rule 1 (the model never produces the error list).
