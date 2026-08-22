/* User settings.
 *
 * Only settings that actually change behaviour live here. The design mock also
 * showed an audio toggle and a daily-reminder toggle; neither is implemented,
 * and a switch that does nothing is worse than no switch, so they are left out
 * until there is something behind them.
 *
 * masteryDays is deliberately NOT a setting. "Correct on three different days"
 * is the definition of mastery this app makes its claims against — letting the
 * learner set it to 1 would turn the progress figure back into a habit number.
 */
window.SETTINGS = (function () {
  'use strict';

  const KEY = 'boldoo.settings.v1';

  const DEFAULTS = {
    sessionLength: 6,      // the design's default sitting
    showEnglish: true,     // English gloss beside the Mongolian
    showSource: true,      // НОМ / ГАРЫН АВЛАГА / ХОЁУЛАА chips
    strictTyping: false,   // typed answers must match case and punctuation
    onboarded: false
  };

  const SESSION_CHOICES = [4, 6, 8, 12];

  function load() {
    let s;
    try {
      s = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {
      s = {};
    }
    const out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = (s && k in s) ? s[k] : DEFAULTS[k];
    });
    if (SESSION_CHOICES.indexOf(out.sessionLength) === -1) {
      out.sessionLength = DEFAULTS.sessionLength;
    }
    return out;
  }

  let state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* blocked storage */ }
  }

  return {
    all: function () { return state; },
    get: function (k) { return state[k]; },
    set: function (k, v) { state[k] = v; save(); return v; },
    toggle: function (k) { return this.set(k, !state[k]); },
    reset: function () { state = JSON.parse(JSON.stringify(DEFAULTS)); save(); },
    SESSION_CHOICES: SESSION_CHOICES,
    DEFAULTS: DEFAULTS
  };
})();
