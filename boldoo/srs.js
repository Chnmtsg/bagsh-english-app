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
 * Three more rules, added from the evidence review (LEARNING.md):
 *
 *   Review before new. Whatever is due is served first; new items only fill
 *   what review leaves, and come from one unit at a time (block the
 *   introduction, interleave the review — Rohrer & Taylor 2007; Nakata &
 *   Suzuki 2019 for the SLA caveat).
 *
 *   A lapse is relearning, not a reset; four lapses make a leech. A leech is
 *   not quizzed again until its page has been re-read — more testing of
 *   absent knowledge is not a desirable difficulty (Bjork 1994).
 *
 *   Only first attempts are scored, and only delayed ones answer "am I
 *   improving?". In-session performance is not learning (Soderstrom & Bjork
 *   2015), so stats() reports delayed first-attempt accuracy.
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
  const LEECH_LAPSES = 4;      // lapses before an item is re-taught, not re-tested
  const DELAYED_DAYS = 7;      // an answer only counts as "delayed" past this gap
  const MATURE_BOX = 4;        // LADDER[4] = 16 days — the productive-mature bar
  const LOG_MAX = 4000;        // first-attempt log cap; oldest rows drop off

  function today() {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const st = raw ? JSON.parse(raw) : { items: {}, log: [] };
      if (!st.log) st.log = [];
      if (!st.fluency) st.fluency = [];
      return st;
    } catch (e) {
      return { items: {}, log: [], fluency: [] };
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
        lapses: 0,
        leech: false,    // stopped being quizzed; cleared by re-reading the page
        typed: false     // was the last correct answer produced, not recognised?
      };
    }
    return state.items[id];
  }

  /**
   * Record one graded FIRST attempt. Returns the updated record.
   *
   * opts.typed — the answer was produced (typed), not picked from options.
   * Same-session re-asks of a missed item must NOT come through here: they
   * are relearning, and scoring them would let a learner "fix" the record by
   * answering the thing they were just shown.
   */
  function grade(id, correct, opts) {
    opts = opts || {};
    const r = rec(id);
    const t = today();
    // Interval the item was scheduled at when this answer was given. For a
    // never-seen item it is 0; for a review it is the gap the scheduler set.
    const ivl = r.seen ? LADDER[r.box] : 0;
    r.seen += 1;
    if (correct) {
      r.right += 1;
      if (r.days.indexOf(t) === -1) r.days.push(t);
      r.box = Math.min(r.box + 1, LADDER.length - 1);
      r.typed = !!opts.typed;
    } else {
      r.wrong += 1;
      if (r.box > 0) r.lapses += 1;
      // Drop back, but not all the way to zero once something has been learnt.
      r.box = r.box > 2 ? 2 : 0;
      if (r.lapses >= LEECH_LAPSES) r.leech = true;
    }
    r.due = t + LADDER[r.box] * DAY;
    state.log.push({ t: t, id: id, ok: correct ? 1 : 0, ivl: ivl, typed: opts.typed ? 1 : 0 });
    if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
    save(state);
    return r;
  }

  function isLeech(id) {
    const r = state.items[id];
    return !!r && !!r.leech;
  }

  function leeches(ids) {
    return ids.filter(isLeech);
  }

  /**
   * The page has been re-read: its leeches may be quizzed again, due today.
   * Reading is not retrieval, so the record is otherwise untouched — the
   * item must still earn its three days, and the lapse clock restarts.
   */
  function reteach(ids) {
    let n = 0;
    ids.forEach(function (id) {
      const r = state.items[id];
      if (r && r.leech) { r.leech = false; r.due = today(); r.lapses = 0; n += 1; }
    });
    if (n) save(state);
    return n;
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

  /**
   * Due reviews first (most overdue first), then never-seen items, then
   * whatever is scheduled furthest in the past. Leeches are never picked.
   * Ties broken deterministically. Used for the write prompts and as the
   * fallback; study sessions use plan() below.
   */
  function pick(ids, n) {
    const t = today();
    const scored = [];
    ids.forEach(function (id, i) {
      const r = state.items[id];
      if (r && r.leech) return;
      if (!r || r.seen === 0) { scored.push({ id: id, k: 1, overdue: 0, i: i }); return; }
      if (r.due <= t) { scored.push({ id: id, k: 2, overdue: t - r.due, i: i }); return; }
      scored.push({ id: id, k: 0, overdue: t - r.due, i: i });
    });
    scored.sort(function (a, b) {
      if (a.k !== b.k) return b.k - a.k;
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      return a.i - b.i;
    });
    return scored.slice(0, n).map(function (s) { return s.id; });
  }

  /**
   * Round-robin over groups so that consecutive items come from different
   * units wherever possible. Stable within a group.
   */
  function interleave(ids, keyOf) {
    const groups = [], byKey = {};
    ids.forEach(function (id) {
      const k = keyOf(id);
      if (!byKey[k]) { byKey[k] = []; groups.push(byKey[k]); }
      byKey[k].push(id);
    });
    const out = [];
    let left = ids.length;
    while (left > 0) {
      groups.forEach(function (g) {
        if (g.length) { out.push(g.shift()); left -= 1; }
      });
    }
    return out;
  }

  /**
   * Build a session of up to n items.
   *
   *   review — everything due, most overdue first, interleaved across units
   *   fresh  — never-seen items fill what review leaves, from ONE unit only
   *            (the first unit in the given order that still has any)
   *
   * newCap, if given, limits fresh items once there is anything to review
   * at all. On a cold start (nothing due) the whole session may be new.
   *
   * keyOf(id) names the unit. Leeches are excluded from both lists; the
   * caller surfaces them separately as "read this page again".
   */
  function plan(ids, n, keyOf, newCap) {
    const t = today();
    const due = [], fresh = [];
    ids.forEach(function (id, i) {
      const r = state.items[id];
      if (r && r.leech) return;
      if (!r || r.seen === 0) fresh.push(id);
      else if (r.due <= t) due.push({ id: id, overdue: t - r.due, i: i });
    });
    due.sort(function (a, b) {
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      return a.i - b.i;
    });
    const review = interleave(due.slice(0, n).map(function (d) { return d.id; }), keyOf);
    let room = Math.max(0, n - review.length);
    if (review.length && newCap != null) room = Math.min(room, newCap);
    let picked = [];
    if (room && fresh.length) {
      const unit = keyOf(fresh[0]);
      picked = fresh.filter(function (id) { return keyOf(id) === unit; }).slice(0, room);
    }
    return { review: review, fresh: picked, queue: review.concat(picked),
             dueTotal: due.length, freshTotal: fresh.length };
  }

  // ------------------------------------------------------------ fluency
  /** Mastered and not a leech: the fluency pool. */
  function fluencyPool(ids) {
    return ids.filter(function (id) {
      const r = state.items[id];
      return !!r && !r.leech && r.days.length >= MASTERY_DAYS;
    });
  }

  /** A timed answer on a mastered item. Never touches the SRS record. */
  function fluency(id, correct, ms) {
    state.fluency.push({ t: today(), id: id, ok: correct ? 1 : 0, ms: Math.max(0, Math.round(ms)) });
    if (state.fluency.length > LOG_MAX) state.fluency.splice(0, state.fluency.length - LOG_MAX);
    save(state);
  }

  function median(xs) {
    if (!xs.length) return null;
    const a = xs.slice().sort(function (x, y) { return x - y; });
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /**
   * Median milliseconds to a correct answer, the last 20 against the 40
   * before them. Should fall as a power law if anything is automatizing
   * (DeKeyser 1997). Flat means the items are too varied, or nothing is.
   */
  function fluencyStats() {
    const okRows = state.fluency.filter(function (f) { return f.ok; });
    const recent = okRows.slice(-20).map(function (f) { return f.ms; });
    const earlier = okRows.slice(0, -20).slice(-40).map(function (f) { return f.ms; });
    return { answers: state.fluency.length, recentMs: median(recent), earlierMs: median(earlier) };
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

  /**
   * The only function allowed to answer "am I improving?".
   *
   *   mastered  — correct on MASTERY_DAYS distinct days
   *   delayed   — first-attempt accuracy on answers whose scheduled gap was
   *               at least DELAYED_DAYS. Grinding an item shortens its gap,
   *               so it cannot enter this figure. The honest headline.
   *   mature    — items at an interval of 16+ days whose last correct answer
   *               was typed. Recognition does not count (Webb 2005).
   *   accuracy  — raw, all first attempts. Shown per unit; never the headline.
   */
  function stats(ids) {
    let seen = 0, mastered = 0, right = 0, total = 0, learning = 0, mature = 0, leech = 0;
    const inPool = {};
    ids.forEach(function (id) {
      inPool[id] = true;
      const r = state.items[id];
      if (!r || r.seen === 0) return;
      seen += 1;
      right += r.right;
      total += r.seen;
      if (r.leech) leech += 1;
      if (r.days.length >= MASTERY_DAYS) mastered += 1;
      else learning += 1;
      if (r.box >= MATURE_BOX && r.typed) mature += 1;
    });
    let dRight = 0, dTotal = 0;
    state.log.forEach(function (row) {
      if (!inPool[row.id] || row.ivl < DELAYED_DAYS) return;
      dTotal += 1;
      dRight += row.ok;
    });
    return {
      known: ids.length,
      touched: seen,
      untouched: ids.length - seen,
      learning: learning,
      mastered: mastered,
      mature: mature,
      leeches: leech,
      delayed: dTotal ? dRight / dTotal : null,
      delayedAnswers: dTotal,
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
    state = { items: {}, log: [], fluency: [] };
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
    if (!parsed.log) parsed.log = [];
    if (!parsed.fluency) parsed.fluency = [];
    state = parsed;
    save(state);
  }

  return {
    grade: grade,
    pick: pick,
    plan: plan,
    interleave: interleave,
    isDue: isDue,
    isMastered: isMastered,
    isLeech: isLeech,
    leeches: leeches,
    reteach: reteach,
    fluencyPool: fluencyPool,
    fluency: fluency,
    fluencyStats: fluencyStats,
    dueCount: dueCount,
    dueBreakdown: dueBreakdown,
    stats: stats,
    unitStats: unitStats,
    record: function (id) { return state.items[id] || null; },
    reset: reset,
    exportState: exportState,
    importState: importState,
    MASTERY_DAYS: MASTERY_DAYS,
    LEECH_LAPSES: LEECH_LAPSES,
    DELAYED_DAYS: DELAYED_DAYS,
    LADDER: LADDER,
    today: today
  };
})();
