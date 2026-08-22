/* Spaced repetition + progress.
 *
 * Two rules carried over from the Bagsh app, because they are the honest ones:
 *
 *   Mastery is a criterion, not an event. An item counts as mastered only when
 *   it has been answered correctly on three DIFFERENT days. One lucky answer is
 *   not knowing.
 *
 *   Habit numbers are never progress. Day counts and totals-seen exist to make
 *   the app usable; they may never answer "am I improving?". Only the mastery
 *   and accuracy figures in stats() may.
 *
 * State lives in localStorage. Nothing leaves the device.
 */
window.SRS = (function () {
  'use strict';

  const KEY = 'boldoo.srs.v1';
  const DAY = 86400000;

  // Interval ladder in days. Index = box.
  const LADDER = [0, 1, 3, 7, 16, 35, 90];
  const MASTERY_DAYS = 3;

  function today() {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { items: {}, log: [] };
    } catch (e) {
      return { items: {}, log: [] };
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode, quota, blocked storage — the session still works */
    }
  }

  let state = load();

  function rec(id) {
    if (!state.items[id]) {
      state.items[id] = {
        box: 0,
        due: 0,          // 0 = never studied, so it is due now
        seen: 0,
        right: 0,
        wrong: 0,
        days: [],        // distinct UTC-midnights answered correctly
        lapses: 0
      };
    }
    return state.items[id];
  }

  /** Record one graded answer. Returns the updated record. */
  function grade(id, correct) {
    const r = rec(id);
    const t = today();
    r.seen += 1;
    if (correct) {
      r.right += 1;
      if (r.days.indexOf(t) === -1) r.days.push(t);
      r.box = Math.min(r.box + 1, LADDER.length - 1);
    } else {
      r.wrong += 1;
      if (r.box > 0) r.lapses += 1;
      // Drop back, but not all the way to zero once something has been learnt.
      r.box = r.box > 2 ? 2 : 0;
    }
    r.due = t + LADDER[r.box] * DAY;
    save(state);
    return r;
  }

  function isMastered(id) {
    const r = state.items[id];
    return !!r && r.days.length >= MASTERY_DAYS;
  }

  function isDue(id) {
    const r = state.items[id];
    if (!r) return true;
    return r.due <= today();
  }

  /** Never-seen items first, then most overdue. Ties broken deterministically. */
  function pick(ids, n) {
    const t = today();
    const scored = ids.map(function (id, i) {
      const r = state.items[id];
      if (!r) return { id: id, k: 2, overdue: 0, i: i };
      if (r.days.length >= MASTERY_DAYS && r.due > t) return { id: id, k: 0, overdue: 0, i: i };
      return { id: id, k: r.due <= t ? 1 : 0, overdue: t - r.due, i: i };
    });
    scored.sort(function (a, b) {
      if (a.k !== b.k) return b.k - a.k;
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      return a.i - b.i;
    });
    return scored.slice(0, n).map(function (s) { return s.id; });
  }

  function dueCount(ids) {
    return ids.filter(isDue).length;
  }

  /**
   * "Due" lumps together two different things. Never-seen items are new work;
   * items whose interval has elapsed are review. Calling 300 untouched items
   * "300 to review" would overstate what the learner has actually started.
   */
  function dueBreakdown(ids) {
    const t = today();
    let fresh = 0, review = 0;
    ids.forEach(function (id) {
      const r = state.items[id];
      if (!r || r.seen === 0) fresh += 1;
      else if (r.due <= t) review += 1;
    });
    return { fresh: fresh, review: review, total: fresh + review };
  }

  /** The only function allowed to answer "am I improving?". */
  function stats(ids) {
    let seen = 0, mastered = 0, right = 0, total = 0, learning = 0;
    ids.forEach(function (id) {
      const r = state.items[id];
      if (!r || r.seen === 0) return;
      seen += 1;
      right += r.right;
      total += r.seen;
      if (r.days.length >= MASTERY_DAYS) mastered += 1;
      else learning += 1;
    });
    return {
      known: ids.length,
      touched: seen,
      untouched: ids.length - seen,
      learning: learning,
      mastered: mastered,
      accuracy: total ? right / total : null,
      answers: total
    };
  }

  function unitStats(unitId, ids) {
    const s = stats(ids);
    s.unitId = unitId;
    return s;
  }

  function reset() {
    state = { items: {}, log: [] };
    save(state);
  }

  function exportState() {
    return JSON.stringify(state, null, 2);
  }

  function importState(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.items) {
      throw new Error('Not a Boldoo progress file.');
    }
    state = parsed;
    save(state);
  }

  return {
    grade: grade,
    pick: pick,
    isDue: isDue,
    isMastered: isMastered,
    dueCount: dueCount,
    dueBreakdown: dueBreakdown,
    stats: stats,
    unitStats: unitStats,
    record: function (id) { return state.items[id] || null; },
    reset: reset,
    exportState: exportState,
    importState: importState,
    MASTERY_DAYS: MASTERY_DAYS,
    today: today
  };
})();
