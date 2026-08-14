/* Багш PWA — grammar, vocabulary & everyday conversation trainer for
 * Mongolian speakers. Pure client: renders data.json (exported from
 * knowledge/*.yaml), keeps all progress in localStorage. The journal
 * (AI correction + safety gate) deliberately lives only in the desktop app. */

"use strict";

const STORE_KEY = "bagsh_profile_v1";
const SESSION_N = 5;
const NEW_PER_SESSION = 3;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const VOCAB_LEVELS = LEVELS;
const LEVEL_MN = { A1: "Эхлэгч", A2: "Бага дунд", B1: "Дунд", B2: "Ахисан дунд", C1: "Ахисан", C2: "Гүнзгий" };
const CHECK_ROUND = 20;          // words per check-yourself round
const LEVEL_DONE_PCT = 90;       // % of the level list known to unlock next

const XP = { lesson: 10, quizCorrect: 4, quizAttempt: 1, vocabCorrect: 3, vocabAttempt: 1, talk: 5 };

const BADGES = [
  ["first_step", "🐫", "Эхний алхам — First step", "earn any XP", p => p.xp > 0],
  ["streak_3", "🔥", "Гурав дараалан — 3-day streak", "study 3 days in a row", p => p.streakDays >= 3],
  ["streak_7", "🔥🔥", "Долоо хоног — 7-day streak", "study 7 days in a row", p => p.streakDays >= 7],
  ["streak_30", "🌋", "Сар бүтэн — 30-day streak", "study 30 days in a row", p => p.streakDays >= 30],
  ["xp_100", "⛏️", "Чулуу цуглуулагч — Rock collector", "reach 100 XP", p => p.xp >= 100],
  ["xp_500", "💎", "Эрдэнэс — Treasure", "reach 500 XP", p => p.xp >= 500],
  ["grammar_25", "🧱", "Дүрэм баригч — Grammar builder", "25 correct grammar answers", p => p.quizCorrect >= 25],
  ["vocab_50", "📚", "Үгийн сан — Word bank", "50 correct vocabulary answers", p => p.vocabCorrect >= 50],
  ["talk_5", "🗣️", "Ярианы хүн — Conversation starter", "finish 5 conversations", p => p.talkDone.length >= 5],
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
    srs: { grammar: {}, vocab: {} },
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

/* ── SRS (SM-2 lite, same math as src/srs.py) ───────────────────── */

function srsReview(store, id, correct) {
  const rec = store[id] || { ease: 2.5, interval: 0, reps: 0 };
  if (correct) {
    rec.reps += 1;
    rec.interval = rec.reps === 1 ? 1 : rec.reps === 2 ? 3 : Math.max(1, Math.round(rec.interval * rec.ease));
    rec.ease = Math.min(3.0, rec.ease + 0.05);
  } else {
    rec.reps = 0; rec.interval = 0;
    rec.ease = Math.max(1.3, rec.ease - 0.2);
  }
  const d = new Date(); d.setDate(d.getDate() + rec.interval);
  rec.due = d.toISOString().slice(0, 10);
  store[id] = rec;
}

function srsPick(store, ids, n) {
  const t = today();
  const due = ids.filter(i => store[i] && store[i].due <= t)
    .sort((a, b) => store[a].due < store[b].due ? -1 : 1);
  const fresh = ids.filter(i => !store[i]);
  const session = due.slice(0, n);
  let room = n - session.length;
  if (room > 0) session.push(...fresh.slice(0, Math.min(room, NEW_PER_SESSION)));
  room = n - session.length;
  if (room > 0) {
    const upcoming = ids.filter(i => store[i] && !session.includes(i))
      .sort((a, b) => store[a].due < store[b].due ? -1 : 1);
    session.push(...upcoming.slice(0, room));
  }
  return session;
}

/* ── answer checking (same rules as src/quiz.py) ────────────────── */

function normalise(s) {
  return s.normalize("NFKC")
    .replace(/[﻿​]/g, "")
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ").trim();
}

function checkAnswer(user, right) {
  const a = normalise(user), b = normalise(right);
  if (a === b) return true;
  return b.endsWith(".") && a === b.slice(0, -1).trimEnd();
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
  ({ path: renderPath, talk: renderTalkList, grammar: startGrammar,
     vocab: renderVocabHome, stats: renderStats }[name])();
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
    const isDone = profile.talkDone.includes(d.id);
    return `<div class="row ${locked ? "locked-row" : ""}" data-id="${locked ? "" : d.id}">
      <span class="st">${locked ? "🔒" : isDone ? "✓" : "🗣️"}</span>
      <span class="name">${esc(d.title_en)}<br>
        <span class="mn">${esc(d.title_mn)}</span></span>
      <span class="pill">${d.level}</span>
    </div>`;
  }).join("");
  view.innerHTML = `
    <div class="card"><h2>🗣️ Everyday talk — Өдөр тутмын яриа</h2>
      <p class="muted">Conversations for YOUR level first (yours:
      <b>${profile.level}</b>), easier ones below for review, harder ones
      🔒 until you raise your level in Stats.</p></div>
    <div class="card">${rows}</div>`;
  view.querySelectorAll(".row[data-id]").forEach(r => {
    if (r.dataset.id) {
      r.addEventListener("click", () => renderDialogue(r.dataset.id));
    }
  });
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
      <button class="primary" id="practiceBtn">Your turn →</button>
      <button class="ghost" id="backBtn">← All conversations</button>
    </div>`;
  document.getElementById("practiceBtn").addEventListener("click", () => renderTalkPractice(d));
  document.getElementById("backBtn").addEventListener("click", renderTalkList);
}

function renderTalkPractice(d) {
  const options = shuffle([...d.practice.options]);
  view.innerHTML = `
    <div class="card">
      <h2>Your turn — Таны ээлж</h2>
      <p>${esc(d.practice.situation)}</p>
      <div class="options">${options.map((o, i) =>
        `<button class="ghost" data-i="${i}">${esc(o.text)}</button>`).join("")}</div>
      <div id="fb"></div>
    </div>`;
  view.querySelectorAll(".options button").forEach(b =>
    b.addEventListener("click", () => {
      const o = options[Number(b.dataset.i)];
      if (o.correct && !profile.talkDone.includes(d.id)) {
        profile.talkDone.push(d.id);
        recordActivity(XP.talk);
      } else { saveProfile(); }
      document.getElementById("fb").innerHTML = `
        <div class="feedback ${o.correct ? "good" : "bad"}">
          <p>${o.correct ? esc(pick(PRAISE)) : "Not the natural choice."}</p>
          <p>💡 ${esc(o.why)}</p>
          ${o.correct ? "" : `<p>✅ <b>${esc(d.practice.options.find(x => x.correct).text)}</b></p>`}
        </div>
        <button class="primary" id="next">${o.correct ? "Done — back to talks" : "Try again"}</button>`;
      document.getElementById("next").addEventListener("click", () =>
        o.correct ? renderTalkList() : renderTalkPractice(d));
    }));
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
  const byId = Object.fromEntries(DATA.grammar.map(q => [q.id, q]));
  const session = srsPick(profile.srs.grammar, grammarIds(topic), SESSION_N);
  runRounds(session, 0, 0, [], {
    kind: "grammar",
    render(id, i, total, onAnswer) {
      const q = byId[id];
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
        const ok = checkAnswer(input.value, q.answer);
        srsReview(profile.srs.grammar, id, ok);
        recordActivity(ok ? XP.quizCorrect : XP.quizAttempt, ok ? "quizCorrect" : null);
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
    },
  });
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

function levelProgress(l) {
  const list = listOfLevel(l);
  const known = list.filter(w => profile.knownWords[w]).length;
  return { known, total: list.length, pct: list.length ? Math.round(100 * known / list.length) : 0 };
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
        <div class="bar"><div class="bar-fill" style="width:${p.pct}%"></div></div></span>
      <span class="muted">${p.known}/${p.total}</span></div>`;
  }).join("");

  const p = levelProgress(current);
  const complete = p.pct >= LEVEL_DONE_PCT;
  const next = VOCAB_LEVELS[currentRank + 1];
  const hasCards = cardsOfLevel(current).length > 0;

  let action = "";
  if (complete && next) {
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
    <button class="primary" id="checkBtn">✓✗ Check yourself — ${current} list</button>
    ${hasCards ? `<button class="ghost" id="studyBtn">📖 Study cards with Mongolian (${cardsOfLevel(current).length})</button>` : ""}
    ${profile.studyList.length ? `<button class="ghost" id="listBtn">📝 My study list (${profile.studyList.length})</button>` : ""}`;

  view.innerHTML = `
    <div class="card"><h2>📚 Word ladder — Үгийн шат</h2>
      <p class="muted">Real level lists (${DATA.wordlist.levels["A1"].length + DATA.wordlist.levels["A2"].length + DATA.wordlist.levels["B1"].length} words to B1,
      like the official Cambridge lists). Mark the words you know; study the
      rest. Know ${LEVEL_DONE_PCT}% of your level — the next opens.</p>
      ${action}</div>
    <div class="card">${rows}</div>
    <p class="muted" style="padding:0 6px">Word list: CEFR-J-based dataset (MIT).
    Cards with Mongolian glosses grow by curation.</p>`;

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

/* check-yourself: fast ✓/✗ through the level's official-size list */

function startCheck() {
  const current = vocabLevel();
  const pending = listOfLevel(current).filter(
    w => !profile.knownWords[w] && !profile.studyList.includes(w));
  const round = pending.slice(0, CHECK_ROUND);
  if (!round.length) {
    renderStudyList();
    return;
  }
  const cardByWord = Object.fromEntries(DATA.vocab.map(w => [w.word, w]));
  let i = 0, knew = 0;

  function step() {
    if (i >= round.length) {
      recordActivity(5);  // finishing a check round feeds the streak
      view.innerHTML = `
        <div class="card">
          <h2>Round done — you knew ${knew}/${round.length}</h2>
          <p class="muted">Unknown words went to your study list. Honest
          answers make the ladder true — no one is watching. 🐫</p>
          <button class="primary" id="more">Next 20 words</button>
          <button class="ghost" id="home">Back to ladder</button>
        </div>`;
      document.getElementById("more").addEventListener("click", startCheck);
      document.getElementById("home").addEventListener("click", renderVocabHome);
      return;
    }
    const word = round[i];
    const card = cardByWord[word];
    view.innerHTML = `
      <div class="card">
        <h2>Do you know this word? <span class="pill">${i + 1}/${round.length}</span></h2>
        <p class="q-wrong" style="font-size:26px"><b>${esc(word)}</b></p>
        ${card ? `<p class="muted stress">${esc(card.stress)}</p>` : ""}
        <button class="primary" id="know">✓ I know it — Мэднэ</button>
        <button class="ghost" id="dont">✗ I don't know — Мэдэхгүй</button>
      </div>`;
    document.getElementById("know").addEventListener("click", () => {
      markKnown(word); knew += 1; i += 1; saveProfile(); step();
    });
    document.getElementById("dont").addEventListener("click", () => {
      if (!profile.studyList.includes(word)) profile.studyList.push(word);
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

function cloze(w) {
  return w.example.replace(new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "_____");
}

function startVocab() {
  const current = vocabLevel();
  const currentRank = vocabRank(current);
  // due reviews from lower levels come along; new cards only from the
  // current level, study-list words first
  const t = today();
  const lowerDue = DATA.vocab
    .filter(w => vocabRank(w.level) < currentRank)
    .filter(w => profile.srs.vocab[w.word] && profile.srs.vocab[w.word].due <= t)
    .map(w => w.word);
  const levelCards = cardsOfLevel(current).map(w => w.word)
    .sort((a, b) => profile.studyList.includes(b) - profile.studyList.includes(a));
  const ids = [...lowerDue, ...levelCards];
  const byWord = Object.fromEntries(DATA.vocab.map(w => [w.word, w]));
  const session = srsPick(profile.srs.vocab, ids, SESSION_N);
  runRounds(session, 0, 0, [], {
    kind: "vocab",
    render(id, i, total, onAnswer) {
      const w = byWord[id];
      const rec = profile.srs.vocab[id];
      const finish = ok => {
        srsReview(profile.srs.vocab, id, ok);
        if (profile.srs.vocab[id].reps >= 2) markKnown(id);  // card mastery counts on the ladder
        recordActivity(ok ? XP.vocabCorrect : XP.vocabAttempt, ok ? "vocabCorrect" : null);
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
        // Brand-new word: TEACH first — full card, no guessing blind.
        view.innerHTML = `
          <div class="card">
            <h2>📚 New word <span class="pill">${i + 1}/${total}</span></h2>
            <p class="q-wrong"><b>${esc(w.word)}</b>
              <span class="stress">(${esc(w.stress)})</span></p>
            <p><b>Meaning:</b> ${esc(w.gloss_en)}</p>
            <p class="mn">🇲🇳 ${esc(w.gloss_mn)}</p>
            <p class="muted">e.g. ${esc(w.example)}</p>
            <button class="primary" id="learned">Got it — ask me ✓</button>
          </div>`;
        document.getElementById("learned").addEventListener("click", () => {
          const wrong = shuffle(DATA.vocab.filter(x => x.word !== w.word))
            .slice(0, 3);
          const options = shuffle([...wrong, w]);
          view.innerHTML = `
            <div class="card">
              <h2>📚 Which meaning? <span class="pill">${i + 1}/${total}</span></h2>
              <p class="q-wrong"><b>${esc(w.word)}</b>
                <span class="stress">(${esc(w.stress)})</span></p>
              <div class="options">${options.map(o =>
                `<button class="ghost" data-g="${esc(o.word)}">
                   ${esc(o.gloss_en)}<br><span class="mn">${esc(o.gloss_mn)}</span>
                 </button>`).join("")}</div>
              <div id="fb"></div>
            </div>`;
          view.querySelectorAll(".options button").forEach(b =>
            b.addEventListener("click", () => finish(b.dataset.g === w.word)));
        });
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
        const submit = () => finish(checkWord(input.value, w.word));
        document.getElementById("go").addEventListener("click", submit);
        input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
      }
    },
  });
}

/* ── shared session runner ──────────────────────────────────────── */

function runRounds(session, i, correct, badges, mode) {
  if (!session.length) {
    view.innerHTML = `<div class="card"><p>Nothing to review — come back tomorrow! 🐫</p></div>`;
    return;
  }
  if (i >= session.length) {
    view.innerHTML = `
      <div class="card">
        <h2>Session done — ${correct}/${session.length}</h2>
        ${badges.map(b => `<p>🏅 New badge: ${esc(b)}</p>`).join("")}
        <p class="muted">${correct === session.length
          ? "Perfect round. Маргааш уулзацгаая!"
          : "Wrong answers come back sooner — that is how memory grows."}</p>
        <button class="primary" id="again">${mode.kind === "grammar" ? "Play again" : "Continue"}</button>
      </div>`;
    document.getElementById("again").addEventListener("click", () =>
      mode.kind === "grammar" ? startGrammar() : renderVocabHome());
    return;
  }
  mode.render(session[i], i, session.length, ok => {
    runRounds(session, i + 1, correct + (ok ? 1 : 0), badges, mode);
  });
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
      <h2>🏅 Progress</h2>
      <p>Level: <b>${profile.level}</b> (${LEVEL_MN[profile.level] || ""})
        <button class="ghost" id="lvlBtn" style="margin-left:8px;padding:4px 12px">Change — Солих</button></p>
      <p>⭐ <b>${profile.xp}</b> XP &nbsp; ${streakLine}</p>
      <p class="muted">Grammar correct: ${profile.quizCorrect} ·
        Words known: ${Object.keys(profile.knownWords).length} ·
        Word ladder: ${vocabLevel()} (${levelProgress(vocabLevel()).pct}%) ·
        Lessons: ${profile.lessonsDone.length}/${totalTopics()} ·
        Talks: ${profile.talkDone.length}/${DATA.dialogues.length}</p>
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
    if (!profile.level) renderLevelPicker("path");
    else setTab("path");
  })
  .catch(() => {
    view.innerHTML = `<div class="card"><p>Could not load lesson data.
      Check your connection once — after that the app works offline.</p></div>`;
  });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
