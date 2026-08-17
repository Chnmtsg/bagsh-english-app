# 0013. The grammar a Mongolian classroom actually teaches

## Status: accepted

The learner asked for the grammar section to be improved against the two
courses they use. This is the analysis and what came of it.

## Context

The app's grammar has always been organised around **errors**: 24 taxonomy
categories, ranked by frequency × blocking, each with a lesson and
deterministic patterns. That axis is right for a journal corrector — you
teach what the learner gets wrong — and it is the reason the app can say
"you did this three times in two weeks."

It is not the axis a course uses. A course teaches **constructions**: the
present perfect, the first conditional, phrasal verbs, question tags. Some of
those map onto an error category; several do not map onto anything.

Reading the two courses side by side made the gap concrete.

**TalkTalk English, Stages 8–9** (10 lessons each) sequences: present perfect,
present perfect continuous, present and past continuous, first and second
conditional, *too*, *could*, gerunds, *have to*, the passive, *wish* + past
simple, *wish* + past perfect, past perfect, reported speech, can/could,
relative clauses, **question tags**, **phrasal verbs**, *would*, preposition +
gerund, may/might, *would rather*, **reported questions**.

**"Boldoo's english lesson"** covers, in Mongolian: spelling→sound, pronoun and
question-word tables, the tenses with time clauses, **articles in far more
detail than this app had**, prepositions with their fixed expressions,
**phrasal verbs**, and 300+ collocations.

Against the app's 24 categories + 12 supplementary topics, the missing pieces
were not marginal. **Phrasal verbs and question tags appear in both courses and
nowhere in this app.** Present perfect vs past simple — the central topic of an
entire stage — existed only as a line inside `tense_aspect`.

## Decision

### 1. Ten topics, in the file that already holds non-category grammar

`knowledge/advanced_grammar.yaml` was created for "supplementary topics that
are not error categories". That is exactly what these are, so they go there
rather than into a new file or, worse, into the taxonomy — **the closed
24-value enum the corrector and tutor see is untouched.**

| Band | Topic | Why it was missing |
|---|---|---|
| A2 | Happening now, happening then | continuous aspect lived only inside `tense_aspect` |
| A2 | Too much, or just enough | never taught |
| A2 | Can, could, may, might | only deduction modals existed |
| B1 | Present perfect, or past simple? | a whole stage of the local syllabus, one line here |
| B1 | Must, have to, should | obligation modals absent |
| B1 | If it rains — the real condition | only the *unreal* conditionals existed |
| B1 | Used to — and be used to | never taught, and the two are constantly confused |
| B1 | Phrasal verbs | in both courses, absent here |
| B2 | Question tags | in both courses, absent here |
| B2 | Reporting a question | `reported_speech` covered statements only |

47 new quiz items, which brings the grammar deck from 165 to 212. Every one is
checked by the parity harness for the two properties that matter: it must
accept its own answer and must never accept its own error.

The file's band range widens from B1–C2 to A2–C2, and its test was renamed and
loosened to match. That is the honest description of what it now is: the
constructive syllabus alongside the error taxonomy.

### 2. Articles go deeper, because that is where the errors are

`articles` is priority 3 in the taxonomy with `frequency: very_high`, and the
lesson stopped at a/an/the/zero. Boldoo spends pages on the layer above:
a/an with jobs and nationalities, rate expressions (*twice a day*), and the
placement rules after *such*, *what*, *half* and *quite*. Three rules and three
examples added — the highest-frequency category deserved the depth.

### 3. What was deliberately not copied

Both books are copyrighted. **No sentence, dialogue, explanation or Mongolian
gloss is taken from either.** What is taken is the *syllabus* — the list of
topics a Mongolian course teaches and the order it teaches them in, which is a
fact about local practice rather than anyone's expression.

Every explanation, example, bridge and quiz item here is written for this app,
in this app's format: `explain` / `how` / `bridge` / `watch_out` / `tip` /
`examples` / `quiz`, with the error as the prompt and the correction as the
typed answer.

### 4. What stays ours

The two courses present grammar and then set exercises. This app keeps what
neither has: the items enter the criterion scheduler, come back on distinct
days, interleave with the other decks, and are typed rather than chosen. The
syllabus is theirs; the method is not.

## Consequences

- The Path grows from 36 to 46 topics, and the A2 band gains real grammar
  instead of only error categories.
- A learner following a course in Ulaanbaatar can now find the topic they were
  taught this week in the app, which is the practical point of the exercise.
- 47 more items in the grammar deck means the deck takes longer to master —
  the scheduler already throttles new material on backlog, so this shows up as
  more days of review rather than a longer session.
- The Mongolian bridges in the new topics are unverified, like every other
  Mongolian string in the repo outside `vocabulary.yaml`. `sounds.yaml` has a
  review command; these do not yet.

## What is still missing

- **Prepositions with their fixed expressions** — Boldoo's deepest section
  (`depend on`, `interested in`, `for ever`, `in return for`). The taxonomy
  marks `prepositions` untreatable, which stops the error queue drilling them;
  it does not stop a lesson teaching the chunks. Worth doing next.
- **A collocation deck** — still open from ADR-0011.
- **Present perfect continuous, past perfect continuous, second/third
  conditional as separate topics.** The continuous perfects are folded into
  the present perfect lesson, and the unreal conditionals already have a
  topic; splitting them is a refinement, not a gap.
