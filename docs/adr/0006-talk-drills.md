# 0006. The conversation strand gets production and a memory

## Status: accepted

## Context

Of the three strands, only conversation had no way to come back. Grammar and
vocabulary both ran on the SM-2-lite scheduler from ADR-0003; `profile.srs`
held `grammar` and `vocab` and nothing else.

What the Talk tab actually offered per dialogue was one multiple-choice
question. `renderTalkPractice` looped `Try again` until the learner clicked
the right option, then wrote the dialogue id into `profile.talkDone` and never
asked again. So the strand was 19 items, unfailable, unrepeated, and entirely
recognition — the learner never produced a word of it.

The cost is concentrated in exactly the wrong place. `phone_repeat` calls
"Sorry, could you say that again?" **"THE most important skill for real
conversations"** and its own practice note calls it **"the single most useful
sentence in spoken English."** A learner met that sentence once.

## Decision

**`knowledge/conversations.yaml` gains no new content. The drills are derived
from it in code** (`src/quiz.py: talk_bank`), for two reasons: the standing
"code before model" rule, and because new drills would need new Mongolian
cues, while every Mongolian string in this repo still carries the
"⚠ needs native-speaker verification" warning. Inventing 23 more unverified
strings to fix a practice problem is a bad trade.

Two item kinds, 74 in total:

- **`cloze` (55)** — the dialogue's own Mongolian line is the cue, its English
  line is shown with the key phrase blanked out, and the learner **types the
  chunk**. This is the strand's first production item and the first place the
  app drills collocations and fixed phrases rather than single words.
- **`reply` (19)** — the existing "choose the best reply" question, kept, but
  **one attempt, scored into the SRS**. Guessing until the button turns green
  taught nothing and recorded nothing.

Supporting decisions:

1. **`profile.srs.talk`** joins `grammar` and `vocab`. Existing profiles need
   no migration: `loadProfile` merges the stored `srs` over a blank that
   already contains the new key.
2. **Answers are located, never assembled.** `_locate` finds the span of the
   phrase inside a real curated line, and the answer is that exact substring.
   For template phrases ("Is there a … near here?") it falls back to the
   longest literal stem. A test asserts every cloze answer appears verbatim in
   the line it was taken from, and that the cue is that line's own Mongolian.
3. **Case-insensitive grading** for cloze answers, via a new `ignore_case`
   flag on `check_answer`. A phrase blanked out of mid-sentence is testing the
   chunk; capitalisation has its own taxonomy category to be tested by.
4. **Dialogue completion is derived from mastery**, not self-report: the list
   shows `known/total phrases learned`, where known means two correct answers
   on different days — the same rule as ADR-0005's word ladder.
5. **`python -m src.play talk`** so the CLI has the strand too.

## Consequences

- The conversation strand goes from 19 unrepeatable recognition items to 74
  scheduled items, 55 of them typed. It stops being ~5% of the practice load.
- Two key phrases produce no drill: `complaint`'s "I ordered X, but this is Y"
  and `opinion`'s "I'd sooner X than Y" are X/Y placeholders with no fixed
  form. They are still taught in the dialogue view. A test bounds how many
  items may be skipped so a curator notices if that number grows.
- `profile.talkDone` is now legacy. It is left in the profile untouched rather
  than migrated away — it costs nothing and removing it would invalidate
  existing saved profiles for no gain.
- Cloze quality depends on key phrases being quotable. A curator who writes a
  key phrase that appears nowhere in the dialogue silently loses a drill; the
  coverage test is what surfaces that.

## Alternatives rejected

- **Author production items by hand in the YAML.** Would need ~23 new
  Mongolian cues that no native speaker has checked. Rejected on the same
  grounds the repo already flags its existing Mongolian.
- **Full-line MN → EN production.** Genuinely productive, but a Mongolian line
  has several correct English renderings and the grader is exact-match. It
  would manufacture false negatives — the exact defect ADR-0005's sibling fix
  (contraction grading) had just removed.
