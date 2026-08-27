/* The tracking sheet (ADR-0016): the four numbers, computed.
 *
 *   words · errors/100w · ART/100w · clauses/sentence  (+ WPM when the
 *   learner types how long the recording was)
 *
 * One row per checked text, kept in localStorage. The first row is the
 * baseline and is never overwritten — the plan's zero point is a one-shot
 * measurement. Errors/100w is never shown alone: it falls when a learner
 * writes shorter, simpler sentences, so words and clauses/sentence sit
 * beside it (LEARNING.md Part 5; docs/learning-engine.md Part 5 §1).
 *
 * Clauses are ESTIMATED: sentences plus clause-linking words. It is a
 * consistent proxy for "am I attempting longer structures", not a parse.
 */
window.TRACK = (function () {
  'use strict';

  const KEY = 'boldoo.track.v1';
  const MAX = 500;

  // The plan's own error codes, mapped onto the closed taxonomy.
  const CODES = {
    ART: 'articles', PREP: 'prepositions', WO: 'word_order', IQ: 'questions_negation',
    TNS: 'tense_aspect', APO: 'punctuation', COLL: 'collocation', SVA: 'verb_agreement',
    WF: 'verb_form'
  };
  const CODE_OF = {};
  Object.keys(CODES).forEach(function (c) { CODE_OF[CODES[c]] = c; });
  CODE_OF.modifier_placement = 'WO';
  CODE_OF.word_choice = 'WF';
  CODE_OF.spelling = 'APO';
  CODE_OF.capitalization = 'APO';

  const LINKERS = /\b(that|which|who|whom|whose|because|when|while|if|unless|although|though|before|after|since|until|where|whereas|and|but|so|or)\b/gi;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) { /* */ } }
  let rows = load();

  function today() {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function words(text) {
    return (String(text).match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) || []).length;
  }
  function sentences(text) {
    const parts = String(text).split(/[.!?]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    return Math.max(1, parts.length);
  }
  function clauses(text) {
    const n = sentences(text);
    const links = (String(text).match(LINKERS) || []).length;
    return n + links;
  }

  /** Numbers for one text and its computed edits. Pure. */
  function measure(text, edits, minutes) {
    const w = words(text);
    const s = sentences(text);
    const c = clauses(text);
    const art = edits.filter(function (e) { return e.category === 'articles'; }).length;
    const byCat = {};
    edits.forEach(function (e) { if (e.category) byCat[e.category] = (byCat[e.category] || 0) + 1; });
    let dominant = null, max = 0;
    Object.keys(byCat).forEach(function (k) { if (byCat[k] > max) { max = byCat[k]; dominant = k; } });
    return {
      words: w, sentences: s, clauses: c, errors: edits.length, art: art,
      per100: w ? Math.round(edits.length / w * 1000) / 10 : null,
      art100: w ? Math.round(art / w * 1000) / 10 : null,
      clausesPerSentence: Math.round(c / s * 100) / 100,
      wpm: minutes && w ? Math.round(w / minutes) : null,
      dominant: dominant, byCat: byCat
    };
  }

  /** Record one check. kind: 'free' | 'translate' | 'tutor'. */
  function log(text, edits, opts) {
    opts = opts || {};
    const m = measure(text, edits, opts.minutes);
    const row = {
      t: today(), kind: opts.kind || 'free', offline: !!opts.offline,
      words: m.words, errors: m.errors, art: m.art, per100: m.per100, art100: m.art100,
      cps: m.clausesPerSentence, wpm: m.wpm, dominant: m.dominant, byCat: m.byCat,
      baseline: rows.length === 0
    };
    rows.push(row);
    if (rows.length > MAX) rows.splice(1, rows.length - MAX);   // keep the baseline
    save();
    return row;
  }

  function all() { return rows.slice(); }
  function baseline() { return rows[0] || null; }
  function latest(n) { return rows.slice(-(n || 1)); }

  /** Mean of the last n rows' per100 / art100 / cps — the block-end view. */
  function recent(n) {
    const r = rows.slice(-(n || 3));
    if (!r.length) return null;
    const mean = function (k) {
      const xs = r.map(function (x) { return x[k]; }).filter(function (x) { return x != null; });
      return xs.length ? Math.round(xs.reduce(function (a, b) { return a + b; }, 0) / xs.length * 10) / 10 : null;
    };
    return { n: r.length, per100: mean('per100'), art100: mean('art100'), cps: mean('cps'), words: mean('words'), wpm: mean('wpm') };
  }

  /** The plan's reading of the numbers, as a sentence key. */
  function verdict() {
    const b = baseline(), r = recent(3);
    if (!b || !r || rows.length < 4) return null;
    const errDown = r.per100 != null && b.per100 != null && r.per100 <= b.per100 * 0.85;
    const clUp = r.cps >= b.cps * 1.1;
    if (errDown && clUp) return 'working';
    if (errDown && !clUp) return 'safe';
    if (!errDown && clUp) return 'stretching';
    return 'flat';
  }

  function reset() { rows = []; save(); }
  function exportState() { return JSON.stringify(rows); }
  function importState(json) {
    const p = JSON.parse(json);
    if (!Array.isArray(p)) throw new Error('Not a tracking file.');
    rows = p; save();
  }

  return {
    CODES: CODES, codeOf: function (cat) { return CODE_OF[cat] || null; },
    words: words, sentences: sentences, clauses: clauses, measure: measure,
    log: log, all: all, baseline: baseline, latest: latest, recent: recent, verdict: verdict,
    reset: reset, exportState: exportState, importState: importState, today: today
  };
})();
