# 0009. The reading strand, and what "graded" has to mean

## Status: accepted

Closes the gap `docs/learning-engine.md` names twice as the largest in the app:
Nation's meaning-focused input strand was at 0%.

## Context

Every surface this app had was deliberate study. Grammar drills, word cards,
talk cloze, repairs of the learner's own errors — all of it language-focused
learning, which Nation (2007) puts at a quarter of a balanced course and which
here was closer to all of it.

That composition has a specific, predictable cost. Deliberate study is the
right tool for the first two or three thousand words; 3,000 → 9,000 is a
reading job (Nation 2006), and 98% lexical coverage is what makes a text
readable without help (Hu & Nation 2000). A vocabulary trainer with 120 curated
cards cannot take anyone there, and no scheduler improvement changes that.

The reason it stayed unbuilt is that a reading library is a content project,
and the failure mode is obvious: four texts nobody opens. Two things had to be
true before it was worth building.

1. **Graded had to mean something checkable.** Anyone can label prose "A2".
   If the label is not measured, the strand is a lie the learner discovers on
   the first paragraph.
2. **It had to cost no new Mongolian.** Every Mongolian string in this repo
   still carries the "needs native-speaker verification" warning (ADR-0006).

## Decision

### 1. `graded` is a measurement, and the build enforces it

`scripts/validate_readings.py` fails, with exit code 1, unless every text
satisfies both halves:

- **≥95% lexical coverage** for a learner at the text's own level — Hu &
  Nation's (2000) threshold for assisted comprehension; and
- **every remaining word carries a gloss**, so effective coverage at the moment
  of reading is 100%.

`src/reading.py: coverage()` computes this against four sources, and the order
is the design:

| Source | Role |
|---|---|
| `knowledge/vocabulary.yaml` | The level authority (ADR-0005). Wins outright. |
| `knowledge/core_words.yaml` | **New.** The everyday words a text may use unglossed at each band. |
| The app's own curated content | Conversation dialogues carry a level; patterns and lesson examples belong to a category with a CEFR band. A word we have already taught at A2 is an A2 word. |
| `knowledge/cefr_wordlist.json` | A frequency ranking, coverage only, consulted last. |

Between the bottom three the **easiest justified level wins**. Taking the first
source to answer made `read` a B2 word because of the dialogue it happened to
appear in, and `went` an A2 word because the surface form is ranked separately
from `go`.

### 2. A core word list, fenced off from everything else

The frequency list cannot grade everyday English. Its own header warns it has
no entry for *bread*, *milk*, *eat* or *hungry*; it also has none for *wait*,
*catch*, *apple*, *join*, *cover* or *pair*, and it ranks *watch* at C1. A
grader built on it alone rejects "I waited for the bus" as advanced prose.

So `knowledge/core_words.yaml` lists the words a text may assume at each band —
the headword list every graded-reader series has. It is fenced hard:

- it decides **nothing** about a learner's level, deck, ladder or metrics;
- the deck outranks it wherever they overlap, and a test asserts that;
- it grows **only** from words the validator has actually reported unknown in
  a real text, and a word goes at the band where a learner meets it, never at
  the band that makes a text pass.

That last rule is the one that keeps it honest, and it did real work: the deck
calls `buy`, `start` and `late` A2, so the A1 texts using them were rewritten
or glossed rather than the list being bent.

### 3. Twelve texts, English-in-English glosses

Three per band A1–B2, 130–250 words each, 2,268 running words. Subjects are the
learner's own world: the cold, the bus, a first day at work, a shift at the
mine, a heating failure, working with a team you cannot hear.

Glosses are **English-in-English**, which is also what Nation prefers at ≥95%
coverage. The Mongolian a reader sees comes from `vocabulary.yaml` when the
word is already a card, and is never written fresh — the ADR-0006 rule. A test
asserts no Mongolian is invented here.

Two comprehension questions per text, about **meaning**, never about vocabulary
or grammar. They exist so the reading has a point, not so it can be scored:
nobody remembers a text they were interrogated about.

### 4. Where it plugs in

- **PWA**: a `Read` tab. Tap any underlined word for its gloss and "add to my
  words", which drops it into the study list the vocabulary trainer already
  uses. That is the input strand handing over to the deliberate-study one.
- **CLI**: `python -m src.play read` and `python -m src.play library`.
- **Metrics**: `words read` joins the honest numbers. It is the only one that
  grows by reading rather than answering.
- **No scheduler.** You do not review a text, you read the next one, so the
  reading store is a log rather than a queue.

## Consequences

- The strand composition moves from ~100% language-focused to something that
  can at least be *described* in Nation's terms. It is not balanced yet:
  2,268 words is a starter library, not extensive reading.
- Adding a text is now mechanical and gated: write it, run the validator, gloss
  or rewrite what it flags. The bar is enforced by a script rather than by
  whoever is writing that day.
- `core_words.yaml` is a second word list in a repo that has an ADR insisting
  there is only one level authority. The tension is real; the fence (no effect
  on any learner-facing level, deck loses to nothing) is what makes it
  acceptable. If it ever starts deciding something, this decision was wrong.
- The stemmer is deliberately crude — suffix rules plus an irregular table.
  Anything it misses surfaces as out-of-band in the validator, where a curator
  sees it. It will occasionally over-count a word as unknown; it should never
  silently pass a hard text.
- Reading gives XP (a lesson's worth) and feeds the streak. It does not feed
  the SRS, and no text is ever "due".

## Alternatives rejected

- **Model-generated texts at read time.** Cheap, infinite, and it would put
  unverified English in front of a learner as the thing to imitate. The same
  rule that keeps a model out of the answer key keeps it out of the library.
- **Grading against the frequency list alone.** Tried first. It rejects
  everyday prose and accepts legal vocabulary; see the numbers above.
- **Adding the missing everyday words to `vocabulary.yaml` instead.** They
  would need stress marks, examples and Mongolian glosses — several hundred
  cards, and new unverified Mongolian. The grading list needs none of that
  because it teaches nothing.
- **Comprehension questions that test vocabulary.** It would turn the one
  non-testing surface into another test, and it would make the glosses
  something to memorise rather than something to lean on.
- **A word-count target or reading streak.** The temptation is obvious and it
  is the anti-pattern this project already refuses: the moment volume is the
  goal, skimming is the rational strategy.
