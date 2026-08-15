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

// ── the scheduler and the session builder (ADR-0007) ──────────────
// srs.py and app.js now both decide when an item comes back, how many days
// a lapse costs and when something is mastered. Same inputs, same records —
// checked by running the real Python module, not a copy of its rules.

const schedulerCode =
  slice("const SESSION_N", "const XP = {") +
  slice("function srsHash(text)", "/* ── the attempt log") +
  slice("function interleave(queues)", "function todayPools()") +
  slice("function requeue(items, index, lag)", "function runSession(items, mode)") +
  'function today() { return "2026-08-14"; }';
const sched = new Function(
  schedulerCode + "\nreturn { srsReview, srsIntroduce, srsMastered, srsLeech,"
  + " srsPick, srsDue, interleave, requeue };"
)();

const SEQUENCES = [
  { id: "g1", answers: [["2026-08-14", true], ["2026-08-15", true],
                        ["2026-08-18", true], ["2026-08-26", true]] },
  { id: "g1", answers: [["2026-08-14", true], ["2026-08-14", true],
                        ["2026-08-14", true]] },                       // same day
  { id: "articles:am geologist",
    answers: [["2026-08-14", true], ["2026-08-15", false],
              ["2026-08-15", true], ["2026-08-16", true],
              ["2026-08-19", true], ["2026-09-01", false]] },
  { id: "tk_cafe_order_0", answers: [["2026-08-14", false], ["2026-08-14", false],
                                     ["2026-08-15", false], ["2026-08-16", false]] },
  { id: "милк", answers: [["2026-08-14", true], ["2026-08-15", true],
                          ["2026-08-18", true], ["2026-08-26", true],
                          ["2026-09-20", true]] },
  // pretest first (ADR-0008): introduced, then really tested from tomorrow
  { id: "deposit", intro: "2026-08-14",
    answers: [["2026-08-15", false], ["2026-08-15", true],
              ["2026-08-17", true], ["2026-08-20", true]] },
  { id: "outcrop", intro: "2026-08-14",
    answers: [["2026-08-15", true], ["2026-08-18", true]] },
];

const FIELDS = ["ease", "interval", "reps", "streak", "lapses", "due", "days"];

function jsRun() {
  return SEQUENCES.map(seq => {
    const store = {};
    if (seq.intro) sched.srsIntroduce(store, seq.id, seq.intro);
    return seq.answers.map(([day, correct]) => {
      const rec = sched.srsReview(store, seq.id, correct, day);
      const out = {};
      FIELDS.forEach(f => { out[f] = f === "ease" ? Number(rec[f].toFixed(9)) : rec[f]; });
      out.mastered = sched.srsMastered(rec);
      out.leech = sched.srsLeech(rec);
      return out;
    });
  });
}

const PY = `
import json, sys
sys.path.insert(0, ${JSON.stringify(REPO)})
from datetime import date
from src import srs, session
seqs = json.load(sys.stdin)
out = []
for seq in seqs:
    store, steps = {}, []
    if seq.get("intro"):
        srs.introduce(store, seq["id"], date.fromisoformat(seq["intro"]))
    for day, correct in seq["answers"]:
        rec = srs.review(store, seq["id"], correct, date.fromisoformat(day))
        row = {f: rec[f] for f in ${JSON.stringify(FIELDS)}}
        row["ease"] = round(row["ease"], 9)
        row["mastered"] = srs.mastered(rec)
        row["leech"] = srs.is_leech(rec)
        steps.append(row)
    out.append(steps)
mixed = session.interleave([["a1", "a2", "a3"], ["b1", "b2"], ["c1"]])
items = [{"deck": "grammar", "id": "g%d" % i, "kind": "review"} for i in range(6)]
print(json.dumps({
    "sequences": out,
    "interleave": [list(p) for p in mixed],
    "requeue": session.requeue(items, 0),
    "constants": {"mastery": srs.MASTERY_STREAK, "leech": srs.LEECH_LAPSES,
                  "backlog": srs.BACKLOG_CAP, "new": srs.NEW_PER_SESSION,
                  "idle": srs.NEW_WHEN_IDLE,
                  "lag": session.LAG},
}))
`;

let python = null;
for (const exe of ["python", "python3", "py"]) {
  try {
    python = JSON.parse(require("child_process").execFileSync(
      exe, ["-c", PY], {
        input: JSON.stringify(SEQUENCES),
        encoding: "utf8",
        // Windows would otherwise hand Python the locale codepage on stdin and
        // mangle any non-ASCII item id — a fake failure that looks like drift
        env: Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }),
      }));
    break;
  } catch (e) { /* try the next interpreter */ }
}

if (!python) {
  console.log("  SKIP scheduler parity — no working python on PATH");
} else {
  const js = jsRun();
  SEQUENCES.forEach((seq, i) => {
    seq.answers.forEach((answer, step) => {
      const a = JSON.stringify(js[i][step]), b = JSON.stringify(python.sequences[i][step]);
      if (a !== b) {
        console.log(`  FAIL scheduler drift on ${seq.id} step ${step + 1}\n    js: ${a}\n    py: ${b}`);
        failed++;
      }
    });
  });

  const jsMixed = JSON.stringify(sched.interleave([["a1", "a2", "a3"], ["b1", "b2"], ["c1"]]));
  ok(jsMixed === JSON.stringify(python.interleave), "interleave order matches Python");

  const items = Array.from({ length: 6 }, (_, i) => ({ deck: "grammar", id: "g" + i, kind: "review" }));
  ok(JSON.stringify(sched.requeue(items, 0)) === JSON.stringify(python.requeue),
     "a missed item is requeued to the same position as Python");

  const c = python.constants;
  const jsConsts = new Function(
    slice("const SESSION_N", "const XP = {")
    + "\nreturn { mastery: MASTERY_STREAK, leech: LEECH_LAPSES, backlog: BACKLOG_CAP,"
    + " new: NEW_PER_SESSION, idle: NEW_WHEN_IDLE, lag: LAG };")();
  ok(JSON.stringify(jsConsts) === JSON.stringify(c),
     `scheduler constants match (js ${JSON.stringify(jsConsts)} vs py ${JSON.stringify(c)})`);
}

// ── the honest metrics (ADR-0007, ADR-0008) ───────────────────────
// delayed accuracy and the fluency trend are computed twice too — once for
// `python -m src.play progress`, once for the PWA's Stats screen. Same log in,
// same numbers out, or one of the two surfaces is lying to the learner.

const ATTEMPTS = [
  { d: "2026-08-10", deck: "grammar", id: "g1", iv: 9, ok: false, prod: true },
  { d: "2026-08-10", deck: "grammar", id: "g1", iv: 0, ok: true, prod: true },
  { d: "2026-08-10", deck: "vocab", id: "milk", iv: 21, ok: true, prod: false },
  { d: "2026-08-10", deck: "talk", id: "tk_1", iv: 3, ok: true, prod: true },
  { d: "2026-08-10", deck: "grammar", id: "g9", iv: 30, ok: true, prod: true, ms: 4000, fl: 1 },
  { d: "2026-08-10", deck: "grammar", id: "g8", iv: 30, ok: true, prod: true, ms: 6000, fl: 1 },
  { d: "2026-08-14", deck: "grammar", id: "g2", iv: 14, ok: true, prod: true },
  { d: "2026-08-14", deck: "grammar", id: "g9", iv: 30, ok: true, prod: true, ms: 0, fl: 1 },
  { d: "2026-08-14", deck: "grammar", id: "g8", iv: 30, ok: false, prod: true, ms: 9000, fl: 1 },
];

const metricsCode =
  slice("const STORE_KEY", "const XP = {") +
  slice("function logAttempt(", "/* ── answer checking") +
  slice("function delayedAccuracy()", "function progressCard()") +
  'function today() { return "2026-08-14"; }';
const jsMetrics = new Function("profile",
  metricsCode + "\nreturn { delayedAccuracy, fluencyTrend };"
)({ log: ATTEMPTS, srs: { grammar: {}, vocab: {}, talk: {} } });

const PY_METRICS = `
import json, sys
sys.path.insert(0, ${JSON.stringify(REPO)})
from src import metrics
rows = json.load(sys.stdin)
flu = metrics.fluency(rows)
print(json.dumps({
    "delayed": metrics.delayed_accuracy(rows),
    "fluency": {"median": flu["median_ms"], "previous": flu["previous_ms"],
                "rounds": flu["rounds"]},
}))
`;

if (python) {
  let pyMetrics = null;
  for (const exe of ["python", "python3", "py"]) {
    try {
      pyMetrics = JSON.parse(require("child_process").execFileSync(
        exe, ["-c", PY_METRICS], {
          input: JSON.stringify(ATTEMPTS),
          encoding: "utf8",
          env: Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }),
        }));
      break;
    } catch (e) { /* try the next interpreter */ }
  }
  const dfa = jsMetrics.delayedAccuracy();
  ok(dfa.n === pyMetrics.delayed.n && dfa.pct === pyMetrics.delayed.pct,
     `delayed accuracy matches (js ${JSON.stringify(dfa)} vs py ${JSON.stringify(pyMetrics.delayed)})`);
  const flu = jsMetrics.fluencyTrend();
  ok(JSON.stringify(flu) === JSON.stringify(pyMetrics.fluency),
     `fluency trend matches (js ${JSON.stringify(flu)} vs py ${JSON.stringify(pyMetrics.fluency)})`);
}

console.log(failed === 0
  ? `JS parity: all checks passed (${DATA.grammar.length} grammar items, `
    + `${drawn} distractors drawn, ${Math.round(100 * tight / drawn)}% from the tightest pool`
    + (python ? `, ${SEQUENCES.length} scheduler sequences` : ", scheduler skipped") + ")"
  : `JS parity: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
