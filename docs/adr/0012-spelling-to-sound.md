# 0012. The spelling→sound tables, and the Mongolian in them

## Status: accepted — with the Mongolian unverified, and marked as such

ADR-0011 named this the strongest next piece of work and said it needed a
Mongolian speaker rather than more code. The learner asked for it. They are the
Mongolian speaker.

## Context

`knowledge/contrastive-guide.md` §1.5–1.7 is already good on pronunciation: the
seven stress rules, the six consonant enemies with minimal pairs, the vowel
contrasts that matter. What it does not have is the direction a **reader**
needs.

The guide answers *how do I make /θ/*. A learner looking at a page has the
opposite question: *I can see `ea` — what sound is that?* Nothing in the repo
answered it, and nothing anywhere in the app connected English spelling to a
sound a Mongolian speaker could produce.

The Boldoo book does exactly this, in one table, in Cyrillic. That is what made
it worth copying the *idea* of.

## Decision

### 1. `knowledge/sounds.yaml` — spelling in, sound out

24 entries in three sections:

- **15 vowels** — for each, the IPA, a Cyrillic approximation, the spellings
  that produce it (`ee`, `ea`, `ie`, `e_e` → /iː/) with examples, and where it
  matters the minimal pair that separates it from its neighbour.
- **7 consonants** — the ones Mongolian does not have or merges: /θ/, /ð/,
  v vs w, f vs p, English /r/, the two Ls, /ŋ/.
- **2 endings** — `-ed` as /t/, /d/, /ɪd/ and `-s` as /s/, /z/, /ɪz/. Both
  books teach these, and `-s` is the sound half of the `verb_agreement`
  category the app already corrects.

Minimal pairs are taken from the contrastive guide, so the two files cannot
drift on which contrasts matter. A test asserts the six hardest are present.

### 2. The Cyrillic is a foothold, and the file says so

Mongolian has no /θ/ and no /æ/, and its `в` covers both English *v* and *w* —
which is precisely why those rows exist. Where the languages genuinely differ,
the row says `с ч биш, т ч биш` ("neither с nor т") rather than offering a
letter that would teach the wrong sound.

**Every English row survives without the Cyrillic.** A test enforces it: any
row with a Mongolian hint must also carry an English one. If the Mongolian
turns out to be wrong, the table is still correct — it is a bridge over the
content, not the content.

### 3. `mongolian_verified: false`, and the app admits it

40 Cyrillic strings were written by this app, not by a native speaker. ADR-0006
forbids exactly that, so the file carries the flag, the PWA shows a warning
band on the page, the CLI prints one, and `python -m src.play sounds --review`
lists all 40 in one column so checking them is a job of minutes rather than a
hunt through YAML.

This is the same shape as `crisis_resources.yaml`, where only `verified: true`
entries are ever shown. The difference: hiding unverified rows there costs
nothing, and here it would leave an empty page. So they are shown *and*
labelled instead.

### 4. Nothing here is scheduled

No SRS deck, no items, no Today integration. The app is text-only by design and
cannot hear the learner. A pronunciation drill it cannot mark would be a drill
of guesses, and the honest limit of a silent app is to *show* the mapping.

This is a deliberate exception to the standing preference for retrieval over
exposure (`docs/learning-engine.md` §1): retrieval needs a gradeable answer,
and this is the one strand where there isn't one.

The two testable pieces — `-ed` and `-s` endings — affect spelling and agreement
rather than sound, and those are already drilled by the grammar deck.

## Consequences

- A learner meeting `night`, `right`, `light` can now see that `igh` is one
  thing and read it, instead of guessing letter by letter.
- The taxonomy lists `pronunciation` under `excluded_from_journal_app`. That
  exclusion is about the **journal**, which corrects text and cannot hear
  speech; it is untouched. Nothing in the correction pipeline changes.
- `webapp/data.json` reaches ~0.96 MB.
- The Mongolian is the app's weakest content until it is checked. It is one
  command to review and one flag to flip.

## What this does not do

- **No audio.** Rejected in `docs/app-review.md` and still rejected. The
  Cyrillic column exists *because* there is no audio.
- **No per-word transcription.** Showing `ий` next to every vocabulary card
  would need a pronunciation for all 6,800 words, which cannot be derived from
  spelling — that irregularity is the whole reason these tables exist.
- **No IPA teaching.** The IPA is shown because it is unambiguous, but nothing
  asks the learner to learn it. The Cyrillic is there so they do not have to.
