/* Parity harness for PWA logic that also exists in Python.
 *
 *     node tests/grader_parity.js
 *
 * checkAnswer and the vocabulary distractor picker each exist twice —
 * src/quiz.py for the CLI, webapp/app.js for the PWA — so the two can drift
 * and silently behave differently for the same learner.
 * This pulls the REAL function bodies out of app.js (not a copy of them) and
 * runs the cases from tests/test_study_games.py against them, then sweeps
 * every shipped item for the two properties that matter: an item must accept
 * its own answer, and must never accept its own error.
 *
 * The contraction table is not duplicated at all — app.js reads it from
 * data.contractions, exported from src/quiz.py by build_webapp_data.py. */

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(REPO, "webapp/app.js"), "utf8");
const DATA = JSON.parse(fs.readFileSync(path.join(REPO, "webapp/data.json"), "utf8"));

function slice(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`could not locate ${from}`);
  return src.slice(a, b);
}

const code =
  slice("function normalise(s)", "/* Contraction-aware grading") +
  slice("const MAX_READINGS", "function checkWord(");

const grader = new Function("DATA", code + "\nreturn { normalise, readings, checkAnswer };")(DATA);
const { checkAnswer } = grader;

let failed = 0;
function ok(cond, label) {
  if (!cond) { console.log("  FAIL " + label); failed++; }
}

// ── the original contract, unchanged ──────────────────────────────
ok(checkAnswer("I am a geologist.", "I am a geologist."), "exact");
ok(checkAnswer("I am a geologist", "I am a geologist."), "final stop forgiven");
ok(checkAnswer("I  am a geologist.", "I am a geologist."), "whitespace");
ok(checkAnswer("It\u2019s ready.", "It's ready."), "curly quote");
ok(!checkAnswer("I am geologist.", "I am a geologist."), "missing article rejected");
ok(!checkAnswer("i am a geologist.", "I am a geologist."), "caps matter");

// ── contractions, both directions ─────────────────────────────────
ok(checkAnswer("It's very cold today.", "It is very cold today."), "It's -> It is");
ok(checkAnswer("It is very cold today.", "It's very cold today."), "It is -> It's");
ok(checkAnswer("There's a bank near the station.", "There is a bank near the station."), "There's");
ok(checkAnswer("They're at home now.", "They are at home now."), "They're");
ok(checkAnswer("I'm very tired today.", "I am very tired today."), "I'm");
ok(checkAnswer("She doesn't like coffee.", "She does not like coffee."), "doesn't");
ok(checkAnswer("He's finished.", "He has finished."), "he's = he has");
ok(checkAnswer("He's late.", "He is late."), "he's = he is");
ok(!checkAnswer("Its ready.", "It's ready."), "its != it's");
ok(!checkAnswer("Their at home now.", "They are at home now."), "their != they're");

// ── also_accept ───────────────────────────────────────────────────
ok(checkAnswer("I know a man that repairs phones.", "I know a man who repairs phones.",
   ["I know a man that repairs phones."]), "also_accept honoured");
ok(!checkAnswer("I know a man that repairs phones.", "I know a man who repairs phones."),
   "no silent leniency without also_accept");
ok(checkAnswer("Yesterday I finished the report", "I finished the report yesterday.",
   ["Yesterday I finished the report."]), "also_accept + final stop");

// ── the safety property, over every shipped item ──────────────────
let selfAccepting = 0;
for (const q of DATA.grammar) {
  if (checkAnswer(q.prompt, q.answer, q.also_accept)) {
    console.log("  FAIL item accepts its own error: " + q.id + " — " + q.prompt);
    selfAccepting++;
  }
}
ok(selfAccepting === 0, `${selfAccepting} items accept their own error`);

// ── every real answer is accepted when typed correctly ────────────
let selfRejecting = 0;
for (const q of DATA.grammar) {
  if (!checkAnswer(q.answer, q.answer, q.also_accept)) {
    console.log("  FAIL item rejects its own answer: " + q.id);
    selfRejecting++;
  }
}
ok(selfRejecting === 0, `${selfRejecting} items reject their own answer`);

// ── vocabulary distractors (mirror of distractor_tiers in quiz.py) ─
const distractorCode =
  'const LEVELS = ["A1","A2","B1","B2","C1","C2"];' +
  'function levelRank(l) { return Math.max(0, LEVELS.indexOf(l)); }' +
  'const shuffle = a => { for (let i = a.length - 1; i > 0; i--) ' +
  '{ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };' +
  slice("function meaningDistractors(w, k)", "function cloze(w)");
const meaningDistractors =
  new Function("DATA", distractorCode + "\nreturn meaningDistractors;")(DATA);

let unrelated = 0, tight = 0, drawn = 0;
for (const w of DATA.vocab) {
  for (let round = 0; round < 5; round++) {
    const picked = meaningDistractors(w, 3);
    ok(picked.length === 3, `only ${picked.length} distractors for ${w.word}`);
    ok(new Set(picked.map(x => x.word)).size === picked.length,
       `duplicate distractor for ${w.word}`);
    for (const x of picked) {
      drawn++;
      if (x.pos !== w.pos && x.level !== w.level) {
        console.log(`  FAIL unrelated distractor: ${w.word} (${w.level} ${w.pos})`
                    + ` got ${x.word} (${x.level} ${x.pos})`);
        unrelated++;
      }
      if (x.pos === w.pos && x.level === w.level) tight++;
    }
  }
}
ok(unrelated === 0, `${unrelated} distractors share neither level nor part of speech`);

console.log(failed === 0
  ? `JS parity: all checks passed (${DATA.grammar.length} grammar items, `
    + `${drawn} distractors drawn, ${Math.round(100 * tight / drawn)}% from the tightest pool)`
  : `JS parity: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
