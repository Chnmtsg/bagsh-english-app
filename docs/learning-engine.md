# The learning engine — designed from the research

Written 2026-08-14. Companion to `docs/app-review.md`, which asked *what do
competitors do*. This asks the prior question: **what does the evidence
support**, and what must this app therefore build.

`docs/app-review.md` is not superseded — its rejections (hearts, leaderboards,
model-generated answers, audio) survive this review with better reasons. What
changes is the ranking: several mechanics adopted there for engagement are
neutral or negative for learning, and three mechanisms with stronger evidence
were missing entirely.

## Status

Everything in the v1 scope at the foot of this document is built (ADR-0007),
along with four of the six items it deferred (ADR-0008): the exposure path for
untreatable errors, the pretest flip, the fluency minute and the pseudoword
anchors. **The reading strand — the largest gap this document names — is now
built too (ADR-0009):** twelve graded texts, and a validator that refuses to
ship one unless a learner at its level already knows 95% of its running words.
One item remains deliberately unbuilt, FSRS, for the reason in the final
table.

## Citation convention

Every empirical claim carries author + year. Confidence is marked:

- **✔** — I am confident of the citation and of roughly what it found.
- **~** — the finding is right, the number attached to it is from memory and
  may be off. Verify before quoting it anywhere public.
- **?** — I believe this exists but would not defend the reference. Verify.

Where the literature is contested, or where SLA and general memory research
disagree, that is stated rather than smoothed over.

---

## Context — the app as it actually is

| | |
|---|---|
| **Product** | Багш: (a) a daily English journal corrected by a LangGraph pipeline; (b) an offline PWA trainer — path/lessons, talk, grammar game, word ladder. |
| **Stack** | Python + LangGraph, one strong-tier and one cheap-tier LLM call per entry. PWA is vanilla JS, `localStorage`, GitHub Pages, no server, **no LLM at all**. |
| **Learners** | Mongolian L1. Self-selected A1–C2, default B1. Goal: work. Text only. Realistically 5–15 min/day, often on a phone, often offline. |
| **Exists today** | 24-category error taxonomy; ~64 deterministic patterns; corrector + `difflib` edit computation; tutor / fluency / coach / teacher / drills nodes; 24-topic curriculum path + C1/C2 topics; ~95 grammar items; curated word deck + a 6,800-word CEFR frequency list; 19 dialogues → 74 talk drills; SM-2-lite SRS over three decks; XP, optional streak, badges, self-set rewards. |
| **Constraints** | Solo dev. Offline-first. Zero LLM in the PWA. Curated content only — a model never writes an answer key. Every Mongolian string still needs native-speaker verification, so new Mongolian is expensive. |
| **Not wanted** | Hearts/lives, leagues, leaderboards, gem economies, audio, model-generated quiz content. |

Two facts about this app matter more than anything in Part 1, and they should
be read as constraints on every recommendation below:

1. **The journal is the only place the learner produces free output**, and it
   is the only source of data about what *this* learner actually gets wrong.
   It is also the only part that does not run in the PWA. The learning engine's
   biggest structural weakness is that its richest signal and its most-used
   surface are on opposite sides of a wall.
2. **Three of Nation's four strands are represented; the input strand is
   empty.** There is nothing to read in this app. *(This was the state when
   this document was written. ADR-0009 closed it — see Status above. The
   analysis below is left as it was, because the reasoning is what justifies
   the build.)*

---

# Part 1 — Evidence review

## 1. Testing / retrieval practice

**(a)** Retrieving an item from memory produces more durable learning than
restudying it for the same amount of time (Roediger & Karpicke 2006 ✔).

**(b)** Rowland (2014 ✔) meta-analysed ~160 comparisons and found g ≈ 0.50
against restudy controls (~). The single most relevant experiment to this app
is Karpicke & Roediger (2008, *Science* ✔): for foreign-language word pairs,
dropping items from further **testing** once learned crushed one-week recall
(~36%) while dropping them from further **study** did not (~80%). Repeated
retrieval, not repeated exposure, is what makes vocabulary stick.

**(c)** Boundaries: the effect needs a retrieval attempt that is at least
sometimes successful, and it needs feedback — with feedback even failed
retrieval helps (Kornell, Bjork & Garcia 2011 ✔). It shrinks or vanishes on
immediate tests and grows with delay, which means **any A/B test that measures
end-of-session performance will report the wrong winner**. Recognition formats
produce less benefit than recall formats. Whether the effect survives for
complex, high-element-interactivity material is genuinely contested (van Gog &
Sweller 2015 vs Karpicke & Aue 2015 ✔ that the debate exists).

**(d)** Replicated, repeatedly, including in classrooms (McDaniel et al. 2011
~). Dunlosky et al. (2013 ✔) rate practice testing one of only two "high
utility" techniques out of ten reviewed. **Survives.**

> **For this app:** the grammar game and talk cloze are already retrieval, and
> typed. The lesson path and the "mark finished" button are not — they are
> exposure with a self-report checkbox on the end.

## 2. Spacing and modern scheduling (SM-2 vs FSRS)

**(a)** The same total study time spread over more sessions produces better
retention than massed time (Ebbinghaus 1885 ✔; Cepeda et al. 2006 ✔).

**(b)** Cepeda et al. (2006 ✔) meta-analysed 254 studies; the distributed
advantage is robust and moderate (d ≈ 0.4 ~). Cepeda et al. (2008 ✔) is the
one to design against: the optimal gap **scales with the retention interval**,
roughly 10–20% of it (~). Retention wanted in a week → gap of about a day;
retention wanted in a year → gaps of a month or more.

**(c)** Boundaries: spacing gains assume review actually happens; a schedule
the learner abandons is worth nothing. The gap function is flat near its
optimum, so precise scheduling buys much less than people assume — being
roughly right matters, being exactly right does not.

**(d)** One of the most replicated findings in psychology; the second of
Dunlosky et al.'s (2013 ✔) two "high utility" techniques. **Survives.**

**SM-2 vs FSRS — read this before rewriting the scheduler.** SM-2 (Wozniak &
Drexler 1990 ✔) is a heuristic: an ease factor multiplied into an interval,
with hand-tuned constants. It has no model of forgetting. FSRS (Ye et al.,
open-source; a DSR model of difficulty / stability / retrievability, explicitly
built on Bjork & Bjork's storage-vs-retrieval-strength distinction ~) fits a
forgetting curve per item and schedules for a target retention probability. Its
published advantage over SM-2 is **lower RMSE in predicting whether a review
will be recalled**, measured on very large Anki review logs (?; the benchmark
exists, the numbers I would not quote).

That is an important distinction and the reason FSRS is **not** in this app's
v1: FSRS is better at *predicting recall*, which is not the same claim as
*produces more learning per minute*, and I know of no RCT establishing the
latter (~ — if one exists, it changes this call). FSRS also needs a review-log
history to fit parameters; with a few hundred reviews it falls back to
defaults, which is where a solo-dev app with a 95-item grammar deck lives.

**What actually beats SM-2 here, at a fraction of the cost, is the next item.**

## 3. Desirable difficulties

**(a)** Conditions that slow acquisition and depress performance during
practice often improve long-term retention and transfer (Bjork 1994 ✔).
Bjork & Bjork's (1992 ✔) new theory of disuse separates **storage strength**
(how well learned) from **retrieval strength** (how accessible now); retrieval
practice at low retrieval strength buys the most storage strength.

**(b)** Not a single effect with a single size — it is the umbrella over
spacing, testing, interleaving, generation and varied practice. Judge it by its
constituents.

**(c)** The boundary is the one people get wrong: **difficulty is not the
mechanism, effortful *successful* retrieval is.** Add difficulty to a novice
with no schema and you get load, not learning (expertise reversal, Kalyuga et
al. 2003 ✔). Bjork's own framing — "desirable *difficulties*, not
*impossibilities*."

**(d)** The framework is well supported through its constituents; the umbrella
itself is a theory, not a measured effect. Soderstrom & Bjork (2015 ✔) is the
key corollary: **performance during training is not a valid measure of
learning.** That single sentence invalidates most in-app metrics in this
industry.

## 4. Generation effect

**(a)** Material you produce yourself is remembered better than material you
read (Slamecka & Graf 1978 ✔).

**(b)** Bertsch et al. (2007 ✔) meta-analysis, mean d ≈ 0.40 (~).

**(c)** Requires successful generation, or feedback immediately after failure;
weaker for long/complex material; the gain is on the generated element, not the
surrounding text.

**(d)** Robust for word- and sentence-level material — exactly this app's unit
size. **Survives.**

**Its stronger cousin, which the app currently does backwards:** *pretesting*
(errorful generation before instruction). Guessing at an answer you cannot
know, then being told, beats being told first — even though every guess is
wrong (Richland, Kornell & Kao 2009 ✔; Kornell, Hays & Bjork 2009 ✔). The
current vocabulary card teaches first, then asks. Reversing that order is a
~15-line change with a real evidence base behind it.

## 5. Interleaving vs blocking

**(a)** Mixing problem types within a session beats practising each type in a
block, on delayed tests (Rohrer & Taylor 2007 ✔).

**(b)** In maths, the delayed-test gaps are unusually large — Rohrer, Dedrick &
Stershic (2015 ✔) and the classroom follow-ups report differences of the order
of 60% vs 20% correct (~ on the exact figures).

**(c)** The mechanism is **discrimination**: interleaving only helps when the
learner must *choose* which rule applies. If the exercise already announces the
rule ("Past tense — Unit 7"), there is nothing to discriminate and interleaving
just adds switching cost. It also depresses in-session performance, which
learners reliably misread as "this is working badly" (Kornell & Bjork 2008 ✔).

**(d)** **This is where SLA and general memory research disagree, and this app
sits on the fault line.** In category learning and maths, interleaving is
strong and replicated. In L2 grammar the picture is mixed: some studies find
blocked practice better for *initial* acquisition of a new form, with
interleaving better for later consolidation and for confusable forms (Nakata &
Suzuki 2019 ~; Suzuki 2021 ~). For vocabulary, spacing dominates and
interleaving adds little.

> **For this app:** the honest reading is *block the introduction, interleave
> the review*. A tab-per-strand UI forces blocking on everything, including
> review, which is the wrong half.

## 6. Nation's Four Strands and high-frequency coverage

**(a)** A balanced course gives roughly equal time to meaning-focused input,
meaning-focused output, language-focused learning, and fluency development
(Nation 2007 ✔).

**(b)** The 25/25/25/25 split is a **design principle backed by its
components**, not the output of a four-arm trial — treat the proportions as a
diagnostic, not a law. The coverage numbers underneath it are empirical:
98% lexical coverage is needed for unassisted comprehension of a text, 95%
gives assisted comprehension (Hu & Nation 2000 ✔; Laufer 1989 ✔ for the 95%
threshold), which requires roughly 8,000–9,000 word families for written
English and 6,000–7,000 for spoken (Nation 2006 ✔). Vocabulary needs
repetition — on the order of ten meaningful encounters (Webb 2007 ~), with
frequency-of-encounter correlating with learning at about r ≈ .34
(Uchihara, Webb & Yanagisawa 2019 ~).

**(c)** Coverage figures describe **receptive reading**, not production. A
learner with 6,800 recognised words may produce 1,500. And self-report
checklists systematically over-estimate: learners tick words they half-know,
which is why vocabulary-size tests use **pseudoword anchors** to subtract
over-claiming (Anderson & Freebody 1981 ✔; the technique is standard in the
Vocabulary Size Test literature ~).

**(d)** The coverage research replicates well. The strands framework is sound
pedagogy with component support.

> **For this app (updated):** all four strands now exist — input via the
> reading library (ADR-0009), fluency via the timed minute (ADR-0008), output
> via the journal, language-focused learning everywhere else. The proportions
> are still wrong: 2,268 words of reading against a whole app of study is not
> 25%. The Coverage Check's anchors landed in ADR-0008.

## 7. Comprehensible input (Krashen) vs pushed output (Swain)

**(a)** Krashen (1985 ✔): acquisition comes from comprehensible input slightly
beyond current level (i+1); production and instruction contribute little.
Swain (1985, 1995 ✔): producing language forces syntactic processing that
comprehension does not, and does three things — makes learners notice gaps,
test hypotheses, and reflect metalinguistically.

**(b)** Krashen's framework is **largely unfalsifiable as stated** — i+1 is not
independently measurable, and the affective filter is unobservable (McLaughlin
1987 ✔; Gregg 1984 ✔). But the practical prescription that follows from it —
lots of extensive reading — has independent support: Nakanishi (2015 ✔)
meta-analysed extensive reading with a small-to-moderate effect (d ≈ 0.46 ~).
Output-plus-feedback beating input-only for *accuracy* is well attested in the
corrective-feedback literature (see §9); a clean meta-analysis of Swain's
output hypothesis as such, I would not cite (?).

**(c)** They are not rivals at the level of features. Input builds breadth,
comprehension and collocational intuition; output builds accuracy, retrieval
strength and fluency. Input alone reliably leaves fossilised errors — the
Canadian immersion finding that started Swain's work (✔).

**(d)** Verdict: **build both, believe neither theorist's exclusivity claim.**

> **For this app:** it is 100% output and language-focused study. That
> composition predicts exactly the profile Mongolian learners here show —
> functional production riddled with stable article/copula errors — and it
> predicts slow vocabulary growth, because 3,000 → 9,000 words is a reading
> job, not a flashcard job (Nation 2006 ✔). The flashcard deck is the right
> tool for the first 2,000–3,000 and the wrong tool for the rest.

## 8. Noticing (Schmidt)

**(a)** Learners acquire the features of input they consciously notice, and
progress requires noticing the gap between what they said and what a competent
speaker would say (Schmidt 1990 ✔).

**(b)** The evidential base is thinner than the citation count suggests: the
founding study is Schmidt & Frota's (1986 ✔) diary of one learner —
Schmidt himself.

**(c)** The **strong** version (no learning without awareness) is not
supported; there is evidence of learning without reportable awareness
(Williams 2005 ✔), and Truscott (1998 ✔) is the standard critique. The **weak**
version — attention to form improves learning — is well supported (Robinson
1995 ~; Leow 2015 ~).

**(d)** Contested in its strong form, safe in its weak form. Design for the
weak version: **make the gap visible at the moment of error.**

> **For this app:** the `difflib` edit display is a purpose-built noticing
> device — "you wrote X, the target is Y", with the span located exactly. This
> is the app's best-designed feature and it comes from the standing "the model
> never produces the error list" rule, not from the SLA literature. Good
> architecture arrived at a good pedagogy by accident. Keep it.

## 9. Corrective feedback: prompts vs recasts

**(a)** Recasts (reformulating the learner's utterance correctly) are the most
common feedback move and among the least effective; prompts (elicitation,
clarification requests, metalinguistic clues, repetition) push the learner to
**self-repair** and produce far more uptake (Lyster & Ranta 1997 ✔).

**(b)** Lyster & Ranta (1997 ✔): recasts were ~55% of all feedback in French
immersion but drew the lowest uptake and repair rates (~31% ~); prompts drew
substantially more. Meta-analytically, corrective feedback works: Li (2010 ✔)
reports a medium effect overall (d ≈ 0.6 ~), with explicit feedback larger
immediately and implicit feedback better maintained at delay. Lyster & Saito
(2010 ✔) find prompts outperform recasts on delayed measures (~).

**(c)** The boundaries are the most product-relevant thing in Part 1:

- **Treatable vs untreatable errors** (Ferris 1999 ✔). Rule-governed, closed
  errors — articles, copula, subject–verb agreement, plurals, capitalisation —
  respond to explicit correction. Idiomatic ones — word choice, collocation,
  register — do not; there is no rule to look up, and correcting them mostly
  teaches the learner that they are bad at English. Bitchener & Knoch (2010 ✔)
  and Bitchener (2008 ✔) show focused written CF on English articles producing
  gains that hold for months. Truscott (1996 ✔) argued grammar correction is
  ineffective or harmful; the resolution of that long argument is essentially
  Ferris's distinction plus "focused beats unfocused".
- **Focused beats unfocused.** Correcting one or two features works; correcting
  everything does not (✔). The app's "at most 3 corrections" rule is, by
  accident, a research-backed default — but only if the three are chosen by
  *category priority*, not by order of appearance.
- **Developmental readiness** (Pienemann's teachability hypothesis, 1984/1998
  ✔): a structure can only be taught when the learner is at the preceding
  stage. Feedback on a form two stages ahead is wasted.

**(d)** That CF works is settled. Prompts > recasts is well supported but not
unanimous (recast studies with intensive, salient recasts do well ~).

> **For this app, this is the single most actionable section.** The teacher
> node currently *recasts*: it shows the corrected sentence. The evidence says
> to **prompt first** — show the learner their own sentence with the offending
> span blanked, ask them to repair it, then reveal. That converts every journal
> error into a retrieval opportunity instead of a reading opportunity, and it
> costs no LLM call, because the span and the target are already computed
> deterministically by `diff.py`.

## 10. Skill acquisition and automatization (DeKeyser)

**(a)** Knowledge moves declarative → procedural → automatized through
practice; automatization shows up as a power-law drop in reaction time and
error rate, not as new knowledge (DeKeyser 1997, 2007 ✔; power law: Newell &
Rosenbloom 1981 ✔; Logan 1988 ✔ for instance theory).

**(b)** The RT curves are robust and old. What is specific to SLA is that the
gains are **skill-specific**: DeKeyser (1997 ✔) found comprehension practice
automatized comprehension and production practice automatized production, with
little crossover.

**(c)** Requires many repetitions of the *same* skill under conditions
resembling use — including time pressure. Explanation does not automatize.
Recognition practice does not automatize production.

**(d)** Well supported. **Survives.**

> **For this app:** every drill is untimed and self-paced, so nothing measures
> or trains automatization. Nation's fourth strand — fluency development on
> *easy, known* material under mild time pressure — is the missing half of
> practice. It is also the cheapest missing feature: the items already exist,
> they just need a timer and a rule that only mastered items appear.

## 11. Cognitive load theory

**(a)** Working memory is the bottleneck; instruction should minimise load that
does not build schemas (Sweller 1988 ✔).

**(b)** Its strongest testable children: the worked-example effect (Sweller &
Cooper 1985 ✔; large effects for novices ~), split-attention, redundancy, and
expertise reversal (Kalyuga et al. 2003 ✔).

**(c)** The effects **reverse with expertise** — worked examples help novices
and hurt experts, who need practice problems instead. The "germane load"
component has been repeatedly reformulated and is the weakest part of the
theory (Sweller 2010 ~). Element interactivity is what actually predicts load,
and it is hard to measure a priori.

**(d)** The core and its main effects replicate. The theory's edges are
contested. **Survives, with care.**

> **For this app:** one decision per screen is already the pattern, and the
> bilingual card (word + stress + gloss_en + gloss_mn + example) is at the edge
> — it is four representations of one item, which is redundancy for a B2
> learner and support for an A1 learner. That argues for **level-conditional
> card density**, not for cutting the Mongolian.

## 12. Deliberate practice

**(a)** Expert performance comes from sustained, effortful practice designed to
target current weaknesses, with immediate feedback and repetition of the
failing component (Ericsson, Krampe & Tesch-Römer 1993 ✔).

**(b)** The defensible core is the **design** of practice, not the hours.
The 10,000-hour rule is a popularisation Ericsson himself rejected. Macnamara,
Hambrick & Oswald (2014 ✔) meta-analysed deliberate practice across domains and
found it explained roughly 26% of variance in games, 21% in music, 18% in
sports, ~4% in education and ~1% in professions (~ on the exact percentages).

**(c)** It requires an identified weakness, a task that isolates it, immediate
feedback, and a repair attempt. Repetition without those four is just time.

**(d)** The construct survives; the strong "practice is all that matters" claim
does not. **Use the design principles, refuse the hour-counting.**

> **For this app:** the four requirements map exactly onto what already exists —
> the taxonomy identifies the weakness, `diff.py` isolates the span, the tutor
> supplies feedback. What is missing is the fourth: **the repair attempt.**

## 13. What was missing from the list — and outranks several items on it

**13a. Successive relearning** (Rawson & Dunlosky 2011 ✔; Dunlosky & Rawson
2015 ✔). Retrieve each item to a **criterion** (e.g. three correct recalls)
within a session, then repeat that to-criterion session at spaced intervals.
This is spacing × testing composed, and it is the strongest *practically
implementable* result in the applied memory literature — classroom studies
report gains on real course exams, not lab word lists (~ on the size). It
subsumes most of what a scheduler rewrite would buy. **It should be the
backbone of this app's scheduler, and it is roughly 40 lines of code.**

**13b. Feedback that targets the task, never the person.** Kluger & DeNisi
(1996 ✔) reviewed 607 effect sizes and found that **about one third of feedback
interventions made performance worse**, with the damage concentrated where
feedback drew attention to the self rather than the task. Bangert-Drowns et al.
(1991 ✔) find feedback works best when it supplies the correct answer *after*
the learner has committed to one. This is the empirical basis for the app's
existing "never generic praise" rule — and an argument against every mechanic
that scores the *learner* rather than the *answer*.

**13c. Transfer-appropriate processing** (Morris, Bransford & Franks 1977 ✔).
You get good at the operation you practised. Receptive vocabulary practice
gives receptive knowledge; production requires production practice (for L2
vocab specifically, Webb 2005 ✔ on receptive vs productive gains). This is the
principle that condemns tap-the-word-bank exercises, and it is why the talk
drills' switch to typed cloze (ADR-0006) was the right call.

**13d. Pretesting / errorful generation** — see §4. Cheap, replicated, and the
app currently does it backwards.

---

# Part 2 — Translation to features

Ranked by (evidence strength × impact for *this* app) ÷ build cost. "Cost" is
solo-dev days including tests and Python/JS parity.

| # | Principle | Mechanism | Concrete feature | Measured by | Cost | Rank |
|---|---|---|---|---|---|---|
| 1 | Prompts > recasts (§9); noticing (§8); deliberate practice (§12) | Force self-repair before revealing the target | **Repair-first feedback.** The teacher shows the learner's own sentence with the error span blanked and asks for the fix; the correct form is revealed only after an attempt. Span + target already exist in `diff.py` — zero new LLM calls. | Repair rate at first attempt, per category; recurrence of that category in later entries | 1–2 d | **1** |
| 2 | Successive relearning (§13a); spacing (§2); testing (§1) | Retrieval to criterion, re-spaced | **Criterion-based scheduler.** An item is not "known" at one correct answer: it needs *k* correct on *different days*, a lapse drops it into relearning rather than to zero, and a chronic failure becomes a leech that is re-taught instead of re-tested. | Delayed first-attempt accuracy (Part 5 §2); lapse rate; leech count | 1–2 d | **2** |
| 3 | Error-driven practice (§9, §12); fossilisation | Schedule the learner's *own* errors | **Error-type queue.** Every journal error becomes a scheduled item keyed by category + form; it graduates only after correct repairs on separate days *and* clean entries; a recurrence re-enters it. | Category graduation count; time-to-graduation; recurrence after graduation | 2–3 d | **3** |
| 4 | Interleaving for review (§5); spacing (§2) | One due queue, mixed types | **"Today" session.** One entry point that pulls whatever is due across grammar, vocabulary and talk and interleaves it, instead of three tabs of blocked practice. Introduction of new material stays blocked (per §5's SLA caveat). | Session completion rate; delayed accuracy vs the blocked baseline | 2 d | **4** |
| 5 | Automatization (§10); fluency strand (§6) | Speeded practice on known material | **Fluency minute.** 60 seconds of already-mastered items, timed, no new learning. Requires a timer and a "mastered only" filter. | Median time-to-correct on mastered items over weeks (should fall as a power law) | 1 d | **5** |
| 6 | Pretesting (§4, §13d) | Guess before being told | **Flip the new-word card**: ask for the meaning first, accept the wrong guess, then teach. Same screens, reversed order. | First-exposure retention at the next due date | 0.5 d | **6** |
| 7 | Treatable vs untreatable errors (§9c) | Different treatment per error type | **`treatable:` flag on every taxonomy category.** Treatable → drill + rule + repair. Untreatable (word choice, collocation, register) → exposure and a natural alternative, never a rule drill, never a "wrong". | Share of drills spent on untreatable categories (should approach 0) | 0.5 d | **7** |
| 8 | Feedback targets the task (§13b) | Never score the person | **Progress screen split**: "what you can do" (proficiency metrics) separated from "habit" (XP, streak). Habit numbers never appear in an answer to "am I improving?". | n/a — this is a de-biasing change | 0.5 d | 8 |
| 9 | Coverage & self-report inflation (§6c) | Anchor the estimate | **Pseudoword anchors in the Coverage Check**: 10% of items are plausible non-words; over-claims discount the estimate. | Corrected coverage vs raw; the gap is itself a calibration score | 1 d | 9 |
| 10 | Comprehensible input (§7); coverage (§6) | Volume of reading | **Reading strand** — graded texts with tap-to-gloss, feeding unknown words into the deck. | Words read per week; new-word encounters in context | 5–10 d | 10 |
| 11 | Cognitive load / expertise reversal (§11) | Fade support as skill grows | **Level-conditional card density** — A1/A2 see the Mongolian gloss first; B2+ see English only, with Mongolian on demand. | Accuracy at each density; no drop expected if the fade is right | 1 d | 11 |
| 12 | Scheduling precision (§2) | Model the forgetting curve | **FSRS**. Deferred: better recall *prediction* is not evidence of better *learning*, and it needs a review history this app does not yet have. | RMSE of predicted vs actual recall | 3–5 d | 12 |

**What to cut, and say so out loud:** #10 and #12 are not in v1. #10 is the
largest *learning* gap in the app (the empty input strand) and the largest
build; it is deferred because a graded-reading library is a content project,
not a code project, and half-building it produces a tab with four texts in it
that nobody opens. #12 is deferred because the evidence for it is prediction
accuracy, not learning gain.

---

# Part 3 — Session design

**A 15-minute session, with a 5-minute core that survives a bad day.** The
learner is on a phone, offline, often tired. Every segment below is
interruptible; the session's value is front-loaded so that quitting at minute 5
still delivers the two highest-evidence mechanisms.

| Minutes | Segment | Strand (Nation) | Principle served | What it looks like |
|---|---|---|---|---|
| 0:00–1:00 | **Fluency minute** | Fluency development | Automatization (§10) | 6–10 *mastered* items, timed, easy on purpose. No new material. Answers scored for speed, not for the SRS. |
| 1:00–6:00 | **Due queue, interleaved** | Language-focused | Spacing (§2), retrieval (§1), interleaving for review (§5) | 10–14 items pulled by due date across grammar / vocab / talk, mixed. A miss is re-asked later in the same session and must be got right twice before it leaves. |
| 6:00–9:00 | **New material, blocked** | Language-focused | Pretesting (§4/§13d), generation (§4), CLT (§11) | At most 3 new items, all from the same topic (blocked — §5's SLA caveat). Each: guess → feedback → teach → immediate retrieval. |
| 9:00–12:00 | **Your errors** | Language-focused / output | Prompts > recasts (§9), noticing (§8), deliberate practice (§12) | 2–3 items from the error queue: *your own sentence*, span blanked, repair it. Treatable categories only. |
| 12:00–15:00 | **Write** | Meaning-focused output | Output hypothesis (§7), transfer-appropriate processing (§13c) | The journal. Three sentences is a valid entry. Corrections arrive as prompts, not recasts. |

**The 5-minute version** is minutes 1:00–6:00 only: the due queue. That is
spacing + retrieval + interleaving, i.e. the two "high utility" techniques from
Dunlosky et al. (2013 ✔) and nothing else. Everything above and below it is an
improvement on a session that is already worth doing.

**The input strand now has a home** (ADR-0009): a research-honest 15 minutes
gives about 4 of them to reading, and there are now twelve graded texts to
read. It sits outside the five segments above on purpose — reading is the one
part of the app that is not a queue, and putting it on a timer would make it
another thing to get through.

## What changes on day 1, day 30, day 60

| | Day 1 | Day 30 | Day 60 |
|---|---|---|---|
| **Due queue** | Empty. The session is new material. | Dominant: ~60% of items. Backlog begins to matter; new intake throttles when >30 items are due. | Steady state. Most items have intervals >21 days, so daily due count *falls* even as known items rise — the learner should be told this, or it reads as the app running out of content. |
| **New items/day** | 5–6 (nothing else to do) | 3 | 3, auto-reduced to 0 on days when the backlog is over the cap |
| **Fluency minute** | Skipped — nothing is mastered yet | ~50 mastered items to draw on | Deep pool; time-to-correct becomes a real trend line |
| **Error queue** | Empty. Grammar practice follows taxonomy priority: copula → word order → articles → agreement | 5–15 tracked forms; the first graduations; the first *leeches* identified | The main personalisation signal. Leeches have been routed to re-teaching. Categories start disappearing from the queue entirely — the intended end state |
| **Level** | Self-selected, default B1 | `accuracy_history` has 10 entries, so automatic promotion/demotion can fire | Level is evidence-based, not self-reported |
| **What the learner is shown as "progress"** | "You met 6 new things" | Errors/100 words trend + first graduations | Graduated categories, mature item count, delayed accuracy — the Part 5 metrics have enough data to be meaningful |

---

# Part 4 — The error-type scheduler

This is the part of the app that no competitor can copy, because it needs the
learner's own writing and a closed, L1-contrastive taxonomy. Specified in full.

## 4.1 Taxonomy of error types

The 24 categories in `knowledge/error_taxonomy.yaml` stay as they are. They
gain **one new field**, which changes how each is treated:

```yaml
treatable: true    # rule-governed, closed class → drill it
treatable: false   # idiomatic/open → expose it, never drill a "rule"
```

The split follows Ferris (1999 ✔) and Bitchener & Knoch (2010 ✔):

| Treatable — drill, rule, repair | Untreatable — expose, offer alternative, never mark "wrong" |
|---|---|
| copula, word_order, articles, verb_agreement, plurals, missing_subject, topic_fronting, questions_negation, verb_form, punctuation, pronoun_gender, capitalization, countability, determiners, comparatives, relative_clauses, reported_speech, spelling, modifier_placement | prepositions*, collocation, word_choice, register, tense_aspect* |

\* Judgement calls, flagged as such. `prepositions` is partly rule-governed
(time/place) and partly arbitrary (*depend **on***); the rule-governed subset is
covered by the deterministic patterns, and the arbitrary remainder behaves like
collocation. `tense_aspect` is rule-governed in form but usage-driven in
choice; drill the form, expose the choice. Where the taxonomy needs a finer
grain than one flag, that is a `linguistics-curator` job, not a code job.

Each error item also inherits the category's `blocking` (how much it obstructs
understanding) and `frequency` (how common among Mongolian speakers). These are
already in the taxonomy and are **two different dimensions** — priority must
never collapse them into one number silently.

## 4.2 How errors get tagged — and what the LLM does not do

Unchanged, and this is load-bearing:

1. `matcher` (code) matches deterministic patterns → `category` comes from the
   pattern file. Zero model involvement.
2. `corrector` (LLM) returns a corrected sentence. It is never asked what is
   wrong.
3. `diff` (code) computes edits with `difflib`. Every edit is, by construction,
   a real difference between the learner's text and the correction.
4. `tutor` (LLM) assigns each computed edit a category **from the closed
   24-value enum** and adapts the taxonomy's own wording to the level. It
   classifies; it does not detect, and it cannot invent a category.

So the scheduler consumes *code-computed spans with a model-assigned label from
a closed set* — never a model-authored error list. The queue inherits the
precision guarantee of the pipeline, and a mis-tagged category is a
misfiled drill, not an invented error.

## 4.3 Data model

`data/srs/<learner>_errors.json` — one file, same directory and conventions as
the existing decks.

```jsonc
{
  "version": 1,
  "items": {
    "articles:i am geologist": {
      "key":        "articles:i am geologist",  // category + normalised span
      "category":   "articles",
      "treatable":  true,
      "form":       "I am geologist",           // what the learner wrote
      "target":     "I am a geologist",         // what the corrector returned
      "entry_ids":  ["a1b2c3", "d4e5f6"],       // entries it appeared in
      "seen":       2,                          // times produced in writing
      "first_seen": "2026-08-01",
      "last_seen":  "2026-08-14",

      "state":      "queued",   // queued | drilling | graduated | leech
      "streak":     0,          // consecutive correct repairs, distinct days
      "days":       [],         // the distinct days those repairs happened
      "lapses":     0,
      "ease":       2.5,
      "interval":   0,
      "due":        "2026-08-15"
    }
  },
  "categories": {
    "articles": { "seen": 9, "graduated": 0, "last_seen": "2026-08-14",
                  "entries_clean": 1 }
  }
}
```

Three deliberate choices:

- **The key is category + normalised form**, not a UUID. The same error made
  twice must land on the same item — that *is* the fossilisation signal, and
  the existing `error_recurrence` map already uses this key shape
  (`_fossil_key` in `nodes/memory.py`).
- **Both levels are tracked.** The *item* is a specific fossilised form ("I am
  geologist"); the *category* is the system ("articles"). Items drive drills;
  categories drive what the curriculum teaches next and what counts as
  graduation in Part 5.
- **Nothing is deleted.** A graduated item keeps its history so a recurrence
  can be recognised as a relapse rather than a new error.

## 4.4 Scheduling

**Entry.** After each entry, every labelled edit folds in: `seen += 1`,
`last_seen = today`, entry id appended. A new item enters `queued`, due
**tomorrow** — not today. Same-day re-drilling of an error the learner has just
had explained is massed practice (§2), and the explanation is still in working
memory, so the retrieval is free.

**Priority** (which of the due items gets drilled, when only 2–3 slots exist):

```
score = blocking_weight(category)      # high 3, medium 2, low 1
      × min(seen, 5)                   # recurrence, capped
      × (1 + overdue_days / 7)         # overdue first
```

Untreatable categories are filtered out before scoring rather than weighted
down — they are never drilled at all (see graduation, below).

with **at most one item per category per session** — interleaving (§5) and a
guard against the learner spending a whole session on articles.

**The drill itself** is a prompt, not a recast (§9): the learner's own sentence
with the span blanked, their own wrong form shown as what to fix, a repair
typed. Feedback reveals the target and the taxonomy rule at the learner's
level. No new content is generated, and the grader is the existing contraction-
aware `check_answer`.

**Success** (`streak += 1`, but only if today is not already in `days`):

```
interval = 1 → 3 → round(interval × ease), ease += 0.05, capped at 3.0
```

**Failure** — relearning, not reset (§13a):

```
lapses += 1
ease     = max(1.3, ease − 0.2)
interval = 0        →  due today, re-asked later in the same session
streak   = 0        →  the criterion clock restarts
```

**Graduation** requires *both* conditions, and this is the important design
decision:

1. **`streak >= 3` on three distinct days** — the successive-relearning
   criterion (§13a), not one lucky answer; **and**
2. **the form has not appeared in the last 2 journal entries** —
   because the goal is not answering a drill, it is not making the error.

Condition 2 is what stops the app from measuring itself. A learner can pass any
drill; the only evidence that matters is free production.

**Untreatable items never graduate by drill** — condition 1 is skipped for
them, and only condition 2 applies. They come back instead as **exposures**
(ADR-0008): *you wrote X, more natural: Y*, with the L1 bridge, one per
session, pushed out four days each time it is shown. No answer, no score, no
XP — and `mark_shown` deliberately leaves `streak` alone, because reading is
not retrieval and something only ever read must never reach the criterion.

**Re-entry.** A graduated item that reappears in an entry:

```
state    = "queued"
lapses  += 1
interval = max(1, interval // 2)     # keep the history, halve the confidence
streak   = 0
```

**Leeches.** `lapses >= 4` → `state = "leech"`. The item stops being drilled;
this is the boundary condition from §3 — repeated failure means the knowledge
isn't there, and more testing of absent knowledge is not a desirable
difficulty, it is just failure. A leech instead (a) pushes its category to the
front of the lesson path, (b) is surfaced to the learner as "this one needs the
lesson again, not another quiz", and (c) is counted in the metrics as an
unresolved item. It can re-enter `queued` only after its lesson is re-read.

## 4.5 What may be stored, and from whom

The queue keeps the **sentence** an error appeared in, not just the span,
because the drill replays it: *"You wrote: I am geologist."* That is a real
increase in what the app retains about a learner's writing, and it interacts
with the safety path, so:

- Only entries the distress classifier rated **`none`** contribute sentences.
  An `elevated` entry still feeds error counts, weak points and fossilisation —
  it simply never returns as a grammar exercise. `acute` entries never reach
  any grammar node at all.
- The classifier **fails toward `elevated`**, so a transient failure costs a
  day of queue data and never risks handing someone their worst sentence back
  as a quiz three weeks later.
- Stores live in `data/srs/`, already excluded from version control.

The same gate applies to *today's* repair, not only to the stored copy
(ADR-0008 §5): the teacher quotes the offending **span**, a repair quotes the
whole **sentence**, and only the first of those happens on an entry with any
distress signal. Grammar feedback is not withheld — the correction, the
counters and the fossilisation tracking all run as normal.

The rule in one line: **a whole sentence is only ever replayed from an entry
rated `none` — a sentence a learner wrote while struggling is not practice
material.**

## 4.6 Where it plugs in

```
nodes/memory.py   → error_queue.fold(edits)          # write, deterministic
nodes/drills.py   → error_queue.due(profile, n=3)    # read, chooses the target
nodes/teacher.py  → repair-first rendering of the top edits
src/play.py       → `python -m src.play errors`      # drill them directly
src/curriculum.py → leeches jump the lesson queue
```

All of it code. The only LLM involvement remains the corrector (produces the
correction) and the tutor (labels an already-computed edit).

---

# Part 5 — Metrics

## The four that count

### 1. Free-production error rate — errors per 100 words

**Computed:** `100 × len(labelled_edits) / word_count`, per journal entry;
report the mean of the last 5 entries and the slope over the last 20. Already
half-built as `accuracy_history` in the profile.

**Why it resists gaming:** it comes from writing the learner chose to write,
about their own day. There is one cheat — write shorter, simpler sentences —
so it is **never reported alone**. It is always paired with mean words per
entry and mean words per sentence. A falling error rate with falling length is
avoidance and must be shown as such.

**Good trajectory:** B1 learner starts around 8–12 errors/100 words; a real
improvement is a slope of roughly −0.1 to −0.3 per entry over 20 entries, with
length flat or rising. Plateaus are normal and often precede a level change.

### 2. Delayed first-attempt accuracy (DFA)

**Computed:** of the items answered today whose scheduled interval was
**≥ 7 days**, the percentage correct **on the first attempt**. Retries and
same-session repeats are excluded by construction.

**Why it resists gaming:** grinding an item *shortens* its interval, so it
cannot enter the numerator. The only way to raise DFA is to remember things
after a week.

**Good trajectory:** stable at 80–90% while the number of mature items grows.
Below ~75% means the scheduler is over-extending intervals; above ~95% means it
is under-extending and wasting the learner's minutes on things they know.

### 3. Productive mature count

**Computed:** the number of items with `interval >= 21` days whose last
successful answer was in a **typed production** format (grammar repair, typed
cloze, talk cloze) — not multiple choice.

**Why it resists gaming:** it takes 21+ days of real intervals to enter, and
recognition answers do not count (transfer-appropriate processing, §13c).

**Good trajectory:** monotone increase, roughly linear in study days once the
pipeline fills — ~1–3 items/day at 15 minutes/day. If this rises while DFA
falls, the criterion is too weak.

### 4. Categories graduated (and leeches outstanding)

**Computed:** from the error queue — categories where every tracked item is
`graduated`, i.e. drilled to criterion **and** absent from the last 2 entries.
Reported with its shadow: the number of `leech` items.

**Why it resists gaming:** graduation requires absence in free writing, which
the learner does not control through the drill screens at all.

**Good trajectory:** 24 categories, first graduations at ~4–6 weeks, the
high-frequency architecture ones (copula, word order) first. A category that
graduates and then re-enters twice is telling you the lesson is wrong, not that
the learner is careless.

### 5. (Optional, once the fluency minute exists) Time-to-correct on mastered items

**Computed:** median milliseconds to a correct answer on items with
`interval >= 21`, per week. **Good trajectory:** a power-law decline (§10) —
fast early gains then a long shallow tail. Flat means practice is not
automatizing anything, usually because the items are too varied.

## The vanity metrics — and why each is refused

| Metric | Why it must not be shown as progress |
|---|---|
| **XP total** | A weighted count of taps. It rises fastest for whoever answers the most easy items, which is the opposite of desirable difficulty (§3). Keep it as a habit token; never let it answer "am I improving?". |
| **Streak length** | Measures showing up, not learning — and it invites goal displacement: once the number is the goal, the cheapest session that preserves it is the rational session. Kluger & DeNisi (1996 ✔) is the general warning. This app already makes it optional; that is the right call and it should never become the headline. |
| **Badge count** | Rewards for thresholds already measured elsewhere. Harmless as decoration, dishonest as evidence. |
| **Lessons "marked finished"** | Self-report on a button. Reading a lesson is exposure, not learning (§1). The number can only go up, which makes it useless as a signal. |
| **Words "recognised" on the coverage list** | Uncorrected self-report, and learners over-claim systematically (§6c). It measures *confidence*, not vocabulary, until it has pseudoword anchors. Currently displayed as "N/6800 recognised" — it should be labelled an estimate, and it must never feed level progression (ADR-0005 already got this right for the wrong reason). |
| **% of the course complete** | Completion is tapping through content. It correlates with time spent and nothing else. |
| **In-session accuracy** | The trap Soderstrom & Bjork (2015 ✔) named: performance during training is not learning. Blocked, massed practice maximises it while minimising retention. If it is shown at all, show it *next to* DFA so the divergence is visible. |
| **Total time in app** | An input, not an outcome — and an input this app should want to *minimise* for a given gain. |

---

# Part 6 — Anti-patterns

What the big apps do that the evidence does not support. Mechanism of failure
first; the "don't copy this" follows from it.

**1. Hearts / lives / losing progress on error.**
The mechanism: it attaches a loss to the exact event that carries the learning
signal. Loss aversion then does what it always does — the learner shifts to
whatever minimises loss, which is easy items, recognition formats and guessing
patterns. The measurable damage is invisible in engagement metrics and shows up
only on delayed tests, so the A/B test that introduced it looked fine.
*Already rejected here (ADR-0003). Keep rejecting it.*

**2. Streak-as-product.**
Streaks work — as habit scaffolding (Duolingo's own retention numbers are real).
The failure is making the streak the *goal state*. Once the number is what the
learner protects, the optimal move is the cheapest qualifying session, and
"cheapest" means the shortest, easiest, most massed practice available. Streak
freezes and repair items complete the inversion: the learner can now pay to
keep the metric while doing no learning at all.
*Mitigation already in place: the streak is optional and every surface feeds it.
Do not add freezes, repairs, or a purchasable anything.*

**3. Tap-the-word-bank / four-option-recognition as the dominant item type.**
The mechanism is transfer-appropriate processing (§13c): the learner practises
*selecting among displayed options*, and gets good at selecting among displayed
options. Recognition also inflates in-session accuracy, which feels like
progress. Production requires production practice (Webb 2005 ✔). Word banks
exist because they are easy to grade on mobile, not because they teach.
*This app is already mostly typed. The remaining recognition items — the vocab
meaning round and the talk `reply` items — are justified as first exposure, and
should convert to typed recall on the second encounter. The rule: recognition
may introduce, only production may certify.*

**4. Blocked units — "Unit 7: Past Tense", 20 past-tense items in a row.**
Two mechanisms. First, within a block the exercise itself announces the rule, so
the learner never practises *choosing* it (§5) — and choosing is what free
writing requires. Second, blocking inflates within-session accuracy, so both the
learner and the product team read it as effective. Delayed tests say otherwise.
*Block the introduction of a new form; interleave every review. This is why the
"Today" session exists and why practice must not be organised by tab.*

**5. Correcting everything.**
Unfocused correction of every error in a piece of writing has repeatedly failed
to produce durable gains, and it is the strongest part of Truscott's (1996 ✔)
critique. Focused correction of one or two treatable features works
(Bitchener & Knoch 2010 ✔). Beyond the evidence there is a simple product
failure: a learner who sees 14 red marks stops writing.
*The "at most 3, chosen by category priority" rule is correct. `strictness:
high` showing everything is a documented, learner-chosen override — keep it
opt-in, and never make it the default.*

**6. Recasting as the whole of feedback.**
Showing the corrected sentence is a recast, and recasts have the lowest uptake
of any feedback move (Lyster & Ranta 1997 ✔). Learners read the correction,
agree with it, and change nothing. Reading a correction is not retrieval (§1).
*This is the app's current teacher behaviour and the top-ranked fix in Part 2.*

**7. Engagement-weighted content selection — double XP, timed events, "practice
this for a bonus".**
The mechanism: the scheduler stops serving memory and starts serving session
length. Items get reviewed because they pay, not because they are due, which
directly destroys the spacing (§2) the SRS exists to create.
*Never let a reward multiplier influence which item is shown next.*

**8. Leagues and leaderboards.**
Social comparison feedback moves attention from the task to the self, which is
where Kluger & DeNisi (1996 ✔) locate the third of interventions that make
performance *worse*. For a single-learner app it is also just noise.
*Already rejected. The self-set rewards feature is the right substitute: the
target is the learner's own, and it is not a comparison.*

**9. Guilt notifications and mascot pressure.**
Optimises DAU. There is no mechanism by which it improves retention of English,
and coercive framing pushes toward the cheapest qualifying session (see #2).

**10. Generated content in the answer key.**
Not a Duolingo pattern — an LLM-era one, and the most dangerous for this app. A
hallucinated "correct answer" teaches a learner that their correct English was
wrong. That is the one failure that destroys trust permanently.
*The standing rule — the model never produces the error list, all quiz content
is curated — is the most important architectural decision in this repo. Nothing
in this document is worth relaxing it for.*

---

# v1 scope — the smallest set that captures most of the gain

**Ship these five.** They are ranks 1–7 of Part 2 minus the two that can wait,
and together they are ~6 solo-dev days.

1. **Repair-first feedback** (Part 2 #1). The learner's own sentence, span
   blanked, repair typed, target revealed after. Converts every journal
   correction from a recast into a retrieval. No new LLM call.
2. **Criterion scheduler with relearning and leeches** (#2). Three correct on
   three distinct days to master; a lapse enters relearning instead of
   resetting to zero; four lapses make a leech that gets re-taught rather than
   re-tested. Replaces the SM-2-lite `review()` in one place, mirrored in JS.
3. **The error-type queue** (#3). Part 4 in full. This is the app's only
   irreproducible feature.
4. **The "Today" session** (#4). One interleaved due queue across all three
   decks; new material still blocked; misses re-asked within the session.
5. **Honest metrics** (#8, and the measurement side of #2/#3): errors per 100
   words paired with entry length, delayed first-attempt accuracy, productive
   mature count, categories graduated. Shown *separately* from XP and streak.

**Deliberately excluded from v1, with the honest reason each waits:**

| Excluded | Why it waits |
|---|---|
| ~~**Reading / input strand** (#10)~~ | **Shipped (ADR-0009).** Twelve graded texts with tap-to-gloss, a coverage validator that gates the build, and unknown words flowing into the deck. 2,268 running words is a starter library, not extensive reading — the next job is volume, and the pipeline for adding to it is now mechanical. |
| **FSRS** (#12) | Its documented advantage is recall *prediction* accuracy on large review logs, not learning gain, and it needs review history this app has not accumulated. Item #2 captures most of the same benefit for a fifth of the work. Revisit at ~10k reviews. |
| ~~**Fluency minute** (#5)~~ | **Shipped in v1.1** (ADR-0008). It self-unlocks at six mastered items and says so before then, which turned out to be a better answer than waiting for the pool to exist. |
| ~~**Pretesting flip** (#6)~~ | **Shipped in v1.1** (ADR-0008), together with `srs.introduce` — the flip is only safe once a wrong guess stops counting as a lapse. |
| ~~**Pseudoword anchors** (#9)~~ | **Shipped in v1.1** (ADR-0008): 48 curated non-words, two per round, with the raw and corrected counts shown side by side. |
| **Level-conditional card density** (#11) | Needs data on where the Mongolian gloss stops helping. Guessing at the fade point risks removing support from learners who need it; wait for accuracy-by-level data from the metrics in #5. |

**The one-sentence version:** the app already has an unusually good correction
pipeline and an unusually good taxonomy, and it spends both on *showing*
learners their errors — v1 turns that into *asking* learners to fix them, on a
schedule that respects how forgetting actually works, and then measures whether
the errors stopped happening in real writing.
