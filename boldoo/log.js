/* The study log (ADR-0016 addendum): the plan's daily habit sheet.
 *
 * One entry per calendar day: minutes PRODUCED (written or spoken — reading
 * alone does not count), which task, hand-marked error codes from the
 * day's transcript or tutor session, and one line on what was hard.
 *
 * This is a habit record, not a progress measure. It answers "did I show
 * up and what did I mark", never "am I improving" — that question belongs
 * to Ахиц (srs.js stats, track.js). So there is no streak here: the plan's
 * own rule is the two-day rule — never skip twice running — and that is
 * the only habit signal shown.
 *
 * Dates are local calendar days (a shift worker's "today" is the day they
 * are living in, not UTC's).
 */
window.LOG = (function () {
  'use strict';

  const KEY = 'boldoo.log.v1';
  const WINDOW = 14;
  const TARGET = 30;         // minutes; the bar fills at this
  const TASKS = ['Drill', 'Writing', 'Speaking', 'Reading'];
  const CODES = (window.TRACK && Object.keys(window.TRACK.CODES)) ||
    ['ART', 'PREP', 'WO', 'IQ', 'TNS', 'APO', 'COLL', 'SVA', 'WF'];

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || '{"entries":{}}');
      if (!d.entries) d.entries = {};
      return d;
    } catch (e) { return { entries: {} }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* */ } }
  let data = load();

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fromIso(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function today() { return iso(new Date()); }
  function shift(n, from) {
    const d = from ? fromIso(from) : new Date();
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function blank() { return { min: 0, task: '', errors: {}, note: '' }; }

  function get(day) { return data.entries[day] || null; }
  function put(day, entry) {
    if (!entry || !(entry.min > 0)) return false;
    data.entries[day] = { min: Math.max(0, Number(entry.min) || 0), task: entry.task || '',
                          errors: entry.errors || {}, note: String(entry.note || '').slice(0, 120) };
    save();
    return true;
  }
  function clear(day) { const had = !!data.entries[day]; delete data.entries[day]; save(); return had; }

  function days(n) {
    const out = [];
    for (let i = 0; i < (n || WINDOW); i++) out.push(shift(-i));
    return out;
  }
  function marks(entry) {
    return Object.keys((entry && entry.errors) || {}).reduce(function (a, k) { return a + entry.errors[k]; }, 0);
  }

  /** The window's totals. No streak — see the header. */
  function totals(n) {
    const ds = days(n);
    const logged = ds.filter(function (d) { return get(d) && get(d).min > 0; });
    const mins = logged.reduce(function (a, d) { return a + get(d).min; }, 0);
    const mk = ds.reduce(function (a, d) { return a + marks(get(d)); }, 0);
    return { days: ds.length, logged: logged.length, minutes: mins,
             marksPerSession: logged.length ? Math.round(mk / logged.length * 10) / 10 : 0 };
  }

  /** Two-day rule: were yesterday and the day before both empty? (Today is still open.) */
  function twoDayBreach() {
    const y = get(shift(-1)), yy = get(shift(-2));
    return !(y && y.min > 0) && !(yy && yy.min > 0) && Object.keys(data.entries).length > 0;
  }

  /** Codes ranked by marks in the window. */
  function rank(n) {
    const tally = {};
    days(n).forEach(function (d) {
      const e = get(d);
      if (!e) return;
      Object.keys(e.errors || {}).forEach(function (k) { tally[k] = (tally[k] || 0) + e.errors[k]; });
    });
    return Object.keys(tally).map(function (k) { return [k, tally[k]]; })
      .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
  }

  /**
   * The plan's §5 fossilisation detector: a code with marks in each of the
   * last four 7-day weeks. Returns those codes.
   */
  function persistent() {
    const weeks = [0, 1, 2, 3].map(function (w) {
      const t = {};
      for (let i = w * 7; i < w * 7 + 7; i++) {
        const e = get(shift(-i));
        if (e) Object.keys(e.errors || {}).forEach(function (k) { if (e.errors[k]) t[k] = true; });
      }
      return t;
    });
    return CODES.filter(function (c) { return weeks.every(function (t) { return t[c]; }); });
  }

  function reset() { data = { entries: {} }; save(); }
  function exportState() { return JSON.stringify(data); }
  function importState(json) {
    const p = JSON.parse(json);
    if (!p || typeof p !== 'object' || Array.isArray(p) || !p.entries || typeof p.entries !== 'object') throw new Error('Not a study-log file.');
    data = p; save();
  }

  return {
    TASKS: TASKS, CODES: CODES, TARGET: TARGET, WINDOW: WINDOW,
    iso: iso, fromIso: fromIso, today: today, shift: shift, blank: blank,
    get: get, put: put, clear: clear, days: days, marks: marks,
    totals: totals, twoDayBreach: twoDayBreach, rank: rank, persistent: persistent,
    reset: reset, exportState: exportState, importState: importState
  };
})();
