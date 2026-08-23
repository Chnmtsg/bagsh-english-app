/* Render smoke test: drives app.js through every screen with a stub DOM.
 *
 *   node tests/test_render.js
 *
 * Not a layout test. It proves each screen builds its markup without throwing
 * and contains what the screen is for — which catches the failure this app is
 * most exposed to: a template reading a field the content file does not have.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// --------------------------------------------------------------- stub DOM
function makeEl(tag, cls) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    className: cls || '',
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    style: {},
    children: [],
    _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    focus() {}, click() {}, closest() { return null; },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = v; },
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || makeEl('div'); } });
  return el;
}

const appEl = makeEl('main');
appEl.querySelector = function () { return null; };
appEl.querySelectorAll = function () { return []; };

const listeners = {};
const document = {
  getElementById(id) { return id === 'app' ? appEl : null; },
  createElement: makeEl,
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  activeElement: { tagName: 'BODY' }
};

let store = {};
const sandbox = {
  console, document,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  location: { hash: '#/', protocol: 'file:' },
  navigator: {},
  alert() {}, confirm() { return true; }, prompt() { return ''; },
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  scrollTo() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// Skip onboarding for most of the sweep; it gets its own checks below.
store['boldoo.settings.v1'] = JSON.stringify({ onboarded: true });

['content/lessons.js', 'content/contrastive.js', 'content/taxonomy.js', 'settings.js', 'srs.js', 'correct.js', 'errors.js',
 'exercises.js', 'app.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

function go(hash) {
  sandbox.location.hash = hash;
  appEl.innerHTML = '';
  (listeners.hashchange || []).forEach(fn => fn());
  return appEl.innerHTML;
}

// ---------------------------------------------------------------- harness
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++;
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); }
}
function has(name, html, needle) {
  ok(name, html.indexOf(needle) !== -1, 'missing ' + JSON.stringify(needle));
}
function clean(name, html) {
  ok(name + ' has no undefined', html.indexOf('undefined') === -1);
  ok(name + ' has no [object Object]', html.indexOf('[object Object]') === -1);
  ok(name + ' has no NaN', html.indexOf('NaN') === -1);
  ok(name + ' has no bare х. undefined', html.indexOf('х. undefined') === -1);
}

const { BOLDOO, SETTINGS } = sandbox;
const CG = sandbox.BOLDOO_CONTRASTIVE;
const UNITS = BOLDOO.units.concat(CG.units);

// ------------------------------------------------------------------- home
console.log('\nhome');
const home = go('#/');
ok('home renders', home.length > 800, 'got ' + home.length);
has('home is branded Small Step', home, 'Small Step');
has('home leads with today', home, 'Өнөөдөр');
has('home shows the review count', home, 'давтах');
has('home shows the not-started count', home, 'шинэ');
has('home refuses to add the two numbers', home, 'Хоёр тоог хэзээ ч нэмдэггүй');
has('home has the gold call to action', home, 'btn gold block');
has('home has the tab bar', home, 'class="tabs"');
has('home marks the path tab active', home, 'class="tab on"');
UNITS.forEach(u => has('home lists ' + u.id, home, '#/read/' + u.id));
clean('home', home);

// Source chips: every unit is labelled, and the label matches its kind.
has('home labels a book unit', home, 'НОМ');
has('home labels a guide unit', home, 'ГАРЫН АВЛАГА');
has('home labels a both unit', home, 'ХОЁУЛАА');
ok('a book unit with guide notes is labelled both',
   home.indexOf('chip both') !== -1);

// ------------------------------------------------------------- onboarding
console.log('onboarding');
SETTINGS.set('onboarded', false);
const onb = go('#/onboarding');
has('onboarding renders', onb, 'class="onb"');
has('onboarding asks about language', onb, 'Аль хэлээр');
has('onboarding promises no streaks', onb, 'цуврал, оноо, тэмдэг өгөхгүй');
has('onboarding can be skipped', onb, 'onb-skip');
clean('onboarding', onb);

// An un-onboarded learner is redirected there from anywhere.
sandbox.location.hash = '#/progress';
(listeners.hashchange || []).forEach(fn => fn());
ok('un-onboarded users are sent to onboarding', sandbox.location.hash === '#/onboarding');

// Back to onboarded for the rest.
SETTINGS.set('onboarded', true);

// ----------------------------------------------------------------- reader
console.log('reader');
UNITS.forEach(u => {
  const html = go('#/read/' + u.id);
  ok('reader renders ' + u.id, html.length > 400, 'got ' + html.length);
  has('reader titles ' + u.id, html, u.title_mn);
  clean('reader ' + u.id, html);
  u.blocks.forEach(b => {
    if (b.label) has('reader ' + u.id + ' shows "' + b.label + '"', html, b.label);
  });
});

const gridHtml = go('#/read/u-tense-grid');
has('tense grid renders a formula', gridHtml, 'S + Have/Has + Ved/pp3 + O + Ad + L + Te');
has('tense grid scrolls in its own box', gridHtml, 'class="scroll"');
const verbHtml = go('#/read/u-verbs');
has('verb table shows the corrected PP3', verbHtml, 'known');
has('verb table flags the book typo', verbHtml, '⚠');
const l3 = go('#/read/l3-syntax');
has('lesson 3 renders the 6 FORM table', l3, '6 FORM');
has('lesson 3 renders the letter', l3, 'Stanley Morgan');

// Guide commentary appears inside the book unit it bears on.
Object.keys(CG.notes).forEach(uid => {
  const html = go('#/read/' + uid);
  has('guide section in ' + uid, html, 'class="cg-section"');
  CG.notes[uid].forEach(n => has('note kind rendered in ' + uid, html, 'note ' + n.kind));
});
BOLDOO.units.filter(u => !CG.notes[u.id]).forEach(u => {
  ok('no empty guide section on ' + u.id,
     go('#/read/' + u.id).indexOf('class="cg-section"') === -1);
});

// ------------------------------------------------------------------ drill
console.log('drill');
store['boldoo.srs.v1'] = '';
delete store['boldoo.srs.v1'];
const study = go('#/study');
has('drill renders a prompt', study, 'class="prompt');
has('drill shows a progress track', study, 'class="track"');
has('drill has a close button', study, 'iconbtn');
has('drill primary action is Шалгах', study, 'Шалгах');
ok('drill session honours the session length',
   study.indexOf('/' + SETTINGS.get('sessionLength') + '<') !== -1,
   'expected /' + SETTINGS.get('sessionLength'));
clean('drill', study);

UNITS.forEach(u => {
  const html = go('#/study/' + u.id);
  ok('drill renders for ' + u.id,
     html.indexOf('class="prompt') !== -1 || html.indexOf('Дасгал алга') !== -1);
  clean('drill ' + u.id, html);
});

// Option keys are letters, matching the design.
const mcUnit = go('#/study/l2-translation');
has('options are lettered', mcUnit, '>A<');

// ----------------------------------------------------------------- write
console.log('write');
const write = go('#/write');
has('write renders textareas', write, 'textarea');
has('write is honest about grading', write, 'нарийвчлалын тоонд ордоггүй');
has('write has the tab bar', write, 'class="tabs"');
clean('write', write);
ok('write offers a model answer where one exists',
   write.indexOf('Загвар хариу') !== -1 || write.indexOf('загвар хариу номд байхгүй') !== -1);

// -------------------------------------------------------------- placement
console.log('placement');
const pl = go('#/placement');
has('placement renders a prompt', pl, 'class="prompt');
has('placement offers a skip', pl, 'Мэдэхгүй');
clean('placement', pl);

// --------------------------------------------------------------- progress
console.log('progress');
const pr = go('#/progress');
has('progress shows mastered', pr, 'эзэмшсэн');
has('progress headlines delayed accuracy', pr, 'хойшлуулсан нарийвчлал');
has('progress counts productive mature items', pr, 'бичиж эзэмшсэн');
has('progress refuses habit numbers', pr, 'ахиц дэвшлийг хэмждэггүй');
ok('progress does not headline raw accuracy', pr.indexOf('<div class="l">нарийвчлал</div>') === -1);
has('progress lists units', pr, 'class="prog-list"');
UNITS.forEach(u => has('progress rows ' + u.id, pr, u.title_mn));
clean('progress', pr);

// --------------------------------------------------------------- settings
console.log('settings');
const set = go('#/settings');
has('settings offers session length', set, 'Нэг суултын урт');
has('settings offers the English gloss switch', set, 'Англи тайлбар');
has('settings offers the source-label switch', set, 'Эх сурвалжийн шошго');
has('settings offers strict typing', set, 'Хатуу шалгалт');
has('settings explains why mastery is fixed', set, 'Энэ нь тохиргоо биш');
has('settings can reset', set, 'Бүх ахицыг устгах');
has('settings says data stays local', set, 'Хаашаа ч илгээгддэггүй');
clean('settings', set);
ok('settings has no fake audio toggle', set.indexOf('Дуудлагын сонсгол') === -1);
ok('settings has no fake reminder toggle', set.indexOf('сануулга') === -1);

// ------------------------------------------------------------ evidence review
console.log('review before new');
delete store['boldoo.srs.v1'];
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });
const fresh = go('#/');
has('home says a cold session is all new', fresh, 'бүгд шинэ');
ok('home has no leech callout cold', fresh.indexOf('callout leech') === -1);
ok('home offers no fluency round cold', fresh.indexOf('#/fluency') === -1);
has('fluency screen explains itself cold', go('#/fluency'), 'Хурдны тойрог хараахан алга');

// Seed: ten mastered items, one leech, one due item that was answered right once.
const T0 = sandbox.SRS.today();
const DAYMS = 86400000;
const allItems = sandbox.EX.forUnits(UNITS);
const seed = { items: {}, log: [], fluency: [] };
const mastered = allItems.filter(i => i.kind === 'choice').slice(0, 10);
mastered.forEach(i => { seed.items[i.id] = { box: 4, due: T0 + 9 * DAYMS, seen: 3, right: 3, wrong: 0,
  days: [T0 - 2 * DAYMS, T0 - DAYMS, T0], lapses: 0, leech: false, typed: false }; });
const leechItem = allItems.filter(i => !seed.items[i.id])[0];
seed.items[leechItem.id] = { box: 0, due: T0, seen: 9, right: 4, wrong: 5, days: [T0 - DAYMS], lapses: 4, leech: true, typed: false };
const promoted = allItems.find(i => i.kind === 'choice' && !seed.items[i.id] &&
  /^[a-z][a-z' \/-]*$/i.test(i.answer) && i.answer.split(/\s+/).length <= 3);
seed.items[promoted.id] = { box: 1, due: T0 - DAYMS, seen: 1, right: 1, wrong: 0, days: [T0 - DAYMS], lapses: 0, leech: false, typed: false };
store['boldoo.srs.v1'] = JSON.stringify(seed);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });

const warm = go('#/');
has('home shows review + new split', warm, '1 давтах + 3 шинэ');
has('home surfaces the leech', warm, 'callout leech');
has('leech callout names its unit', warm, '#/read/' + leechItem.unitId);
has('home offers the fluency round', warm, '#/fluency');
clean('home warm', warm);

const flHtml = go('#/fluency');
has('fluency renders a prompt', flHtml, 'class="prompt');
has('fluency is labelled', flHtml, 'Хурд · Fluency');
clean('fluency', flHtml);

const studyWarm = go('#/study/' + promoted.unitId);
has('a once-right choice item is asked typed the second time', studyWarm, 'Энэ удаа өөрөө бич');
has('the promoted item is a typed input', studyWarm, 'id="answer"');
clean('study warm', studyWarm);

const readLeech = go('#/read/' + leechItem.unitId);
has('reading the page readmits the leech', readLeech, 'дасгалд эргэж орлоо');
ok('leech flag cleared by reading', !sandbox.SRS.isLeech(leechItem.id));
ok('home drops the callout once readmitted', go('#/').indexOf('callout leech') === -1);

sandbox.SRS.fluency(mastered[0].id, true, 1200);
const prWarm = go('#/progress');
has('progress shows the fluency line when there is data', prWarm, 'Хурд:');
clean('progress warm', prWarm);
delete store['boldoo.srs.v1'];
vm.runInContext(fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'), sandbox, { filename: 'srs.js' });

// ------------------------------------------------- learner's own errors (ADR-0015)
console.log('own errors');
const CORRECT = sandbox.CORRECT, ERRQ = sandbox.ERRQ;
ok('write screen points to settings without a key', go('#/write').indexOf('Шалгуулах') === -1);
ok('settings shows the key field', go('#/settings').indexOf('id="apikey"') !== -1);
CORRECT.setKey('sk-test');
const wk = go('#/write');
has('write screen offers checking with a key', wk, 'Шалгуулах');
has('write screen says what is sent', wk, 'Anthropic');
has('settings shows the model when enabled', go('#/settings'), CORRECT.MODEL);
ok('progress hides the error block when nothing is tracked', go('#/progress').indexOf('Таны алдаа') === -1);

// Seed one treatable and one untreatable error, both due today.
const e1 = CORRECT.diff('I am geologist.', 'I am a geologist.'); e1[0].category = 'articles';
const e2 = CORRECT.diff('I did a photo.', 'I took a photo.'); e2[0].category = 'collocation';
ERRQ.fold(e1, 'r1', 'I am geologist.'); ERRQ.fold(e2, 'r2', 'I did a photo.');
let eraw = JSON.parse(store['boldoo.errors.v1']);
Object.keys(eraw.items).forEach(k => { eraw.items[k].due = ERRQ.today(); });
store['boldoo.errors.v1'] = JSON.stringify(eraw);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'errors.js'), 'utf8'), sandbox, { filename: 'errors.js' });

const homeE = go('#/');
has('home counts the repair in the session', homeE, 'таны өгүүлбэр');
has('home shows the untreatable as an exposure', homeE, 'callout expo');
has('exposure shows the natural form', homeE, 'took');
ok('exposure was marked shown', sandbox.ERRQ.item('collocation:did').shown === 1);
ok('home drops the exposure once shown', go('#/').indexOf('callout expo') === -1);
clean('home with errors', homeE);

const stE = go('#/study');
has('mixed session opens with the learner\'s own sentence', stE, 'Таны өгүүлбэр');
has('repair blanks the span', stE, 'I am _____geologist.');
has('repair is typed', stE, 'id="answer"');
clean('study with repair', stE);
ok('unit drill has no repairs', go('#/study/' + UNITS[0].id).indexOf('Таны өгүүлбэр') === -1);

const prE = go('#/progress');
has('progress shows the error block', prE, 'Таны алдаа');
has('progress counts queued errors', prE, 'дасгалд');
clean('progress with errors', prE);

CORRECT.setKey('');
sandbox.ERRQ.reset();

// ---------------------------------------------------------------- routing
console.log('routing');
ok('unknown route falls back home', go('#/nope').indexOf('Өнөөдөр') !== -1);
ok('unknown unit falls back home', go('#/read/nope').indexOf('Өнөөдөр') !== -1);
// #/results after a session shows the session; the guard only matters cold.
const resHtml = go('#/results');
ok('results renders without throwing', resHtml.length > 200, 'got ' + resHtml.length);
ok('results shows a score or falls back home',
   resHtml.indexOf('res-score') !== -1 || resHtml.indexOf('Өнөөдөр') !== -1);
clean('results', resHtml);
has('results names the mastery rule', resHtml, 'өөр өдөр зөв');

// ------------------------------------------------------------- settings fx
console.log('settings take effect');
SETTINGS.set('showSource', false);
ok('source chips disappear when switched off', go('#/').indexOf('class="chip') === -1);
SETTINGS.set('showSource', true);
ok('source chips come back', go('#/').indexOf('class="chip') !== -1);

SETTINGS.set('showEnglish', false);
const noEn = go('#/read/u-verbs');
ok('English gloss hidden when switched off',
   noEn.indexOf('Irregular verbs (PP1 / PP2 / PP3)') === -1);
SETTINGS.set('showEnglish', true);
ok('English gloss returns',
   go('#/read/u-verbs').indexOf('Irregular verbs (PP1 / PP2 / PP3)') !== -1);

SETTINGS.set('sessionLength', 12);
ok('session length setting is honoured', go('#/study').indexOf('/12<') !== -1);
SETTINGS.set('sessionLength', 6);

SETTINGS.set('strictTyping', true);
has('strict typing changes the hint', go('#/study/u-verbs'), 'том, жижиг үсэг хүртэл');
SETTINGS.set('strictTyping', false);

// ----------------------------------------------------------------- report
console.log('\n' + '-'.repeat(46));
if (fail) {
  console.log('FAILURES (' + fail + '):');
  failures.forEach(f => console.log('  ✗ ' + f));
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
