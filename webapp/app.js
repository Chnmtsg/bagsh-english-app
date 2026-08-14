/* Багш PWA — grammar & vocabulary trainer for Mongolian speakers.
 * Pure client: renders data.json (exported from knowledge/*.yaml) and keeps
 * all progress in localStorage. The journal (AI correction + safety gate)
 * deliberately lives only in the desktop app. */

"use strict";

const STORE_KEY = "bagsh_profile_v1";
const SESSION_N = 5;
const NEW_PER_SESSION = 3;

const XP = { lesson: 10, quizCorrect: 4, quizAttempt: 1, vocabCorrect: 3, vocabAttempt: 1 };

const BADGES = [
  ["first_step", "🐫", "Эхний алхам — First step", "earn any XP", p => p.xp > 0],
  ["streak_3", "🔥", "Гурав дараалан — 3-day streak", "study 3 days in a row", p => p.streakDays >= 3],
  ["streak_7", "🔥🔥", "Долоо хоног — 7-day streak", "study 7 days in a row", p => p.streakDays >= 7],
  ["streak_30", "🌋", "Сар бүтэн — 30-day streak", "study 30 days in a row", p => p.streakDays >= 30],
  ["xp_100", "⛏️", "Чулуу цуглуулагч — Rock collector", "reach 100 XP", p => p.xp >= 100],
  ["xp_500", "💎", "Эрдэнэс — Treasure", "reach 500 XP", p => p.xp >= 500],
  ["grammar_25", "🧱", "Дүрэм баригч — Grammar builder", "25 correct grammar answers", p => p.quizCorrect >= 25],
  ["vocab_50", "📚", "Үгийн сан — Word bank", "50 correct vocabulary answers", p => p.vocabCorrect >= 50],
  ["lessons_12", "📖", "Хагас зам — Halfway", "finish 12 lessons", p => p.lessonsDone.length >= 12],
];

const PRAISE = ["✅ Гоё! (Nice!)", "✅ Exactly right.", "✅ Зөв! (Correct!)", "✅ Clean fix."];
const MISS = ["Almost — here it is:", "Not this time. The answer:", "This one comes back later. Answer:"];

let DATA = null;
let profile = loadProfile();

/* ── profile / gamification ─────────────────────────────────────── */

function loadProfile() {
  const blank = {
    xp: 0, streakDays: 0, lastActive: null, badges: [],
    quizCorrect: 0, vocabCorrect: 0, lessonsDone: [],
    srs: { grammar: {}, vocab: {} },
  };
  try {
    return Object.assign(blank, JSON.parse(localStorage.getItem(STORE_KEY)) || {});
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
  for (const b of BADGES) {
    const [id, icon, name, , pred] = b;
    if (!profile.badges.includes(id) && pred(profile)) {
      profile.badges.push(id);
      fresh.push(`${icon} ${name}`);
    }
  }
  saveProfile();
  renderStatline();
  return fresh;
}

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

/* ── rendering helpers ──────────────────────────────────────────── */

const view = document.getElementById("view");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];

function renderStatline() {
  document.getElementById("statline").textContent =
    `⭐ ${profile.xp} XP · 🔥 ${profile.streakDays} · 🏅 ${profile.badges.length}/${BADGES.length}`;
}

function setTab(name) {
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name));
  ({ path: renderPath, lesson: () => renderLesson(), grammar: startGrammar,
     vocab: startVocab, stats: renderStats }[name])();
}

/* ── Path ───────────────────────────────────────────────────────── */

function renderPath() {
  const done = profile.lessonsDone;
  const rows = DATA.curriculum_order.map((name, i) => {
    const st = done.includes(name) ? "✓" : "·";
    const cls = done.includes(name) ? "ok" : "muted";
    return `<div class="row" data-topic="${name}">
      <span class="num">${i + 1}</span>
      <span class="name">${name.replace(/_/g, " ")}</span>
      <span class="st ${cls}">${st}</span></div>`;
  }).join("");
  view.innerHTML = `
    <div class="card"><h2>Таны зам — Your path</h2>
      <p class="muted">24 grammar systems, in teaching order. Tap one to study it.
      Finished: ${done.length}/24.</p></div>
    <div class="card">${rows}</div>`;
  view.querySelectorAll(".row").forEach(r =>
    r.addEventListener("click", () => renderLesson(r.dataset.topic)));
}

function nextTopic() {
  return DATA.curriculum_order.find(n => !profile.lessonsDone.includes(n))
    || DATA.curriculum_order[0];
}

/* ── Lesson ─────────────────────────────────────────────────────── */

function renderLesson(topic) {
  topic = topic || nextTopic();
  const c = DATA.categories[topic];
  const done = profile.lessonsDone.includes(topic);
  const examples = c.examples.map(e =>
    `<p>❌ ${esc(e.wrong)}<br>✅ <b>${esc(e.right)}</b></p>`).join("");
  view.innerHTML = `
    <div class="card">
      <h2 style="text-transform:capitalize">${topic.replace(/_/g, " ")}
        <span class="pill">lesson ${c.priority}/24</span></h2>
      <h3>📌 Rule</h3><p>${esc(c.rule_b1)}</p>
      <h3>🇲🇳 Таны хэлэнд аль хэдийн байгаа зүйл</h3>
      <p class="mn">${esc(c.bridge)}</p>
      <h3>Examples</h3>${examples}
      <p class="muted">Guide: ${esc(c.guide_ref)}</p>
      <button class="primary" id="doneBtn" ${done ? "disabled" : ""}>
        ${done ? "✓ Finished" : "Mark finished (+10 XP)"}</button>
      <button class="ghost" id="drillBtn">Practise it now →</button>
    </div>`;
  document.getElementById("doneBtn").addEventListener("click", () => {
    profile.lessonsDone.push(topic);
    const fresh = recordActivity(XP.lesson);
    renderLesson(topic);
    if (fresh.length) toast(fresh);
  });
  document.getElementById("drillBtn").addEventListener("click", () => startGrammar(topic));
}

/* ── Grammar game ───────────────────────────────────────────────── */

function grammarIds(topic) {
  let bank = DATA.grammar;
  if (topic) {
    const scoped = bank.filter(q => q.category === topic);
    if (scoped.length) bank = scoped;
  }
  return bank.map(q => q.id);
}

function startGrammar(topic) {
  topic = typeof topic === "string" ? topic : null;
  const byId = Object.fromEntries(DATA.grammar.map(q => [q.id, q]));
  const session = srsPick(profile.srs.grammar, grammarIds(topic), SESSION_N);
  runRounds(session, 0, 0, [], {
    title: "🧱 Fix the sentence",
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

/* ── Vocab trainer ──────────────────────────────────────────────── */

function cloze(w) {
  return w.example.replace(new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "_____");
}

function startVocab() {
  const byWord = Object.fromEntries(DATA.vocab.map(w => [w.word, w]));
  const ids = DATA.vocab.map(w => w.word);
  const session = srsPick(profile.srs.vocab, ids, SESSION_N);
  runRounds(session, 0, 0, [], {
    title: "📚 Words",
    render(id, i, total, onAnswer) {
      const w = byWord[id];
      const seen = profile.srs.vocab[id] && profile.srs.vocab[id].reps > 0;
      const finish = ok => {
        srsReview(profile.srs.vocab, id, ok);
        recordActivity(ok ? XP.vocabCorrect : XP.vocabAttempt, ok ? "vocabCorrect" : null);
        document.getElementById("fb").innerHTML = `
          <div class="feedback ${ok ? "good" : "bad"}">
            <p>${ok ? esc(pick(PRAISE)) : `${esc(pick(MISS))} <b>${esc(w.word)}</b> — ${esc(w.gloss_en)}`}</p>
            <p>🔊 say it: <span class="stress">${esc(w.stress)}</span> · 🇲🇳 ${esc(w.gloss_mn)}</p>
            <p class="muted">e.g. ${esc(w.example)}</p>
          </div>
          <button class="primary" id="next">Next →</button>`;
        document.querySelectorAll(".options button, #go").forEach(b => b.disabled = true);
        document.getElementById("next").addEventListener("click", () => onAnswer(ok));
      };
      if (seen) {
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
      } else {
        const wrong = shuffle(DATA.vocab.filter(x => x.word !== w.word)).slice(0, 3).map(x => x.gloss_en);
        const options = shuffle([...wrong, w.gloss_en]);
        view.innerHTML = `
          <div class="card">
            <h2>📚 New word <span class="pill">${i + 1}/${total}</span></h2>
            <p class="q-wrong"><b>${esc(w.word)}</b>
              <span class="stress">(${esc(w.stress)})</span></p>
            <p class="muted">${esc(cloze(w))}</p>
            <div class="options">${options.map(o =>
              `<button class="ghost" data-g="${esc(o)}">${esc(o)}</button>`).join("")}</div>
            <div id="fb"></div>
          </div>`;
        view.querySelectorAll(".options button").forEach(b =>
          b.addEventListener("click", () => finish(b.dataset.g === w.gloss_en)));
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
        <button class="primary" id="again">Play again</button>
      </div>`;
    document.getElementById("again").addEventListener("click", () =>
      mode.title.startsWith("🧱") ? startGrammar() : startVocab());
    return;
  }
  mode.render(session[i], i, session.length, ok => {
    runRounds(session, i + 1, correct + (ok ? 1 : 0), badges, mode);
  });
}

function toast(msgs) {
  msgs.forEach(m => console.log("badge:", m));
}

/* ── Stats ──────────────────────────────────────────────────────── */

function renderStats() {
  const grid = BADGES.map(([id, icon, name, req]) => `
    <div class="badge ${profile.badges.includes(id) ? "" : "locked"}">
      <span class="ic">${profile.badges.includes(id) ? icon : "🔒"}</span><br>
      <b>${esc(name)}</b><br><span class="muted">${esc(req)}</span>
    </div>`).join("");
  view.innerHTML = `
    <div class="card">
      <h2>🏅 Progress</h2>
      <p>⭐ <b>${profile.xp}</b> XP &nbsp; 🔥 <b>${profile.streakDays}</b>-day streak</p>
      <p class="muted">Grammar correct: ${profile.quizCorrect} ·
        Words correct: ${profile.vocabCorrect} ·
        Lessons: ${profile.lessonsDone.length}/24</p>
      <div class="badge-grid">${grid}</div>
      <p class="muted" style="margin-top:12px">✍️ The journal with AI correction
        lives in the desktop app — this trainer works fully offline.</p>
    </div>`;
}

/* ── boot ───────────────────────────────────────────────────────── */

document.querySelectorAll(".tab").forEach(t =>
  t.addEventListener("click", () => setTab(t.dataset.tab)));

fetch("./data.json")
  .then(r => r.json())
  .then(d => { DATA = d; renderStatline(); setTab("path"); })
  .catch(() => {
    view.innerHTML = `<div class="card"><p>Could not load lesson data.
      Check your connection once — after that the app works offline.</p></div>`;
  });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
