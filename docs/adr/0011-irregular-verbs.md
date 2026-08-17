# 0011. The irregular verb table, and what we take from other people's books

## Status: accepted

Prompted by the learner handing over two Mongolian English courses and asking
what the app should learn from them.

## Context

The material was:

- **TalkTalk English**, Stages 8 and 9, textbooks and workbooks (TTEC LLC,
  Ulaanbaatar, © 2022, all rights reserved) — 257 pages. Each lesson runs
  vocabulary table (English ↔ Mongolian) → dialogue → comprehension questions →
  a grammar "REMEMBER" box → **a four-form verb table**.
- **"Boldoo's English lesson"** — 150 photographed pages of a Mongolian grammar
  and phrase book: English spelling-to-sound taught through Cyrillic
  (`ea → /iː/ ий`), grammar explained in Mongolian, prepositions with their
  fixed expressions, and 300+ numbered collocations with Mongolian glosses.

Reading them, the sharpest gap in this app was not a missing topic. It was a
missing **table**. Every lesson in both books drills base / past simple / past
participle / present participle, and the app had nothing:

- `verb_form` is one of the 24 taxonomy categories.
- Ten deterministic patterns already correct exactly these errors —
  `I have went there` → `gone`, `The report was wrote` → `written`.
- Nothing anywhere taught the forms. A learner could be told they were wrong
  indefinitely and never meet the answer.

## Decision

### 1. What we take, and what we do not

Both books are copyrighted publications. **No text from either is copied into
this repo** — not a dialogue, not a sentence, not a Mongolian gloss, not a word
list. What they provide is evidence about what Mongolian learners are actually
taught, and that evidence justified building something.

The forms of English irregular verbs are facts. `go / went / gone` is not
anybody's creative expression, and it appears in every reference grammar. The
102 verbs here were chosen and levelled for this app, and every example
sentence is written for it.

The two source folders are in `.gitignore`. They are 538 MB of someone else's
work, on loan for reading.

### 2. `knowledge/irregular_verbs.yaml` — 102 verbs, three forms

`base`, `past`, `participle`, a level (A1 35 / A2 35 / B1 32), an example
sentence that must actually contain the past or the participle, and a `note`
only where a form is genuinely confusable — `lie/lay`, `hang/hanged`,
`bear/born`, and every same-form verb, because `put/put/put` is the fact
learners most often disbelieve.

**The present participle is not stored.** It is regular for every irregular
verb in English, so `src/verbs.py` computes it from the doubling and -e rules
with a short exception table. A stored column is a column to get wrong.

### 3. Two typed drills per verb, and the cue is the table label

    go — past simple?               went
    go — past participle (have …)?  gone

The first version cued with a sentence frame, `go → yesterday I ___`. That
reads naturally for `go` and produces nonsense for `cost`, `hurt` and `let` —
a prompt that models wrong English, which is what standing rule 4 exists to
prevent. The table label works for all 102, and a test now asserts no prompt
starts with a frame.

Both drills are **typed**, so they count as production in the metrics. 204
items join the four decks the scheduler already knows.

### 4. `verbs` is a full deck, not a side feature

It appears in the mixed daily session, the new-material rotation, the fluency
minute, the mastery and leech counts, and `python -m src.play verbs`. Adding a
deck touched exactly the places ADR-0007 said a deck lives, which is the
evidence that the seam was in the right place.

Alternative forms are accepted only where both are genuinely standard —
`got/gotten`, `learnt/learned`, `proved/proven` — declared per form in the
YAML rather than guessed in code.

## Consequences

- The app can now answer its own correction. A learner who trips
  `I have went there` has 204 items waiting, and the error queue's
  `verb_form` category has somewhere to send them.
- `webapp/data.json` grows to ~0.94 MB.
- The `-ing` computation is a small piece of English morphology in code. It is
  tested against the cases that break naive rules (`keeping` not `keepping`,
  `lying` not `lieing`, `beginning` with the stress-driven double), and it is
  computed in Python and shipped, so the PWA never has to know the rules.
- 102 verbs is the common core, not the full list — English has roughly 200 in
  ordinary use. Extending is mechanical: add rows, the tests check them.

## What was considered and not built

- **Spelling-to-sound tables through Cyrillic**, which is the most striking
  thing in the Boldoo book: `ea → /iː/ ий`, `ai/ay → /eɪ/ эй`. This is a real
  gap — the app teaches word stress and nothing else about pronunciation, and a
  Mongolian learner needs to know how letters sound. It is not built because
  the value is in the *Cyrillic* bridge, and writing new Mongolian is the one
  thing ADR-0006 forbids without a native speaker. An English-and-IPA version
  would be a worse version of the thing worth having. **This is the strongest
  candidate for the next piece of work, and it needs a Mongolian speaker, not
  more code.**
- **A collocation deck** (`make a decision`, `speak highly of`). Boldoo has
  300+ with Mongolian glosses, and chunks are core vocabulary in Nation's
  terms. Worth building, from an independently chosen list, once the verb deck
  has proved the format.
- **Aligning the curriculum to TalkTalk's stages.** The app orders grammar by
  the taxonomy's frequency × impact priority, which is a defensible order with
  its own ADR. Re-ordering it to match one commercial course would trade a
  reasoned sequence for a familiar one.
- **Copying the dialogues or the vocabulary tables.** They are the part of
  those books that is actually theirs.
