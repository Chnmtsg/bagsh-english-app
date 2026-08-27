/* The corrector (ADR-0015): the ONE place Small Step talks to a model.
 *
 * The standing rule of the whole repository is kept here: THE MODEL NEVER
 * PRODUCES THE ERROR LIST. It is asked for two things and nothing else:
 *
 *   1. correct(text)      → the same text with only clear errors fixed
 *                           (prompts/corrector.md, ported verbatim)
 *   2. label(text, edits) → a category, from a CLOSED enum, for each edit
 *                           that CODE has already computed
 *
 * The edit list itself comes from diff() below — a token alignment of the
 * learner's text against the correction, the same algorithm as
 * src/nodes/diff.py. A mis-labelled edit is a misfiled drill; an invented
 * error is impossible by construction.
 *
 * Transport is a plain fetch to the Messages API with the learner's own
 * key. There is no SDK because there is no bundler; there is no server
 * because there is no server. The key lives in localStorage under its own
 * name and is never part of a progress export.
 */
window.CORRECT = (function () {
  'use strict';

  const KEY_STORE = 'boldoo.apikey.v1';
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-opus-5';
  const VERSION = '2023-06-01';
  const TAX = (window.BOLDOO_TAXONOMY && window.BOLDOO_TAXONOMY.categories) || {};
  const PATTERNS = (window.BOLDOO_PATTERNS && window.BOLDOO_PATTERNS.patterns) || [];

  // --------------------------------------------------------------- key
  function getKey() {
    try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function setKey(k) {
    try {
      if (k) localStorage.setItem(KEY_STORE, String(k).trim());
      else localStorage.removeItem(KEY_STORE);
    } catch (e) { /* blocked storage */ }
  }
  function enabled() { return !!getKey(); }

  // ----------------------------------------------------------- matcher
  // Port of src/nodes/matcher.py. Standing rule 2: code before model. The
  // deterministic patterns run first, at zero cost and zero hallucination
  // risk; each carries its category and curated explanation from the
  // pattern file, so these edits never go near the labeller either.
  let compiled = null;
  function compiledPatterns() {
    if (compiled) return compiled;
    compiled = [];
    PATTERNS.forEach(function (p) {
      try { compiled.push({ p: p, re: new RegExp(p.find, p.flags + 'g') }); } catch (e) { /* skip */ }
    });
    return compiled;
  }

  /** $1..$9 from the match groups. Re-running the regex on m[0] alone would
   *  lose a lookahead/lookbehind context and miss its own match. */
  function expand(template, m) {
    return template.replace(/\$(\d)/g, function (_, n) { return m[+n] || ''; });
  }

  /** Pattern edits, first pattern wins an overlapping span, sorted by start. */
  function match(text) {
    const edits = [], claimed = [];
    compiledPatterns().forEach(function (cp) {
      cp.re.lastIndex = 0;
      let m;
      while ((m = cp.re.exec(text)) !== null) {
        if (m[0] === '') { cp.re.lastIndex += 1; continue; }
        const start = m.index, end = m.index + m[0].length;
        if (claimed.some(function (c) { return c[0] < end && start < c[1]; })) continue;
        const corrected = expand(cp.p.replace, m);
        if (corrected === m[0]) continue;
        claimed.push([start, end]);
        // Narrow the edit to the tokens that change, so the repair blanks
        // "a", not the whole matched phrase. Falls back to the full match
        // when the change is not a single contiguous span.
        const sub = diff(m[0], corrected);
        const e = sub.length === 1
          ? { original: sub[0].original, corrected: sub[0].corrected, start: start + sub[0].start, end: start + sub[0].end }
          : { original: m[0], corrected: corrected, start: start, end: end };
        e.source = 'pattern'; e.category = cp.p.category; e.explanation = cp.p.explanation; e.patternId = cp.p.id;
        edits.push(e);
      }
    });
    edits.sort(function (a, b) { return a.start - b.start; });
    return edits;
  }

  // -------------------------------------------------------------- diff
  // Port of src/nodes/diff.py. Tokens are words (with internal apostrophes)
  // or single punctuation marks; spans are character offsets into `text`.
  const TOKEN = /[\p{L}\p{N}_]+(?:'[\p{L}\p{N}_]+)*|[^\p{L}\p{N}_\s]/gu;

  function tokenize(text) {
    const tokens = [], spans = [];
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text)) !== null) {
      tokens.push(m[0]);
      spans.push([m.index, m.index + m[0].length]);
    }
    return { tokens: tokens, spans: spans };
  }

  /**
   * Longest-common-subsequence alignment of two token lists, returned as
   * difflib-style opcodes [op, a0, a1, b0, b1]. For sentence-length inputs
   * this matches SequenceMatcher's output in every case the tests cover;
   * the guarantee that matters is the same either way — every non-equal
   * block is a real difference between the two texts.
   */
  function opcodes(a, b) {
    const n = a.length, m = b.length;
    const L = [];
    for (let i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    function push(op, a0, a1, b0, b1) {
      const last = ops[ops.length - 1];
      if (last && last[0] === op && last[2] === a0 && last[4] === b0) { last[2] = a1; last[4] = b1; }
      else ops.push([op, a0, a1, b0, b1]);
    }
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { push('equal', i, i + 1, j, j + 1); i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { push('insert', i, i, j, j + 1); j++; }
      else { push('delete', i, i + 1, j, j); i++; }
    }
    // Merge an adjacent delete+insert into a replace, as difflib reports it.
    const out = [];
    for (let k = 0; k < ops.length; k++) {
      const cur = ops[k], nxt = ops[k + 1];
      if (nxt && cur[0] !== 'equal' && nxt[0] !== 'equal' && cur[0] !== nxt[0]) {
        out.push(['replace', Math.min(cur[1], nxt[1]), Math.max(cur[2], nxt[2]),
                  Math.min(cur[3], nxt[3]), Math.max(cur[4], nxt[4])]);
        k++;
      } else out.push(cur);
    }
    return out;
  }

  /**
   * Edits from original → corrected. Never from a model. A model edit whose
   * span overlaps a pattern edit is dropped — the pattern already owns that
   * span, with curated wording (src/nodes/diff.py does the same).
   */
  function diff(original, corrected, patternEdits) {
    const owned = (patternEdits || []).map(function (e) { return [e.start, e.end]; });
    const A = tokenize(original), B = tokenize(corrected);
    const edits = [];
    opcodes(A.tokens, B.tokens).forEach(function (op) {
      if (op[0] === 'equal') return;
      let start, end;
      if (op[0] === 'insert') {
        start = end = op[1] < A.spans.length ? A.spans[op[1]][0] : original.length;
      } else {
        start = A.spans[op[1]][0];
        end = A.spans[op[2] - 1][1];
      }
      const overlaps = owned.some(function (o) {
        return start === end ? (o[0] <= start && start <= o[1]) : (o[0] < end && start < o[1]);
      });
      if (overlaps) return;
      edits.push({
        source: 'model',
        original: original.slice(start, end),
        corrected: B.tokens.slice(op[3], op[4]).join(' '),
        start: start, end: end
      });
    });
    return edits;
  }

  // ----------------------------------------------------------- prompts
  // prompts/corrector.md v1.0.0, verbatim. Versioned so a stored item can
  // say which wording produced it.
  const CORRECTOR_VERSION = '1.0.0';
  const CORRECTOR = [
    'You are a minimal-edit corrector of English written by Mongolian learners.',
    'You receive a short piece of English the learner wrote while translating a',
    'Mongolian sentence. You return the same text with ONLY clear grammatical,',
    'spelling, capitalisation and punctuation errors fixed.',
    '',
    '## Absolute rules',
    '',
    '1. **Minimum edits.** Change only what is wrong. If a sentence is correct,',
    '   return it byte-identical — every character, including its punctuation.',
    '2. **Never add content. Never delete content.** The corrected text says',
    '   exactly what the learner said, nothing more, nothing less.',
    '3. **Never improve style.** Plain-but-correct stays plain. Do not upgrade',
    '   vocabulary, do not reorder correct sentences, do not vary word choice.',
    '4. **Never merge or split sentences**, except where the ONLY correct fix for',
    '   a comma splice is a full stop.',
    "5. **Preserve the learner's voice.** They must recognise their own writing.",
    '6. Mongolian words mixed into the text are content, not errors. Leave them',
    '   exactly as written.',
    '7. **Flag ambiguity instead of guessing.** If you cannot tell what the',
    '   learner meant, leave that part unchanged and describe the ambiguity in an',
    '   <ambiguity> tag.',
    '8. Register (e.g. "I want" vs "I\'d like") is NOT an error. Do not change it.',
    '9. Do not list, count, or explain errors. You output corrected text only —',
    '   another system computes the edit list.',
    '10. The Mongolian source sentence is given for meaning only. Do not translate',
    '    it yourself; do not change the learner\'s text to match it more closely',
    '    if what they wrote is correct English.',
    '',
    '## Output format',
    '',
    'Return exactly:',
    '',
    '<corrected>',
    '...the corrected text...',
    '</corrected>',
    '',
    'and, only when needed, one or more:',
    '',
    '<ambiguity>...one sentence describing what is unclear...</ambiguity>'
  ].join('\n');

  const LABELLER_VERSION = '1.0.0';
  function labellerPrompt() {
    const rules = Object.keys(TAX).map(function (c) {
      return '- `' + c + '`: ' + (TAX[c].rule_b1 || '');
    }).join('\n');
    return [
      'You are the error tutor for a Mongolian learner of English at level A2.',
      "You receive edits that were ALREADY computed by comparing the learner's",
      'text with its correction. Your job is to label each edit — nothing else.',
      '',
      '## Absolute rules',
      '',
      '1. You may NOT add, remove, or dispute an edit. Every edit you receive gets',
      '   exactly one label.',
      '2. `category` must be one of the closed list below. NEVER invent a category.',
      '3. Do not explain. The approved rule wording is shown to the learner by',
      '   another system.',
      '',
      '## Categories',
      '',
      rules,
      '',
      '## Output',
      '',
      'JSON array only, one object per edit, same order as given:',
      '',
      '[{"index": 0, "category": "articles"}]'
    ].join('\n');
  }

  // --------------------------------------------------------- transport
  function call(system, user, maxTokens, effort) {
    const key = getKey();
    if (!key) return Promise.reject(new Error('no-key'));
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': VERSION,
        // Required for a browser origin to call the API directly. The key is
        // the learner's own, on the learner's own device.
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: system,
        output_config: { effort: effort || 'low' },
        messages: [{ role: 'user', content: user }]
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          const err = new Error('api-' + res.status);
          err.status = res.status; err.body = t;
          throw err;
        });
      }
      return res.json();
    }).then(function (msg) {
      if (msg.stop_reason === 'refusal') throw new Error('refusal');
      return (msg.content || []).filter(function (b) { return b.type === 'text'; })
        .map(function (b) { return b.text; }).join('');
    });
  }

  function parseCorrected(raw) {
    const m = /<corrected>([\s\S]*?)<\/corrected>/.exec(raw);
    if (!m) throw new Error('no-corrected-tag');
    const amb = [];
    const re = /<ambiguity>([\s\S]*?)<\/ambiguity>/g;
    let a;
    while ((a = re.exec(raw)) !== null) amb.push(a[1].trim());
    return { corrected: m[1].replace(/^\n/, '').replace(/\n$/, ''), ambiguity: amb };
  }

  function parseLabels(raw, n) {
    const m = /\[[\s\S]*\]/.exec(raw);
    if (!m) throw new Error('no-json');
    const arr = JSON.parse(m[0]);
    const out = new Array(n).fill(null);
    arr.forEach(function (row) {
      const i = row && row.index;
      if (typeof i === 'number' && i >= 0 && i < n && TAX[row.category]) out[i] = row.category;
    });
    return out;
  }

  // ---------------------------------------------------------- pipeline
  /** Apply pattern edits to the text — the corrected form with no model. */
  function applyEdits(text, edits) {
    let out = '', pos = 0;
    edits.forEach(function (e) {
      let ins = e.corrected;
      if (e.start === e.end && ins) {
        // an insertion between tokens needs the spaces the tokens lost
        if (e.start > 0 && !/\s/.test(text[e.start - 1])) ins = ' ' + ins;
        if (e.start < text.length && !/\s/.test(text[e.start])) ins = ins + ' ';
      }
      out += text.slice(pos, e.start) + ins; pos = e.end;
    });
    // a deleted word leaves two spaces behind; a deletion before punctuation leaves one
    return (out + text.slice(pos)).replace(/ {2,}/g, ' ').replace(/ ([.,;!?])/g, '$1');
  }

  /**
   * The zero-cost check: patterns only. Works offline and with no key.
   * Same result shape as check(), with `offline: true`.
   */
  function checkOffline(text) {
    const clean = String(text).trim();
    const pe = match(clean);
    return { text: clean, corrected: applyEdits(clean, pe), edits: pe, ambiguity: [],
             offline: true, versions: { patterns: (window.BOLDOO_PATTERNS || {}).version || 0 } };
  }

  /**
   * Correct one draft. Resolves to
   *   { text, corrected, edits:[{source,original,corrected,start,end,category}],
   *     ambiguity:[...], versions:{...} }
   * Order: patterns (code) → corrector (model) → diff (code) → labels (model,
   * only for model edits). `category` on a model edit is the one
   * model-labelled field; it is null when the label was missing or not in
   * the enum. Pattern edits carry their category and explanation from the
   * pattern file.
   */
  function check(text, sourceMn) {
    const clean = String(text).trim();
    if (!clean) return Promise.reject(new Error('empty'));
    const pe = match(clean);
    const user = (sourceMn ? 'Mongolian source (for meaning only):\n' + sourceMn + '\n\n' : '') +
      "Learner's English:\n" + clean;
    return call(CORRECTOR, user, 2048, 'medium').then(function (raw) {
      const p = parseCorrected(raw);
      const me = diff(clean, p.corrected, pe);
      const all = pe.concat(me).sort(function (a, b) { return a.start - b.start; });
      const base = { text: clean, corrected: p.corrected, edits: all, ambiguity: p.ambiguity,
                     versions: { corrector: CORRECTOR_VERSION, labeller: LABELLER_VERSION,
                                 patterns: (window.BOLDOO_PATTERNS || {}).version || 0 } };
      if (!me.length) return base;
      const listing = me.map(function (e, i) {
        return i + '. "' + e.original + '" → "' + e.corrected + '"';
      }).join('\n');
      return call(labellerPrompt(), 'Text:\n' + clean + '\n\nEdits:\n' + listing, 512, 'low')
        .then(function (raw2) {
          const labels = parseLabels(raw2, me.length);
          me.forEach(function (e, i) { e.category = labels[i]; });
          return base;
        }).catch(function () {
          // A failed labelling is not a failed correction: the diff stands,
          // the items just cannot be queued until they have a category.
          me.forEach(function (e) { e.category = null; });
          return base;
        });
    });
  }

  return {
    getKey: getKey, setKey: setKey, enabled: enabled,
    tokenize: tokenize, diff: diff, opcodes: opcodes, match: match, applyEdits: applyEdits,
    checkOffline: checkOffline, patternCount: function () { return compiledPatterns().length; },
    parseCorrected: parseCorrected, parseLabels: parseLabels,
    check: check,
    MODEL: MODEL,
    CORRECTOR_VERSION: CORRECTOR_VERSION, LABELLER_VERSION: LABELLER_VERSION,
    _call: call
  };
})();
