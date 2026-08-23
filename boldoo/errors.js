/* The learner's-own-errors queue (ADR-0015) — a port of src/error_queue.py.
 *
 * Every edit the corrector pipeline computes becomes a scheduled item keyed
 * by category + normalised form, so the same mistake made twice lands on the
 * same item. That recurrence IS the fossilisation signal.
 *
 * Three rules carry the design, unchanged from the journal app:
 *
 *   A repair is a prompt, not a recast. The drill shows the learner's own
 *   sentence with the error span blanked and asks them to fix it; the target
 *   is revealed after the attempt (Lyster & Ranta 1997). The blank is a
 *   substring operation on text the learner wrote.
 *
 *   Graduation needs absence, not a passed drill. A treatable error graduates
 *   when the criterion is met on distinct days AND the form has not come back
 *   in recent checked drafts. Untreatable ones (word choice, collocation,
 *   register) are never drilled and never scored — they return as a read-only
 *   exposure (Ferris 1999).
 *
 *   Nothing is deleted. A graduated item keeps its history so a recurrence is
 *   recognised as a relapse.
 *
 * One honest difference from the Python: the answer to a repair is text the
 * corrector produced. It is the only model text that ever becomes an answer
 * key in Small Step, and the learner can dispute it — a disputed item is
 * never drilled again (precision over recall).
 */
window.ERRQ = (function () {
  'use strict';

  const KEY = 'boldoo.errors.v1';
  const DAY = 86400000;
  const LADDER = [0, 1, 3, 7, 16, 35, 90];
  const MASTERY_DAYS = 3;
  const LEECH_LAPSES = 4;
  const CLEAN_ENTRIES = 2;       // checked drafts with no recurrence before a drilled item graduates
  const CLEAN_UNTREATABLE = 3;   // untreatable items graduate by absence alone
  const FADE_ENTRIES = 5;        // a one-off slip fades without ever being drilled
  const FOSSIL_SEEN = 3;         // produced this many times -> must be drilled to graduate
  const EXPOSURE_STEP = 4;
  const BLOCKING = { high: 3, medium: 2, low: 1 };
  const TAX = (window.BOLDOO_TAXONOMY && window.BOLDOO_TAXONOMY.categories) || {};

  function today() {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function blank() { return { version: 1, items: {}, categories: {}, entries: [], entryCount: 0 }; }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const st = raw ? JSON.parse(raw) : blank();
      const b = blank();
      Object.keys(b).forEach(function (k) { if (!(k in st)) st[k] = b[k]; });
      return st;
    } catch (e) { return blank(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* */ } }
  let state = load();

  /**
   * category + normalised form. An insertion has no form, so it is keyed on
   * what was inserted ("articles:+a") — otherwise every missing article
   * would collapse into one item. (The Python keys on the empty string.)
   */
  function keyFor(category, original, corrected) {
    const norm = function (x) { return String(x || '').toLowerCase().split(/\s+/).filter(Boolean).join(' '); };
    const f = norm(original);
    return category + ':' + (f || '+' + norm(corrected));
  }

  // ------------------------------------------------- building the repair
  const SENT_END = /[.!?]\s/g;

  function sentenceBounds(text, start, end) {
    let left = 0, m;
    SENT_END.lastIndex = 0;
    while ((m = SENT_END.exec(text)) !== null && m.index < start) left = m.index + m[0].length;
    let right = text.length;
    SENT_END.lastIndex = Math.max(end - 1, 0);
    m = SENT_END.exec(text);
    if (m) right = m.index + m[0].length;
    while (left < start && /\s/.test(text[left])) left++;
    return [left, right];
  }

  /** The learner's own sentence with the error removed; null if unlocatable. */
  function buildRepair(text, edit) {
    const original = edit.original || '', corrected = edit.corrected || '';
    let start = edit.start, end = edit.end;
    if (start == null || end == null || text.slice(start, end) !== original) {
      const found = original ? text.indexOf(original) : -1;
      if (found < 0) return null;
      start = found; end = found + original.length;
    }
    const lr = sentenceBounds(text, start, end);
    const sentence = text.slice(lr[0], lr[1]).trim();
    const a = start - lr[0], b = end - lr[0];
    if (!(a >= 0 && a <= b && b <= sentence.length)) return null;
    if (corrected.trim()) {
      return { mode: 'chunk', sentence: sentence,
               prompt: sentence.slice(0, a) + '_____' + sentence.slice(b), answer: corrected };
    }
    const fixed = (sentence.slice(0, a) + sentence.slice(b)).replace(/\s+/g, ' ').trim();
    return { mode: 'sentence', sentence: sentence,
             prompt: sentence.slice(0, a) + '⟦' + original + '⟧' + sentence.slice(b), answer: fixed };
  }

  // ------------------------------------------------------- folding in
  function newItem(key, category, edit, repair, t) {
    const cat = TAX[category] || {};
    return {
      key: key, category: category, treatable: cat.treatable !== false,
      form: edit.original || '', target: edit.corrected || '',
      sentence: repair.sentence, prompt: repair.prompt, answer: repair.answer, mode: repair.mode,
      entryIds: [], seen: 0, firstSeen: t, lastSeen: t, seenAt: 0,
      state: 'queued',          // queued | drilling | graduated | leech | disputed
      box: 0, days: [], lapses: 0, due: t, shown: 0
    };
  }

  /** Add one checked draft's edits. Deterministic. */
  function fold(edits, entryId, text) {
    const t = today(), tomorrow = t + DAY;
    if (state.entries.indexOf(entryId) === -1) {
      state.entries = state.entries.concat([entryId]).slice(-50);
      state.entryCount += 1;
    }
    const count = state.entryCount;
    let added = 0;
    edits.forEach(function (edit) {
      const category = edit.category;
      if (!category || !TAX[category]) return;
      const repair = buildRepair(text, edit);
      if (!repair) return;
      const key = keyFor(category, edit.original, edit.corrected);
      let item = state.items[key];
      if (!item) {
        item = newItem(key, category, edit, repair, t);
        state.items[key] = item;
        added += 1;
      } else if (item.state === 'disputed') {
        return;   // the learner said this was correct; we do not argue
      } else {
        if (item.state === 'graduated') { item.lapses += 1; item.box = Math.max(0, Math.floor(item.box / 2)); }
        item.state = 'queued'; item.days = []; item.box = Math.min(item.box, 2);
        item.form = edit.original || item.form; item.target = edit.corrected || item.target;
        ['sentence', 'prompt', 'answer', 'mode'].forEach(function (k) { item[k] = repair[k]; });
      }
      // Due TOMORROW: re-drilling an error just explained is massed practice
      // against an explanation still in working memory.
      item.due = tomorrow;
      item.seen += 1; item.lastSeen = t; item.seenAt = count;
      if (item.entryIds.indexOf(entryId) === -1) item.entryIds = item.entryIds.concat([entryId]).slice(-20);
      const row = state.categories[category] || (state.categories[category] = { seen: 0, graduated: 0, lastSeen: null });
      row.seen += 1; row.lastSeen = t;
    });
    settle();
    save();
    return added;
  }

  // ------------------------------------------------------- graduation
  function entriesSince(item) { return Math.max(0, state.entryCount - (item.seenAt || 0)); }

  function graduates(item) {
    const clean = entriesSince(item);
    if (!item.treatable) return clean >= CLEAN_UNTREATABLE;
    const criterion = item.days.length >= MASTERY_DAYS;
    if (item.seen >= FOSSIL_SEEN) return criterion && clean >= CLEAN_ENTRIES;
    return (criterion && clean >= CLEAN_ENTRIES) || clean >= FADE_ENTRIES;
  }

  function settle() {
    Object.keys(state.items).forEach(function (k) {
      const item = state.items[k];
      if (item.state === 'leech' || item.state === 'disputed') return;
      if (item.lapses >= LEECH_LAPSES) item.state = 'leech';
      else if (graduates(item)) {
        if (item.state !== 'graduated') {
          const row = state.categories[item.category] || (state.categories[item.category] = { seen: 0, graduated: 0, lastSeen: null });
          row.graduated += 1;
        }
        item.state = 'graduated';
      }
    });
  }

  // ------------------------------------------------------- selection
  function score(item, t) {
    const w = BLOCKING[(TAX[item.category] || {}).blocking] || 1;
    const overdue = Math.max(0, (t - item.due) / DAY);
    return w * Math.min(item.seen || 1, 5) * (1 + overdue / 7);
  }

  /** Due, treatable, not leech: highest priority first, one per category. */
  function due(n) {
    const t = today();
    const ready = Object.keys(state.items).map(function (k) { return state.items[k]; })
      .filter(function (i) { return (i.state === 'queued' || i.state === 'drilling') && i.treatable && i.due <= t; });
    ready.sort(function (a, b) { return (score(b, t) - score(a, t)) || (a.key < b.key ? -1 : 1); });
    const out = [], cats = {};
    ready.forEach(function (i) {
      if (out.length >= n || cats[i.category]) return;
      out.push(i); cats[i.category] = true;
    });
    return out;
  }

  function dueCount() { return due(1000).length; }

  /** Untreatable errors, to be read rather than answered. */
  function exposures(n) {
    const t = today();
    return Object.keys(state.items).map(function (k) { return state.items[k]; })
      .filter(function (i) { return (i.state === 'queued' || i.state === 'drilling') && !i.treatable && i.due <= t; })
      .sort(function (a, b) { return (b.seen - a.seen) || (a.key < b.key ? -1 : 1); })
      .slice(0, n);
  }

  /** An exposure was displayed. Pushed out; never moved toward mastery. */
  function markShown(key) {
    const item = state.items[key];
    if (!item) return null;
    item.shown += 1; item.state = 'drilling';
    item.box = Math.min(item.box + 1, 3);
    item.due = today() + Math.min(30, EXPOSURE_STEP * (item.shown)) * DAY;
    save();
    return item;
  }

  // ------------------------------------------------------- attempts
  /** One repair attempt. Same arithmetic as srs.js: box ladder, distinct days. */
  function record(key, correct) {
    const item = state.items[key];
    if (!item) return null;
    const t = today();
    if (correct) {
      if (item.days.indexOf(t) === -1) item.days.push(t);
      item.box = Math.min(item.box + 1, LADDER.length - 1);
    } else {
      item.lapses += 1; item.days = []; item.box = 0;   // the criterion clock restarts
    }
    item.due = t + LADDER[item.box] * DAY;
    item.state = item.lapses >= LEECH_LAPSES ? 'leech' : 'drilling';
    settle();
    save();
    return item;
  }

  /** Re-teaching happened: a leech returns with a clean slate. */
  function clearLeech(key) {
    const item = state.items[key];
    if (!item || item.state !== 'leech') return null;
    item.lapsesBeforeLesson = item.lapses;
    item.lapses = 0; item.days = []; item.box = 0; item.state = 'queued'; item.due = today();
    save();
    return item;
  }

  /** The learner says their version was right. We stop, and keep the record. */
  function dispute(key) {
    const item = state.items[key];
    if (!item) return null;
    item.state = 'disputed';
    save();
    return item;
  }

  // ------------------------------------------------------- rendering
  function toDrill(item) {
    const cat = TAX[item.category] || {};
    return {
      id: 'err:' + item.key, key: item.key, kind: 'repair', mode: item.mode,
      unitId: 'errors', tag: 'Таны өгүүлбэр · ' + item.category.replace(/_/g, ' '),
      prompt: item.prompt,
      promptNote: item.mode === 'chunk' ? 'Дутуу үгийг бич.' : 'Тэмдэглэсэн үггүйгээр өгүүлбэрийг бич.',
      answer: item.answer, accept: acceptable(item.answer),
      sentence: item.sentence, category: item.category,
      explain: (cat.rule_a2 || '') + (cat.bridge ? '\n' + cat.bridge : ''),
      source: 'таны бичсэн', seen: item.seen
    };
  }

  function toExposure(item) {
    const cat = TAX[item.category] || {};
    return { key: item.key, category: item.category, yours: item.form, natural: item.target,
             sentence: item.sentence, rule: cat.rule_a2 || '', bridge: cat.bridge || '', seen: item.seen };
  }

  function norm(s) {
    return String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[.,;!?]+$/, '').replace(/\s+/g, ' ').trim();
  }
  const CONTRACT = [['i am', "i'm"], ['it is', "it's"], ['do not', "don't"],
    ['does not', "doesn't"], ['did not', "didn't"], ['is not', "isn't"], ['are not', "aren't"],
    ['cannot', "can't"], ['will not', "won't"], ['have not', "haven't"], ['has not', "hasn't"],
    ['i have', "i've"], ['we are', "we're"], ['they are', "they're"], ['you are', "you're"]];
  function swapAll(s, from, to) {
    return s.replace(new RegExp('(^|[^a-z])' + from + '(?![a-z])', 'g'), '$1' + to);
  }
  /** The answer and its contracted/expanded forms — "I am" and "I'm" are both right. */
  function acceptable(answer) {
    const a = norm(answer);
    const out = [a];
    let c = a, e = a;
    CONTRACT.forEach(function (p) { c = swapAll(c, p[0], p[1]); e = swapAll(e, p[1], p[0]); });
    if (out.indexOf(c) === -1) out.push(c);
    if (out.indexOf(e) === -1) out.push(e);
    return out;
  }

  // ------------------------------------------------------- reporting
  function summary() {
    const items = Object.keys(state.items).map(function (k) { return state.items[k]; });
    const by = {};
    items.forEach(function (i) { by[i.state] = (by[i.state] || 0) + 1; });
    const cats = {};
    items.forEach(function (i) { (cats[i.category] = cats[i.category] || []).push(i); });
    const graduated = Object.keys(cats).filter(function (c) {
      return cats[c].every(function (i) { return i.state === 'graduated'; });
    }).sort();
    return {
      tracked: items.length,
      queued: (by.queued || 0) + (by.drilling || 0),
      graduated: by.graduated || 0,
      leeches: by.leech || 0,
      disputed: by.disputed || 0,
      categoriesGraduated: graduated,
      leechKeys: items.filter(function (i) { return i.state === 'leech'; }).map(function (i) { return i.key; }).sort(),
      entries: state.entryCount,
      due: dueCount()
    };
  }

  function reset() { state = blank(); save(); }
  function exportState() { return JSON.stringify(state); }
  function importState(json) {
    const p = JSON.parse(json);
    if (!p || typeof p !== 'object' || !p.items) throw new Error('Not an error-queue file.');
    state = p; const b = blank();
    Object.keys(b).forEach(function (k) { if (!(k in state)) state[k] = b[k]; });
    save();
  }

  return {
    keyFor: keyFor, buildRepair: buildRepair, fold: fold,
    due: due, dueCount: dueCount, exposures: exposures, markShown: markShown,
    record: record, clearLeech: clearLeech, dispute: dispute,
    toDrill: toDrill, toExposure: toExposure, acceptable: acceptable,
    summary: summary, item: function (k) { return state.items[k] || null; },
    reset: reset, exportState: exportState, importState: importState,
    MASTERY_DAYS: MASTERY_DAYS, LEECH_LAPSES: LEECH_LAPSES, CLEAN_ENTRIES: CLEAN_ENTRIES,
    today: today
  };
})();
