# 0014. Word partners — prepositions and collocations

## Status: accepted

The last two items on ADR-0011 and ADR-0013's open list, and the deepest
sections of the Boldoo book: which preposition a word takes, and which verb
goes with which noun.

## Context

Two of the app's 24 error categories are marked `treatable: false`:
`prepositions` and `collocation`. ADR-0007 gave the reason — they are not
rule-governed, so when a learner writes `depend of` or `do a mistake` there is
no rule to drill them on, and the error queue shows a natural alternative
instead of a correction (Ferris 1999).

That decision was about **repairing an error**, and it was right. It quietly
left the other half undone. Nothing in the app ever *taught* the partnerships
in the first place, so the learner met them only by getting them wrong.

The two Mongolian courses treat this as core material, not a footnote. Boldoo
gives pages to prepositions with their fixed expressions (`for ever`,
`in return for`, `depend on`) and 300+ numbered collocations with Mongolian
glosses. TalkTalk S9 has a lesson on phrasal verbs and another on
preposition + gerund.

## Decision

### 1. One deck, because it is one skill

`knowledge/chunks.yaml` holds 139 phrases: **81 prepositions** (verb +, adjective
+, noun +, and the time/place set) and **58 collocations** (make/do, have, take,
give, pay, keep, break, catch, and the adjective+noun pairs like *heavy rain*
and *strong coffee*).

They are one file and one deck because they are one problem — a phrase where
one word is not predictable — and the drill for both is identical. Splitting
them would double the wiring for no pedagogical gain.

### 2. The drill is a typed cloze over a real sentence

    It depends _____ the weather.        on
    I _____ three mistakes in the form.  made

The stored `answer` is the word **in the form the sentence uses** — `made`, not
`make` — and it must appear **exactly once** in the example, so the blank can
never have two right answers. `occurrences()` matches whole words only, so `on`
in `on Monday` is not also found inside `London`. Both properties are tests,
and they are what makes the deck safe to grade by exact match.

The example must also contain **both halves** of the partnership, checked
through the stemmer so `make a mistake` can appear as `made three mistakes`.
That test caught a real one: `spend time` was illustrated by a sentence that
never said *time*.

### 3. The blank falls on the unpredictable word

For a preposition chunk that is the preposition. For a collocation it is
usually the verb — `I ___ a mistake` — because the verb is the part Mongolian
gets wrong: *хийх* covers both *make* and *do*, so `do a mistake` and
`make homework` are the two errors this deck exists for, and both are in it.

### 4. Mongolian only where the L1 actually pulls

Ten entries carry a note, and only where Mongolian pushes toward the wrong
English: `good in` for *good at*, `married with` for *married to*, `explain me`
for *explain to me*, *хийх* for make/do. The rest need no note — an English
phrase and an English sentence are enough. The notes are unverified Mongolian,
like every bridge outside `vocabulary.yaml`.

## Consequences

- Five practice decks now: grammar, vocab, talk, verbs, chunks — plus the error
  queue. The daily session interleaves all of them, and the new-material
  rotation cycles one deck per day, so the five decks introduce material on a
  five-day cycle rather than competing.
- 139 more items to master. As with the verbs, this lengthens the road rather
  than the daily session: the scheduler throttles new intake on backlog.
- `webapp/data.json` reaches ~1.0 MB.
- The taxonomy is untouched. `prepositions` and `collocation` remain
  untreatable **as errors** — this deck teaches, it does not repair. A learner
  who writes `depend of` still gets an exposure, not a drill, and that
  distinction is the whole reason both mechanisms exist.

## What is deliberately not here

- **Phrasal verbs** live in `advanced_grammar.yaml` as a lesson (ADR-0013),
  not here. They are rule-governed in one respect that matters — the pronoun
  splits a separable verb — so they get a lesson with a rule, and this deck is
  for the phrases with no rule at all.
- **A 300-phrase list.** Boldoo has one; this has 139, chosen for frequency and
  for the errors the taxonomy already sees. Adding more is mechanical: write
  the row, and the tests check it.
- **Receptive multiple choice.** Choosing `on` from four prepositions is
  easier than producing it, and produces knowledge you cannot use when writing
  (`docs/learning-engine.md` §13c). Every item here is typed.
