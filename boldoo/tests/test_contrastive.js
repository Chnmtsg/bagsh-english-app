/* Tests for the contrastive-guide layer.
 *
 *   node tests/test_contrastive.js
 *
 * The guide is a second, independent source sitting alongside the book. This
 * suite checks that it stays separable from the book (own id namespace, own
 * citations, no shadowing), that every note is classified and sourced, and
 * that the drills it generates grade correctly.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let store = {};
const sandbox = {
  console,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

['content/lessons.js', 'content/contrastive.js', 'srs.js', 'exercises.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

const { BOLDOO, EX } = sandbox;
const CG = sandbox.BOLDOO_CONTRASTIVE;

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++;
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
}
function group(t) { console.log('\n' + t); }

// ------------------------------------------------------------------ shape
group('shape');

ok('guide loads', !!CG && Array.isArray(CG.units));
eq('guide contributes 7 units', CG.units.length, 7);
ok('guide cites its source file', !!CG.meta && !!CG.meta.file);

const bookIds = new Set(BOLDOO.units.map(u => u.id));

CG.units.forEach(u => {
  eq('guide unit ' + u.id + ' is labelled guide material', u.kind, 'guide');
  ok('guide unit ' + u.id + ' cites a section', !!u.src);
  ok('guide unit ' + u.id + ' has both titles', !!u.title_mn && !!u.title_en);
  ok('guide unit ' + u.id + ' has blocks', u.blocks.length > 0);
  ok('guide unit ' + u.id + ' claims no book pages',
     Array.isArray(u.pages) && u.pages.length === 0);
  ok('guide unit ' + u.id + ' is namespaced', u.id.indexOf('cg-') === 0);
  ok('guide unit ' + u.id + ' does not shadow a book unit', !bookIds.has(u.id));
});

// ------------------------------------------------------------------ notes
group('notes');

Object.keys(CG.notes).forEach(uid => {
  ok('note target ' + uid + ' is a real book unit', bookIds.has(uid));
  CG.notes[uid].forEach((n, i) => {
    const tag = uid + '#' + i;
    eq('note ' + tag + ' is a note block', n.t, 'note');
    ok('note ' + tag + ' is classified',
       ['warn', 'confirm', 'gap'].indexOf(n.kind) !== -1, n.kind);
    ok('note ' + tag + ' cites a section', !!n.src);
    ok('note ' + tag + ' is bilingual', !!n.mn && !!n.en);
  });
});

const kinds = {};
Object.keys(CG.notes).forEach(uid =>
  CG.notes[uid].forEach(n => { kinds[n.kind] = (kinds[n.kind] || 0) + 1; }));
ok('there are conflicts recorded', kinds.warn >= 4, JSON.stringify(kinds));
ok('there are agreements recorded', kinds.confirm >= 5, JSON.stringify(kinds));
ok('there are gaps recorded', kinds.gap >= 3, JSON.stringify(kinds));
console.log('  notes: ' + JSON.stringify(kinds));

// The specific findings this work exists to record.
const has = (uid, kind, needle) =>
  (CG.notes[uid] || []).some(n =>
    n.kind === kind && (n.mn.indexOf(needle) !== -1 || n.en.indexOf(needle) !== -1));

ok('records the wh -> В conflict', has('u-sounds-consonants', 'warn', 'Wh'));
ok('records the th -> Т/Д conflict', has('u-sounds-consonants', 'warn', 'Th'));
ok('records the nearby-the-flat error', has('u-prepositions', 'warn', 'nearby'));
ok('records the ago-with-perfect error', has('u-tense-grid', 'warn', 'ago'));
ok('records the SVOMPT agreement', has('l3-syntax', 'confirm', 'SVOMPT'));
ok('records the do-support gap', has('l3-syntax', 'warn', 'DO'));
ok('records the missing article after the copula', has('l2-translation', 'gap', 'a'));
ok('records the stative-verb guard', has('u-tense-grid', 'gap', 'know'));
ok('records the schwa / short-i gap', has('u-sounds-vowels', 'gap', 'schwa'));
ok('records the he/she bridge agreement', has('u-pronouns', 'confirm', 'she'));

// ------------------------------------------------------------------- path
group('path');

Object.keys(CG.pathAfter).forEach(after => {
  ok('pathAfter anchor ' + after + ' is a book unit', bookIds.has(after));
  CG.pathAfter[after].forEach(g =>
    ok('pathAfter target ' + g + ' is a guide unit', CG.units.some(u => u.id === g)));
});

const placed = new Set();
Object.keys(CG.pathAfter).forEach(k => CG.pathAfter[k].forEach(g => placed.add(g)));
CG.units.forEach(u => ok('guide unit ' + u.id + ' is reachable from the path', placed.has(u.id)));
eq('every guide unit is placed exactly once', placed.size, CG.units.length);

// -------------------------------------------------------------- exercises
group('exercises');

const bookItems = EX.forUnits(BOLDOO.units);
const cgItems = EX.forUnits(CG.units);
ok('guide generates exercises', cgItems.length > 100, 'got ' + cgItems.length);
console.log('  ' + cgItems.length + ' guide items (book: ' + bookItems.length + ')');

const bookItemIds = new Set(bookItems.map(i => i.id));
const seen = new Set();
cgItems.forEach(i => {
  ok('guide item id unique ' + i.id, !seen.has(i.id));
  seen.add(i.id);
  ok('guide item id does not collide with the book ' + i.id, !bookItemIds.has(i.id));
  ok('guide item cites a source ' + i.id, !!i.source);
  ok('guide item kind valid ' + i.id, ['choice', 'type'].indexOf(i.kind) !== -1, i.kind);
  ok('guide item has a prompt ' + i.id, !!i.prompt);
  if (i.kind === 'choice') {
    ok('answer among options ' + i.id, i.options.some(o => EX.norm(o) === EX.norm(i.answer)));
    eq('options distinct ' + i.id, new Set(i.options.map(EX.norm)).size, i.options.length);
  }
  if (i.kind === 'type') {
    ok('type item has accept list ' + i.id, Array.isArray(i.accept) && i.accept.length > 0);
  }
});

eq('combined set is exactly the sum of both sources',
   EX.forUnits(BOLDOO.units.concat(CG.units)).length,
   bookItems.length + cgItems.length);

// --------------------------------------------------- error-correction drill
group('error correction');

const fixes = cgItems.filter(i => i.id.endsWith(':fix'));
ok('error-correction items exist', fixes.length >= 40, 'got ' + fixes.length);
console.log('  ' + fixes.length + ' sentences to correct');

fixes.forEach(f => {
  eq('fix item is typed ' + f.id, f.kind, 'type');
  ok('fix accepts its own answer ' + f.id, EX.check(f, f.answer).correct);
  ok('fix rejects the wrong sentence it displays ' + f.id, !EX.check(f, f.prompt).correct);
  ok('fix shows both sides ' + f.id,
     f.explain.indexOf('✗') !== -1 && f.explain.indexOf('✓') !== -1);
});

const geologist = fixes.find(f => f.prompt === 'I am geologist.');
ok('the copula+article error is drillable', !!geologist);
if (geologist) {
  ok('accepts the correction', EX.check(geologist, 'I am a geologist.').correct);
  ok('accepts it without the full stop', EX.check(geologist, 'I am a geologist').correct);
  ok('accepts it lowercased', EX.check(geologist, 'i am a geologist').correct);
  ok('rejects the uncorrected form', !EX.check(geologist, 'I am geologist').correct);
  ok('rejects a different repair', !EX.check(geologist, 'I am the geologist').correct);
}

const dont = fixes.find(f => f.prompt === "She don't know.");
ok('the does-agreement error is drillable', !!dont);
if (dont) {
  ok('accepts the contraction', EX.check(dont, "She doesn't know.").correct);
  ok('accepts the expanded form too', EX.check(dont, 'She does not know').correct);
  ok('rejects the uncorrected form', !EX.check(dont, "She don't know").correct);
}

// -------------------------------------------------------- pronunciation drill
group('pronunciation');

const pronItems = cgItems.filter(i => i.id.indexOf(':pron') !== -1);
ok('pronunciation items exist', pronItems.length >= 20, 'got ' + pronItems.length);

const what = pronItems.find(i => i.prompt === 'what');
ok('"what" is drilled', !!what);
if (what) {
  eq('"what" is taught as /w/ and not the book\'s В', what.answer, '/w/');
  ok('the explanation names the page-13 conflict', what.explain.indexOf('х.13') !== -1);
  ok('the explanation offers minimal pairs', what.explain.indexOf('Хос:') !== -1);
}
['think', 'three'].forEach(w => {
  const it = pronItems.find(i => i.prompt === w);
  if (it) eq('"' + w + '" is taught as /θ/', it.answer, '/θ/');
});
const ship = pronItems.find(i => i.prompt === 'ship');
if (ship) eq('"ship" is taught as /ɪ/ — the sound page 12 omits', ship.answer, '/ɪ/');

// Every sound that the book contradicts must carry a warning.
const pronBlocks = CG.units.find(u => u.id === 'cg-pron').blocks;
const warned = [];
pronBlocks.forEach(b => b.items.forEach(s => { if (s.warn) warned.push(s.key); }));
['/θ/', '/ð/', '/w/', '/ɪ/', '/æ/', '/ə/'].forEach(k =>
  ok('sound ' + k + ' carries a note about the book', warned.indexOf(k) !== -1));

// ------------------------------------------------------------------- qa
group('qa');
const qas = cgItems.filter(i => i.id.endsWith(':qa'));
ok('qa items exist', qas.length >= 30, 'got ' + qas.length);
ok('every qa item explains itself', qas.every(q => !!q.explain));

// ------------------------------------------------------------------ report
console.log('\n' + '-'.repeat(46));
if (fail) {
  console.log('FAILURES (' + fail + '):');
  failures.forEach(f => console.log('  ✗ ' + f));
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
