# ADR-0016 — Small Step as the operating layer of a study plan

**Status:** accepted, built · **Date:** 2026-08-23
**Depends on:** ADR-0015 (corrector + own-errors queue, patterns first)
**Scope:** `boldoo/` only.

## Context

The owner runs an 84-day study plan (`boldoo/PLAN.md`): a daily production
task of ten sentences, 3-minute recordings transcribed by hand, a human
tutor (QQ English) who returns written error lists, and a tracking sheet of
four numbers every 14 days — words, errors/100 words, ART/100 words,
clauses/sentence. ADR-0015 gave Small Step the pipeline for all of that
but only over the Write screen's book translation prompts. Three gaps
stopped the app being the plan's daily tool: nowhere to paste one's own
text, no tracking numbers, and no way in for the tutor's corrections.

## Decision

Three additions and one convention, all on the existing pipeline. No new
model behaviour; the model is still called only by `CORRECT.check()`.

**1. Own text (`Өөрийн бичвэр`) on the Write screen.** A free box for the
day's sentences or a transcript, an optional recording length for WPM,
and the same check as before (patterns → corrector, or patterns only with
no key). Every labelled error enters the queue as a repair due tomorrow.

This is personal writing, which ADR-0015 deliberately excluded to keep the
distress path in Багш. For a single-learner tool the mitigations are
stated rather than the question avoided: **corrector only** — no coach,
no praise, no comment on content; the box says so; and a **"дасгалд бүү
оруул"** opt-out that checks a text without ever replaying it as a drill.
The corrector prompt is unchanged and forbids adding or removing content.
If Small Step is ever offered to other learners, this box needs a distress
gate before it ships to them; that is a new ADR.

**2. The tracking sheet, computed (`track.js`).** Every check logs one row:
words, errors/100w, ART/100w, clauses/sentence, WPM when a length is
given, and the dominant category. The **first row is the baseline and is
never overwritten** — the plan's zero point is a one-shot measurement.
Ахиц shows baseline vs the mean of the last three, and after four checks
gives the plan's own reading of the numbers (working / playing safe /
stretching / flat → more correction, not more study). Errors/100w never
appears without words and clauses beside it (Part 5: it falls when a
learner writes shorter). Clauses are an estimate — sentences plus
clause-linking words — and are labelled as such.

**3. The tutor's list (`Багш хэлсэн`).** Lines of `wrong → right`. Code
diffs each pair (the same `CORRECT.diff`), the learner names the category
from the plan's codes, and each labelled edit enters the queue with
`source: 'tutor'`. Nothing is sent anywhere. A human's correction hours
land in the same scheduler as everything else, instead of a chat window.

**4. The plan's error codes alongside the taxonomy.** `ART → articles`,
`PREP → prepositions`, `WO → word_order` (+ `modifier_placement`), `IQ →
questions_negation`, `TNS → tense_aspect`, `APO → punctuation` (+
`spelling`, `capitalization`), `COLL → collocation`, `SVA →
verb_agreement`, `WF → verb_form` (+ `word_choice`). Shown on every edit
chip so hand-marked transcripts and the app agree.

## Also fixed while building

`CORRECT.match()` re-ran each pattern on its own matched substring to
compute the replacement, which lost lookahead/lookbehind context and
silently skipped 9 of the 64 patterns. It now expands `$n` from the
original match. `tests/test_errors.js` now asserts that **every shipped
pattern fires on its own example through `match()` and repairs it to
`right`** (`tests/pattern_examples.json`, exported from the YAML), not only
in the build validator.

## Consequences

- Storage: `boldoo.track.v1` (rows). Reset clears it with the rest.
- Cost: one or two calls per checked text, as before; a transcript is
  ~400 words, well inside a single call.
- `boldoo/PLAN.md` is the plan itself — clock times, minutes, and which
  unit to open on each day of Block 1 — with L7/L8/L10/L11 named as not in
  the app's content yet.

## Addendum (same day) — the study log

The owner's `study-log.html` (a daily habit sheet: minutes produced, task,
hand-marked error codes, one line on what was hard, a 14-day strip) was
reviewed and ported as `log.js` + the `Тэмдэглэл` tab. Ported, not dropped
in, for four reasons: it saved through `window.storage`, an artifact-runtime
API that does not exist on GitHub Pages; it headlined a **day streak**,
which rule 4 and LEARNING.md §13b refuse; it used its own fonts and palette
from Google Fonts, which breaks the offline bundle; and long-press-to-
decrement fights the mobile context menu.

What survived: the data model (one entry per local calendar day), the
strip, the code rank, the note, the plan's own error codes (now shared
with `track.js`). What changed: `localStorage` under `boldoo.log.v1`; the
streak replaced by **logged/14** and the plan's **two-day rule** flag; a
**four-week fossilisation detector** (a code marked in each of the last
four weeks) that names the codes to take to the tutor; −/+ buttons; the
app's own type and colours. It is labelled a habit record and never feeds
Ахиц's progress figures.

## Not done

- **Porting L7–L11** (relative clauses, passive, hedging, connectors) from
  `knowledge/advanced_grammar.yaml`. Content work; blocks 3–6.
- **A real clause count.** Would need a parser; the proxy is consistent
  with itself, which is what a trend needs.
- **Distress gate** for other learners — see Decision 1.
