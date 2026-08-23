/* Node harness for the parts of Boldoo that are not DOM.
 *
 *   node tests/test_boldoo.js
 *
 * Loads the browser scripts into a fake window with a fake localStorage, then
 * asserts on the content, the generated exercises, the grader and the
 * scheduler. No dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ------------------------------------------------------------- fake browser
let store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

const sandbox = { console, localStorage };
sandbox.window = sandbox;
vm.createContext(sandbox);

['content/lessons.js', 'content/contrastive.js', 'srs.js', 'exercises.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

const { BOLDOO, SRS, EX } = sandbox;

// ---------------------------------------------------------------- harness
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); }
}

function eq(name, got, want) {
  ok(name, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
}

function group(title) { console.log('\n' + title); }

// ---------------------------------------------------------------- content
group('content');

ok('units load', BOLDOO.units.length === 10, 'got ' + BOLDOO.units.length);
ok('path covers every unit', BOLDOO.path.length === BOLDOO.units.length);
BOLDOO.path.forEach(id => {
  ok('path id ' + id + ' resolves', BOLDOO.units.some(u => u.id === id));
});
BOLDOO.units.forEach(u => {
  ok(u.id + ' has pages', Array.isArray(u.pages) && u.pages.length > 0);
  ok(u.id + ' has blocks', Array.isArray(u.blocks) && u.blocks.length > 0);
  ok(u.id + ' has both titles', !!u.title_mn && !!u.title_en);
});

const verbBlock = BOLDOO.units.find(u => u.id === 'u-verbs').blocks.find(b => b.t === 'verbs');
ok('irregular verb list is substantial', verbBlock.items.length >= 150,
   'got ' + verbBlock.items.length);
verbBlock.items.forEach(v => {
  ok('verb ' + v.v + ' complete', !!v.v && !!v.mn && !!v.pp2 && !!v.pp3);
});
const dupes = {};
verbBlock.items.forEach(v => { dupes[v.v] = (dupes[v.v] || 0) + 1; });
ok('no duplicate verbs', Object.keys(dupes).every(k => dupes[k] === 1),
   Object.keys(dupes).filter(k => dupes[k] > 1).join(', '));

// The two book typos we deliberately corrected must stay corrected.
const know = verbBlock.items.find(v => v.v === 'know');
eq('know PP3 corrected', know.pp3, 'known');
ok('know carries the correction note', !!know.note);
const stride = verbBlock.items.find(v => v.v === 'stride');
eq('stride PP2 corrected', stride.pp2, 'strode');
ok('stride carries the correction note', !!stride.note);

const gridBlock = BOLDOO.units.find(u => u.id === 'u-tense-grid').blocks[0];
eq('tense grid is 4x4', Object.keys(gridBlock.cells).length, 16);
gridBlock.rows.forEach(r => gridBlock.cols.forEach(c => {
  const cell = gridBlock.cells[r + '|' + c];
  ok('cell ' + r + '|' + c + ' exists', !!cell);
  if (cell) ok('cell ' + r + '|' + c + ' full', !!cell.trans && !!cell.aux && !!cell.formula);
}));

const mapBlock = BOLDOO.units.find(u => u.id === 'l2-translation').blocks.find(b => b.t === 'map');
eq('lesson 2 has all 28 mappings', mapBlock.items.length, 28);
mapBlock.items.forEach((m, i) => eq('mapping ' + (i + 1) + ' numbered', m.n, i + 1));

// ------------------------------------------------------------- exercises
group('exercises');

const all = EX.forUnits(BOLDOO.units);
ok('exercises generated', all.length > 500, 'got ' + all.length);
console.log('  ' + all.length + ' graded items generated');

const ids = new Set();
all.forEach(i => {
  ok('unique id ' + i.id, !ids.has(i.id));
  ids.add(i.id);
  ok('item has prompt', !!i.prompt);
  ok('item has unitId', !!i.unitId);
  ok('item kind valid', ['choice', 'type', 'write'].indexOf(i.kind) !== -1, i.kind);
  if (i.kind === 'choice') {
    ok('choice has options', Array.isArray(i.options) && i.options.length >= 2);
    ok('answer is among the options for ' + i.id,
       i.options.some(o => EX.norm(o) === EX.norm(i.answer)));
    const seen = new Set(i.options.map(EX.norm));
    eq('options are distinct for ' + i.id, seen.size, i.options.length);
  }
  if (i.kind === 'type') {
    ok('type item has accept list', Array.isArray(i.accept) && i.accept.length > 0);
  }
});

// Write items are opt-in only.
ok('write items excluded by default', all.every(i => i.kind !== 'write'));
const withWrite = EX.forUnits(BOLDOO.units, { includeWrite: true });
ok('write items available on request', withWrite.some(i => i.kind === 'write'));
ok('write items are self-graded', withWrite.filter(i => i.kind === 'write')
   .every(i => i.selfGraded === true));

// ---------------------------------------------------------------- grading
group('grading');

const typeItem = all.find(i => i.kind === 'type' && i.answer.indexOf('/') !== -1);
ok('found an alternative-form verb', !!typeItem);
if (typeItem) {
  const alts = typeItem.answer.split('/').map(s => s.trim());
  alts.forEach(a => ok('accepts alternative "' + a + '"', EX.check(typeItem, a).correct));
  ok('accepts the printed form', EX.check(typeItem, typeItem.answer).correct);
  ok('rejects nonsense', !EX.check(typeItem, 'zzzz').correct);
}

const burned = all.find(i => i.kind === 'type' && i.prompt === 'burn' && i.tag.indexOf('PP2') === 0);
if (burned) {
  ok('burn PP2 accepts burnt', EX.check(burned, 'burnt').correct);
  ok('burn PP2 accepts burned', EX.check(burned, 'Burned').correct);
  ok('burn PP2 is case-insensitive', EX.check(burned, '  BURNED  ').correct);
}

const go = all.find(i => i.kind === 'type' && i.prompt === 'go' && i.tag.indexOf('PP2') === 0);
if (go) {
  ok('go PP2 = went', EX.check(go, 'went').correct);
  ok('go PP2 rejects gone', !EX.check(go, 'gone').correct);
}

const choice = all.find(i => i.kind === 'choice');
ok('choice grades its own answer right', EX.check(choice, choice.answer).correct);
ok('choice rejects a different option',
   !EX.check(choice, choice.options.find(o => EX.norm(o) !== EX.norm(choice.answer))).correct);

// write items are never machine-graded
const w = withWrite.find(i => i.kind === 'write');
eq('write item returns no verdict', EX.check(w, 'anything').correct, null);

// ---------------------------------------------------------------- scheduler
group('scheduler');

store = {};
const T = SRS.today();
const DAY = 86400000;

const id = 'test:item:1';
ok('unseen item is due', SRS.isDue(id));
ok('unseen item is not mastered', !SRS.isMastered(id));

SRS.grade(id, true);
let r = SRS.record(id);
eq('one correct answer -> box 1', r.box, 1);
eq('one correct answer -> one day logged', r.days.length, 1);
ok('not mastered after one right answer', !SRS.isMastered(id));
ok('not due again today', !SRS.isDue(id));

SRS.grade(id, true);
SRS.grade(id, true);
eq('three answers on one day still counts as one day', SRS.record(id).days.length, 1);
ok('still not mastered on a single day', !SRS.isMastered(id),
   'mastery must require ' + SRS.MASTERY_DAYS + ' distinct days');

// Simulate two further days by rewriting the stored day stamps.
const raw = JSON.parse(store['boldoo.srs.v1']);
raw.items[id].days = [T - 2 * DAY, T - DAY, T];
store['boldoo.srs.v1'] = JSON.stringify(raw);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
ok('mastered after three distinct days', sandbox.SRS.isMastered(id));

// A wrong answer demotes but does not erase a learnt item.
const S2 = sandbox.SRS;
const id2 = 'test:item:2';
for (let i = 0; i < 5; i++) S2.grade(id2, true);
const boxBefore = S2.record(id2).box;
ok('repeated success climbs the ladder', boxBefore >= 4, 'box ' + boxBefore);
S2.grade(id2, false);
const after = S2.record(id2);
eq('a lapse drops to box 2, not 0', after.box, 2);
eq('lapse counted', after.lapses, 1);

// Selection order: never-seen first, then most overdue.
const pool = ['a', 'b', 'c', 'd'];
store = {};
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const S3 = sandbox.SRS;
S3.grade('a', true);           // scheduled forward, so not due
const picked = S3.pick(pool, 4);
ok('unseen items come before scheduled ones', picked.indexOf('a') === picked.length - 1,
   picked.join(','));

// stats
const st = S3.stats(pool);
eq('stats counts the pool', st.known, 4);
eq('stats counts touched', st.touched, 1);
eq('stats counts untouched', st.untouched, 3);
eq('accuracy after one correct answer', st.accuracy, 1);
eq('accuracy is null with no answers', S3.stats(['zzz']).accuracy, null);

// ---------------------------------------------------------------- session
group('session shape');

store = {};
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const S4 = sandbox.SRS;
const everyId = all.map(i => i.id);
const first = S4.pick(everyId, 12);
eq('a session is 12 items', first.length, 12);
eq('a session has no repeats', new Set(first).size, 12);
ok('pick is stable for the same state', S4.pick(everyId, 12).join() === first.join());

// ------------------------------------------------- evidence review (LEARNING.md)
group('review before new, blocked introduction, interleaved review');

store = {};
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const S5 = sandbox.SRS;
const unitOf = id => id.split(':')[0];
const P = ['u1:0:0', 'u1:0:1', 'u1:0:2', 'u1:0:3', 'u2:0:0', 'u2:0:1', 'u2:0:2', 'u3:0:0'];

let pl = S5.plan(P, 6, unitOf);
eq('day 1: nothing to review', pl.review.length, 0);
eq('day 1: new items fill the session', pl.fresh.length, 4);
ok('day 1: new items come from ONE unit', pl.fresh.every(id => unitOf(id) === 'u1'), pl.fresh.join(','));

// Make u1:0:0, u2:0:0, u2:0:1 and u3:0:0 overdue, u1:0:1 scheduled ahead.
let st5 = JSON.parse(store['boldoo.srs.v1'] || '{"items":{},"log":[]}');
const mk = (due, extra) => Object.assign({ box: 1, due, seen: 1, right: 1, wrong: 0, days: [T], lapses: 0, leech: false, typed: false }, extra || {});
st5.items['u1:0:0'] = mk(T - 5 * DAY);
st5.items['u2:0:0'] = mk(T - 2 * DAY);
st5.items['u2:0:1'] = mk(T - 1 * DAY);
st5.items['u3:0:0'] = mk(T);
st5.items['u1:0:1'] = mk(T + 3 * DAY);
store['boldoo.srs.v1'] = JSON.stringify(st5);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const S6 = sandbox.SRS;
pl = S6.plan(P, 6, unitOf);
eq('due items are all reviewed', pl.review.length, 4);
ok('review comes before new', pl.queue.indexOf(pl.fresh[0]) >= pl.review.length);
ok('review is interleaved across units',
   pl.review.slice(1).every((id, i) => unitOf(id) !== unitOf(pl.review[i])), pl.review.join(','));
eq('most overdue item opens the session', pl.review[0], 'u1:0:0');
ok('scheduled-ahead item is not in the session', pl.queue.indexOf('u1:0:1') === -1);
eq('new items fill only what review leaves', pl.fresh.length, 2);
eq('a new-item cap applies once there is review', S6.plan(P, 6, unitOf, 1).fresh.length, 1);
eq('the cap does not apply to a cold start', S5.plan(P, 6, unitOf, 1).fresh.length, 4);
ok('pick() also serves due before unseen', S6.pick(P, 1)[0] === 'u1:0:0');
eq('interleave keeps order within a unit',
   S6.interleave(['a:1', 'a:2', 'b:1'], unitOf).join(), 'a:1,b:1,a:2');

group('leeches');
const lid = 'u9:0:0';
S6.grade(lid, true); S6.grade(lid, true); S6.grade(lid, true);
for (let i = 0; i < S6.LEECH_LAPSES; i++) { S6.grade(lid, false); S6.grade(lid, true); }
ok('four lapses make a leech', S6.isLeech(lid));
eq('leech counted in stats', S6.stats([lid]).leeches, 1);
ok('leech is never picked', S6.pick([lid], 1).length === 0);
ok('leech is never planned', S6.plan([lid], 1, unitOf).queue.length === 0);
ok('leech is not in the fluency pool', S6.fluencyPool([lid]).length === 0);
eq('re-reading the page readmits it', S6.reteach([lid, 'nope']), 1);
ok('readmitted item is due today', S6.isDue(lid) && !S6.isLeech(lid));
eq('reteach is idempotent', S6.reteach([lid]), 0);
ok('readmitting does not add a mastery day', S6.record(lid).days.length <= 3);

group('delayed first-attempt accuracy');
store = {};
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const S7 = sandbox.SRS;
S7.grade('d:0:0', true); S7.grade('d:0:0', false);
eq('same-day answers are not delayed', S7.stats(['d:0:0']).delayedAnswers, 0);
ok('delayed is null with no delayed answers', S7.stats(['d:0:0']).delayed === null);
// An item sitting at box 3 (7-day gap) answered now counts; at box 2 (3 days) it does not.
let st7 = JSON.parse(store['boldoo.srs.v1']);
st7.items['d:0:1'] = mk(T, { box: 3 });
st7.items['d:0:2'] = mk(T, { box: 2 });
store['boldoo.srs.v1'] = JSON.stringify(st7);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const S8 = sandbox.SRS;
S8.grade('d:0:1', true, { typed: true });
S8.grade('d:0:2', false);
const st8 = S8.stats(['d:0:0', 'd:0:1', 'd:0:2']);
eq('only the 7-day answer is delayed', st8.delayedAnswers, 1);
eq('delayed accuracy from that answer', st8.delayed, 1);
eq('raw accuracy still counts everything', st8.answers, 6);
eq('log records the interval the answer was scheduled at',
   JSON.parse(store['boldoo.srs.v1']).log.find(r => r.id === 'd:0:1').ivl, 7);

group('productive mature');
let st9 = JSON.parse(store['boldoo.srs.v1']);
st9.items['m:0:0'] = mk(T + 10 * DAY, { box: 4, typed: true, days: [T - 2 * DAY, T - DAY, T] });
st9.items['m:0:1'] = mk(T + 10 * DAY, { box: 4, typed: false, days: [T - 2 * DAY, T - DAY, T] });
st9.items['m:0:2'] = mk(T + 10 * DAY, { box: 3, typed: true });
store['boldoo.srs.v1'] = JSON.stringify(st9);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const S10 = sandbox.SRS;
const st10 = S10.stats(['m:0:0', 'm:0:1', 'm:0:2']);
eq('mature needs 16+ days AND a typed answer', st10.mature, 1);
eq('mastered still counts recognition', st10.mastered, 2);
ok('a correct typed answer marks the record typed', S10.grade('m:0:2', true, { typed: true }).typed === true);
ok('a correct picked answer clears it', S10.grade('m:0:2', true, {}).typed === false);

group('fluency');
eq('fluency pool is the mastered, non-leech items', S10.fluencyPool(['m:0:0', 'm:0:1', 'm:0:2']).length, 2);
const before = JSON.stringify(S10.record('m:0:0'));
S10.fluency('m:0:0', true, 1400);
S10.fluency('m:0:0', false, 3000);
eq('fluency never touches the record', JSON.stringify(S10.record('m:0:0')), before);
const fst = S10.fluencyStats();
eq('fluency counts answers', fst.answers, 2);
eq('fluency median is over correct answers only', fst.recentMs, 1400);
ok('no earlier window yet', fst.earlierMs === null);

group('import keeps older files working');
S10.importState(JSON.stringify({ items: { 'x:0:0': { box: 1, due: 0, seen: 1, right: 1, wrong: 0, days: [T], lapses: 0 } } }));
ok('old record without leech/typed/log loads', S10.stats(['x:0:0']).touched === 1 && S10.stats(['x:0:0']).delayed === null);
ok('old record is not a leech', !S10.isLeech('x:0:0'));

// ------------------------------------------------------------------ report
console.log('\n' + '-'.repeat(46));
if (fail) {
  console.log('FAILURES (' + fail + '):');
  failures.forEach(f => console.log('  ✗ ' + f));
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
