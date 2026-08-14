/* Parity harness for the PWA's answer grader.
 *
 *     node tests/grader_parity.js
 *
 * checkAnswer exists twice — src/quiz.py for the CLI, webapp/app.js for the
 * PWA — so the two can drift and silently grade the same answer differently.
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

console.log(failed === 0
  ? `JS grader: all checks passed (${DATA.grammar.length} items swept)`
  : `JS grader: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
