/* The learner's-own-errors loop (ADR-0015), with no network.
 *
 *   node tests/test_errors.js
 *
 * 1. diff() agrees with Python difflib on tests/diff_cases.json (generated
 *    with the same tokenizer as src/nodes/diff.py).
 * 2. The queue follows the rules of src/error_queue.py.
 * 3. CORRECT.check() runs end to end against a stubbed fetch, and the model
 *    text never becomes an edit — the diff does.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let store = {};
const fetchCalls = [];
let fetchQueue = [];
const sandbox = {
  console,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  fetch(url, opts) {
    fetchCalls.push({ url, opts: JSON.parse(opts.body), headers: opts.headers });
    const next = fetchQueue.shift();
    if (!next) return Promise.reject(new TypeError('network'));
    if (typeof next === 'number') {
      return Promise.resolve({ ok: false, status: next, text: () => Promise.resolve('{}') });
    }
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ stop_reason: 'end_turn', content: [{ type: 'text', text: next }] })
    });
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
['content/taxonomy.js', 'correct.js', 'errors.js'].forEach(load);
const { CORRECT } = sandbox;

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
}
function group(t) { console.log('\n' + t); }

// ------------------------------------------------------------------ diff
group('diff parity with difflib');
JSON.parse(fs.readFileSync(path.join(__dirname, 'diff_cases.json'), 'utf8')).forEach(c => {
  eq('diff: ' + c.o, CORRECT.diff(c.o, c.c), c.edits);
});
eq('identical text has no edits', CORRECT.diff('Hello there.', 'Hello there.'), []);
ok('every edit is a real substring',
   CORRECT.diff('I goed home', 'I went home').every(e => 'I goed home'.slice(e.start, e.end) === e.original));

group('parsing');
eq('corrected tag', CORRECT.parseCorrected('<corrected>\nI am a geologist.\n</corrected>'),
   { corrected: 'I am a geologist.', ambiguity: [] });
eq('ambiguity collected',
   CORRECT.parseCorrected('<corrected>x</corrected><ambiguity>one</ambiguity><ambiguity>two</ambiguity>').ambiguity,
   ['one', 'two']);
let threw = false; try { CORRECT.parseCorrected('no tags'); } catch (e) { threw = true; }
ok('missing tag throws', threw);
eq('labels from closed enum only',
   CORRECT.parseLabels('[{"index":0,"category":"articles"},{"index":1,"category":"made_up"}]', 2),
   ['articles', null]);
eq('labels tolerate prose around the JSON',
   CORRECT.parseLabels('Here: [{"index":0,"category":"copula"}] done', 1), ['copula']);

// ----------------------------------------------------------------- queue
group('queue: folding');
let E = sandbox.ERRQ;
const T = E.today(), DAY = 86400000;
const text = 'I am geologist. I go to school yesterday.';
const edits = CORRECT.diff(text, 'I am a geologist. I went to school yesterday.');
edits[0].category = 'articles'; edits[1].category = 'tense_aspect';
eq('two edits queued', E.fold(edits, 'e1', text), 2);
const art = E.item('articles:+a');
ok('insertion keyed on the inserted word', !!art);
eq('repair blanks the span in the learner\'s own sentence', art.prompt, 'I am _____geologist.');
eq('repair answer is the corrected chunk', art.answer, 'a');
eq('new item is due tomorrow, not today', art.due, T + DAY);
eq('nothing due today', E.due(3).length, 0);
eq('tense_aspect is untreatable', E.item('tense_aspect:go').treatable, false);
const unlabelled = CORRECT.diff('She have cat', 'She has a cat');
eq('unlabelled edits are not queued', E.fold(unlabelled, 'e2', 'She have cat'), 0);
eq('entries count anyway', E.summary().entries, 2);

group('queue: deletion repair');
const del = CORRECT.diff('I like the music', 'I like music'); del[0].category = 'articles';
E.fold(del, 'e3', 'I like the music');
const d = E.item('articles:the');
eq('deletion marks the extra word', d.prompt, 'I like ⟦the⟧ music');
eq('deletion answer is the sentence without it', d.answer, 'I like music');
eq('mode sentence', d.mode, 'sentence');

group('queue: drilling and graduation');
let raw = JSON.parse(store['boldoo.errors.v1']);
raw.items['articles:+a'].due = T; store['boldoo.errors.v1'] = JSON.stringify(raw); load('errors.js');
E = sandbox.ERRQ;
const dueNow = E.due(3);
eq('due item is the treatable article', dueNow.map(i => i.key), ['articles:+a']);
eq('untreatable never in due()', E.due(10).some(i => i.key === 'tense_aspect:go'), false);
eq('one per category', E.due(10).length, 1);
const drill = E.toDrill(dueNow[0]);
eq('drill kind', drill.kind, 'repair');
ok('drill carries the taxonomy rule', drill.explain.length > 10);
ok('drill accepts contractions', E.acceptable('I am not').indexOf("i'm not") !== -1);
E.record('articles:+a', true);
eq('one correct → drilling, box 1', [E.item('articles:+a').state, E.item('articles:+a').box], ['drilling', 1]);
raw = JSON.parse(store['boldoo.errors.v1']);
raw.items['articles:+a'].days = [T - 2 * DAY, T - DAY, T]; raw.items['articles:+a'].due = T;
store['boldoo.errors.v1'] = JSON.stringify(raw); load('errors.js'); E = sandbox.ERRQ;
// Two drafts (e2, e3) have been checked since the article error: clean = 2.
E.record('articles:+a', true);
eq('criterion + 2 clean entries → graduated', E.item('articles:+a').state, 'graduated');
eq('category row counts the graduation', E.summary().graduated, 1);
// A fresh error with the criterion met but NO clean drafts stays queued.
const fresh = CORRECT.diff('I am teacher', 'I am the teacher'); fresh[0].category = 'articles';
E.fold(fresh, 'eX', 'I am teacher');
raw = JSON.parse(store['boldoo.errors.v1']);
raw.items['articles:+the'].days = [T - 2 * DAY, T - DAY, T]; raw.items['articles:+the'].due = T;
store['boldoo.errors.v1'] = JSON.stringify(raw); load('errors.js'); E = sandbox.ERRQ;
E.record('articles:+the', true);
ok('criterion without clean drafts → not graduated', E.item('articles:+the').state !== 'graduated');
ok('missing a and missing the are different items', E.item('articles:+a') !== E.item('articles:+the'));

group('queue: relapse');
const again = CORRECT.diff('I am geologist', 'I am a geologist'); again[0].category = 'articles';
E.fold(again, 'e6', 'I am geologist');
const rel = E.item('articles:+a');
eq('relapse re-queues with a lapse', [rel.state, rel.lapses], ['queued', 1]);
eq('history kept', rel.seen, 2);

group('queue: untreatable exposure');
eq('the early untreatable item has already graduated by absence', E.item('tense_aspect:go').state, 'graduated');
const wc = CORRECT.diff('I did a photo', 'I took a photo'); wc[0].category = 'collocation';
E.fold(wc, 'e7', 'I did a photo');
raw = JSON.parse(store['boldoo.errors.v1']);
raw.items['collocation:did'].due = T; store['boldoo.errors.v1'] = JSON.stringify(raw); load('errors.js');
E = sandbox.ERRQ;
eq('exposure is the untreatable item', E.exposures(1).map(i => i.key), ['collocation:did']);
eq('untreatable never in due()', E.due(10).some(i => i.key === 'collocation:did'), false);
E.markShown('collocation:did');
ok('shown item pushed out', E.item('collocation:did').due > T);
eq('shown item never gains a day', E.item('collocation:did').days.length, 0);
E.fold([], 'e8', 'x'); E.fold([], 'e9', 'x');
ok('two clean drafts are not enough', E.item('collocation:did').state !== 'graduated');
E.fold([], 'e9b', 'x');
eq('untreatable graduates by absence alone after 3', E.item('collocation:did').state, 'graduated');

group('queue: leech and dispute');
const lk = CORRECT.diff('He go', 'He goes'); lk[0].category = 'verb_agreement';
E.fold(lk, 'e10', 'He go');
for (let i = 0; i < 4; i++) E.record('verb_agreement:go', false);
eq('four lapses → leech', E.item('verb_agreement:go').state, 'leech');
eq('leech not due', E.due(10).some(i => i.key === 'verb_agreement:go'), false);
E.clearLeech('verb_agreement:go');
eq('re-taught leech returns, lapses kept in history',
   [E.item('verb_agreement:go').state, E.item('verb_agreement:go').lapsesBeforeLesson], ['queued', 4]);
E.dispute('verb_agreement:go');
eq('disputed never due', E.due(10).some(i => i.key === 'verb_agreement:go'), false);
E.fold(lk, 'e11', 'He go');
eq('disputed stays disputed on recurrence', E.item('verb_agreement:go').state, 'disputed');

group('queue: old files load');
E.importState(JSON.stringify({ items: {} }));
eq('missing fields default', E.summary().entries, 0);

// -------------------------------------------------------------- pipeline
group('check() against a stubbed fetch');
CORRECT.setKey('sk-test');
fetchQueue = ['<corrected>\nI am a geologist.\n</corrected>', '[{"index":0,"category":"articles"}]'];
CORRECT.check('I am geologist.', 'Би геологич.').then(r => {
  eq('edits come from diff, not the model', r.edits.map(e => [e.original, e.corrected]), [['', 'a']]);
  eq('label applied', r.edits[0].category, 'articles');
  eq('two calls: corrector then labeller', fetchCalls.length, 2);
  ok('corrector is never asked for errors',
     fetchCalls[0].opts.system.indexOf('Do not list, count, or explain errors') !== -1);
  ok('labeller sees the closed list', fetchCalls[1].opts.system.indexOf('`copula`') !== -1);
  ok('browser header set', fetchCalls[0].headers['anthropic-dangerous-direct-browser-access'] === 'true');
  ok('key sent as x-api-key', fetchCalls[0].headers['x-api-key'] === 'sk-test');
  eq('model', fetchCalls[0].opts.model, 'claude-opus-5');
  ok('no sampling params sent', !('temperature' in fetchCalls[0].opts));
  ok('source Mongolian passed for meaning', fetchCalls[0].opts.messages[0].content.indexOf('Би геологич') !== -1);
  fetchQueue = ['<corrected>Hello.</corrected>'];
  return CORRECT.check('Hello.');
}).then(r => {
  eq('no edits → no labeller call', [r.edits.length, fetchCalls.length], [0, 3]);
  fetchQueue = ['<corrected>\nHe goes.\n</corrected>', 'not json'];
  return CORRECT.check('He go.');
}).then(r => {
  eq('labeller failure leaves the diff with null categories', r.edits.map(e => e.category), [null]);
  fetchQueue = [401];
  return CORRECT.check('x').then(() => ok('401 rejects', false), e => eq('401 surfaces', e.message, 'api-401'));
}).then(() => {
  CORRECT.setKey('');
  return CORRECT.check('x').then(() => ok('no key rejects', false), e => eq('no key surfaces', e.message, 'no-key'));
}).then(() => {
  ok('key removed from storage', !('boldoo.apikey.v1' in store));
  console.log('\n' + '-'.repeat(46));
  if (fail) { console.log('FAILURES (' + fail + '):'); failures.forEach(f => console.log('  ✗ ' + f)); }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
