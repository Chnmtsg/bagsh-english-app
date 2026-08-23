# Small Step — the learning engine, from the evidence

Written 2026-08-23. The question this answers is not *what do language apps
do* but *what does the research support*, and therefore what this app must
build — under its real constraints: **no LLM, no server, no network**, one
developer, a phone, a few minutes a day, and every Mongolian string needing
a native check.

The parent repository's `docs/learning-engine.md` (2026-08-14) reviewed the
same literature for the Багш journal app. Where the finding is the same, this
document is shorter and says so; where the absence of a model changes the
answer — and it changes several — it says that too. Nothing here is argued
from what a competitor ships.

## Citation convention

Author + year on every empirical claim, marked:

- **✔** confident of the citation and roughly what it found
- **~** the finding is right; the number attached is from memory — verify
  before quoting it anywhere public
- **?** I believe this exists but would not defend the reference

Where SLA and general memory research disagree, or the literature is
contested, that is stated rather than smoothed over.

---

## Context — the app as it actually is

| | |
|---|---|
| **Product** | Small Step: an offline bilingual study app built from one textbook (*Boldoo's English Lesson*, pp. 6–22) and one contrastive guide. Read → drill → write → place. |
| **Stack** | Vanilla JS PWA, `localStorage`, GitHub Pages. **No model anywhere.** Every exercise is generated and graded by code from transcribed content. |
| **Learners** | Mongolian L1, beginner to lower-intermediate (the book is A1–A2 grammar). Self-directed. 4–12 questions a sitting, on a phone, often offline. |
| **Exists before this review** | 932 machine-graded items + 91 self-assessed translation prompts across 17 units; a 7-box interval ladder with "three different days" mastery; a reader; placement; progress = mastered + accuracy. |
| **Constraints** | Solo dev. No build step. Curated content only; code cannot invent English. No audio yet. |
| **Not wanted** | Streaks, XP, badges, hearts, leagues, reminders, anything a model writes. |

Two facts about this app constrain everything below:

1. **There was no learner-specific error signal** when this was written:
   the journal app has `difflib`; this one had a self-assessed translation
   box. Part 4 therefore specified the book-item substitute. **ADR-0015
   (same day) added the real thing** — a corrector the learner can switch on
   with their own key — and Part 4b below specifies it. Without a key, Part
   4 is still exactly what the app does.
2. **The content is finite and fixed.** 932 items is small enough that the
   scheduler's job is not "what to show from infinity" but "what order, how
   often, and when to stop". That makes several famous mechanisms cheap and
   several others pointless.

---

# Part 1 — Evidence review

## 1. Testing / retrieval practice

**(a)** Retrieving from memory beats re-reading for the same time
(Roediger & Karpicke 2006 ✔). **(b)** Rowland 2014 ✔ meta-analysis, g ≈ 0.5
vs restudy (~). Karpicke & Roediger 2008 ✔ (*Science*): for foreign-language
pairs, dropping items from further *testing* once learned cut one-week recall
to ~36%; dropping them from further *study* did not (~80%) (~). **(c)** Needs
an at-least-sometimes successful attempt plus feedback (Kornell, Bjork &
Garcia 2011 ✔); recognition formats give less than recall; the effect grows
with delay, so an end-of-session measure picks the wrong winner. **(d)**
Dunlosky et al. 2013 ✔: one of two "high utility" techniques. **Replicated.**

> **Small Step:** every graded item is already a retrieval attempt, asked
> *before* the page is read if the learner goes straight to drill. The
> weakness was what happens *after* a miss: nothing, until the ladder said so.
> §13a fixes that.

## 2. Spacing, and SM-2 vs FSRS

**(a)** Spread practice beats massed practice (Ebbinghaus 1885 ✔; Cepeda et
al. 2006 ✔, 254 studies). **(b)** Moderate, d ≈ 0.4 (~); Cepeda et al. 2008 ✔:
optimal gap scales with the retention interval, roughly 10–20% of it (~).
**(c)** The gap function is *flat near its optimum* — roughly right is nearly
as good as exactly right. Gains assume the review happens. **(d)** Among the
most replicated findings in psychology. **Replicated.**

**SM-2 vs FSRS.** FSRS fits a per-item forgetting curve and schedules for a
target retention probability; its published advantage is *lower error in
predicting recall* on very large Anki logs (? on the numbers). That is not a
claim about *learning per minute*, and I know of no RCT making one (~). FSRS
also needs hundreds of reviews to fit parameters; below that it uses defaults.
With a 932-item deck and a learner doing 6 items a day, this app lives below
that line for months. **Verdict: a fixed ladder is the right scheduler here;
FSRS stays out, and the reason is not cost.** What was actually wrong with the
existing ladder was the *ordering* (new before review — §13a), not the
intervals.

## 3. Desirable difficulties

**(a)** Conditions that slow practice often improve retention (Bjork 1994 ✔).
Storage strength vs retrieval strength (Bjork & Bjork 1992 ✔): retrieval at
low retrieval strength buys the most storage. **(b)** An umbrella, not an
effect — judge by its constituents (§1, §2, §4, §5). **(c)** The boundary is
the one to design against: difficulty is not the mechanism, *effortful
successful retrieval* is. A learner who has failed the same item four times is
not experiencing a desirable difficulty; they are being tested on knowledge
that is not there. **(d)** Soderstrom & Bjork 2015 ✔: performance during
training is not learning. **Survives.**

> **Small Step:** this is the argument for the **leech** rule (Part 4) and for
> refusing in-session accuracy as a headline (Part 5).

## 4. Generation effect, and pretesting

**(a)** Self-produced material is remembered better (Slamecka & Graf 1978 ✔).
**(b)** Bertsch et al. 2007 ✔, d ≈ 0.4 (~). **(c)** Needs success or immediate
feedback; the gain is on the generated element. **(d)** Robust at word and
sentence level. **Survives.**

*Pretesting* — guessing before being told, even when every guess is wrong —
beats being told first (Richland, Kornell & Kao 2009 ✔; Kornell, Hays & Bjork
2009 ✔).

> **Small Step already does this by accident of layout:** the drill is
> reachable before the page, and a cold session asks first. The change is to
> make sure *production* is what gets generated — §13c.

## 5. Interleaving vs blocking

**(a)** Mixing types within a session beats blocks on delayed tests (Rohrer &
Taylor 2007 ✔). **(b)** Large in maths (Rohrer, Dedrick & Stershic 2015 ✔;
~60% vs ~20% delayed, ~ on the figures). **(c)** The mechanism is
*discrimination*: it helps only when the learner must choose which rule
applies. It depresses in-session scores, which learners misread (Kornell &
Bjork 2008 ✔). **(d)** **Here SLA and memory research part ways.** In L2
grammar, blocked practice often wins for *initial* acquisition of a form and
interleaving wins for later consolidation and for confusable forms (Nakata &
Suzuki 2019 ~; Suzuki 2021 ~).

> **Small Step:** *block the introduction, interleave the review.* The old
> session builder did the opposite on both counts — it served never-seen items
> first, from whatever unit came next, and never mixed due reviews. This is
> the cheapest high-value change in the document (§13a).

## 6. Nation's Four Strands and coverage

**(a)** Balance meaning-focused input, meaning-focused output,
language-focused learning and fluency development (Nation 2007 ✔). **(b)** A
design principle with component support, not a four-arm trial. The coverage
numbers underneath are empirical: 95% known running words for assisted
comprehension, 98% for unassisted (Laufer 1989 ✔; Hu & Nation 2000 ✔).
**(c)** Coverage is receptive. **(d)** Component support is good.

> **Small Step is three-quarters language-focused learning.** Input is the
> book's own short texts (pp. 17–22) and nothing else; output is self-assessed
> translation; fluency did not exist. This review adds the fluency strand
> because it is cheap and its items already exist (§10). It does **not** add a
> reading library: that is a content project and a Mongolian-verification
> project, and half of one is a tab with three texts in it. Stated, not hidden.

## 7. Comprehensible input vs pushed output

**(a)** Krashen 1985 ✔ vs Swain 1985/1995 ✔. **(b)** Krashen's framework is
largely unfalsifiable as stated (McLaughlin 1987 ✔; Gregg 1984 ✔) but
extensive reading has independent support (Nakanishi 2015 ✔, d ≈ 0.46 ~).
Output-plus-feedback beating input-only for accuracy is well attested in the
CF literature (§9). **(c)** Input builds breadth; output builds accuracy and
retrieval strength. **(d)** Build both, believe neither exclusivity claim.

> **Small Step:** without a model there is no feedback on free output, so the
> Write screen stays self-assessed and outside accuracy (it already was). The
> honest pushed-output mechanism this app *can* grade is typed production of
> known forms — §13c.

## 8. Noticing

**(a)** Learners acquire what they notice; progress needs noticing the gap
(Schmidt 1990 ✔). **(b)** The founding evidence is one diary (Schmidt & Frota
1986 ✔). **(c)** Strong form unsupported (Williams 2005 ✔; Truscott 1998 ✔);
weak form — attention to form helps — well supported. **(d)** Design for the
weak form: make the gap visible at the moment of error.

> **Small Step:** feedback already shows *your answer / the answer* side by
> side, and the five book-vs-guide conflicts are shown as conflicts. Keep.

## 9. Corrective feedback: prompts vs recasts

**(a)** Recasts get the least uptake; prompts that push self-repair get the
most (Lyster & Ranta 1997 ✔). **(b)** CF works, d ≈ 0.6 (Li 2010 ✔ ~);
prompts beat recasts at delay (Lyster & Saito 2010 ✔). **(c)** Treatable vs
untreatable errors (Ferris 1999 ✔); focused beats unfocused (Bitchener & Knoch
2010 ✔). **(d)** Settled that CF works; prompts > recasts well supported.

> **Small Step:** there is no learner sentence to recast. But a *miss* is
> still a feedback event, and showing the answer then moving on is a recast.
> The prompt-shaped equivalent without a model is: **ask the same item again
> before the session ends.** That is the in-session re-ask in §13a, and it is
> deliberately not graded — it is the repair attempt, not a second test.

## 10. Skill acquisition and automatization

**(a)** Declarative → procedural → automatized; automatization is a power-law
drop in time and error, not new knowledge (DeKeyser 1997, 2007 ✔; Newell &
Rosenbloom 1981 ✔). **(b)** Skill-specific: practising comprehension
automatizes comprehension, not production (DeKeyser 1997 ✔). **(c)** Needs
many repetitions under conditions like use, including time pressure.
**(d)** Well supported. **Survives.**

> **Small Step:** untimed, self-paced, and only ever asked "do you know it?".
> A **timed round on mastered items only** is the fluency strand and the
> cheapest missing feature: the items exist, they need a clock and a filter.

## 11. Cognitive load theory

**(a)** Working memory is the bottleneck (Sweller 1988 ✔). **(b)** Worked
examples (Sweller & Cooper 1985 ✔), split attention, redundancy, expertise
reversal (Kalyuga et al. 2003 ✔). **(c)** Effects reverse with expertise;
"germane load" is the weak part (Sweller 2010 ~). **(d)** Core replicates.

> **Small Step:** one decision per screen; the English gloss is a switch. The
> book page *is* the worked example, and it precedes the drill in the path.
> The promotion rule in §13c respects expertise reversal by only moving to
> typed recall *after* a correct recognition answer.

## 12. Deliberate practice

**(a)** Effortful practice targeting a current weakness with immediate
feedback (Ericsson, Krampe & Tesch-Römer 1993 ✔). **(b)** The defensible core
is the *design* of practice; hours explain little outside games and music
(Macnamara, Hambrick & Oswald 2014 ✔, ~4% in education ~). **(c)** Needs an
identified weakness, an isolating task, feedback, a repair attempt. **(d)**
Use the design, refuse the hour-counting.

> **Small Step:** the weakness is identified at item grain (the miss), the
> task isolates it (one item), feedback is immediate; the missing fourth —
> the repair attempt — is §13a's re-ask.

## 13. Missing from the list, and outranking items on it

**13a. Successive relearning** (Rawson & Dunlosky 2011 ✔; Dunlosky & Rawson
2015 ✔). Retrieve to a criterion within the session, then repeat the
to-criterion session at spaced intervals. Spacing × testing composed; the
strongest practically implementable result in applied memory research, with
classroom-exam outcomes (~ on size). **This is the backbone.** Concretely:
review before new; a miss re-asked in the same session; "three different
days" as the between-session criterion (already there).

**13b. Feedback targets the task, never the person** (Kluger & DeNisi 1996 ✔:
a third of 607 feedback effects were *negative*, concentrated where attention
went to the self). Basis for: no streaks, no praise, no score of the learner.

**13c. Transfer-appropriate processing** (Morris, Bransford & Franks 1977 ✔;
for L2 vocabulary, Webb 2005 ✔: receptive practice → receptive gain). You get
good at what you practised. Four-option recognition trains four-option
recognition. **Rule: recognition may introduce; only production may certify.**

**13d. Leeches.** Not a named literature — engineering judgement from §3's
boundary condition, and from Anki's long-standing practice (?). Repeated
failure is absent knowledge; re-teach, do not re-test.

---

# Part 2 — Translation to features

Ranked by (evidence × impact for *this* app) ÷ build cost, in solo-dev days
including tests. "Measured by" must be something the app can compute offline.

| # | Principle | Mechanism | Feature | Measured by | Cost | Rank |
|---|---|---|---|---|---|---|
| 1 | §13a, §2, §5 | Review first, blocked intro, interleaved review | **Session plan**: due items (most overdue first, interleaved across units) → new items fill what is left, from one unit, at most 3 once anything is due | Delayed first-attempt accuracy (Part 5 #2) | 0.5 d | **1** |
| 2 | §13a, §9, §12 | Repair attempt within the session | **In-session re-ask**: a miss returns at the end of the same session, at most twice, never graded | Retry-right rate per session (diagnostic only) | 0.5 d | **2** |
| 3 | §13c, §10 | Production certifies | **Promotion**: a choice item with a short English answer becomes typed after one correct recognition answer | Productive mature count (Part 5 #3) | 0.5 d | **3** |
| 4 | §3, §13d | Stop testing absent knowledge | **Leeches**: 4 lapses → not quizzed; re-reading the page readmits it, due today | Leech count, shown beside mastered | 0.5 d | **4** |
| 5 | §3 (Soderstrom & Bjork), §1c | Measure delay, not session | **Delayed first-attempt accuracy** as the headline metric; first-attempt log with the scheduled gap | — it *is* the metric | 0.5 d | **5** |
| 6 | §10, §6 | Speeded practice on known material | **Fluency minute**: 10 mastered items, timed, never graded into the SRS | Median ms-to-correct, recent vs earlier | 1 d | **6** |
| 7 | §11 | Fade support | Hide English gloss by default once >50% of a unit is mastered | Accuracy at each density | 0.5 d | 7 |
| 8 | §6, §7 | Input volume | Graded reading library with tap-to-gloss | Words read / week | 5–10 d + verification | 8 |
| 9 | §9 | Error-type queue on the learner's own writing | **Built, ADR-0015** — opt-in with the learner's own API key; Part 4b | Categories graduated; leeches | 2 d | **built** |
| 10 | §2 | Model the forgetting curve | FSRS | RMSE of predicted recall | 3 d | 10 |

**Cut, and say why.** #7 is small but needs new Mongolian copy and a native
check for every state; it waits. #8 is the largest *learning* gap and the
largest build, and it is a content project — half-building it produces the
"three texts in a tab" failure. #9 cannot exist without something that can
correct free English; the journal app has it, this one does not, and a
self-assessed write box must not pretend to. #10 is deferred because its
evidence is prediction accuracy, not learning, and because this deck is too
small to fit it.

---

# Part 3 — Session design

**A 6-question sitting (the default), with the 4-question version being the
same thing shorter.** Every segment is interruptible; the value is
front-loaded so that quitting early still delivers §1 + §2.

| Order | Segment | Strand | Principle | What it is |
|---|---|---|---|---|
| 0 | *(optional, when ≥6 items are mastered)* **Хурд · 1 minute** | Fluency | §10 | 10 mastered items, a clock on each, not graded. Offered on the home screen, never required. |
| 1 | **Давтах · due reviews** | Language-focused | §1, §2, §5 | Everything due, most overdue first, **interleaved across units**. A typed item where production is possible (§13c). |
| 2 | **Шинэ · new items** | Language-focused | §4 (pretest), §5 (blocked) | Fills what review leaves; at most 3 once there is any review; all from **one unit**, the next in path order. Asked before taught — the page is one tap away. |
| 3 | **Дахин · re-asks** | Language-focused | §13a, §9, §12 | Every miss from 1–2 comes back at the end. Right → gone. Wrong → once more. Never graded. |
| — | **Бичих · write** | Meaning-focused output | §7 (Swain) | Outside the session, self-assessed, outside accuracy. Unchanged. |

## Day 1 / day 30 / day 60

| | Day 1 | Day 30 | Day 60 |
|---|---|---|---|
| Reviews due | 0 | ~40–80 (more than a sitting) | Falling: most items at 16–35 day gaps |
| New items / sitting | all 6, one unit | 0–3 — the home screen says so, and says it is the right order | 3 again as the backlog clears |
| Re-asks | a few | several: the review backlog is where misses live | few |
| Fluency round | not offered | offered: 50+ mastered items | a real trend line |
| Leeches | 0 | first ones; the home screen names their pages | handful; the main "read this again" signal |
| What "progress" shows | mastered 0, delayed accuracy "—" with an explanation | delayed accuracy is real for the first time | mature count rising; delayed accuracy stable 80–90% |

The day-30 row is the one to design the UI around: the learner *will* see
"6 давтах, 0 шинэ" and read it as the app stalling. The home button says
`бүгд давтах` and a note explains that review before new is the correct
order. That copy exists because of Kornell & Bjork 2008 ✔.

---

# Part 4 — The error scheduler, without a model

The journal app's Part 4 schedules *the learner's own errors* from their own
sentences, tagged by category. Small Step has no sentences and no tagger.
What it has is 932 items, each of which is already a single, closed,
book-sourced contrast. So:

## 4.1 Taxonomy

**The item is the error type.** Its `unitId` is the category (pronoun table,
irregular verb, tense grid, spelling→sound, preposition…); its `tag` is the
block. The five book-vs-guide conflicts are the only place a *learner* error
can be distinguished from a *book* error, and those are shown as conflicts in
the reader rather than scheduled.

No model tags anything. An item's category is fixed at generation time from
the content file, so a mis-tag is impossible and a category never drifts.

## 4.2 Data model

`localStorage["boldoo.srs.v1"]`:

```jsonc
{
  "items": {
    "u-verbs:3:12:pp2": {
      "box": 3,            // index into LADDER = [0,1,3,7,16,35,90] days
      "due": 1756339200000,// UTC midnight
      "seen": 4, "right": 3, "wrong": 1,
      "days": [..., ...],  // distinct UTC-midnights answered right
      "lapses": 1,         // misses after box > 0
      "leech": false,      // 4 lapses → true; cleared by reading the page
      "typed": true        // last correct answer was produced, not picked
    }
  },
  "log":     [{ "t": 1756339200000, "id": "...", "ok": 1, "ivl": 7, "typed": 1 }],
  "fluency": [{ "t": 1756339200000, "id": "...", "ok": 1, "ms": 1420 }]
}
```

`ivl` is the gap the item was *scheduled at* when the answer was given — it is
what makes a "delayed" answer identifiable later. Only first attempts are
logged. Re-asks and fluency answers never touch `items`.

## 4.3 Scheduling

```
plan(ids, n):
  due    = seen items with due <= today, not leech, most overdue first
  review = interleave(due[:n], by unit)
  room   = n - |review|;  if |review| > 0: room = min(room, 3)
  fresh  = never-seen items of the FIRST unit (path order) with any, [:room]
  queue  = review ++ fresh
```

**Success:** `box += 1`, today added to `days`, `typed` recorded.
**Failure:** `box = box > 2 ? 2 : 0` — relearning, not reset; `lapses += 1`
if the item had been learnt at all.
**Re-ask:** a miss returns at the end of the same session, up to twice; not
graded.
**Graduation:** `days.length >= 3` — three different days. Not a setting.
**Leech:** `lapses >= 4` → excluded from `plan`, `pick` and the fluency pool;
counted in stats; surfaced on the home screen with its page.
**Re-entry:** opening the page clears `leech`, sets `due = today`, resets
`lapses`. Nothing else changes — reading is not retrieval, and the item must
still earn its three days.

## 4.4 What is not here, without a key

A category-level graduation ("articles are done") needs evidence of *not
making the error* in free production. The book drills cannot give it. Part
4b can.

# Part 4b — The learner's-own-errors scheduler (ADR-0015)

Built 2026-08-23 in `correct.js` + `errors.js`, a port of the journal app's
`src/error_queue.py`. Active only when the learner has entered an Anthropic
API key in Settings; only the Write screen's translation drafts are sent.

**What code does first, at zero cost (standing rule 2):** the 64
deterministic patterns from `knowledge/top_100_patterns.yaml` run on the
device before any call — each re-validated under JS semantics with zero
hits on the clean-English corpus. A pattern edit carries its category and
curated explanation and never goes near a model; a model edit that overlaps
a pattern span is dropped. With no key, this layer is the whole check.

**What the model does (two calls per checked draft, when a key is set):**

1. **Correct** — returns the draft with only clear errors fixed
   (`prompts/corrector.md` v1.0.0 verbatim; Mongolian source supplied for
   meaning only). It is forbidden to list, count or explain errors.
2. **Label** — assigns each *code-computed* edit one category from the
   closed 24-value taxonomy. It may not add, remove or dispute an edit.

**What code does:** tokenise and align the draft against the correction
(port of `nodes/diff.py`; parity fixture from Python `difflib` in
`tests/diff_cases.json`) → every edit is a real substring of the learner's
text → key = category + normalised form (insertions keyed on the inserted
word) → the learner's own sentence with the span blanked becomes the repair.

**Scheduling** (`boldoo.errors.v1`): new items due *tomorrow* (§2: re-drilling
an error just explained is massed practice); at most 2 repairs per mixed
session, ahead of the book, one per category (§5); a miss drops to box 0 and
returns in-session like any other miss; criterion = 3 distinct days (§13a);
**graduation needs the criterion AND two checked drafts without the form** —
the only evidence that matters is not making the error (§9, §12); a form
produced 3+ times must be drilled to graduate, a one-off fades after 5 clean
drafts; 4 lapses = leech (§3); a relapse after graduation re-queues with the
history kept.

**Untreatable categories** (word choice, collocation, register, and the
usage half of prepositions / tense) are never drilled and never scored
(Ferris 1999 ✔). They return on the home screen as a read-only *more
natural* note, pushed out 4 days per showing, and graduate by absence alone.

**Dispute.** The repair answer is model text — the one place that happens in
Small Step. A learner who marks "my version was right" parks the item for
good. Precision over recall (standing rule 4): a false correction teaches a
learner their correct English was wrong, and no scheduler is worth that.

**Metric it unlocks** (Part 5 #4 of the journal review): categories
graduated, and leeches outstanding, both shown on Progress. The trajectory
to expect: first graduations at 4–6 weeks of regular checking, architecture
categories (copula, word order) first.

---

# Part 5 — Metrics

## The four that count

**1. Mastered (criterion).** Items correct on 3 distinct days. Resists
gaming because three answers on one day count as one. Trajectory: roughly
linear in study days; ~1–3 per sitting.

**2. Delayed first-attempt accuracy.** Of first attempts whose scheduled gap
was ≥ 7 days, the share correct. Grinding an item shortens its gap, so it
cannot enter this figure; the only way up is to remember things after a week.
Trajectory: 80–90% and stable as the pool grows. Below ~75% the ladder is too
aggressive; above ~95% it is wasting the learner's minutes.

**3. Productive mature.** Items at a 16+ day gap whose last correct answer
was typed. Takes weeks to enter and recognition does not count (§13c).
Trajectory: monotone; if it rises while #2 falls, promotion is too early.

**4. Leeches outstanding.** Items the scheduler has given up testing. Shown
beside #1 so the mastered count cannot hide them. Trajectory: small and
shrinking; a unit that keeps producing leeches is a unit whose page needs
rewriting, not a learner who needs more drills.

**5. (with the fluency round) Time-to-correct on mastered items.** Median ms
of the last 20 correct answers vs the 40 before. Should fall as a power law.
Flat means nothing is automatizing — usually because the pool is too varied.

## Refused as progress

| Metric | Why |
|---|---|
| In-session score | Soderstrom & Bjork 2015 ✔. Still shown on the results screen, labelled *today's performance*, with a line saying learning is measured a week later. |
| Raw accuracy, all attempts | Was the headline. Now a footnote per unit: it punishes exactly the new-item misses that pretesting (§4) says are fine. |
| Streak, XP, badges, time in app | Habit numbers. Kluger & DeNisi 1996 ✔. Never built; still never built. |
| "Items seen" / % complete | Exposure. Shown as "not started" so that it counts *down*, never as progress. |
| Write self-assessments | Self-report. Excluded from every figure; always were. |

---

# Part 6 — Anti-patterns

1. **New-before-review.** The old `pick()` served never-seen items first. With
   932 items the review backlog would never have been serviced; the learner
   would have "started" everything and kept nothing (Karpicke & Roediger 2008
   ✔ is precisely this). Fixed in §13a.
2. **Blocked everything.** Unit tabs are fine for *introduction*; serving
   review inside a unit removes the choice the learner must practise (§5).
   Review is now interleaved; the unit drill still exists for introduction.
3. **Recognition certifying.** Four options, one tap, "mastered". Transfer-
   appropriate processing says that certifies tapping (§13c). Promotion fixes
   the items where typing is fair; Cyrillic and formula answers stay choices,
   and that is stated in the code.
4. **Recast and move on.** Showing the answer after a miss and never asking
   again is a recast (§9). The re-ask is the prompt.
5. **Testing a leech.** Four failures, a fifth test. Not a desirable
   difficulty (§3). The page, not the quiz.
6. **Score-of-the-learner.** A percentage at the end of a session *reads* as a
   grade. It stays, because hiding it would be dishonest, but it is named as
   today's performance and the Progress screen refuses to repeat it.
7. **Hearts, streaks, leagues, reminders, gem economies.** Never built.
   The mechanism of failure — loss aversion pushing toward the cheapest
   qualifying session — is the same as in the journal app's review, and a
   4-question app is *already* the cheapest qualifying session.
8. **Model-generated answer keys.** The one failure that destroys trust. Not a
   risk here because there is no model, and that is the design, not a gap.

---

# v1 scope — shipped in this change

| Built | Evidence | Where |
|---|---|---|
| Review before new; blocked intro (one unit, ≤3 once any review exists); interleaved review | §13a, §5, §2 | `srs.js plan()`, `app.js buildSession()` |
| In-session re-ask of a miss, ≤2, never graded | §13a, §9, §12 | `app.js actions['drill']` |
| Recognition→production promotion after one correct answer | §13c, §10, §11 | `app.js promote()` |
| Leeches at 4 lapses; re-read readmits; home screen names the page | §3, §13d | `srs.js`, `viewHome`, `viewRead` |
| First-attempt log; **delayed first-attempt accuracy** and **productive mature** headline Progress; raw accuracy demoted | §3, §13c, Part 5 | `srs.js stats()`, `viewProgress` |
| Fluency minute on mastered items, timed, outside the SRS | §10, §6 | `viewFluency`, `srs.js fluency*` |
| Results screen labels its score as today's performance | §3 | `viewResults` |

Storage stays `boldoo.srs.v1`; older files load (missing fields default),
so nobody's progress is reset.

**Waits, and why:**

- **Level-conditional gloss** — new Mongolian copy, needs a native check.
- **Reading library** — content project; half of one is worse than none.
- **Error-type queue on free writing** — *now built* (ADR-0015), as an
  opt-in corrector over the Write screen's drafts. Free journaling with a
  distress path stays in Багш.
- **FSRS** — evidence is prediction accuracy, not learning; deck too small to
  fit it; the ladder's flat optimum (§2c) makes the gain small anyway.
- **Audio for the sound units** — the sounds.yaml Cyrillic is unverified in
  the parent repo; playing an unverified sound is teaching it.
