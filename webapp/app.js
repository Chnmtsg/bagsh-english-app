/* Багш PWA — grammar, vocabulary & everyday conversation trainer for
 * Mongolian speakers. Pure client: renders data.json (exported from
 * knowledge/*.yaml), keeps all progress in localStorage. The journal
 * (AI correction + safety gate) deliberately lives only in the desktop app. */

"use strict";

const STORE_KEY = "bagsh_profile_v1";
const SESSION_N = 5;
const TODAY_N = 12;              // the mixed daily session
const NEW_PER_SESSION = 3;
const NEW_WHEN_IDLE = 6;         // day one has no reviews to crowd
const MASTERY_STREAK = 3;        // correct answers on that many distinct days
const LEECH_LAPSES = 4;          // misses before an item leaves rotation
const BACKLOG_CAP = 30;          // due items above which no new material comes
const FUZZ_FROM = 7;
const FUZZ = 0.15;
const LAG = 3;                   // a missed item returns this many items later
const FLUENCY_SECONDS = 60;      // the fluency minute, on mastered items only
const FLUENCY_MIN_POOL = 6;
const LOG_CAP = 1000;
const DELAYED_DAYS = 7;          // an interval this long makes an answer delayed
const MATURE_DAYS = 21;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const VOCAB_LEVELS = LEVELS;
const LEVEL_MN = { A1: "Эхлэгч", A2: "Бага дунд", B1: "Дунд", B2: "Ахисан дунд", C1: "Ахисан", C2: "Гүнзгий" };
const CHECK_ROUND = 20;          // words per check-yourself round
const CHECK_ANCHORS = 2;         // ... of which this many do not exist
const LEVEL_DONE_PCT = 90;       // % of the level list known to unlock next

const XP = { lesson: 10, quizCorrect: 4, quizAttempt: 1, vocabCorrect: 3, vocabAttempt: 1, talk: 5, talkAttempt: 1 };

const BADGES = [
  ["first_step", "🐫", "Эхний алхам — First step", "earn any XP", p => p.xp > 0],
  ["streak_3", "🔥", "Гурав дараалан — 3-day streak", "study 3 days in a row", p => p.streakDays >= 3],
  ["streak_7", "🔥🔥", "Долоо хоног — 7-day streak", "study 7 days in a row", p => p.streakDays >= 7],
  ["streak_30", "🌋", "Сар бүтэн — 30-day streak", "study 30 days in a row", p => p.streakDays >= 30],
  ["xp_100", "⛏️", "Чулуу цуглуулагч — Rock collector", "reach 100 XP", p => p.xp >= 100],
  ["xp_500", "💎", "Эрдэнэс — Treasure", "reach 500 XP", p => p.xp >= 500],
  ["grammar_25", "🧱", "Дүрэм баригч — Grammar builder", "25 correct grammar answers", p => p.quizCorrect >= 25],
  ["vocab_50", "📚", "Үгийн сан — Word bank", "50 correct vocabulary answers", p => p.vocabCorrect >= 50],
  // ADR-0006 retired `talkDone` (nothing writes it any more), so this badge
  // was unreachable. It now counts phrases actually learned to criterion.
  ["talk_5", "🗣️", "Ярианы хүн — Conversation starter", "learn 5 conversation phrases",
   p => Object.keys(p.srs.talk || {}).filter(id => srsMastered(p.srs.talk[id])).length >= 5],
  ["lessons_12", "📖", "Хагас зам — Halfway", "finish 12 lessons", p => p.lessonsDone.length >= 12],
];

const PRAISE = ["✅ Гоё! (Nice!)", "✅ Exactly right.", "✅ Зөв! (Correct!)", "✅ Clean fix."];
const MISS = ["Almost — here it is:", "Not this time. The answer:", "This one comes back later. Answer:"];

let DATA = null;
let profile = loadProfile();

/* ── profile / gamification ─────────────────────────────────────── */

function loadProfile() {
  const blank = {
    level: null, xp: 0, streakDays: 0, lastActive: null, badges: [],
    quizCorrect: 0, vocabCorrect: 0, lessonsDone: [], talkDone: [],
    knownWords: {},      // word -> 1 (self-checked or card-mastered)
    studyList: [],       // words the learner marked as unknown
    showStreak: true,    // the streak is optional — pressure off if you like
    rewards: [],         // self-set prizes: {id,title,type,target,claimed,claimedDate}
    log: [],             // attempt log — the honest metrics are computed from it
    reading: {},         // textId -> {reads, correct, asked, last}
    wordsRead: 0,        // the input strand's only number
    anchors: { shown: 0, ticked: 0 },   // pseudowords offered / claimed known
    srs: { grammar: {}, vocab: {}, talk: {} },
  };
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return Object.assign(blank, stored, {
      srs: Object.assign(blank.srs, stored.srs || {}),
    });
  } catch { return blank; }
}

function saveProfile() { localStorage.setItem(STORE_KEY, JSON.stringify(profile)); }

function today() { return new Date().toISOString().slice(0, 10); }
function yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function recordActivity(xp, counter) {
  profile.xp += xp;
  if (profile.lastActive !== today()) {
    profile.streakDays = profile.lastActive === yesterday() ? profile.streakDays + 1 : 1;
    profile.lastActive = today();
  }
  if (counter) profile[counter] += 1;
  const fresh = [];
  for (const [id, icon, name, , pred] of BADGES) {
    if (!profile.badges.includes(id) && pred(profile)) {
      profile.badges.push(id);
      fresh.push(`${icon} ${name}`);
    }
  }
  saveProfile();
  renderStatline();
  return fresh;
}

function a2Mode() { return profile.level === "A1" || profile.level === "A2"; }
function levelRank(l) { return Math.max(0, LEVELS.indexOf(l)); }

/* ── SRS — criterion scheduler, same math as src/srs.py (ADR-0007) ──
 * Mastery is MASTERY_STREAK correct answers on DIFFERENT days (successive
 * relearning), not one lucky answer. A miss drops the item into relearning —
 * interval 0, so it comes back today — but keeps its ease and its history.
 * After LEECH_LAPSES misses the item leaves rotation: failing an item over
 * and over is not a desirable difficulty, it is a missing lesson.
 * tests/grader_parity.js runs this and srs.py against the same cases. */

function srsHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 1000003;
  return h;
}

function srsFuzzed(interval, id) {
  if (interval < FUZZ_FROM) return interval;
  const offset = ((srsHash(id) % 21) - 10) / 10;
  return Math.max(1, interval + Math.round(interval * FUZZ * offset));
}

function srsMastered(rec) { return !!rec && (rec.streak || 0) >= MASTERY_STREAK; }
function srsLeech(rec) { return !!rec && (rec.lapses || 0) >= LEECH_LAPSES; }

function srsReview(store, id, correct, when) {
  const stamp = when || today();
  const rec = store[id] || { ease: 2.5, interval: 0, reps: 0 };
  if (rec.streak === undefined) rec.streak = 0;
  if (rec.lapses === undefined) rec.lapses = 0;
  if (!rec.days) rec.days = [];
  if (correct) {
    rec.reps += 1;
    if (!rec.days.includes(stamp)) {   // only a new day advances the criterion
      rec.days = rec.days.concat([stamp]).slice(-MASTERY_STREAK);
      rec.streak += 1;
    }
    rec.interval = rec.reps === 1 ? 1 : rec.reps === 2 ? 3 : Math.max(1, Math.round(rec.interval * rec.ease));
    rec.ease = Math.min(3.0, rec.ease + 0.05);
  } else {
    rec.lapses += 1;
    rec.streak = 0; rec.days = [];
    rec.reps = 0; rec.interval = 0;
    rec.ease = Math.max(1.3, rec.ease - 0.2);
  }
  // UTC throughout: today() reads the UTC date, so the due date must too,
  // or an evening session east of Greenwich schedules into yesterday
  const d = new Date(stamp + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + srsFuzzed(rec.interval, id));
  rec.due = d.toISOString().slice(0, 10);
  store[id] = rec;
  return rec;
}

/* First meeting after a pretest guess: met once, due tomorrow, criterion
 * clock still at zero. The guess is NOT scored — the app had not taught the
 * item yet, so a miss is ignorance, not forgetting. Mirrors srs.introduce. */
function srsIntroduce(store, id, when) {
  const stamp = when || today();
  const rec = store[id] || { ease: 2.5, interval: 0, reps: 0 };
  if (rec.streak === undefined) rec.streak = 0;
  if (rec.lapses === undefined) rec.lapses = 0;
  if (!rec.days) rec.days = [];
  if (rec.reps === 0) {
    rec.reps = 1;
    rec.interval = 1;
    const d = new Date(stamp + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    rec.due = d.toISOString().slice(0, 10);
  }
  store[id] = rec;
  return rec;
}

function srsDue(store, ids) {
  const t = today();
  return ids.filter(i => store[i] && store[i].due <= t && !srsLeech(store[i]))
    .sort((a, b) => store[a].due < store[b].due ? -1 : 1);
}

function srsPick(store, ids, n) {
  const due = srsDue(store, ids);
  const session = due.slice(0, n);
  let room = n - session.length;
  if (room > 0 && due.length < BACKLOG_CAP) {
    const fresh = ids.filter(i => !store[i]);
    session.push(...fresh.slice(0, Math.min(room, NEW_PER_SESSION)));
  }
  room = n - session.length;
  if (room > 0) {
    const upcoming = ids.filter(i => store[i] && !session.includes(i) && !srsLeech(store[i]))
      .sort((a, b) => store[a].due < store[b].due ? -1 : 1);
    session.push(...upcoming.slice(0, room));
  }
  return session;
}

/* ── the attempt log — the only honest metrics are computed from it ──
 * (deck, item, the interval it had BEFORE this answer, right/wrong, and
 * whether the learner TYPED the answer or picked it). No text is stored. */

function logAttempt(deck, id, intervalBefore, ok, produced, ms, fluency) {
  if (!profile.log) profile.log = [];
  const row = { d: today(), deck, id, iv: intervalBefore | 0, ok: !!ok, prod: !!produced };
  if (ms || ms === 0) row.ms = ms;   // a 0 ms answer is still a timing
  if (fluency) row.fl = 1;    // a speed round on mastered material
  profile.log.push(row);
  if (profile.log.length > LOG_CAP) profile.log = profile.log.slice(-LOG_CAP);
}

function firstAttempts() {
  const seen = new Set(), out = [];
  for (const a of profile.log || []) {
    // a fluency round is timed practice on things already mastered: it is
    // never evidence of recall, so it never reaches the accuracy metrics
    if (a.fl) continue;
    const key = a.d + "|" + a.deck + "|" + a.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/* ── answer checking (same rules as src/quiz.py) ────────────────── */

function normalise(s) {
  return s.normalize("NFKC")
    .replace(/[﻿​]/g, "")
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ").trim();
}

/* Contraction-aware grading — a port of check_answer in src/quiz.py. The
 * table itself is NOT duplicated here: DATA.contractions is exported from
 * that same module, so the two graders cannot drift apart. */

const MAX_READINGS = 12;
let _contractionRe = null;

function contractionRe() {
  if (!_contractionRe) {
    const keys = Object.keys((DATA && DATA.contractions) || {})
      .sort((a, b) => b.length - a.length)
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    _contractionRe = keys.length ? new RegExp("\\b(" + keys.join("|") + ")", "i") : null;
  }
  return _contractionRe;
}

function readings(text) {
  const table = (DATA && DATA.contractions) || {};
  const re = contractionRe();
  const seen = new Set([text]);
  if (!re) return seen;
  const queue = [text];
  while (queue.length && seen.size < MAX_READINGS) {
    const current = queue.shift();
    const m = re.exec(current);
    if (!m) continue;
    const head = current.slice(0, m.index), tail = current.slice(m.index + m[0].length);
    for (let expansion of table[m[1].toLowerCase()] || []) {
      if (m[1][0] === m[1][0].toUpperCase() && m[1][0] !== m[1][0].toLowerCase()) {
        expansion = expansion[0].toUpperCase() + expansion.slice(1);
      }
      const variant = head + expansion + tail;
      if (!seen.has(variant) && seen.size < MAX_READINGS) {
        seen.add(variant);
        queue.push(variant);
      }
    }
  }
  return seen;
}

function checkAnswer(user, right, alsoAccept, ignoreCase) {
  const fold = ignoreCase ? (s => s.toLowerCase()) : (s => s);
  const typed = readings(fold(normalise(user)));
  for (const target of [right, ...(alsoAccept || [])]) {
    for (const form of readings(fold(normalise(target)))) {
      if (typed.has(form)) return true;
      if (form.endsWith(".") && typed.has(form.slice(0, -1).trimEnd())) return true;
    }
  }
  return false;
}

function checkWord(user, word) {
  return normalise(user).toLowerCase() === normalise(word).toLowerCase();
}

/* ── helpers ────────────────────────────────────────────────────── */

const view = document.getElementById("view");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];

function renderStatline() {
  const streak = profile.showStreak ? ` · 🔥 ${profile.streakDays}` : "";
  const ready = profile.rewards.filter(r => !r.claimed && rewardValue(r) >= r.target).length;
  document.getElementById("statline").textContent =
    `${profile.level || "?"} · ⭐ ${profile.xp}${streak}` +
    ` · 🏅 ${profile.badges.length}/${BADGES.length}` +
    (ready ? ` · 🎁${ready}` : "");
}

/* ── personal rewards — the learner sets their own prizes ───────── */

const REWARD_TYPES = {
  xp: { label: "XP", mn: "оноо", value: () => profile.xp },
  streak: { label: "day streak", mn: "өдөр дараалан", value: () => profile.streakDays },
  words: { label: "words known", mn: "мэддэг үг", value: () => Object.keys(profile.knownWords).length },
};

function rewardValue(r) {
  const t = REWARD_TYPES[r.type];
  return t ? t.value() : 0;
}

function setTab(name) {
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name));
  ({ today: renderToday, read: renderReadList, path: renderPath,
     talk: renderTalkList, grammar: startGrammar, vocab: renderVocabHome,
     stats: renderStats }[name])();
}

/* ── level picker ───────────────────────────────────────────────── */

function renderLevelPicker(returnTab) {
  view.innerHTML = `
    <div class="card">
      <h2>Түвшнээ сонго — Choose your level</h2>
      <p class="muted">Your level changes the whole app: which grammar
      topics and quiz questions are open (Cambridge-style bands), which
      conversations you see, where the word ladder stands, and how much
      Mongolian the explanations use. Change it anytime in Stats.</p>
      ${LEVELS.map(l => `
        <button class="ghost level-btn" data-level="${l}">
          <b>${l}</b> — ${LEVEL_MN[l]}${l === "B1" ? " · most learners start here" : ""}
        </button>`).join("")}
    </div>`;
  view.querySelectorAll(".level-btn").forEach(b =>
    b.addEventListener("click", () => {
      profile.level = b.dataset.level;
      profile.vocabLevel = b.dataset.level;  // word ladder follows (known words stay)
      saveProfile();
      renderStatline();
      setTab(returnTab || "path");
    }));
}

/* ── Path & Lessons ─────────────────────────────────────────────── */

function topicBand(name) {
  if (DATA.categories[name]) return DATA.categories[name].cefr || "B1";
  const adv = DATA.advanced.find(t => t.id === name);
  return adv ? adv.cefr : "B1";
}

function bandUnlocked(band) {
  return levelRank(band) <= levelRank(profile.level || "B1");
}

function topicsByBand() {
  const groups = { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] };
  for (const name of DATA.curriculum_order) groups[topicBand(name)].push(name);
  for (const t of DATA.advanced) groups[t.cefr].push(t.id);
  return groups;
}

function topicTitle(name) {
  const adv = DATA.advanced.find(t => t.id === name);
  return adv ? adv.title : name.replace(/_/g, " ");
}

function totalTopics() { return DATA.curriculum_order.length + DATA.advanced.length; }

function nextTopic() {
  // first unfinished topic in an unlocked band (lowest band first)
  const groups = topicsByBand();
  for (const band of LEVELS) {
    if (!bandUnlocked(band)) break;
    const open = groups[band].find(n => !profile.lessonsDone.includes(n));
    if (open) return open;
  }
  return DATA.curriculum_order.find(n => !profile.lessonsDone.includes(n))
    || DATA.curriculum_order[0];
}

function openTopic(name) {
  if (DATA.categories[name]) renderLesson(name);
  else renderAdvancedLesson(name);
}

function renderPath() {
  const done = profile.lessonsDone;
  const next = nextTopic();
  const groups = topicsByBand();
  const sections = LEVELS.map(band => {
    const unlocked = bandUnlocked(band);
    const mine = band === (profile.level || "B1");
    const rows = groups[band].map(name => {
      const isDone = done.includes(name);
      const mark = !unlocked ? "🔒" : isDone ? "✓" : name === next ? "▶" : "·";
      return `<div class="row ${unlocked ? "" : "locked-row"}" data-topic="${unlocked ? name : ""}">
        <span class="name">${esc(topicTitle(name))}</span>
        <span class="st ${isDone ? "ok" : "muted"}">${mark}</span></div>`;
    }).join("");
    const doneCount = groups[band].filter(n => done.includes(n)).length;
    return `<div class="card">
      <h3>${band} — ${LEVEL_MN[band]}${mine ? " · ⭐ your level" : ""}${unlocked ? "" : " 🔒"}
        <span class="muted" style="float:right">${doneCount}/${groups[band].length}</span></h3>
      ${rows}</div>`;
  }).join("");

  view.innerHTML = `
    <div class="card"><h2>Таны зам — Your path</h2>
      <p class="muted">The grammar of English, level by level (Cambridge-style
      bands, A1 → C2), each topic explained through Mongolian. Your level:
      <b>${profile.level}</b> — higher bands unlock when you change level in
      Stats. Finished: ${done.length}/${totalTopics()}.</p>
      <button class="primary" id="continueBtn">
        ▶ Continue: ${esc(topicTitle(next))} (${topicBand(next)})</button></div>
    ${sections}`;
  document.getElementById("continueBtn").addEventListener("click", () => openTopic(next));
  view.querySelectorAll(".row[data-topic]").forEach(r => {
    if (r.dataset.topic) {
      r.addEventListener("click", () => openTopic(r.dataset.topic));
    }
  });
}

function renderLesson(topic) {
  const c = DATA.categories[topic];
  const L = c.lesson || {};
  const done = profile.lessonsDone.includes(topic);
  const explain = (a2Mode() ? L.explain_a2 : L.explain_b1) || "";
  const rule = a2Mode() ? c.rule_a2 : c.rule_b1;
  const allExamples = [...(c.examples || []), ...(L.extra_examples || [])];
  const seen = new Set();
  const examples = allExamples.filter(e => {
    if (seen.has(e.wrong)) return false;
    seen.add(e.wrong); return true;
  }).map(e => `<p>❌ ${esc(e.wrong)}<br>✅ <b>${esc(e.right)}</b></p>`).join("");
  const how = (L.how || []).map(s => `<li>${esc(s)}</li>`).join("");
  view.innerHTML = `
    <div class="card">
      <h2 style="text-transform:capitalize">${topic.replace(/_/g, " ")}
        <span class="pill">${c.cefr}</span> <span class="pill">lesson ${c.priority}/24</span></h2>
      <h3>📖 The grammar</h3><p>${esc(explain)}</p>
      ${how ? `<h3>🔧 How to build it</h3><ol class="how">${how}</ol>` : ""}
      <h3>📌 The rule in one line</h3><p><b>${esc(rule)}</b></p>
      <h3>🇲🇳 Таны хэлэнд аль хэдийн байгаа</h3>
      <p class="mn">${esc(c.bridge)}</p>
      <h3>Examples</h3>${examples}
      ${L.watch_out ? `<div class="feedback bad"><p>⚠️ <b>Watch out:</b> ${esc(L.watch_out)}</p></div>` : ""}
      ${L.tip ? `<h3>💡 Tip</h3><p>${esc(L.tip)}</p>` : ""}
      <p class="muted">Guide: ${esc(c.guide_ref)}</p>
      <button class="primary" id="doneBtn" ${done ? "disabled" : ""}>
        ${done ? "✓ Finished" : "Mark finished (+10 XP)"}</button>
      <button class="ghost" id="drillBtn">Practise it now →</button>
      <button class="ghost" id="backBtn">← Back to path</button>
    </div>`;
  document.getElementById("doneBtn").addEventListener("click", () => {
    profile.lessonsDone.push(topic);
    recordActivity(XP.lesson);
    renderLesson(topic);
  });
  document.getElementById("drillBtn").addEventListener("click", () => startGrammar(topic));
  document.getElementById("backBtn").addEventListener("click", renderPath);
}

function renderAdvancedLesson(id) {
  const t = DATA.advanced.find(x => x.id === id);
  const done = profile.lessonsDone.includes(id);
  const examples = t.examples.map(e =>
    `<p>❌ ${esc(e.wrong)}<br>✅ <b>${esc(e.right)}</b></p>`).join("");
  const how = (t.how || []).map(s => `<li>${esc(s)}</li>`).join("");
  view.innerHTML = `
    <div class="card">
      <h2>${esc(t.title)} <span class="pill">${t.cefr}</span></h2>
      <h3>📖 The grammar</h3><p>${esc(t.explain)}</p>
      ${how ? `<h3>🔧 How to build it</h3><ol class="how">${how}</ol>` : ""}
      <h3>🇲🇳 Таны хэлтэй харьцуулбал</h3>
      <p class="mn">${esc(t.bridge)}</p>
      <h3>Examples</h3>${examples}
      ${t.watch_out ? `<div class="feedback bad"><p>⚠️ <b>Watch out:</b> ${esc(t.watch_out)}</p></div>` : ""}
      ${t.tip ? `<h3>💡 Tip</h3><p>${esc(t.tip)}</p>` : ""}
      <button class="primary" id="doneBtn" ${done ? "disabled" : ""}>
        ${done ? "✓ Finished" : "Mark finished (+10 XP)"}</button>
      <button class="ghost" id="drillBtn">Practise it now →</button>
      <button class="ghost" id="backBtn">← Back to path</button>
    </div>`;
  document.getElementById("doneBtn").addEventListener("click", () => {
    profile.lessonsDone.push(id);
    recordActivity(XP.lesson);
    renderAdvancedLesson(id);
  });
  document.getElementById("drillBtn").addEventListener("click", () => startGrammar(id));
  document.getElementById("backBtn").addEventListener("click", renderPath);
}

/* ── Talk — everyday conversations ──────────────────────────────── */

function renderTalkList() {
  const myRank = levelRank(profile.level || "B1");
  const sorted = [...DATA.dialogues].sort((a, b) => {
    const la = levelRank(a.level), lb = levelRank(b.level);
    const lockedA = la > myRank, lockedB = lb > myRank;
    if (lockedA !== lockedB) return lockedA - lockedB;  // locked last
    // unlocked: your level first, then easier; locked: easiest first
    if (!lockedA) {
      const mineA = a.level === profile.level, mineB = b.level === profile.level;
      if (mineA !== mineB) return mineB - mineA;
      return lb - la;
    }
    return la - lb;
  });
  const rows = sorted.map(d => {
    const locked = levelRank(d.level) > myRank;
    const p = talkProgress(d.id);
    const isDone = p.total > 0 && p.known === p.total;
    return `<div class="row ${locked ? "locked-row" : ""}" data-id="${locked ? "" : d.id}">
      <span class="st">${locked ? "🔒" : isDone ? "✓" : "🗣️"}</span>
      <span class="name">${esc(d.title_en)}<br>
        <span class="mn">${esc(d.title_mn)}</span>
        ${locked || !p.total ? "" : `<br><span class="muted">${p.known}/${p.total} phrases learned</span>`}</span>
      <span class="pill">${d.level}</span>
    </div>`;
  }).join("");
  const due = talkIds(null).filter(id => {
    const rec = profile.srs.talk[id];
    return !rec || rec.due <= today();
  }).length;
  view.innerHTML = `
    <div class="card"><h2>🗣️ Everyday talk — Өдөр тутмын яриа</h2>
      <p class="muted">Read a conversation, then SAY the lines yourself —
      the phrases come back on a schedule until they stick. Conversations for
      YOUR level first (yours: <b>${profile.level}</b>), harder ones 🔒 until
      you raise your level in Stats.</p>
      <button class="primary" id="practiceAll">🎤 Practise phrases${due ? ` (${due} due)` : ""}</button></div>
    <div class="card">${rows}</div>`;
  document.getElementById("practiceAll").addEventListener("click", () => startTalk(null));
  view.querySelectorAll(".row[data-id]").forEach(r => {
    if (r.dataset.id) {
      r.addEventListener("click", () => renderDialogue(r.dataset.id));
    }
  });
}

/* ── Talk drills (ADR-0006) ──────────────────────────────────────────
 * The conversation strand used to be 19 one-shot multiple-choice questions
 * with no memory. It is now 74 SRS-scheduled items, 55 of which the learner
 * TYPES: the dialogue's Mongolian line as the cue, its English line with the
 * key phrase blanked. Both derived in code from conversations.yaml. */

function talkIds(dialogueId) {
  const myRank = levelRank(profile.level || "B1");
  return DATA.talk
    .filter(i => (dialogueId ? i.dialogue === dialogueId
                             : levelRank(i.level) <= myRank))
    .map(i => i.id);
}

function talkProgress(dialogueId) {
  const ids = DATA.talk.filter(i => i.dialogue === dialogueId).map(i => i.id);
  const known = ids.filter(id => srsMastered(profile.srs.talk[id])).length;
  return { known, total: ids.length };
}

function startTalk(dialogueId) {
  const session = srsPick(profile.srs.talk, talkIds(dialogueId), SESSION_N);
  runSession(session.map(id => ({ deck: "talk", id, kind: "review" })),
             { kind: "talk", dialogueId });
}

function renderTalkItem(id, i, total, onAnswer) {
  const item = DATA.talk.find(x => x.id === id);
  const finish = (ok, produced) => {
    const before = (profile.srs.talk[id] || {}).interval || 0;
    srsReview(profile.srs.talk, id, ok);
    logAttempt("talk", id, before, ok, produced);
    award(ok ? XP.talk : XP.talkAttempt);
    document.querySelectorAll(".options button, #go").forEach(b => b.disabled = true);
    document.getElementById("next").addEventListener("click", () => onAnswer(ok));
  };

  if (item.kind === "cloze") {
    view.innerHTML = `
      <div class="card">
        <h2>🎤 Say it in English <span class="pill">${i + 1}/${total}</span></h2>
        <p class="muted">${esc(item.situation)}</p>
        <p class="mn">🇲🇳 ${esc(item.cue_mn)}</p>
        <p class="q-wrong">${esc(item.prompt)}</p>
        <input type="text" id="ans" autocomplete="off" autocapitalize="sentences"
               placeholder="The missing words…">
        <button class="primary" id="go">Check</button>
        <div id="fb"></div>
      </div>`;
    const input = document.getElementById("ans");
    input.focus();
    const submit = () => {
      const ok = checkAnswer(input.value, item.answer, null, true);
      document.getElementById("fb").innerHTML = `
        <div class="feedback ${ok ? "good" : "bad"}">
          <p>${ok ? esc(pick(PRAISE)) : esc(pick(MISS))}</p>
          ${ok ? "" : `<p>✅ <b>${esc(item.answer)}</b></p>`}
          ${item.note ? `<p>💡 ${esc(item.note)}</p>` : ""}
        </div>
        <button class="primary" id="next">Next →</button>`;
      finish(ok, true);
    };
    document.getElementById("go").addEventListener("click", submit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  } else {
    const options = shuffle([...item.options]);
    view.innerHTML = `
      <div class="card">
        <h2>🗣️ Your turn <span class="pill">${i + 1}/${total}</span></h2>
        <p>${esc(item.situation)}</p>
        <div class="options">${options.map((o, n) =>
          `<button class="ghost" data-i="${n}">${esc(o.text)}</button>`).join("")}</div>
        <div id="fb"></div>
      </div>`;
    view.querySelectorAll(".options button").forEach(b =>
      b.addEventListener("click", () => {
        const o = options[Number(b.dataset.i)];
        // one attempt, scored — no guessing until it turns green
        document.getElementById("fb").innerHTML = `
          <div class="feedback ${o.correct ? "good" : "bad"}">
            <p>${o.correct ? esc(pick(PRAISE)) : "Not the natural choice."}</p>
            <p>💡 ${esc(o.why)}</p>
            ${o.correct ? "" : `<p>✅ <b>${esc(item.options.find(x => x.correct).text)}</b></p>`}
          </div>
          <button class="primary" id="next">Next →</button>`;
        finish(o.correct, false);   // picked, not produced — see logAttempt
      }));
  }
}

function renderDialogue(id) {
  const d = DATA.dialogues.find(x => x.id === id);
  const lines = d.lines.map(l => `
    <div class="bubble ${l.sp === "A" ? "left" : "right"}">
      <p>${esc(l.en)}</p><p class="mn">${esc(l.mn)}</p>
    </div>`).join("");
  const phrases = d.key_phrases.map(p => `
    <p>⭐ <b>${esc(p.en)}</b><br><span class="muted">${esc(p.note)}</span></p>`).join("");
  view.innerHTML = `
    <div class="card">
      <h2>${esc(d.title_en)} <span class="pill">${d.level}</span></h2>
      <p class="mn">${esc(d.title_mn)}</p>
      <p class="muted">${esc(d.situation)}</p>
      <div class="chat">${lines}</div>
      <h3>Key phrases</h3>${phrases}
      <button class="primary" id="practiceBtn">Your turn — practise these ${talkProgress(d.id).total} →</button>
      <button class="ghost" id="backBtn">← All conversations</button>
    </div>`;
  document.getElementById("practiceBtn").addEventListener("click", () => startTalk(d.id));
  document.getElementById("backBtn").addEventListener("click", renderTalkList);
}

/* ── Grammar game ───────────────────────────────────────────────── */

function grammarIds(topic) {
  let bank = DATA.grammar;
  if (topic) {
    const scoped = bank.filter(q => q.category === topic);
    if (scoped.length) bank = scoped;
  } else {
    // free play: only grammar from YOUR level and below (Cambridge-style
    // cumulative bands) — change level in Stats to unlock harder items
    const scoped = bank.filter(q => bandUnlocked(q.cefr || "B1"));
    if (scoped.length) bank = scoped;
  }
  return bank.map(q => q.id);
}

function startGrammar(topic) {
  topic = typeof topic === "string" ? topic : null;
  const session = srsPick(profile.srs.grammar, grammarIds(topic), SESSION_N);
  runSession(session.map(id => ({ deck: "grammar", id, kind: "review" })),
             { kind: "grammar", topic });
}

function renderGrammarItem(id, i, total, onAnswer) {
  const q = DATA.grammar.find(x => x.id === id);
  view.innerHTML = `
    <div class="card">
      <h2>🧱 Fix the sentence <span class="pill">${i + 1}/${total}</span></h2>
      <p class="q-wrong">❌ ${esc(q.prompt)}</p>
      <input type="text" id="ans" autocomplete="off" autocapitalize="sentences"
             placeholder="Type the correct sentence…">
      <button class="primary" id="go">Check</button>
      <div id="fb"></div>
    </div>`;
  const input = document.getElementById("ans");
  input.focus();
  const submit = () => {
    const ok = checkAnswer(input.value, q.answer, q.also_accept);
    const before = (profile.srs.grammar[id] || {}).interval || 0;
    srsReview(profile.srs.grammar, id, ok);
    logAttempt("grammar", id, before, ok, true);
    award(ok ? XP.quizCorrect : XP.quizAttempt, ok ? "quizCorrect" : null);
    document.getElementById("fb").innerHTML = `
      <div class="feedback ${ok ? "good" : "bad"}">
        <p>${ok ? esc(pick(PRAISE)) : esc(pick(MISS))}</p>
        ${ok ? "" : `<p>✅ <b>${esc(q.answer)}</b></p>`}
        <p>💡 ${esc(q.explanation)}</p>
        ${!ok && q.bridge ? `<p class="mn">🇲🇳 ${esc(q.bridge)}</p>` : ""}
      </div>
      <button class="primary" id="next">Next →</button>`;
    document.getElementById("go").disabled = true;
    document.getElementById("next").addEventListener("click", () => onAnswer(ok));
  };
  document.getElementById("go").addEventListener("click", submit);
  input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
}

/* ── Vocab trainer — the level ladder ───────────────────────────────
 * Words are organized A1 → A2 → B1 → B2. A word is KNOWN after 2 correct
 * answers on different days. Know ALL words of your level → the next
 * level unlocks. Lower-level words still return when the SRS says so. */

function vocabLevel() {
  if (!profile.vocabLevel || !VOCAB_LEVELS.includes(profile.vocabLevel)) {
    profile.vocabLevel = profile.level && VOCAB_LEVELS.includes(profile.level)
      ? profile.level : "A1";
    saveProfile();
  }
  return profile.vocabLevel;
}

function vocabRank(l) { return Math.max(0, VOCAB_LEVELS.indexOf(l)); }
function cardsOfLevel(l) { return DATA.vocab.filter(w => w.level === l); }
function listOfLevel(l) { return DATA.wordlist.levels[l] || []; }

function markKnown(word) {
  if (!profile.knownWords[word]) profile.knownWords[word] = 1;
  profile.studyList = profile.studyList.filter(w => w !== word);
}

/* ADR-0005: the card deck is the only authority on a word's level, so the
 * ladder counts MASTERED CARDS. ADR-0007 makes "mastered" mean what the deck
 * always documented and the code never enforced — correct answers on
 * DIFFERENT days, now three of them (successive relearning). Counts from
 * before that change will drop; that is the correction, not a regression.
 * The 6,800-word frequency list measures coverage and gates nothing. */

function cardMastered(word) {
  return srsMastered(profile.srs.vocab[word]);
}

function levelProgress(l) {
  const cards = cardsOfLevel(l);
  const known = cards.filter(w => cardMastered(w.word)).length;
  return { known, total: cards.length,
           pct: cards.length ? Math.round(100 * known / cards.length) : 0 };
}

function listProgress(l) {
  const list = listOfLevel(l);
  const known = list.filter(w => profile.knownWords[w]).length;
  return { known, total: list.length,
           pct: list.length ? Math.round(100 * known / list.length) : 0 };
}

function renderVocabHome() {
  const current = vocabLevel();
  const currentRank = vocabRank(current);
  const rows = VOCAB_LEVELS.map(l => {
    const p = levelProgress(l);
    const rank = vocabRank(l);
    const state = rank < currentRank ? "done" : rank === currentRank ? "now" : "locked";
    const icon = state === "done" ? "✓" : state === "now" ? "▶" : "🔒";
    return `<div class="row ${state === "locked" ? "locked-row" : ""}">
      <span class="st">${icon}</span>
      <span class="name"><b>${l}</b> — ${LEVEL_MN[l]}
        ${p.total
          ? `<div class="bar"><div class="bar-fill" style="width:${p.pct}%"></div></div>`
          : `<br><span class="muted">no cards yet — картууд хараахан алга</span>`}</span>
      <span class="muted">${p.total ? `${p.known}/${p.total}` : "—"}</span></div>`;
  }).join("");

  const p = levelProgress(current);
  const complete = p.pct >= LEVEL_DONE_PCT;
  const next = VOCAB_LEVELS[currentRank + 1];
  const hasCards = cardsOfLevel(current).length > 0;

  let action = "";
  if (!hasCards) {
    action = `<div class="feedback">
        <p>The card deck stops at B2 for now — there are no ${current} cards
        yet. Keep the lower levels warm with the SRS, and use the coverage
        check below to find gaps.</p>
      </div>`;
  } else if (complete && next) {
    action = `<div class="feedback good">
        <p>🎉 <b>Гоё! You know ${p.known} of the ${p.total} ${current} words!</b></p>
        <p class="muted">Дараагийн түвшин нээгдлээ — the next level is open.</p>
      </div>
      <button class="primary" id="levelUp">Jump to ${next} →</button>`;
  } else if (complete) {
    action = `<div class="feedback good">
        <p>🏆 <b>You have climbed the whole ladder — ${p.known} words at ${current}!</b></p>
      </div>`;
  }
  action += `
    ${hasCards ? `<button class="primary" id="studyBtn">📖 Study ${current} cards (${cardsOfLevel(current).length})</button>` : ""}
    ${profile.studyList.length ? `<button class="ghost" id="listBtn">📝 My study list (${profile.studyList.length})</button>` : ""}`;

  const cov = listProgress(current);

  view.innerHTML = `
    <div class="card"><h2>📚 Word ladder — Үгийн шат</h2>
      <p class="muted">Your level rises by LEARNING the cards, not by ticking
      a list: a word counts once you have answered it correctly on
      ${MASTERY_STREAK} different days. Know ${LEVEL_DONE_PCT}% of your level —
      the next opens. (That used to be two days, and it was counted wrongly —
      answers on the same day now count once, so your total may have dropped.)</p>
      ${action}</div>
    <div class="card">${rows}</div>
    <div class="card">
      <h3>📊 Coverage check — Хэр олон үг мэдэх вэ?</h3>
      <p class="muted">A separate, optional tool: the ${DATA.wordlist.levels[current].length}
      most frequent ${current}-band words from a public frequency dataset.
      Mark what you recognise to find gaps — honest answers only, and it does
      not move your level. ${CHECK_ANCHORS} words in every round are invented,
      to keep the number below honest.</p>
      <div class="bar"><div class="bar-fill" style="width:${cov.pct}%"></div></div>
      <p class="muted">${cov.known}/${cov.total} recognised${
        (profile.anchors && profile.anchors.shown)
          ? ` · about <b>${correctedKnown(cov.known)}</b> after the honesty
              check (you ticked ${profile.anchors.ticked} of
              ${profile.anchors.shown} invented words)`
          : ""}</p>
      <button class="ghost" id="checkBtn">✓✗ Check yourself — ${current} band</button>
    </div>
    <p class="muted" style="padding:0 6px">Cards: curated, stress-marked, with
    Mongolian (ADR-0005 — the cards decide a word's level). Frequency bands:
    CEFR-J-based dataset (MIT), used for coverage only.</p>`;

  document.getElementById("checkBtn").addEventListener("click", startCheck);
  const studyBtn = document.getElementById("studyBtn");
  if (studyBtn) studyBtn.addEventListener("click", startVocab);
  const listBtn = document.getElementById("listBtn");
  if (listBtn) listBtn.addEventListener("click", renderStudyList);
  const upBtn = document.getElementById("levelUp");
  if (upBtn) upBtn.addEventListener("click", () => {
    profile.vocabLevel = next;
    recordActivity(20);  // level-up bonus
    renderVocabHome();
  });
}

/* check-yourself: fast ✓/✗ through the level's official-size list, with
 * pseudoword anchors mixed in (ADR-0008). Self-report inflates: learners tick
 * words they half-know, so vocabulary-size tests plant words that do not
 * exist and discount the estimate by how many get ticked. The fakes are never
 * added to knownWords, never shown as vocabulary, and are revealed at the end
 * of the round — hiding them permanently would just be a trick. */

function overclaimRate() {
  const a = profile.anchors || { shown: 0, ticked: 0 };
  return a.shown ? a.ticked / a.shown : 0;
}

function correctedKnown(raw) {
  return Math.round(raw * (1 - overclaimRate()));
}

function startCheck() {
  const current = vocabLevel();
  const pending = listOfLevel(current).filter(
    w => !profile.knownWords[w] && !profile.studyList.includes(w));
  const real = pending.slice(0, CHECK_ROUND - CHECK_ANCHORS);
  if (!real.length) {
    renderStudyList();
    return;
  }
  const fakes = shuffle((DATA.pseudowords || []).slice())
    .slice(0, CHECK_ANCHORS)
    .map(w => ({ word: w, fake: true }));
  const round = shuffle(real.map(w => ({ word: w, fake: false })).concat(fakes));

  const cardByWord = Object.fromEntries(DATA.vocab.map(w => [w.word, w]));
  if (!profile.anchors) profile.anchors = { shown: 0, ticked: 0 };
  let i = 0, knew = 0;
  const caught = [];

  function step() {
    if (i >= round.length) {
      recordActivity(5);  // finishing a check round feeds the streak
      const realCount = round.length - fakes.length;
      view.innerHTML = `
        <div class="card">
          <h2>Round done — you knew ${knew}/${realCount}</h2>
          ${caught.length
            ? `<div class="feedback bad">
                 <p><b>${caught.length} of those ${fakes.length === 1 ? "was" : "were"}
                 not English at all:</b> ${caught.map(esc).join(", ")}.</p>
                 <p class="muted">Not a trap for its own sake — it is how the
                 estimate below stays honest. Every list like this collects a
                 few "I think I've seen it", and now yours is discounted by how
                 often that happens to you.</p>
               </div>`
            : `<div class="feedback good">
                 <p>You turned down ${fakes.length === 1 ? "the invented word"
                   : "both invented words"} in this round — your count is
                 trustworthy.</p>
               </div>`}
          <p class="muted">Unknown words went to your study list. Honest
          answers make the ladder true — no one is watching. 🐫</p>
          <button class="primary" id="more">Next ${CHECK_ROUND} words</button>
          <button class="ghost" id="home">Back to ladder</button>
        </div>`;
      document.getElementById("more").addEventListener("click", startCheck);
      document.getElementById("home").addEventListener("click", renderVocabHome);
      return;
    }
    const entry = round[i];
    const card = entry.fake ? null : cardByWord[entry.word];
    view.innerHTML = `
      <div class="card">
        <h2>Do you know this word? <span class="pill">${i + 1}/${round.length}</span></h2>
        <p class="q-wrong" style="font-size:26px"><b>${esc(entry.word)}</b></p>
        ${card ? `<p class="muted stress">${esc(card.stress)}</p>` : ""}
        <button class="primary" id="know">✓ I know it — Мэднэ</button>
        <button class="ghost" id="dont">✗ I don't know — Мэдэхгүй</button>
      </div>`;
    document.getElementById("know").addEventListener("click", () => {
      if (entry.fake) {
        profile.anchors.shown += 1;
        profile.anchors.ticked += 1;
        caught.push(entry.word);
      } else {
        markKnown(entry.word);
        knew += 1;
      }
      i += 1; saveProfile(); step();
    });
    document.getElementById("dont").addEventListener("click", () => {
      if (entry.fake) profile.anchors.shown += 1;
      else if (!profile.studyList.includes(entry.word)) profile.studyList.push(entry.word);
      i += 1; saveProfile(); step();
    });
  }
  step();
}

function renderStudyList() {
  const cardByWord = Object.fromEntries(DATA.vocab.map(w => [w.word, w]));
  const items = profile.studyList.map(w => {
    const card = cardByWord[w];
    return `<div class="row"><span class="name"><b>${esc(w)}</b>
      ${card ? `<br><span class="muted">${esc(card.stress)} — ${esc(card.gloss_en)} (${esc(card.gloss_mn)})</span>`
             : `<br><span class="muted">толь бичгээс хараарай — look it up, then mark it known</span>`}
      </span>
      <button class="ghost known-btn" data-w="${esc(w)}">✓ know it now</button></div>`;
  }).join("");
  view.innerHTML = `
    <div class="card"><h2>📝 My study list — Сурах үгс</h2>
      <p class="muted">Words you marked as unknown. The ones with Mongolian
      come from the card deck; study the rest with a dictionary, then mark
      them known.</p></div>
    <div class="card">${items || "<p class='muted'>Empty — сайхан байна!</p>"}</div>
    <button class="ghost" id="home" style="margin:0 6px">← Back to ladder</button>`;
  view.querySelectorAll(".known-btn").forEach(b =>
    b.addEventListener("click", () => {
      markKnown(b.dataset.w); saveProfile(); renderStudyList();
    }));
  document.getElementById("home").addEventListener("click", renderVocabHome);
}

/* Distractors that share the target's part of speech and level where the deck
 * allows — a port of distractor_tiers in src/quiz.py. Sampling the whole deck
 * made the round free: a B2 noun against "white drink from cows" needs no
 * knowledge of the word. Five (level, pos) buckets are too thin to fill on
 * their own, so this drops one constraint at a time. */

function meaningDistractors(w, k) {
  const others = DATA.vocab.filter(x => x.word !== w.word);
  const near = x => Math.abs(levelRank(x.level) - levelRank(w.level)) <= 1;
  const tiers = [
    others.filter(x => x.level === w.level && x.pos === w.pos),
    others.filter(x => x.pos === w.pos && near(x)),
    others.filter(x => x.pos === w.pos),
    others.filter(x => x.level === w.level),
    others,
  ];
  const chosen = [], seen = new Set([w.gloss_en]);
  for (const tier of tiers) {
    for (const cand of shuffle(tier.filter(x => !seen.has(x.gloss_en)))) {
      if (chosen.length >= k) break;
      chosen.push(cand);
      seen.add(cand.gloss_en);
    }
    if (chosen.length >= k) break;
  }
  return chosen.slice(0, k);
}

function cloze(w) {
  return w.example.replace(new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "_____");
}

/* The word pool for a session: due reviews from lower levels come along;
 * new cards only from the current level, study-list words first. */
function vocabIds() {
  const current = vocabLevel();
  const currentRank = vocabRank(current);
  const t = today();
  const lowerDue = DATA.vocab
    .filter(w => vocabRank(w.level) < currentRank)
    .filter(w => profile.srs.vocab[w.word] && profile.srs.vocab[w.word].due <= t)
    .map(w => w.word);
  const levelCards = cardsOfLevel(current).map(w => w.word)
    .sort((a, b) => profile.studyList.includes(b) - profile.studyList.includes(a));
  return [...lowerDue, ...levelCards];
}

function startVocab() {
  const session = srsPick(profile.srs.vocab, vocabIds(), SESSION_N);
  runSession(session.map(id => ({ deck: "vocab", id, kind: "review" })),
             { kind: "vocab" });
}

function renderVocabItem(id, i, total, onAnswer) {
      const w = DATA.vocab.find(x => x.word === id);
      const rec = profile.srs.vocab[id];
      const finish = (ok, produced) => {
        const before = (profile.srs.vocab[id] || {}).interval || 0;
        srsReview(profile.srs.vocab, id, ok);
        logAttempt("vocab", id, before, ok, produced);
        if (cardMastered(id)) markKnown(id);  // card mastery counts on the ladder
        award(ok ? XP.vocabCorrect : XP.vocabAttempt, ok ? "vocabCorrect" : null);
        document.getElementById("fb").innerHTML = `
          <div class="feedback ${ok ? "good" : "bad"}">
            <p>${ok ? esc(pick(PRAISE)) : `${esc(pick(MISS))} <b>${esc(w.word)}</b> — ${esc(w.gloss_en)} (${esc(w.gloss_mn)})`}</p>
            <p>🔊 say it: <span class="stress">${esc(w.stress)}</span></p>
            <p class="muted">e.g. ${esc(w.example)}</p>
          </div>
          <button class="primary" id="next">Next →</button>`;
        document.querySelectorAll(".options button, #go").forEach(b => b.disabled = true);
        document.getElementById("next").addEventListener("click", () => onAnswer(ok));
      };

      if (!rec) {
        /* Brand-new word: GUESS first, then be taught (ADR-0008). A wrong
         * guess followed by the answer beats being told first — and the guess
         * is never scheduled as a lapse, because the app had not taught the
         * word yet. srsIntroduce puts it in the deck, due tomorrow; the real
         * test is the typed round on a later day. */
        const options = shuffle([...meaningDistractors(w, 3), w]);
        view.innerHTML = `
          <div class="card">
            <h2>📚 New word — have a guess <span class="pill">${i + 1}/${total}</span></h2>
            <p class="muted">You have not met this one. Guessing wrong is part
              of it — the answer sticks better after you have tried.</p>
            <p class="q-wrong"><b>${esc(w.word)}</b>
              <span class="stress">(${esc(w.stress)})</span></p>
            <p class="muted">${esc(cloze(w))}</p>
            <div class="options">${options.map(o =>
              `<button class="ghost" data-g="${esc(o.word)}">
                 ${esc(o.gloss_en)}<br><span class="mn">${esc(o.gloss_mn)}</span>
               </button>`).join("")}</div>
          </div>`;
        view.querySelectorAll(".options button").forEach(b =>
          b.addEventListener("click", () => {
            const guessed = b.dataset.g === w.word;
            srsIntroduce(profile.srs.vocab, id);
            logAttempt("vocab", id, 0, guessed, false);
            award(guessed ? XP.vocabCorrect : XP.vocabAttempt,
                  guessed ? "vocabCorrect" : null);
            view.innerHTML = `
              <div class="card">
                <h2>📚 ${guessed ? "Right — and here it is properly"
                                 : "Now the answer"}
                  <span class="pill">${i + 1}/${total}</span></h2>
                <p class="q-wrong"><b>${esc(w.word)}</b>
                  <span class="stress">(${esc(w.stress)})</span></p>
                <p><b>Meaning:</b> ${esc(w.gloss_en)}</p>
                <p class="mn">🇲🇳 ${esc(w.gloss_mn)}</p>
                <p class="muted">e.g. ${esc(w.example)}</p>
                <div class="feedback ${guessed ? "good" : ""}">
                  <p>${guessed ? esc(pick(PRAISE))
                               : "Wrong guesses are cheap here — you will type"
                                 + " this one from memory tomorrow."}</p>
                </div>
                <button class="primary" id="next">Next →</button>
              </div>`;
            document.getElementById("next")
              .addEventListener("click", () => onAnswer(guessed));
          }));
      } else {
        // Known word: recall — type it into its sentence.
        view.innerHTML = `
          <div class="card">
            <h2>📚 Type the word <span class="pill">${i + 1}/${total}</span></h2>
            <p>${esc(w.gloss_en)} <span class="mn">(${esc(w.gloss_mn)})</span></p>
            <p class="q-wrong">${esc(cloze(w))}</p>
            <input type="text" id="ans" autocomplete="off" autocapitalize="off"
                   placeholder="The word…">
            <button class="primary" id="go">Check</button>
            <div id="fb"></div>
          </div>`;
        const input = document.getElementById("ans");
        input.focus();
        const submit = () => finish(checkWord(input.value, w.word), true);
        document.getElementById("go").addEventListener("click", submit);
        input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
      }
}

/* ── shared session runner ──────────────────────────────────────────
 * Items are {deck, id, kind}. A miss is put back into the SAME session LAG
 * items later and must be answered again before the session ends — the
 * within-session half of successive relearning (ADR-0007). Mirrors
 * run_session / session.requeue in Python. */

const RENDERERS = { grammar: renderGrammarItem, vocab: renderVocabItem, talk: renderTalkItem };

let sessionBadges = [];

function award(xp, counter) {
  sessionBadges.push(...recordActivity(xp, counter));
}

function requeue(items, index, lag) {
  const item = Object.assign({}, items[index], { kind: "relearn" });
  const out = items.slice();
  out.splice(Math.min(index + (lag === undefined ? LAG : lag) + 1, out.length), 0, item);
  return out;
}

function runSession(items, mode) {
  sessionBadges = [];
  if (!items.length) {
    view.innerHTML = `<div class="card">
      <p>Nothing due — come back tomorrow! 🐫</p>
      <p class="muted">An empty queue is the system working: everything you
      have met is still in date. Adding more today would only crowd tomorrow.</p>
    </div>`;
    return;
  }
  let queue = items.slice(), index = 0, correct = 0, asked = 0;

  const step = () => {
    if (index >= queue.length) return finishSession(asked, correct, mode);
    const entry = queue[index];
    RENDERERS[entry.deck](entry.id, index, queue.length, ok => {
      asked += 1;
      if (ok) correct += 1;
      if (!ok && entry.kind !== "relearn") queue = requeue(queue, index);
      index += 1;
      step();
    });
  };
  step();
}

function finishSession(asked, correct, mode) {
  const perfect = correct === asked && asked > 0;
  view.innerHTML = `
    <div class="card">
      <h2>Session done — ${correct}/${asked}</h2>
      ${sessionBadges.map(b => `<p>🏅 New badge: ${esc(b)}</p>`).join("")}
      <p class="muted">${perfect
        ? "Perfect round. Маргааш уулзацгаая!"
        : "The ones you missed came back once today, and they will come back"
          + " again in a day or two. That is what makes them stick."}</p>
      <button class="primary" id="again">${mode.kind === "today" ? "More" : mode.kind === "vocab" ? "Continue" : "Practise more"}</button>
      <button class="ghost" id="home">← Done for today</button>
    </div>`;
  document.getElementById("again").addEventListener("click", () => {
    if (mode.kind === "today") startToday();
    else if (mode.kind === "grammar") startGrammar(mode.topic);
    else if (mode.kind === "talk") startTalk(mode.dialogueId);
    else renderVocabHome();
  });
  document.getElementById("home").addEventListener("click", () => setTab("today"));
}

/* ── Today — one interleaved session across all three decks ──────────
 * Practice used to be organised by tab, which is blocked practice: inside a
 * block the tab tells you which rule applies, so you never practise choosing
 * one. Review is interleaved here; NEW material stays blocked (one deck per
 * day), which is what the SLA evidence actually supports. Mirrors
 * src/session.py — the parity harness checks both. */

function interleave(queues) {
  const remaining = queues.map(q => q.slice());
  const out = [];
  while (remaining.some(q => q.length)) {
    remaining.forEach((q, index) => { if (q.length) out.push([index, q.shift()]); });
  }
  return out;
}

function todayPools() {
  return { grammar: grammarIds(null), vocab: vocabIds(), talk: talkIds(null) };
}

function buildToday(n) {
  const decks = ["grammar", "vocab", "talk"];
  const pools = todayPools();
  const dueLists = decks.map(d => srsDue(profile.srs[d], pools[d]));
  const backlog = dueLists.reduce((sum, list) => sum + list.length, 0);
  const review = interleave(dueLists).slice(0, n)
    .map(([d, id]) => ({ deck: decks[d], id, kind: "review" }));

  let fresh = [];
  const room = n - review.length;
  if (room > 0 && backlog < BACKLOG_CAP) {
    const candidates = decks.filter(d => pools[d].some(i => !profile.srs[d][i]));
    if (candidates.length) {
      // one deck per day, rotating — new material arrives in a block
      const ordinal = Math.floor(Date.parse(today() + "T00:00:00Z") / 86400000) + 719163;
      const deck = candidates[ordinal % candidates.length];
      fresh = pools[deck].filter(i => !profile.srs[deck][i])
        .slice(0, Math.min(room, backlog ? NEW_PER_SESSION : NEW_WHEN_IDLE))
        .map(id => ({ deck, id, kind: "new" }));
    }
  }
  return { items: review.concat(fresh), review, fresh, backlog,
           capped: backlog >= BACKLOG_CAP };
}

function startToday() {
  runSession(buildToday(TODAY_N).items, { kind: "today" });
}

/* ── the fluency minute (ADR-0008) ───────────────────────────────────
 * Nation's fourth strand: speed on material you already know. Practice at the
 * edge of your knowledge builds knowledge; practice inside it builds
 * automaticity (DeKeyser 2007), and nothing in the app trained the second.
 * Only mastered, typed items qualify, and NOTHING here is rescheduled — a
 * fast round must not move intervals that were earned slowly. */

function fluencyPool() {
  const pools = { grammar: grammarIds(null), vocab: vocabIds(),
                  talk: DATA.talk.filter(i => i.kind === "cloze").map(i => i.id) };
  const out = [];
  for (const deck of ["grammar", "vocab", "talk"]) {
    for (const id of pools[deck]) {
      if (srsMastered(profile.srs[deck][id])) out.push({ deck, id });
    }
  }
  return out;
}

function flashItem(entry) {
  if (entry.deck === "grammar") {
    const q = DATA.grammar.find(x => x.id === entry.id);
    return { cue: "", prompt: q.prompt, answer: q.answer,
             also: q.also_accept, loose: false };
  }
  if (entry.deck === "vocab") {
    const w = DATA.vocab.find(x => x.word === entry.id);
    return { cue: w.gloss_en, prompt: cloze(w), answer: w.word,
             also: null, loose: true };
  }
  const t = DATA.talk.find(x => x.id === entry.id);
  return { cue: "🇲🇳 " + t.cue_mn, prompt: t.prompt, answer: t.answer,
           also: null, loose: true };
}

function startFluency() {
  const pool = shuffle(fluencyPool());
  if (pool.length < FLUENCY_MIN_POOL) return renderToday();

  const end = Date.now() + FLUENCY_SECONDS * 1000;
  let index = 0, correct = 0, times = [], over = false, ticker = null;

  const finish = () => {
    if (over) return;
    over = true;
    if (ticker) clearInterval(ticker);
    saveProfile();
    const sorted = times.slice().sort((a, b) => a - b);
    const typical = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    view.innerHTML = `
      <div class="card">
        <h2>⏱ Minute up — ${correct}/${times.length} right</h2>
        <p><b>${typical} ms</b> typical answer.</p>
        <p class="muted">This was not new learning: every item was something
        you had already mastered. What it trains is the same knowledge getting
        cheaper to use — which is what makes writing feel less like work.</p>
        <button class="primary" id="again">Again</button>
        <button class="ghost" id="home">← Today</button>
      </div>`;
    document.getElementById("again").addEventListener("click", startFluency);
    document.getElementById("home").addEventListener("click", () => setTab("today"));
  };

  ticker = setInterval(() => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = left + "s";
    if (left <= 0) finish();
  }, 250);

  const step = () => {
    if (over) return;
    if (Date.now() >= end || index >= pool.length) return finish();
    const entry = pool[index];
    const item = flashItem(entry);
    view.innerHTML = `
      <div class="card">
        <h2>⏱ Fluency <span class="pill" id="clock">${
          Math.ceil((end - Date.now()) / 1000)}s</span></h2>
        ${item.cue ? `<p class="muted">${esc(item.cue)}</p>` : ""}
        <p class="q-wrong">${esc(item.prompt)}</p>
        <input type="text" id="ans" autocomplete="off" autocapitalize="sentences"
               placeholder="Fast — you know this one">
        <div id="fb"></div>
      </div>`;
    const input = document.getElementById("ans");
    input.focus();
    const started = Date.now();
    let answered = false;
    const submit = () => {
      if (answered) return;
      answered = true;
      const ok = item.loose && entry.deck === "vocab"
        ? checkWord(input.value, item.answer)
        : checkAnswer(input.value, item.answer, item.also, item.loose);
      const ms = Date.now() - started;
      times.push(ms);
      if (ok) correct += 1;
      logAttempt(entry.deck, entry.id, 0, ok, true, ms, true);
      document.getElementById("fb").innerHTML =
        `<div class="feedback ${ok ? "good" : "bad"}"><p>${
          ok ? "✅ " + ms + " ms" : "→ <b>" + esc(item.answer) + "</b>"}</p></div>`;
      index += 1;
      setTimeout(step, ok ? 450 : 1100);
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  };
  step();
}

function renderToday() {
  const plan = buildToday(TODAY_N);
  const pool = fluencyPool();
  const byDeck = { grammar: 0, vocab: 0, talk: 0 };
  plan.items.forEach(i => byDeck[i.deck]++);
  const label = { grammar: "🧱 grammar", vocab: "📚 words", talk: "🗣️ talk" };
  const rows = Object.keys(byDeck).filter(d => byDeck[d])
    .map(d => `<div class="row"><span class="name">${label[d]}</span>
       <span class="muted">${byDeck[d]}</span></div>`).join("");

  view.innerHTML = `
    <div class="card">
      <h2>🐫 Өнөөдөр — Today</h2>
      <p class="muted">Everything that is due, mixed on purpose: in real
      English nobody tells you which rule is coming. ${plan.fresh.length
        ? `${plan.fresh.length} new ${label[plan.fresh[0].deck].slice(2)} today.`
        : plan.capped
          ? "No new material until the backlog is cleared — reviews first."
          : "Review only today."}</p>
      ${plan.items.length
        ? `<button class="primary" id="go">▶ Start — ${plan.items.length} items</button>`
        : `<p><b>Nothing is due. 🎉</b></p>
           <p class="muted">Everything you have met is still in date. You can
           start new material from any tab, but the queue coming back empty is
           the system working, not a day wasted.</p>`}
    </div>
    ${rows ? `<div class="card"><h3>What is waiting</h3>${rows}</div>` : ""}
    <div class="card">
      <h3>⏱ Fluency minute</h3>
      ${pool.length >= FLUENCY_MIN_POOL
        ? `<p class="muted">60 seconds on ${pool.length} things you have
             already mastered. Not new learning — this is the same knowledge
             getting faster, which is the strand the app was missing.</p>
           <button class="ghost" id="flu">Start the minute</button>`
        : `<p class="muted">Unlocks at ${FLUENCY_MIN_POOL} mastered items —
             you have ${pool.length}. It runs on what you already know, so it
             has to wait until you know some things cold.</p>`}
    </div>
    <div class="card">
      <h3>Backlog</h3>
      <p class="muted">${plan.backlog} item${plan.backlog === 1 ? "" : "s"} due
      in total.${plan.capped
        ? " That is a lot — new material is paused until it comes down. This is deliberate: an app that keeps adding while you are behind is how people quit."
        : ""}</p>
    </div>`;
  const go = document.getElementById("go");
  if (go) go.addEventListener("click", startToday);
  const flu = document.getElementById("flu");
  if (flu) flu.addEventListener("click", startFluency);
}

/* ── Read — the input strand (ADR-0009) ─────────────────────────────
 * Every other tab is deliberate study. This one is the quarter of a course
 * Nation gives to meaning-focused input, and the only part of the app where
 * the learner is not being asked anything. Texts are graded by measurement,
 * not by claim: scripts/validate_readings.py refuses to ship a text unless a
 * learner at its level already knows 95% of its running words and every
 * remaining word carries a gloss. */

function readingsFor(level) {
  const mine = levelRank(level || "B1");
  return (DATA.readings || [])
    .filter(t => levelRank(t.level) <= mine)
    .sort((a, b) => levelRank(b.level) - levelRank(a.level)
                    || (a.id < b.id ? -1 : 1));
}

function readRow(id) {
  if (!profile.reading) profile.reading = {};
  return profile.reading[id];
}

function renderReadList() {
  const texts = readingsFor(profile.level);
  const done = texts.filter(t => readRow(t.id)).length;
  const words = profile.wordsRead || 0;
  const rows = texts.map(t => {
    const row = readRow(t.id);
    return `<div class="row" data-id="${t.id}">
      <span class="st">${row ? "✓" : "📖"}</span>
      <span class="name plain">${esc(t.title)}
        <br><span class="muted">${t.words} words · about ${t.minutes} min${
          row ? ` · read ${row.reads}×` : ""}</span></span>
      <span class="pill">${t.level}</span>
    </div>`;
  }).join("");

  view.innerHTML = `
    <div class="card">
      <h2>📖 Read — Уншлага</h2>
      <p class="muted">The one part of the app that is not a test. Read for the
      story; tap any <span class="gl">underlined word</span> if you want it.
      Three thousand words to nine thousand is a reading job, not a flashcard
      job — this is where that happens.</p>
      <p class="muted">${done}/${texts.length} texts · <b>${words}</b> words read
      so far.</p>
    </div>
    <div class="card">${rows || "<p class='muted'>No texts at your level yet.</p>"}</div>
    <p class="muted" style="padding:0 6px">Every text is checked against your
    level before it ships: you should already know 95% of the words, and the
    rest are glossed.</p>`;
  view.querySelectorAll(".row[data-id]").forEach(r =>
    r.addEventListener("click", () => renderText(r.dataset.id)));
}

function glossedHtml(body, glossary) {
  return body.split(/\n\s*\n/).map(para => {
    let html = esc(para.trim());
    for (const key of Object.keys(glossary).sort((a, b) => b.length - a.length)) {
      const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp("\\b(" + safe + ")\\b", "gi"),
        '<span class="gl" data-w="' + esc(key) + '">$1</span>');
    }
    return "<p>" + html.replace(/\n/g, " ") + "</p>";
  }).join("");
}

function renderText(id) {
  const text = (DATA.readings || []).find(t => t.id === id);
  if (!text) return renderReadList();
  view.innerHTML = `
    <div class="card">
      <h2>${esc(text.title)} <span class="pill">${text.level}</span></h2>
      <p class="muted">${text.words} words · about ${text.minutes} min</p>
      <div class="prose">${glossedHtml(text.body, text.glossary)}</div>
      <div id="gloss"></div>
      <button class="primary" id="doneBtn">I have read it →</button>
      <button class="ghost" id="backBtn">← All texts</button>
    </div>`;

  view.querySelectorAll(".gl").forEach(el =>
    el.addEventListener("click", () => {
      const entry = text.glossary[el.dataset.w];
      if (!entry) return;
      const known = (profile.studyList || []).includes(entry.word);
      document.getElementById("gloss").innerHTML = `
        <div class="feedback">
          <p><b>${esc(entry.word)}</b>${entry.stress
            ? ` <span class="stress">(${esc(entry.stress)})</span>` : ""}</p>
          <p>${esc(entry.gloss_en)}</p>
          ${entry.gloss_mn ? `<p class="mn">🇲🇳 ${esc(entry.gloss_mn)}</p>` : ""}
          <button class="ghost" id="addWord" ${known ? "disabled" : ""}
            style="margin-top:6px;padding:6px 14px">${
              known ? "✓ on your list" : "＋ add to my words"}</button>
        </div>`;
      const add = document.getElementById("addWord");
      if (add) add.addEventListener("click", () => {
        if (!profile.studyList) profile.studyList = [];
        if (!profile.studyList.includes(entry.word)) profile.studyList.push(entry.word);
        saveProfile();
        add.disabled = true;
        add.textContent = "✓ on your list";
      });
    }));

  document.getElementById("backBtn").addEventListener("click", renderReadList);
  document.getElementById("doneBtn").addEventListener("click", () => askComprehension(text));
}

function askComprehension(text) {
  const questions = text.questions || [];
  let i = 0, correct = 0;

  const finish = () => {
    if (!profile.reading) profile.reading = {};
    const row = profile.reading[text.id]
      || { reads: 0, correct: 0, asked: 0, last: null };
    row.reads += 1;
    row.correct += correct;
    row.asked += questions.length;
    row.last = today();
    profile.reading[text.id] = row;
    profile.wordsRead = (profile.wordsRead || 0) + text.words;
    const badges = recordActivity(XP.lesson);
    view.innerHTML = `
      <div class="card">
        <h2>${correct}/${questions.length} — ${text.words} words read</h2>
        ${badges.map(b => `<p>🏅 New badge: ${esc(b)}</p>`).join("")}
        <p class="muted">Total: <b>${profile.wordsRead}</b> words. Comprehension
        questions are here so the reading has a point, not to be scored — nobody
        remembers a text they were interrogated about.</p>
        <button class="primary" id="next">Read another →</button>
        <button class="ghost" id="again">Read this one again</button>
      </div>`;
    document.getElementById("next").addEventListener("click", renderReadList);
    document.getElementById("again").addEventListener("click", () => renderText(text.id));
  };

  const step = () => {
    if (i >= questions.length) return finish();
    const question = questions[i];
    const options = shuffle([...question.options]);
    view.innerHTML = `
      <div class="card">
        <h2>${esc(text.title)} <span class="pill">${i + 1}/${questions.length}</span></h2>
        <p class="q-wrong">${esc(question.q)}</p>
        <div class="options">${options.map((o, n) =>
          `<button class="ghost" data-i="${n}">${esc(o.text)}</button>`).join("")}</div>
        <div id="fb"></div>
      </div>`;
    view.querySelectorAll(".options button").forEach(b =>
      b.addEventListener("click", () => {
        const picked = options[Number(b.dataset.i)];
        const ok = !!picked.correct;
        if (ok) correct += 1;
        document.getElementById("fb").innerHTML = `
          <div class="feedback ${ok ? "good" : "bad"}">
            <p>${ok ? esc(pick(PRAISE))
                    : "Not quite — " + esc(question.options.find(o => o.correct).text)}</p>
          </div>
          <button class="primary" id="next">Next →</button>`;
        view.querySelectorAll(".options button").forEach(x => x.disabled = true);
        document.getElementById("next").addEventListener("click", () => { i += 1; step(); });
      }));
  };
  step();
}

/* ── Stats ──────────────────────────────────────────────────────── */

function renderRewards() {
  const rows = profile.rewards.map(r => {
    const current = rewardValue(r);
    const typeInfo = REWARD_TYPES[r.type];
    const pct = Math.min(100, Math.round(100 * current / r.target));
    let status, button = "";
    if (r.claimed) {
      status = `<span class="ok">✓ taken ${r.claimedDate}</span>`;
    } else if (current >= r.target) {
      status = `<span class="ok"><b>READY! Авах цаг боллоо!</b></span>`;
      button = `<button class="primary claim-btn" data-id="${r.id}" style="margin-top:6px;padding:6px 14px">🎁 Take it</button>`;
    } else {
      status = `<span class="muted">${current}/${r.target} ${typeInfo.label}</span>`;
    }
    return `<div class="row"><span class="name"><b>${esc(r.title)}</b>
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
        ${status} ${button}</span>
      <button class="ghost del-btn" data-id="${r.id}" style="padding:4px 10px">✕</button>
    </div>`;
  }).join("");

  return `
    <h3>🎁 My rewards — Урамшуулал</h3>
    <p class="muted">Set your own prize and earn it with effort: "reach a
    20-day streak → кино үзнэ" or "know 500 words → new shoes". The app
    tells you when you've earned it. Bonus is yours to choose!</p>
    ${rows ? `<div style="margin:6px 0">${rows}</div>` : ""}
    <input type="text" id="rTitle" placeholder="Reward — e.g. 🍦 Ice cream / Кино үзэх" maxlength="60">
    <div style="display:flex;gap:8px;margin-top:8px">
      <select id="rType" style="flex:1;font:inherit;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink)">
        <option value="streak">Day streak (өдөр дараалан)</option>
        <option value="xp">XP (оноо)</option>
        <option value="words">Words known (мэддэг үг)</option>
      </select>
      <input type="number" id="rTarget" min="1" max="100000" placeholder="30"
        style="width:90px;margin-top:0">
    </div>
    <button class="ghost" id="rAdd">＋ Add reward</button>`;
}

/* ── the honest numbers (ADR-0007, docs/learning-engine.md Part 5) ───
 * XP, streaks and badges measure showing up. These measure what you can do,
 * and none of them can be raised by tapping: grinding an item SHORTENS its
 * interval, so grinding cannot get an answer into "delayed", and only typed
 * answers count as production. Mirrors src/metrics.py. */

function delayedAccuracy() {
  const delayed = firstAttempts().filter(a => a.iv >= DELAYED_DAYS);
  if (!delayed.length) return { n: 0, pct: null };
  const ok = delayed.filter(a => a.ok).length;
  return { n: delayed.length, pct: Math.round(100 * ok / delayed.length) };
}

function productiveMature() {
  const lastTyped = {};
  for (const a of profile.log || []) lastTyped[a.deck + "|" + a.id] = a.prod;
  let mature = 0, productive = 0;
  for (const deck of ["grammar", "vocab", "talk"]) {
    const store = profile.srs[deck] || {};
    for (const id of Object.keys(store)) {
      if ((store[id].interval || 0) >= MATURE_DAYS && !srsLeech(store[id])) {
        mature += 1;
        if (lastTyped[deck + "|" + id]) productive += 1;
      }
    }
  }
  return { mature, productive };
}

function leechCount() {
  return ["grammar", "vocab", "talk"].reduce((sum, deck) =>
    sum + Object.keys(profile.srs[deck] || {})
      .filter(id => srsLeech(profile.srs[deck][id])).length, 0);
}

function masteredCount() {
  return ["grammar", "vocab", "talk"].reduce((sum, deck) =>
    sum + Object.keys(profile.srs[deck] || {})
      .filter(id => srsMastered(profile.srs[deck][id])).length, 0);
}

function fluencyTrend() {
  const rounds = {};
  for (const a of profile.log || []) {
    // `a.ms !== undefined`, not `a.ms`: a 0 ms answer is a timing, not a gap
    if (a.fl && a.ms !== undefined && a.ok) (rounds[a.d] = rounds[a.d] || []).push(a.ms);
  }
  const days = Object.keys(rounds).sort();
  if (!days.length) return { median: null, previous: null, rounds: 0 };
  // a true median, averaging the middle pair — the same definition Python's
  // statistics.median uses, or the same round would print two numbers
  const mid = list => {
    const s = list.slice().sort((a, b) => a - b), half = Math.floor(s.length / 2);
    return Math.round(s.length % 2 ? s[half] : (s[half - 1] + s[half]) / 2);
  };
  return {
    median: mid(rounds[days[days.length - 1]]),
    previous: days.length > 1 ? mid(rounds[days[days.length - 2]]) : null,
    rounds: days.length,
  };
}

function progressCard() {
  const dfa = delayedAccuracy();
  const prod = productiveMature();
  const leeches = leechCount();
  const flu = fluencyTrend();
  return `
    <h2>📈 What you can do</h2>
    <p class="muted">Not points — evidence. Each of these needs time to pass
    before it can move, which is exactly why it means something.</p>
    <div class="row"><span class="name">Remembered after a week</span>
      <span>${dfa.pct === null ? "—" : dfa.pct + "%"}</span></div>
    <p class="muted">${dfa.pct === null
      ? "Nothing has been away a week yet. Come back."
      : `first try, on ${dfa.n} item${dfa.n === 1 ? "" : "s"} you had not seen for 7+ days.`
        + (dfa.pct < 75 ? " Under 75% means the gaps are stretching too fast." : "")}</p>
    <div class="row"><span class="name">Known for keeps</span>
      <span>${prod.productive}</span></div>
    <p class="muted">items you can TYPE from memory after three weeks or more
      ${prod.mature ? `(of ${prod.mature} that old — the rest you can only recognise)` : ""}.</p>
    <div class="row"><span class="name">Learned to criterion</span>
      <span>${masteredCount()}</span></div>
    <p class="muted">right on ${MASTERY_STREAK} different days. One correct
      answer never counted, and now the app says so.</p>
    ${profile.wordsRead ? `<div class="row"><span class="name">Words read</span>
      <span>${profile.wordsRead}</span></div>
    <p class="muted">across ${Object.keys(profile.reading || {}).length} texts.
      This is the only number here that grows by reading rather than answering,
      and past about three thousand words of vocabulary it is the one that
      matters most.</p>` : ""}
    ${flu.median ? `<div class="row"><span class="name">Speed on known items</span>
      <span>${flu.median} ms</span></div>
    <p class="muted">median answer in the fluency minute${flu.previous
      ? `, ${Math.abs(flu.median - flu.previous)} ms ${flu.median < flu.previous
          ? "faster" : "slower"} than last round`
      : ""} — over ${flu.rounds} round${flu.rounds === 1 ? "" : "s"}. This one
      should fall quickly at first, then flatten. Flat from the start means the
      items are too varied to automatize.</p>` : ""}
    ${leeches ? `<div class="row"><span class="name">Need the lesson again</span>
      <span>${leeches}</span></div>
      <p class="muted">missed four times or more. These stopped coming back as
      quizzes on purpose — repeating a question you cannot answer is not
      practice. Re-read the topic, then they return.</p>` : ""}
    <p class="muted">✍️ Errors from your own writing are tracked in the desktop
      journal (<code>python -m src.play progress</code>) — that is where
      "did this error stop happening" gets answered.</p>`;
}

function renderStats() {
  const grid = BADGES.map(([id, icon, name, req]) => `
    <div class="badge ${profile.badges.includes(id) ? "" : "locked"}">
      <span class="ic">${profile.badges.includes(id) ? icon : "🔒"}</span><br>
      <b>${esc(name)}</b><br><span class="muted">${esc(req)}</span>
    </div>`).join("");
  const streakLine = profile.showStreak
    ? `🔥 <b>${profile.streakDays}</b>-day streak` : `<span class="muted">streak hidden</span>`;
  view.innerHTML = `
    <div class="card">
      <h2>🏅 Your level</h2>
      <p>Level: <b>${profile.level}</b> (${LEVEL_MN[profile.level] || ""})
        <button class="ghost" id="lvlBtn" style="margin-left:8px;padding:4px 12px">Change — Солих</button></p>
      <p class="muted">Word ladder: ${vocabLevel()} (${levelProgress(vocabLevel()).pct}%) ·
        Lessons read: ${profile.lessonsDone.length}/${totalTopics()} ·
        Words recognised: ${Object.keys(profile.knownWords).length}${
          (profile.anchors && profile.anchors.shown)
            ? ` (about ${correctedKnown(Object.keys(profile.knownWords).length)}
                corrected for over-claiming)` : ""}
        <br>Lessons read and words ticked are self-reported — useful for
        finding gaps, not evidence of learning.</p>
    </div>
    <div class="card">${progressCard()}</div>
    <div class="card">
      <h2>🔥 Habit — not progress</h2>
      <p class="muted">These measure showing up. Showing up is worth a lot, and
      it is still not the same as remembering — so they live down here.</p>
      <p>⭐ <b>${profile.xp}</b> XP &nbsp; ${streakLine} &nbsp;
        🏅 ${profile.badges.length}/${BADGES.length}</p>
      <label class="muted" style="display:block;margin:6px 0">
        <input type="checkbox" id="streakToggle" ${profile.showStreak ? "checked" : ""}>
        Show the streak (optional — no pressure without it)</label>
    </div>
    <div class="card" id="rewardsCard">${renderRewards()}</div>
    <div class="card">
      <h3>Badges</h3>
      <div class="badge-grid">${grid}</div>
      <p class="muted" style="margin-top:12px">✍️ The journal with AI correction
        lives in the desktop app — this trainer works fully offline.</p>
    </div>`;

  document.getElementById("lvlBtn").addEventListener("click", () => renderLevelPicker("stats"));
  document.getElementById("streakToggle").addEventListener("change", e => {
    profile.showStreak = e.target.checked;
    saveProfile(); renderStatline(); renderStats();
  });
  document.getElementById("rAdd").addEventListener("click", () => {
    const title = document.getElementById("rTitle").value.trim();
    const type = document.getElementById("rType").value;
    const target = parseInt(document.getElementById("rTarget").value, 10);
    if (!title || !REWARD_TYPES[type] || !target || target < 1) return;
    profile.rewards.push({
      id: Date.now().toString(36), title, type, target,
      claimed: false, claimedDate: null,
    });
    saveProfile(); renderStatline(); renderStats();
  });
  view.querySelectorAll(".claim-btn").forEach(b =>
    b.addEventListener("click", () => {
      const r = profile.rewards.find(x => x.id === b.dataset.id);
      if (r && rewardValue(r) >= r.target) {
        r.claimed = true;
        r.claimedDate = today();
        saveProfile(); renderStatline(); renderStats();
        alert(`🎉 ${r.title} — earned! Сайхан амраарай, та үүнийг хөдөлмөрөөрөө авлаа!`);
      }
    }));
  view.querySelectorAll(".del-btn").forEach(b =>
    b.addEventListener("click", () => {
      profile.rewards = profile.rewards.filter(x => x.id !== b.dataset.id);
      saveProfile(); renderStatline(); renderStats();
    }));
}

/* ── boot ───────────────────────────────────────────────────────── */

document.querySelectorAll(".tab").forEach(t =>
  t.addEventListener("click", () => setTab(t.dataset.tab)));

fetch("./data.json")
  .then(r => r.json())
  .then(d => {
    DATA = d;
    renderStatline();
    if (!profile.level) renderLevelPicker("today");
    else setTab("today");
  })
  .catch(() => {
    view.innerHTML = `<div class="card"><p>Could not load lesson data.
      Check your connection once — after that the app works offline.</p></div>`;
  });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
