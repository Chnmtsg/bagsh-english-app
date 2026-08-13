# 0003. Study games: SRS, grammar game, vocabulary trainer, gamification

## Status: accepted

## Context

The app taught only reactively (journal) and linearly (lesson path). The
learner asked for a way to study ALL grammar and vocabulary, simplified and
fun. `docs/app-review.md` surveys the major apps; this ADR records what we
build and where it lives.

## Decision

Everything below is **code + curated YAML. Zero LLM calls in the games.**
A hallucinated quiz answer would teach wrong English; curated content
cannot. This also makes the games free and offline.

- **`src/srs.py`** — SM-2-lite spaced repetition: per-item ease/interval/
  due-date, wrong answers reset and return sooner. State per learner+deck
  in `data/srs/`.
- **`src/quiz.py`** — pure question banks and answer checking.
  Grammar bank = Top-100 checklist minus professional tier (the wrong form
  is the prompt; the right form is the answer; feedback = the pattern
  explanation + the category's Mongolian bridge). Vocab bank =
  `knowledge/vocabulary.yaml` (stress-marked, glossed en+mn, example
  sentence each); round types: meaning-choice and type-the-word cloze.
- **`src/game.py`** — XP, daily streak, badges; all computed in code and
  stored on the learner profile. Every surface (journal, lesson, games)
  calls the same `record_activity`, so any activity keeps the streak.
- **`src/play.py`** — interactive CLI: `python -m src.play grammar|vocab|stats`.
  Default 5 questions per session (bite-size, always finishable).

Rejected mechanics (see the review): hearts/lives, leaderboards,
model-generated quiz content, anything audio.

## Consequences

- New profile fields (`xp`, `streak_days`, `badges`, counters) — additive,
  old profiles load fine via `.get` defaults.
- The vocabulary deck starts small (~60 curated words, core + work). It
  grows by curation, not generation; Mongolian glosses need native-speaker
  verification like every Mongolian string in the repo. A future iteration
  may harvest candidate words from journal corrections into a
  needs-review queue — never directly into the deck.
- The grammar game gives the deterministic patterns a second life: the
  same YAML now powers matching, lessons AND the game, so a curation fix
  improves three surfaces at once.

## Node contract

Not graph nodes. No pipeline changes beyond `memory` awarding journal XP.
