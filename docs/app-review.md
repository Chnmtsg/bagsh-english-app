# Review of English-learning apps — and what we adopt

Written 2026-08. Purpose: our app only reacted to text (journal correction,
lessons). The learner wants to study ALL grammar and vocabulary, simplified
and fun. This review mines what the major apps do well and maps each
mechanic to adopt / adapt / reject against our standing rules.

## The apps

| App | What it does well | Weakness for our learner |
|---|---|---|
| **Duolingo** | Habit machine: streaks, XP, bite-size 3-min lessons, immediate feedback. 7-day streak users are ~3.6× more likely to stay engaged. | Lightest on grammar of all major apps; generic content; hearts punish mistakes. |
| **Anki** | Spaced repetition (SM-2) is the single most evidence-backed retention mechanic. Total control of the deck. | Zero fun, zero guidance; most learners abandon deck-building. |
| **Memrise** | SRS + mnemonics + words in real context; typing and multiple-choice variety. | Video/audio-first (out of scope); no L1-specific explanations. |
| **Busuu** | CEFR-structured curriculum; grammar is a first-class citizen; community feedback. | Community correction is exactly what our corrector pipeline already does, better for this learner. |
| **Babbel** | Clear grammar explanations for adults; L1-aware courses. | No Mongolian L1 pairing exists — this is precisely our moat. |
| **Clozemaster** | Cloze (fill-the-gap) sentences in context; game scoring over a big sentence bank. | No curation; sentences unranked by learner need. |
| **Drops / Quizlet** | Visual, 5-minute vocab sessions; low friction. | Vocabulary without context or stress marking. |
| **LingQ / Beelinguapp** | Comprehensible input: reading as the engine of vocab growth (matches our guide: words 3,000–9,000 live in text). | Requires a large reading library — future work, not this iteration. |
| **ELSA et al.** | Speech scoring. | Rejected wholesale: the app is text-only by design. |

## Decisions

**Adopt (this iteration)**

1. **Spaced repetition engine (from Anki)** — SM-2-lite in code
   (`src/srs.py`). Deterministic, zero LLM cost. Drives both study modes.
2. **Grammar game (from Clozemaster + Duolingo)** — "fix this sentence"
   rounds built from the Top-100 checklist we already curate: the wrong
   form is the question, the right form is the answer, the taxonomy rule +
   Mongolian bridge is the feedback. ~95 items covering all 24 categories,
   zero generation, zero hallucination risk.
3. **Vocabulary trainer (from Memrise + Drops)** — curated starter deck
   (`knowledge/vocabulary.yaml`) with word stress ALWAYS marked
   (`de-POS-it`), simple-English gloss, Mongolian gloss, and a real example
   sentence. Two round types: meaning choice and type-the-word cloze.
4. **Streaks + XP + badges (from Duolingo)** — computed in code in the
   learner profile. Every surface (journal, lesson, games) feeds the same
   streak, so any 5 minutes keeps it alive.
5. **Bite-size sessions (from Duolingo/Drops)** — default 5 questions per
   round, always finishable.

**Adapt**

- **Fun tone**: playful feedback lines and badges, and example sentences
  with personality — but praise stays factual (our rule: never generic
  praise). Fun lives in the *game frame*, not in fake encouragement.
- **CEFR structure (Busuu)**: already ours via the lesson path (ADR-0002);
  the games reuse its priority order when introducing new items.

**Reject, with reasons**

- **Hearts/lives (Duolingo)** — punishing mistakes contradicts our core
  stance that errors are information, and it is the top complaint about
  Duolingo. A wrong answer here just comes back sooner (SRS).
- **Leaderboards** — single-learner app; social comparison adds anxiety,
  not learning.
- **Model-generated quiz content** — a hallucinated "correct answer"
  teaches wrong English (standing rule: precision over recall). All quiz
  content comes from curated YAML.
- **Anything audio** — out of scope by design; stress is taught in text.

## Sources

- [Preply: best language learning apps of 2026](https://preply.com/en/blog/best-language-learning-apps/)
- [Olesen Tuition: choosing a language-learning app (Duolingo/Memrise/Babbel/Quizlet/Busuu)](https://www.olesentuition.co.uk/single-post/which-app-should-i-use-to-learn-a-language-duolingo-memrise-babbel-quizlet-busuu)
- [Test Prep Insight: Busuu vs Duolingo (2026)](https://testprepinsight.com/comparisons/busuu-vs-duolingo/)
- [Migaku: language learning apps comparison](https://migaku.com/blog/language-fun/language-learning-apps-comparison)
- [StriveCloud: Duolingo gamification explained](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo)
- [Orizon: Duolingo streaks & XP engagement data](https://www.orizon.co/blog/duolingos-gamification-secrets)
- [DEV: why Duolingo's gamification works (and when it doesn't)](https://dev.to/pocket_linguist/why-duolingos-gamification-works-and-when-it-doesnt-1d4)
- [arXiv: gamification misuse in a language-learning app](https://arxiv.org/pdf/2203.16175)
