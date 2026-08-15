# 0005. One authority for a word's level

## Status: accepted

## Context

Two independent level systems described the same word, and both rendered on
the Words tab at once:

- **`knowledge/vocabulary.yaml`** — 120 curated cards, each with a hand
  assigned `level:` (exactly 30 at each of A1/A2/B1/B2). Drives which cards
  the trainer teaches (`cardsOfLevel`).
- **`knowledge/cefr_wordlist.json`** — 6,800 words in A1–C2 bands, imported
  in `e3baf8f` from the CEFR-J-based Words-CEFR-Dataset. Drove the progress
  bar, the check-yourself round, and the level unlock (`levelProgress`,
  `LEVEL_DONE_PCT`).

They disagreed on **55 of the 120 cards (46%)**, 53 of them taught harder by
the deck than the list claimed. A learner at A2 saw a progress bar counting
`hospital` as a word they should already know, while the card deck withheld
it as A2 material.

The deciding evidence is not the disagreement but the omissions: **43 of the
120 curated cards do not appear anywhere in the wordlist** — `bread`, `milk`,
`eat`, `drink`, `sleep`, `happy`, `tired`, `hungry`, `breakfast`, `dinner`,
`doctor`, `clothes`, `shoes`, `umbrella`, `buy`, `sell`, `visit`. Meanwhile
its A2 band contains `shall`, `upon`, `thus`, `county`, `commission` and its
C1 band contains `columbia`, `construed`, `pertaining`.

That is the signature of a frequency ranking over a legal/governmental
written corpus. Frequency in such a corpus is not proficiency: `milk` is rare
in statute text and early in every syllabus on earth.

## Decision

**The curated card's `level:` field is the only authority on what level a
word is.** The wordlist is demoted to what it actually is.

1. **Level ladder = the deck.** `levelProgress(l)` counts *cards* of level
   `l` the learner has mastered, where mastered means the SRS record has
   `reps >= 2` — two correct answers on different days. (ADR-0007 supersedes
   this: mastery is now three correct answers on three *distinct* days, and
   distinctness is actually enforced — `reps` counted same-day repeats.)
   This is the rule
   `knowledge/vocabulary.yaml` already documented in its own header and that
   ADR-0003 intended; the wordlist had quietly taken the job over.
2. **Unlock = deck mastery**, same source, so the bar the learner watches and
   the gate they are trying to open are the same number.
3. **The wordlist keeps the check-yourself round** as a separate, optional
   coverage tool, relabelled honestly: it measures how much of a frequency
   ranked vocabulary a learner recognises. It no longer claims CEFR
   authority, no longer gates anything, and its self-reported ✓ no longer
   feeds the level ladder.
4. **`profile.knownWords` keeps its meaning** — words self-reported as known
   in the check-yourself round. It is now scoped to that feature alone. No
   profile migration is needed; existing entries stay valid for it.
5. A test asserts the deck declares a level for every card and that the two
   systems can never again both drive the ladder.

## Consequences

- The deck stops being 30/30/30/30. It was balanced by count, not evidence,
  and the tidy symmetry was itself the tell.
- Cards mis-levelled by the curator are now the only thing that can make a
  level wrong, so they were re-checked against CEFR judgement rather than
  corpus frequency, and twelve moved (see the file's own comments).
- The learner's level percentage drops on first load after this change,
  because it now counts genuine two-day card mastery instead of self
  reported taps on a frequency list. That is the number becoming true, not
  progress being lost — `knownWords` is untouched and the check-yourself
  round still shows it.
- The wordlist's own quality problems (function words at A1, legal residue
  at A2/C1) still stand and are now confined to an optional tool. Cleaning
  or replacing that list is separate work.

## Alternatives rejected

- **Wordlist as authority, re-level the deck.** Impossible: it cannot level
  36% of the deck, and the words it omits are the ones beginners need first.
- **Keep both, reconcile the 55.** Reconciling per word leaves two systems
  that will drift again on the next import. The problem was two authorities,
  not 55 disagreements.
