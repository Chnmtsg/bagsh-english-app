# 0010. Every word in the study list explains itself

## Status: accepted

Raised by the learner, in these words: *"In my study list, there is no
explanation of unknown words. If I don't know this word I need to use a
dictionary. I don't like that."*

## Context

The Coverage Check asks a learner, twenty words at a time, whether they know a
word. Every "no" goes to the study list. That list then said, for any word not
among the 120 curated deck cards:

> толь бичгээс хараарай — look it up, then mark it known

Which is a strange thing for an **offline** app to say to somebody who has just
told it they do not know a word. It is also the wrong way round: the app knew
enough to ask the question and put the word on a list, and then handed the
learner the one part it could have done for them.

The data made it worse than it looks. The study list is fed from
`knowledge/cefr_wordlist.json` — 6,800 words — and the deck covers 120 of them.
So the useful case was about 2% of the list.

There was no dictionary to draw on: `data/raw/` holds the frequency dataset,
which has word ids, part-of-speech tags and counts, and **no definitions**. The
PWA has no network and, by design, no model. So the only honest fix was to
write the glosses.

## Decision

### 1. `knowledge/glosses/` — a plain-English dictionary for the word list

Four files, 1,940 entries: `a1.yaml`, `a2.yaml`, `b1.yaml` and `function.yaml`
(grammar words, numbers, and the stragglers the bands missed). House style, all
enforced by tests:

- Simple English, using words from the same band or an easier one.
- **Never circular.** "work: to do work" teaches nothing, and neither does
  "worker: somebody who works" — the test checks stems, not just the word.
  Grammar words are the deliberate exception: `of: belonging to, or made of` is
  the clearest gloss there is, so words in the function list are shown working
  rather than described.
- One to eighteen words. Longer than that means it wants a card in
  `vocabulary.yaml`, with stress, an example and Mongolian.
- **No new Mongolian.** Mongolian comes from `vocabulary.yaml` where the word
  is already a card, and a test fails on any Cyrillic in these files — the
  ADR-0006 rule, unchanged.
- Base forms only; inflections are resolved in code.

### 2. `src/glossary.py` — one place to ask what a word means

Sources, richest first: the deck (stress + English + Mongolian + example) →
the reading glosses (ADR-0009) → these files → all three again through
`reading.stems`, so `workers` answers with `work` and says which word it found.

The stemmer gained derivational suffixes for this (`-ness`, `-ment`, `-tion`,
`-ity`, `-able`…) plus doubled-consonant pasts, so `referred` reaches `refer`
and `accessibility` reaches `accessible`. Over-stemming is safe: a form that is
not a word matches no source.

### 3. Coverage is a test, not a hope

`test_glossary.py` asserts **100% coverage of A1, A2 and B1** — every word the
Coverage Check can offer a learner at those levels. It fails if a word list
change reintroduces a gap. B2 and above are explicitly *not* covered yet, and
a test asserts that too, so the gap is a recorded fact rather than a surprise;
the learner this was raised by is B1, and the ladder gates B2 behind mastering
the B2 cards.

### 4. What the learner sees

- **Study list**: every word with its meaning, its Mongolian and example where
  the deck has them, and "from *work*" when the entry came from a base form.
  It also says `18/18 explained`, so the coverage is visible rather than
  claimed.
- **Coverage Check**: the round ends by listing the words just marked unknown
  **with their meanings**. The gap is the moment to close it; a dictionary trip
  later is a trip that does not happen.
- **CLI**: `python -m src.play define --word snow`.

### 5. Corpus junk stops being offered as vocabulary

The frequency dataset is built over a corpus with legal citations in it, so its
A1 band contains the "words" `b`, `c`, `p` and `s`. They are now filtered out of
the Coverage Check — a single letter is not vocabulary, except `a` and `I`.

## Consequences

- `webapp/data.json` grows from ~0.4 MB to ~0.9 MB. It is cached by the service
  worker on first visit, so this is a one-time cost for a permanently offline
  dictionary; the whole point of the app is that it works with no network.
- The glossary is now a thing that must be maintained. `coverage_of()` reports
  what is missing for any word list, so extending it to B2 is mechanical: run
  it, write the gloss for what it names.
- 1,940 definitions written in one pass are 1,940 chances to be slightly off.
  The tests catch the mechanical failures — circular, empty, oversized, invented
  Mongolian — and nothing catches a definition that is merely clumsy. The A1
  and A2 bands deserve a native-speaker read before anyone calls them final.
- These glosses are *not* a level authority and not teaching material. They
  explain; `vocabulary.yaml` still teaches, and still decides what level a word
  is (ADR-0005).

## Alternatives rejected

- **Ship a real dictionary.** WordNet or a Wiktionary dump would be more
  complete and better checked than anything written here. It is also tens of
  megabytes before trimming, needs licence handling, and its definitions are
  written for people who already read English well — "deposit: matter that has
  been deposited by some natural process" helps nobody at B1.
- **Generate the glosses with a model at build time.** Faster than writing
  them. It also puts unreviewed model text into the one place a learner goes
  when they are already confused, and the repo's standing rule keeps model text
  out of answer keys for exactly this reason.
- **Only offer words we can explain in the Coverage Check.** It would have made
  the promise true by shrinking it, and quietly changed what "coverage" measures
  — the check exists to estimate how much of a frequency band a learner knows.
- **Link out to an online dictionary.** The app is offline-first. A link that
  fails on the bus is worse than no link.
