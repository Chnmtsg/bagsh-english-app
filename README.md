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

Study games (offline, free, no API key needed — spaced repetition + XP,
streaks and badges; see `docs/app-review.md` for where the mechanics come
from and ADR-0003 for the design):

```bash
python -m src.play grammar     # fix-the-sentence game, covers all 24 systems
python -m src.play vocab       # word trainer: meaning + spelling, stress-marked
python -m src.play talk        # conversation drills: type the missing chunk
python -m src.play stats       # XP, streak, badges
```

All modes share the learner profile: errors in your journal pull that
topic's lesson and quiz items forward, journaling/lessons/games all feed
the same daily streak, and your level rises automatically from journal
accuracy — no speaking or listening anywhere, by design (word stress is
taught in text: `de-POS-it`). Vocabulary grows by curation in
`knowledge/vocabulary.yaml`; never let a model write into it.

## Develop

```bash
pytest tests/ -q
python scripts/validate_patterns.py --corpus data/clean_english.txt
python scripts/run_regression.py --set evals/regression.jsonl
node tests/grader_parity.js      # PWA grader matches src/quiz.py
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
