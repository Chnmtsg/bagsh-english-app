# 0004. Align teaching behaviour with Bagsh v2

## Status: accepted

## Context

ADR-0001 adopted Bagsh v2's content but rejected its single-call
architecture. A pass over the v2 spec shows the app had also not absorbed
several of its *teaching-behaviour* rules: strictness (§6.1), the corrected
teaching-priority rule (§7.3), the reply format (§6.2/6.3), per-level
response budgets (§4), learner-state defaults (§2), and stress-marked
new-vocabulary output (§11).

## Decision

1. **Strictness (§6.1) — detection and display stay separate.** Detection
   is already complete (matcher + difflib). Display now follows
   `learner.strictness`:
   - `low` — errors that block meaning, plus 1 pattern error
   - `normal` (default) — up to 3, by the §7.3 priority rule
   - `high` — ALL detected errors, grouped by pattern
   ⚠ This AMENDS standing rule 5 ("at most 3 corrections shown"): the cap
   is the default, not an absolute. A learner who explicitly asks to be
   pushed (strictness=high) sees everything — suppressing errors from
   someone who asked for them is the bug v2 §6.1 exists to fix. The cap
   still protects everyone who has not opted in.
2. **Teaching priority (§7.3), in `select_edits`:** blocking first, then
   fossilised (a fossilised error outranks a new error of the same blocking
   level), then category frequency, then one-per-system — when filling the
   display slots, prefer edits from distinct categories so we teach the
   family, not the same symptom twice.
3. **Reply format (§6.2/6.3):** the teacher renders ✍️ you wrote →
   ✅ corrected → 📌 why → 🇲🇳 Mongolian influence → ⭐ patterns →
   🎯 practice/next action. At A0–A2: the short form, mostly Mongolian,
   plain sentences, no tables.
4. **Response budget (§4), injected per level:** A0–A1 ≤120 words, A2 ≤200,
   B1 ≤400, B2 ≤600, C1 no fixed limit. Replaces the flat 250.
5. **Learner-state defaults (§2):** profile gains `strictness` ("normal"),
   `goal` ("work"), `known_words` (3000). Defaults applied silently — the
   learner is never asked for them. `--strictness` on the CLI persists an
   explicit choice.
6. **new_vocab (§11):** the teacher may offer up to 3 new words, always
   stress-marked with a Mongolian gloss and a domain example.
7. **Pattern groups are computed in code** (category counts from the edit
   list) and handed to the teacher — the model formats them, it does not
   count them (determinism boundary, v2 Appendix A).
8. `max_tokens` default raised to 8000 (v2 Appendix C headroom rule).

## Consequences

- `prompts/teacher.md` → version 2.0.0. Stored feedback rows will show the
  version boundary (v2 Appendix D: never backfill).
- At strictness=high a dense entry produces a long reply; the per-level
  word budget still applies to the explanation prose, grouping keeps it
  readable, and the learner asked for it.
- Old profiles lack the new fields; `.get` defaults keep them loading.
