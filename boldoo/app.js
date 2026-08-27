/* Small Step — screens, routing and the session builder.
 *
 * Англи хэл, алхам алхмаар.
 *
 * Two sources feed the path: the photographed textbook (content/lessons.js)
 * and the contrastive guide (content/contrastive.js). A unit is labelled НОМ,
 * ГАРЫН АВЛАГА, or ХОЁУЛАА when the guide has commentary on a book page. The
 * label is never dropped, because when the two disagree the learner needs to
 * know which one said what.
 */
(function () {
  'use strict';

  const B = window.BOLDOO;
  const CG = window.BOLDOO_CONTRASTIVE || { notes: {}, units: [], pathAfter: {}, write: [] };
  const S = window.SETTINGS;

  const byId = {};
  B.units.forEach(function (u) { byId[u.id] = u; });
  CG.units.forEach(function (u) { byId[u.id] = u; });

  const path = [];
  B.path.forEach(function (id) {
    path.push(id);
    (CG.pathAfter[id] || []).forEach(function (g) { path.push(g); });
  });
  const ordered = path.map(function (id) { return byId[id]; }).filter(Boolean);

  const app = document.getElementById('app');

  // -------------------------------------------------------------- helpers
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }
  function pctw(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '0%'; }
  function nn(i) { return (i + 1 < 10 ? '0' : '') + (i + 1); }

  /** Which source a unit draws on. A book page the guide comments on is both. */
  function kindOf(u) {
    if (u.kind === 'guide') return 'guide';
    return (CG.notes[u.id] && CG.notes[u.id].length) ? 'both' : 'book';
  }
  const SRC_LABEL = { book: 'НОМ', guide: 'ГАРЫН АВЛАГА', both: 'ХОЁУЛАА' };

  function pageRef(u) {
    const p = u.pages || [];
    if (!p.length) return u.src ? 'Guide ' + u.src : 'Guide';
    return p.length === 1 ? 'х. ' + p[0] : 'х. ' + p[0] + '–' + p[p.length - 1];
  }
  function subtitle(u) {
    const bits = [];
    if (S.get('showEnglish')) bits.push(u.title_en);
    else if (u.kind === 'guide') bits.push(u.title_en);
    bits.push(pageRef(u));
    return bits.join(' · ');
  }

  function unitItems(u) { return EX.forUnit(u).map(function (i) { return i.id; }); }
  /** Item ids are "<unitId>:<block>:<n>[:dir]" — the unit is everything before the first colon. */
  function unitOf(id) { return String(id).split(':')[0]; }
  const FLUENCY_MIN = 6;      // mastered items needed before a timed round is offered
  const FLUENCY_ROUND = 10;   // items per round
  const NEW_PER_SESSION = 3;  // new items per session once reviews exist (LEARNING.md §3)
  const REPAIRS_PER_SESSION = 2; // the learner's own errors, ahead of the book (ADR-0015)
  function hasWrite(u) { return u.blocks.some(function (b) { return b.t === 'translate'; }); }

  const WEEKDAY = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
  function dateline() {
    const d = new Date();
    const dd = (d.getDate() < 10 ? '0' : '') + d.getDate();
    const mm = (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
    return WEEKDAY[d.getDay()] + ' · ' + dd + '.' + mm;
  }

  /** Delegated click handling: data-go for routes, data-act for actions. */
  const actions = {};
  app.addEventListener('click', function (e) {
    const go = e.target.closest ? e.target.closest('[data-go]') : null;
    if (go) { e.preventDefault(); location.hash = go.getAttribute('data-go'); return; }
    const act = e.target.closest ? e.target.closest('[data-act]') : null;
    if (act && actions[act.getAttribute('data-act')]) {
      e.preventDefault();
      actions[act.getAttribute('data-act')](act);
    }
  });

  // -------------------------------------------------------------- tab bar
  const TABS = [
    ['#/', 'Зам', 'PATH'],
    ['#/write', 'Бичих', 'WRITE'],
    ['#/progress', 'Ахиц', 'PROGRESS'],
    ['#/settings', 'Тохиргоо', 'SETTINGS']
  ];
  function tabbar(active) {
    return '<nav class="tabs">' + TABS.map(function (t) {
      return '<a class="tab' + (t[0] === active ? ' on' : '') + '" href="' + t[0] + '">' +
        '<span class="mn">' + esc(t[1]) + '</span>' +
        '<span class="en">' + esc(t[2]) + '</span></a>';
    }).join('') + '</nav>';
  }

  function render(html) { app.innerHTML = html; window.scrollTo(0, 0); }

  // ------------------------------------------------------------ home view
  function viewHome() {
    const allIds = [];
    ordered.forEach(function (u) { allIds.push.apply(allIds, unitItems(u)); });
    const d = SRS.dueBreakdown(allIds);
    const st = SRS.stats(allIds);
    const plan = SRS.plan(allIds, S.get('sessionLength'), unitOf, NEW_PER_SESSION);
    const n = plan.queue.length;
    const leechIds = SRS.leeches(allIds);
    const fluencyN = SRS.fluencyPool(allIds).length;
    const repairs = ERRQ.due(REPAIRS_PER_SESSION).length;
    const exposure = ERRQ.exposures(1)[0] || null;

    let h = '<div class="screen">' +
      '<header class="topline">' +
      '<span class="eyebrow">Small Step · Study path</span>' +
      '<span class="metaline">' + esc(dateline()) + '</span>' +
      '</header>' +
      '<h1 class="h1 pad" style="padding-left:20px;padding-right:20px">Өнөөдөр</h1>' +

      '<section class="hero">' +
      '<div class="hero-nums">' +
      '<div class="hero-num review"><div class="n">' + d.review + '</div>' +
      '<div class="mn">давтах</div><div class="en">to review</div></div>' +
      '<div class="hero-div"></div>' +
      '<div class="hero-num"><div class="n">' + d.fresh + '</div>' +
      '<div class="mn">шинэ</div><div class="en">not started</div></div>' +
      '</div>' +
      '<p class="hero-note">Хоёр тоог хэзээ ч нэмдэггүй — эхлээгүй зүйлийг «давтах» гэж тоолохгүй.</p>' +
      (n + repairs
        ? '<button class="btn gold block" data-go="#/study">Хичээллэх · ' + (n + repairs) + ' асуулт' +
          (repairs ? ' <span class="btn-sub">' + repairs + ' таны өгүүлбэр</span>' : '') +
          (plan.review.length && plan.fresh.length
            ? ' <span class="btn-sub">' + plan.review.length + ' давтах + ' + plan.fresh.length + ' шинэ</span>'
            : plan.review.length ? ' <span class="btn-sub">бүгд давтах</span>'
            : ' <span class="btn-sub">бүгд шинэ</span>') +
          '</button>'
        : '<button class="btn gold block" disabled>Өнөөдөрт дууссан</button>') +
      (plan.review.length >= S.get('sessionLength') && d.fresh
        ? '<p class="hero-note">Давтах зүйл сешнийг дүүргэж байна — шинэ зүйл давталт багасахаар ирнэ. ' +
          'Энэ бол зөв дараалал: давталт эхлээд, шинэ зүйл дараа.</p>'
        : '') +
      (fluencyN >= FLUENCY_MIN
        ? '<button class="btn block outline" data-go="#/fluency">Хурд · 1 минут' +
          ' <span class="btn-sub">' + fluencyN + ' эзэмшсэн зүйл дээр</span></button>'
        : '') +
      '</section>' +
      (leechIds.length ? leechCallout(leechIds) : '') +
      (exposure ? exposureCallout(exposure) : '') +

      '<div class="sectionhead">' +
      '<span class="eyebrow">Нэгжүүд · Units</span>' +
      '<span class="metaline">' + st.mastered + ' / ' + st.known + '</span>' +
      '</div>' +
      '<div class="units">';

    ordered.forEach(function (u, i) {
      const ids = unitItems(u);
      const us = SRS.stats(ids);
      const b = SRS.dueBreakdown(ids);
      const k = kindOf(u);
      h += '<article class="unit">' +
        '<div class="unit-n">' + nn(i) + '</div>' +
        '<div class="unit-b">' +
        '<div class="unit-top">' +
        '<h2 class="unit-mn">' + esc(u.title_mn) + '</h2>' +
        (S.get('showSource')
          ? '<span class="chip ' + k + '">' + esc(SRC_LABEL[k]) + '</span>' : '') +
        '</div>' +
        '<p class="unit-en">' + esc(subtitle(u)) + '</p>' +
        '<div class="bar"><i style="width:' + pctw(us.mastered, ids.length) + '"></i></div>' +
        '<div class="counts">' +
        '<span class="mastered">' + us.mastered + '/' + ids.length + ' эзэмшсэн</span>' +
        (b.review ? '<span class="review">' + b.review + ' давтах</span>' : '') +
        (b.fresh ? '<span class="fresh">' + b.fresh + ' шинэ</span>' : '') +
        (b.total ? '' : '<span class="clear">дууссан</span>') +
        '</div>' +
        '<div class="unit-actions">' +
        '<a class="btn" href="#/read/' + u.id + '">Унших</a>' +
        '<a class="btn primary" href="#/study/' + u.id + '">Дасгал</a>' +
        '</div></div></article>';
    });

    h += '</div>';

    // One gap the guide flags, surfaced where it will be seen.
    const gap = firstGapNote();
    if (gap) {
      h += '<aside class="callout">' +
        '<div class="k">+ Дутуу · Gap</div>' +
        '<p class="t">' + esc(gap.mn) + '</p>' +
        '<a class="btn guide" href="#/placement">Түвшин тогтоох</a>' +
        '</aside>';
    }

    h += '<p class="gap-note">' + esc(B.meta.gap_note) + '</p>' +
      tabbar('#/') + '</div>';
    render(h);
  }

  /** Items the scheduler has given up testing; each names its page. */
  function leechCallout(ids) {
    const units = {};
    ids.forEach(function (id) { units[unitOf(id)] = (units[unitOf(id)] || 0) + 1; });
    return '<aside class="callout leech">' +
      '<div class="k">Дахин унших · Read again</div>' +
      '<p class="t">' + ids.length + ' зүйлийг ' + SRS.LEECH_LAPSES + ' удаа алдсан. ' +
      'Дахин асуухгүй — мэдэхгүй зүйлийг шалгах нь сургадаггүй. Хуудсыг нь дахин уншсаны дараа л эргэж ирнэ.</p>' +
      Object.keys(units).map(function (uid) {
        const u = byId[uid];
        return u ? '<a class="btn guide" href="#/read/' + uid + '">' + esc(u.title_mn) + ' · ' + units[uid] + '</a>' : '';
      }).join(' ') +
      '</aside>';
  }

  /**
   * An untreatable error — word choice, collocation, register — shown, not
   * quizzed. Rendering it is the whole event: it is marked shown here and
   * pushed out; nothing is scored (ADR-0015, Ferris 1999).
   */
  function exposureCallout(item) {
    const x = ERRQ.toExposure(item);
    ERRQ.markShown(item.key);
    return '<aside class="callout expo">' +
      '<div class="k">Илүү зөв хувилбар · More natural</div>' +
      '<p class="t">Та бичсэн: <s>' + esc(x.yours || '—') + '</s> → <b>' + esc(x.natural) + '</b></p>' +
      '<p class="t small">' + esc(x.sentence) + '</p>' +
      (x.bridge ? '<p class="t small">' + esc(x.bridge) + '</p>' : '') +
      '<p class="t small">Энэ дүрэм биш, хэлний заншил. Асуухгүй, дүгнэхгүй — дахин харуулна.</p>' +
      '</aside>';
  }

  function firstGapNote() {
    let found = null;
    Object.keys(CG.notes).some(function (uid) {
      return CG.notes[uid].some(function (n) {
        if (n.kind === 'gap') { found = n; return true; }
        return false;
      });
    });
    return found;
  }

  // ---------------------------------------------------------- onboarding
  const ONB = [
    {
      mn: 'Аль хэлээр унших вэ?', en: 'Which language should the interface use?',
      key: 'showEnglish',
      opts: [
        { v: true, label: 'Хоёулаа', hint: 'Монгол + English зэрэг' },
        { v: false, label: 'Зөвхөн монгол', hint: 'Англи тайлбаргүй, цэвэрхэн' }
      ]
    },
    {
      mn: 'Нэг суулт хэдэн асуулт вэ?', en: 'How long is one sitting?',
      key: 'sessionLength',
      opts: [
        { v: 4, label: '4 асуулт', hint: 'Автобусанд нэг хичээл' },
        { v: 6, label: '6 асуулт', hint: 'Өдөрт 10 минут орчим' },
        { v: 12, label: '12 асуулт', hint: 'Хоёр хичээл, өглөө оройдоо' }
      ]
    },
    {
      mn: 'Хаанаас эхлэх вэ?', en: 'Where should the path start?',
      key: '__start',
      opts: [
        { v: 'place', label: 'Түвшин тогтоох', hint: 'Хэдэн асуултаар сул талыг олно' },
        { v: 'first', label: 'Эхнээс нь', hint: 'Эхний нэгжээс дараалан' }
      ]
    }
  ];
  let onbStep = 0;
  let onbStart = 'place';

  function viewOnboarding() {
    const step = ONB[onbStep];
    const cur = step.key === '__start' ? onbStart : S.get(step.key);

    let h = '<div class="onb">' +
      '<div class="onb-step">Small Step · ' + (onbStep + 1) + ' / ' + ONB.length + '</div>' +
      '<div class="onb-track"><i style="width:' +
      Math.round((onbStep + 1) / ONB.length * 100) + '%"></i></div>' +
      '<h1>' + esc(step.mn) + '</h1>' +
      '<p class="en">' + esc(step.en) + '</p>' +
      '<div class="onb-opts">';

    step.opts.forEach(function (o, i) {
      const on = cur === o.v;
      h += '<button class="onb-opt' + (on ? ' on' : '') + '" data-act="onb-pick" data-i="' + i + '">' +
        '<span><span class="l">' + esc(o.label) + '</span>' +
        '<span class="h">' + esc(o.hint) + '</span></span>' +
        '<span class="m">●</span></button>';
    });

    h += '</div><div class="onb-foot">' +
      '<p class="onb-fine">Энэ апп цуврал, оноо, тэмдэг өгөхгүй. Ахиц гэдэг нь хэр их ' +
      'эзэмшсэн, хэр зөв хариулсан — хоёрхон тоо.</p>' +
      '<button class="btn gold block" data-act="onb-next">' +
      esc(onbStep === ONB.length - 1
        ? (onbStart === 'place' ? 'Түвшин тогтоох' : 'Эхлэх')
        : 'Цааш') + '</button>' +
      '<button class="onb-skip" data-act="onb-skip">Алгасах</button>' +
      '</div></div>';
    render(h);
  }

  actions['onb-pick'] = function (el) {
    const step = ONB[onbStep];
    const o = step.opts[parseInt(el.getAttribute('data-i'), 10)];
    if (step.key === '__start') onbStart = o.v;
    else S.set(step.key, o.v);
    viewOnboarding();
  };
  actions['onb-next'] = function () {
    if (onbStep < ONB.length - 1) { onbStep += 1; return viewOnboarding(); }
    S.set('onboarded', true);
    location.hash = onbStart === 'place' ? '#/placement' : '#/';
  };
  actions['onb-skip'] = function () {
    S.set('onboarded', true);
    location.hash = '#/';
  };

  // -------------------------------------------------------------- reader
  function renderBlock(b) {
    switch (b.t) {
      case 'note': {
        const kind = b.kind || '';
        const badge = { warn: '⚠ Зөрчил · Conflict', confirm: '✓ Таарч байна · Agreement',
                        gap: '+ Дутуу · Gap' }[kind];
        return '<div class="note ' + esc(kind) + '">' +
          (badge ? '<div class="note-badge"><span>' + esc(badge) + '</span>' +
            (b.src ? '<span class="note-src">' + esc(b.src) + '</span>' : '') + '</div>' : '') +
          '<p class="mn">' + esc(b.mn) + '</p>' +
          (b.en && S.get('showEnglish') ? '<p class="en">' + esc(b.en) + '</p>' : '') +
          '</div>';
      }

      case 'pairs':
        return '<div class="block"><h3>' + esc(b.label) + '</h3>' +
          '<div class="scroll"><table class="pairs"><tbody>' +
          b.items.map(function (p) {
            return '<tr><td class="l">' + esc(p[0]) + '</td><td class="r">' + esc(p[1]) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';

      case 'verbs':
        return '<div class="block"><h3>' + esc(b.label) + '</h3>' +
          '<div class="scroll"><table class="verbs"><thead><tr>' +
          '<th>PP1</th><th>Утга</th><th>PP2</th><th>PP3</th></tr></thead><tbody>' +
          b.items.map(function (v) {
            return '<tr><td class="v">' + esc(v.v) + '</td>' +
              '<td class="mn">' + esc(v.mn) + '</td>' +
              '<td>' + esc(v.pp2) + '</td><td>' + esc(v.pp3) + '</td></tr>' +
              (v.note ? '<tr class="rownote"><td colspan="4">⚠ ' + esc(v.note) + '</td></tr>' : '');
          }).join('') + '</tbody></table></div></div>';

      case 'grid': {
        let h = '<div class="block"><h3>' + esc(b.label) + '</h3><div class="scroll">' +
          '<table class="grid"><thead><tr><th></th>' +
          b.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>';
        b.rows.forEach(function (r) {
          h += '<tr><th class="rowh">' + esc(r) + '</th>';
          b.cols.forEach(function (c) {
            const cell = b.cells[r + '|' + c];
            h += '<td class="cell">' + (cell
              ? '<div class="c-trans">' + esc(cell.trans) + '</div>' +
                '<div class="c-line"><b>Aux</b> ' + esc(cell.aux) + '</div>' +
                '<div class="c-line"><b>V/f</b> ' + esc(cell.vf) + '</div>' +
                '<div class="c-line"><b>K/w</b> ' + esc(cell.kw) + '</div>' +
                '<div class="c-formula">' + esc(cell.formula) + '</div>'
              : '') + '</td>';
          });
          h += '</tr>';
        });
        return h + '</tbody></table></div></div>';
      }

      case 'sound':
        return '<div class="block"><h3>' + esc(b.label) + '</h3>' +
          '<div class="scroll"><table class="sound"><thead><tr>' +
          '<th>Үсэг нийлэмж</th><th>Дуудлага</th><th>Жишээ</th></tr></thead><tbody>' +
          b.items.map(function (s) {
            return '<tr><td class="sp">' + esc(s.spelling) + '</td>' +
              '<td class="sd">' + esc(s.sound) + '</td>' +
              '<td>' + esc(s.examples.join(', ')) + '</td></tr>' +
              (s.note ? '<tr class="rownote"><td colspan="3">⚠ ' + esc(s.note) + '</td></tr>' : '');
          }).join('') + '</tbody></table></div></div>';

      case 'prep':
        return '<div class="block"><h3>' + esc(b.label) + '</h3>' +
          '<div class="scroll"><table class="prep"><thead><tr>' +
          '<th>English</th><th>Mongolian</th><th>Example</th><th>Жишээ</th>' +
          '</tr></thead><tbody>' +
          b.items.map(function (p) {
            return '<tr><td class="v">' + esc(p.en) + '</td><td class="mn">' + esc(p.mn) +
              '</td><td>' + esc(p.ex_en) + '</td><td class="mn">' + esc(p.ex_mn) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';

      case 'map':
        return '<div class="block"><h3>' + esc(b.label) + '</h3>' +
          '<div class="scroll"><table class="map"><tbody>' +
          b.items.map(function (m) {
            return '<tr><td class="n">' + m.n + '</td><td class="mn">' + esc(m.mn) + '</td>' +
              '<td class="arrow">→</td><td class="v">' + esc(m.en) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';

      case 'formula':
        return '<div class="block"><h3>' + esc(b.label) + '</h3><ul class="formulas">' +
          b.items.map(function (f) {
            return '<li><span class="fname">' + esc(f.name) + '</span>' +
              '<code>' + esc(f.pattern) + '</code>' +
              (f.gloss ? '<span class="fgloss">/' + esc(f.gloss) + '/</span>' : '') + '</li>';
          }).join('') + '</ul></div>';

      case 'table':
        return '<div class="block"><h3>' + esc(b.label) + '</h3>' +
          '<div class="scroll"><table><thead><tr>' +
          b.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          b.rows.map(function (r) {
            return '<tr>' + r.map(function (c, i) {
              return i === 0 ? '<th class="rowh">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div></div>';

      case 'translate':
        return '<div class="block"><h3>' + esc(b.label) + '</h3><ol class="translate">' +
          b.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
          '</ol></div>';

      case 'text':
        return '<div class="block"><h3>' + esc(b.label) + '</h3><div class="letter">' +
          b.en.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div></div>';

      case 'qa':
        return '<div class="block"><h3>' + esc(b.label) + '</h3><dl class="qa">' +
          b.items.map(function (x) {
            return '<div class="qa-row"><dt>' + esc(x.q) + '</dt><dd>' + esc(x.a) +
              (x.why ? '<span class="qa-why">' + esc(x.why) + '</span>' : '') + '</dd></div>';
          }).join('') + '</dl></div>';

      case 'contrast':
        return '<div class="block"><h3>' + esc(b.label) + '</h3><ul class="contrast">' +
          b.items.map(function (x) {
            return '<li><div class="bad">' + esc(x.bad) + '</div>' +
              '<div class="good">' + esc(x.good) + '</div>' +
              (x.why ? '<div class="why">' + esc(x.why) + '</div>' : '') + '</li>';
          }).join('') + '</ul></div>';

      case 'pron':
        return '<div class="block"><h3>' + esc(b.label) + '</h3><ul class="pron">' +
          b.items.map(function (s) {
            return '<li><div class="pron-head"><span class="ipa">' + esc(s.key) + '</span>' +
              '<span class="pron-name">' + esc(s.name) + '</span></div>' +
              '<div class="pron-how">' + esc(s.how) + '</div>' +
              '<div class="pron-words">' + esc(s.words.join(' · ')) + '</div>' +
              (s.pairs && s.pairs.length
                ? '<div class="pron-pairs">' + s.pairs.map(function (p) {
                    return '<span>' + esc(p[0]) + ' <i>/</i> ' + esc(p[1]) + '</span>';
                  }).join('') + '</div>' : '') +
              (s.warn ? '<div class="pron-warn">⚠ ' + esc(s.warn) + '</div>' : '') +
              '</li>';
          }).join('') + '</ul></div>';

      default: return '';
    }
  }

  function viewRead(unitId) {
    const u = byId[unitId];
    if (!u) return viewHome();
    const k = kindOf(u);
    // Re-reading the page is what re-admits a leech to the queue. Reading is
    // not retrieval, so nothing else on the record changes.
    const readmitted = SRS.reteach(unitItems(u));

    let h = '<div class="screen">' +
      '<div class="crumb"><a class="iconbtn" href="#/" style="display:grid;place-items:center;' +
      'text-decoration:none">←</a>' +
      '<span class="eyebrow">' + esc(SRC_LABEL[k]) + ' · ' + esc(pageRef(u)) + '</span></div>' +
      '<header class="rd-hero">' +
      '<h1 class="h1">' + esc(u.title_mn) + '</h1>' +
      (S.get('showEnglish') ? '<p class="rd-sub">' + esc(u.title_en) + '</p>' : '') +
      (u.blurb_en && S.get('showEnglish')
        ? '<p class="blurb' + (k === 'guide' ? ' guide' : '') + '">' + esc(u.blurb_en) + '</p>'
        : '<div class="spacer"></div>') +
      '</header>';

    u.blocks.forEach(function (b) { h += renderBlock(b); });

    const cg = CG.notes[u.id];
    if (cg && cg.length) {
      h += '<section class="cg-section">' +
        '<div class="sectionhead"><span class="eyebrow">Гарын авлага · Contrastive guide</span></div>' +
        '<p class="cg-intro">Өөр эх сурвалж. Ном юуг зөв заасныг, юуг дутуу орхисныг, ' +
        'хаана зөрчилдөж байгааг доор харуулав.</p>';
      cg.forEach(function (b) { h += renderBlock(b); });
      h += '</section>';
    }

    if (readmitted) {
      h += '<aside class="callout leech"><div class="k">Дахин унших · Read again</div>' +
        '<p class="t">' + readmitted + ' зүйл дасгалд эргэж орлоо. Уншсан нь мэдсэн гэсэн үг биш — ' +
        'дахин ' + SRS.MASTERY_DAYS + ' өөр өдөр зөв хариулах хэрэгтэй.</p></aside>';
    }

    h += '<div class="thumb">' +
      '<a class="btn primary block" href="#/study/' + u.id + '">Энэ нэгжийг дасгалжуулах · ' +
      S.get('sessionLength') + ' асуулт</a></div></div>';
    render(h);
  }

  // --------------------------------------------------------------- drill
  let session = null;

  /**
   * Recognition may introduce; only production may certify (Webb 2005;
   * Morris, Bransford & Franks 1977). A multiple-choice item whose answer is
   * a short English word or phrase becomes a typed item once it has been
   * answered correctly at least once. Cyrillic answers and formulas stay as
   * choices — typing them would test spelling and patience, not English.
   */
  function promote(it) {
    if (it.kind !== 'choice') return it;
    const r = SRS.record(it.id);
    if (!r || r.right === 0) return it;
    if (!/^[a-z][a-z' \/-]*$/i.test(it.answer) || it.answer.split(/\s+/).length > 3) return it;
    const out = {};
    Object.keys(it).forEach(function (k) { out[k] = it[k]; });
    out.kind = 'type';
    out.options = null;
    out.promoted = true;
    out.accept = EX.acceptable(it.answer);
    out.promptNote = (it.promptNote ? it.promptNote + ' ' : '') + 'Энэ удаа өөрөө бич.';
    return out;
  }

  /**
   * One session:
   *   1. everything due, most overdue first, interleaved across units
   *   2. new items fill what review leaves — from one unit, at most
   *      NEW_PER_SESSION once there is anything to review at all
   *   3. a miss is re-asked at the end of the same session (relearning);
   *      the re-ask is never graded into the record
   */
  function buildSession(unitId) {
    const units = unitId ? [byId[unitId]] : ordered;
    const items = EX.forUnits(units);
    const index = {};
    items.forEach(function (i) { index[i.id] = i; });
    const n = S.get('sessionLength');
    const plan = SRS.plan(items.map(function (i) { return i.id; }), n, unitOf, NEW_PER_SESSION);
    const ids = plan.queue;
    // The learner's own errors come first, in the mixed session only: they
    // are the one personalised signal this app has (ADR-0015).
    const repairs = unitId ? [] : ERRQ.due(REPAIRS_PER_SESSION).map(ERRQ.toDrill);
    const queue = repairs.concat(ids.map(function (id) { return promote(index[id]); }));
    return {
      unitId: unitId || null,
      label: unitId ? byId[unitId].title_mn : 'Холимог',
      queue: queue,
      first: queue.length,
      pos: 0, right: 0, missed: [], retried: 0, retriedRight: 0,
      picked: null, checked: false, typed: ''
    };
  }

  function viewStudy(unitId) {
    session = buildSession(unitId);
    if (!session.queue.length) {
      return render('<div class="screen"><div class="empty">' +
        '<h2>Дасгал алга</h2><p>Энд давтах зүйл одоохондоо алга.</p>' +
        '<a class="btn primary" href="#/">Зам руу буцах</a></div>' +
        tabbar('#/') + '</div>');
    }
    renderCard();
  }

  function renderCard() {
    const s = session;
    const it = s.queue[s.pos];
    const u = byId[it.unitId];
    const k = u ? kindOf(u) : 'book';
    const tone = { book: 'var(--navy)', guide: 'var(--purple)', both: 'var(--ochre)' }[k];
    const ok = s.checked && isCorrect(it);

    let body;
    if (it.kind === 'choice') {
      body = '<div class="opts">' + it.options.map(function (o, i) {
        let cls = '';
        if (s.checked) {
          if (EX.norm(o) === EX.norm(it.answer)) cls = ' right';
          else if (s.picked === i) cls = ' wrong';
        } else if (s.picked === i) cls = ' picked';
        return '<button class="opt' + cls + '" data-act="pick" data-i="' + i + '"' +
          (s.checked ? ' disabled' : '') + '>' +
          '<span class="k">' + String.fromCharCode(65 + i) + '</span>' +
          '<span>' + esc(o) + '</span></button>';
      }).join('') + '</div>';
    } else {
      body = '<div class="typed">' +
        '<input id="answer" type="text" autocomplete="off" autocapitalize="off" ' +
        'autocorrect="off" spellcheck="false" placeholder="Хариултаа бич" ' +
        'value="' + esc(s.typed) + '"' + (s.checked ? ' disabled' : '') +
        (s.checked ? ' class="' + (ok ? 'right' : 'wrong') + '"' : '') + '>' +
        '<p class="typed-hint">' + (S.get('strictTyping')
          ? 'Яг тэр хэвээр нь бич — том, жижиг үсэг хүртэл.'
          : 'Том, жижиг үсэг, цэг таслал хамаагүй.') + '</p></div>';
    }

    let h = '<div class="screen">' +
      '<div class="drillbar">' +
      '<button class="iconbtn" data-go="' + (s.unitId ? '#/read/' + s.unitId : '#/') + '">✕</button>' +
      '<div class="track"><i style="width:' + pctw(s.pos, s.queue.length) + '"></i></div>' +
      '<span class="count">' + (s.pos + 1) + '/' + s.queue.length + '</span>' +
      '</div>' +
      '<div class="q"><div class="q-top">' +
      '<span class="eyebrow tight">' + esc(it.tag || (u ? u.title_mn : '')) +
      (it.retry ? ' · <span class="retry">дахин</span>' : '') + '</span>' +
      (S.get('showSource')
        ? '<span class="q-src" style="color:' + tone + '">' + esc(it.source) + '</span>' : '') +
      '</div>' +
      '<h1 class="prompt' + (it.prompt.length > 42 ? ' small' : '') + '">' + esc(it.prompt) + '</h1>' +
      (it.promptNote ? '<p class="q-note">' + esc(it.promptNote) + '</p>' : '') +
      (it.kind === 'repair' && it.seen > 1
        ? '<p class="q-note">Энэ алдаа ' + it.seen + ' удаа гарсан.</p>' : '') +
      '</div>' + body;

    if (s.checked) {
      h += '<div class="fb ' + (ok ? 'good' : 'bad') + '">' +
        '<div class="fb-top"><span class="fb-verdict">' + (ok ? 'Зөв' : 'Буруу') + '</span>' +
        (S.get('showSource') ? '<span class="fb-src">' + esc(it.source) + '</span>' : '') +
        '</div>' +
        (ok ? '' : '<div class="fb-answer">' + esc(it.answer) + '</div>') +
        (it.explain ? '<div class="fb-explain">' + esc(it.explain).replace(/\n/g, '<br>') + '</div>' : '') +
        (it.kind === 'repair' && !ok && !it.retry
          ? '<button class="btn small" data-act="dispute" data-key="' + esc(it.key) + '">' +
            'Миний хувилбар зөв байсан</button>'
          : '') +
        '</div>';
    }

    h += '<div class="thumb"><button class="btn primary block" data-act="drill">' +
      (s.checked ? (s.pos + 1 >= s.queue.length ? 'Дүн харах' : 'Дараах') : 'Шалгах') +
      '</button></div></div>';

    render(h);
    const inp = document.getElementById('answer');
    if (inp && !s.checked) inp.focus();
  }

  function isCorrect(it) {
    const s = session;
    if (it.kind === 'choice') {
      return s.picked != null && EX.norm(it.options[s.picked]) === EX.norm(it.answer);
    }
    if (S.get('strictTyping')) return String(s.typed).trim() === String(it.answer).trim();
    return EX.check(it, s.typed).correct;
  }

  /** Precision over recall: a correction the learner rejects is never drilled again. */
  actions['dispute'] = function (el) {
    ERRQ.dispute(el.getAttribute('data-key'));
    el.outerHTML = '<p class="q-note">Тэмдэглэлээ. Энэ өгүүлбэрийг дахин асуухгүй.</p>';
  };

  actions['pick'] = function (el) {
    if (session.checked) return;
    session.picked = parseInt(el.getAttribute('data-i'), 10);
    renderCard();
  };

  actions['drill'] = function () {
    const s = session;
    const it = s.queue[s.pos];
    if (!s.checked) {
      const inp = document.getElementById('answer');
      if (inp) s.typed = inp.value;
      if (it.kind === 'choice' && s.picked == null) return;   // nothing chosen yet
      const ok = isCorrect(it);
      if (it.retry) {
        // Relearning, not scoring. Wrong again → once more, later — but at
        // most twice: after that it is tomorrow's problem, not tonight's.
        s.retried += 1;
        if (ok) s.retriedRight += 1;
        else if (it.retries < 2) {
          const more = {};
          Object.keys(it).forEach(function (k) { more[k] = it[k]; });
          more.retries = it.retries + 1;
          s.queue.push(more);
        }
      } else {
        if (it.kind === 'repair') ERRQ.record(it.key, ok);
        else SRS.grade(it.id, ok, { typed: it.kind === 'type' });
        if (ok) s.right += 1;
        else {
          s.missed.push({
            prompt: it.prompt,
            given: it.kind === 'choice'
              ? (s.picked == null ? '—' : it.options[s.picked])
              : (String(s.typed).trim() || '—'),
            answer: it.answer,
            leech: SRS.isLeech(it.id)
          });
          const again = {};
          Object.keys(it).forEach(function (k) { again[k] = it[k]; });
          again.retry = true;
          again.retries = 1;
          s.queue.push(again);
        }
      }
      s.checked = true;
      return renderCard();
    }
    if (s.pos + 1 >= s.queue.length) { location.hash = '#/results'; return; }
    s.pos += 1; s.picked = null; s.checked = false; s.typed = '';
    renderCard();
  };

  // ------------------------------------------------------------- results
  function viewResults() {
    if (!session) return viewHome();
    const s = session;
    const total = s.first;
    const again = total - s.right;

    let h = '<div class="screen"><div class="res">' +
      '<div class="res-head">' +
      '<div class="eyebrow">Дууслаа · Session done</div>' +
      '<div class="res-score">' + pct(s.right / total) + '</div>' +
      '<p class="res-line">' + s.right + ' / ' + total + ' анхны оролдлогоор зөв · ' + esc(s.label) + '</p>' +
      '<p class="fine">Энэ өнөөдрийн гүйцэтгэл. Сурсан эсэхийг долоо хоногийн дараа давтахад л харна.</p>' +
      '</div>' +
      '<div class="res-cards">' +
      '<div class="res-card green"><div class="n">' + s.right + '</div>' +
      '<div class="l">зөв хариулт</div>' +
      '<div class="s">Эзэмшсэн гэхэд ' + SRS.MASTERY_DAYS + ' өөр өдөр зөв</div></div>' +
      '<div class="res-card ochre"><div class="n">' + again + '</div>' +
      '<div class="l">дахин ирнэ</div>' +
      '<div class="s">' + (s.retried
        ? 'Өнөөдөр ' + s.retried + ' удаа дахин асуусан, тоонд ороогүй'
        : 'Удахгүй давтагдана') + '</div></div>' +
      '</div>';

    if (s.missed.length) {
      h += '<div class="sectionhead" style="padding-left:4px;padding-right:4px">' +
        '<span class="eyebrow tight">Алдсан зүйл · Missed</span></div>' +
        '<div class="missed">' + s.missed.map(function (m) {
          return '<div class="row"><div class="p">' + esc(m.prompt) +
            (m.leech ? ' <span class="retry">хуудсаа дахин унш</span>' : '') + '</div>' +
            '<div class="g">' + esc(m.given) + '</div>' +
            '<div class="a">' + esc(m.answer) + '</div></div>';
        }).join('') + '</div>';
    } else {
      h += '<p class="res-line" style="text-align:center;margin-top:24px">' +
        'Алдсан зүйл алга. Гэхдээ нэг удаа зөв хариулах нь мэдсэн гэсэн үг биш.</p>';
    }

    h += '</div><div class="thumb">' +
      '<a class="btn primary block" href="#/">Зам руу буцах</a></div></div>';
    render(h);
  }

  // ----------------------------------------------------------- fluency
  // Nation's fourth strand: easy, known material under mild time pressure.
  // Nothing here is new, nothing is graded into the scheduler; the only
  // number that comes out is milliseconds-to-correct on mastered items.
  let fl = null;

  function viewFluency() {
    const allIds = [];
    ordered.forEach(function (u) { allIds.push.apply(allIds, unitItems(u)); });
    const pool = SRS.fluencyPool(allIds);
    if (pool.length < FLUENCY_MIN) {
      return render('<div class="screen"><div class="empty">' +
        '<h2>Хурдны тойрог хараахан алга</h2>' +
        '<p>Эзэмшсэн зүйл ' + FLUENCY_MIN + ' хүрэхэд нээгдэнэ. Одоо ' + pool.length + '.</p>' +
        '<a class="btn primary" href="#/">Зам руу буцах</a></div>' + tabbar('#/') + '</div>');
    }
    const items = EX.forUnits(ordered);
    const index = {};
    items.forEach(function (i) { index[i.id] = i; });
    // Rotate through the pool by day so the same ten do not come every time.
    const start = (SRS.today() / 86400000) % pool.length;
    const ids = [];
    for (let i = 0; i < Math.min(FLUENCY_ROUND, pool.length); i++) {
      ids.push(pool[(start + i) % pool.length]);
    }
    fl = { queue: ids.map(function (id) { return index[id]; }), pos: 0, right: 0,
           times: [], t0: 0, picked: null, checked: false, typed: '' };
    renderFluency();
  }

  function renderFluency() {
    const f = fl;
    const it = f.queue[f.pos];
    let body;
    if (it.kind === 'choice') {
      body = '<div class="opts">' + it.options.map(function (o, i) {
        let cls = '';
        if (f.checked) {
          if (EX.norm(o) === EX.norm(it.answer)) cls = ' right';
          else if (f.picked === i) cls = ' wrong';
        }
        return '<button class="opt' + cls + '" data-act="fl-pick" data-i="' + i + '"' +
          (f.checked ? ' disabled' : '') + '>' +
          '<span class="k">' + String.fromCharCode(65 + i) + '</span><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>';
    } else {
      body = '<div class="typed"><input id="answer" type="text" autocomplete="off" autocapitalize="off" ' +
        'autocorrect="off" spellcheck="false" placeholder="Хурдан бич" value="' + esc(f.typed) + '"' +
        (f.checked ? ' disabled' : '') + '></div>';
    }
    let h = '<div class="screen">' +
      '<div class="drillbar">' +
      '<button class="iconbtn" data-go="#/">✕</button>' +
      '<div class="track"><i style="width:' + pctw(f.pos, f.queue.length) + '"></i></div>' +
      '<span class="count">' + (f.pos + 1) + '/' + f.queue.length + '</span></div>' +
      '<div class="q"><div class="q-top"><span class="eyebrow tight">Хурд · Fluency</span>' +
      '<span class="q-src">эзэмшсэн</span></div>' +
      '<h1 class="prompt' + (it.prompt.length > 42 ? ' small' : '') + '">' + esc(it.prompt) + '</h1>' +
      '<p class="q-note">Мэддэг зүйл. Бодолгүй, хурдан.</p></div>' + body;
    if (f.checked) {
      const last = f.times[f.times.length - 1];
      h += '<div class="fb ' + (last.ok ? 'good' : 'bad') + '"><div class="fb-top">' +
        '<span class="fb-verdict">' + (last.ok ? 'Зөв' : 'Буруу') + '</span>' +
        '<span class="fb-src">' + (last.ms / 1000).toFixed(1) + ' с</span></div>' +
        (last.ok ? '' : '<div class="fb-answer">' + esc(it.answer) + '</div>') + '</div>';
    }
    h += '<div class="thumb"><button class="btn primary block" data-act="fl-next">' +
      (f.checked ? (f.pos + 1 >= f.queue.length ? 'Дүн харах' : 'Дараах') : 'Шалгах') +
      '</button></div></div>';
    render(h);
    if (!f.checked) f.t0 = Date.now();
    const inp = document.getElementById('answer');
    if (inp && !f.checked) inp.focus();
  }

  function flCheck() {
    const f = fl, it = f.queue[f.pos];
    const ms = Date.now() - f.t0;
    let ok;
    if (it.kind === 'choice') ok = f.picked != null && EX.norm(it.options[f.picked]) === EX.norm(it.answer);
    else ok = EX.check(it, f.typed).correct;
    f.times.push({ ok: ok, ms: ms });
    if (ok) f.right += 1;
    SRS.fluency(it.id, ok, ms);
    f.checked = true;
  }

  actions['fl-pick'] = function (el) {
    if (fl.checked) return;
    fl.picked = parseInt(el.getAttribute('data-i'), 10);
    flCheck();           // a choice is an answer; no second tap, the clock matters
    renderFluency();
  };

  actions['fl-next'] = function () {
    const f = fl;
    if (!f.checked) {
      const inp = document.getElementById('answer');
      if (inp) f.typed = inp.value;
      const it = f.queue[f.pos];
      if (it.kind === 'choice' && f.picked == null) return;
      flCheck();
      return renderFluency();
    }
    if (f.pos + 1 >= f.queue.length) return renderFluencyResult();
    f.pos += 1; f.picked = null; f.checked = false; f.typed = '';
    renderFluency();
  };

  function renderFluencyResult() {
    const f = fl;
    const okMs = f.times.filter(function (t) { return t.ok; }).map(function (t) { return t.ms; })
      .sort(function (a, b) { return a - b; });
    const med = okMs.length ? okMs[okMs.length >> 1] : null;
    const fs = SRS.fluencyStats();
    render('<div class="screen"><div class="res">' +
      '<div class="res-head"><div class="eyebrow">Хурд · Fluency</div>' +
      '<div class="res-score">' + (med == null ? '—' : (med / 1000).toFixed(1) + ' с') + '</div>' +
      '<p class="res-line">зөв хариултын дундаж хугацаа · ' + f.right + ' / ' + f.queue.length + ' зөв</p>' +
      '<p class="fine">Энд шинэ зүйл байхгүй, давталтын хуваарьт ч нөлөөлөхгүй. ' +
      'Мэддэг зүйлээ хурдан гаргаж сурах нь тусдаа ур чадвар (DeKeyser).</p></div>' +
      (fs.earlierMs != null
        ? '<div class="res-cards"><div class="res-card green"><div class="n">' + (fs.recentMs / 1000).toFixed(1) + '</div>' +
          '<div class="l">сүүлийн 20</div><div class="s">секунд, дундаж</div></div>' +
          '<div class="res-card"><div class="n">' + (fs.earlierMs / 1000).toFixed(1) + '</div>' +
          '<div class="l">өмнөх 40</div><div class="s">буурч байвал автоматжиж байна</div></div></div>'
        : '') +
      '</div><div class="thumb"><a class="btn primary block" href="#/">Зам руу буцах</a></div></div>');
  }

  // ------------------------------------------------------------- write
  function writeItems() {
    const out = [];
    (CG.write || []).forEach(function (w) {
      out.push({ id: 'cgw:' + w.id, mn: w.mn, model: w.model, why: w.why, src: w.src });
    });
    ordered.forEach(function (u) {
      if (!hasWrite(u)) return;
      EX.forUnit(u, { includeWrite: true }).forEach(function (i) {
        if (i.kind === 'write') {
          out.push({ id: i.id, mn: i.prompt, model: null, why: null, src: i.source });
        }
      });
    });
    return out;
  }

  const revealed = {};
  const marked = {};
  const drafts = {};
  const checks = {};     // id -> { busy, error, result }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  /** Your text and the correction, edit by edit, with the taxonomy's own rule. */
  function renderCheck(w, c) {
    if (c.busy) return '<p class="wi-check busy">Шалгаж байна…</p>';
    if (c.error) {
      const msg = c.error === 'no-key' ? 'API түлхүүр алга.'
        : c.error === 'refusal' ? 'Загвар хариулахаас татгалзлаа.'
        : /^api-4/.test(c.error) ? 'Түлхүүр буруу эсвэл хүсэлт хүлээн авагдсангүй (' + c.error + ').'
        : /^api-/.test(c.error) ? 'Сервер хариулсангүй (' + c.error + ').'
        : 'Холболт алга — дараа дахин оролдоно уу.';
      return '<p class="wi-check err">' + esc(msg) + '</p>';
    }
    const r = c.result;
    if (!r) return '';
    const TAXC = (window.BOLDOO_TAXONOMY || {}).categories || {};
    let h = '<div class="wi-check">';
    if (!r.edits.length) {
      h += '<p class="ok">' + (r.offline ? CORRECT.patternCount() + ' дүрмийн аль нь ч алдаа олсонгүй.'
          : 'Засах зүйл алга.') +
        ' <span class="fine">' + (r.offline ? 'Дүрмүүд зөвхөн мэддэг алдаагаа олдог; зөв гэсэн үг биш.'
          : 'Энэ нэг удаагийн дүгнэлт — мэдсэн гэдгийг давталт л батална.') + '</span></p>';
    } else {
      h += '<p class="fine">' + r.edits.length + ' засвар. ' + (r.offline
        ? 'Бүгдийг дүрэм олсон — загвар дуудагдаагүй.'
        : 'Дүрэм эхлээд, дараа нь загвар. Засварыг код тооцоолсон; загвар зөвхөн ' +
          'засварласан өгүүлбэр буцааж, ангиллыг нь нэрлэсэн.') + '</p><ul class="edits">';
      r.edits.forEach(function (e) {
        const cat = e.category ? TAXC[e.category] : null;
        h += '<li><span class="from">' + (e.original ? esc(e.original) : '∅') + '</span> → ' +
          '<span class="to">' + (e.corrected ? esc(e.corrected) : '∅') + '</span>' +
          (e.category ? '<span class="cat' + (cat && cat.treatable === false ? ' soft' : '') + '">' +
            (TRACK.codeOf(e.category) ? TRACK.codeOf(e.category) + ' · ' : '') +
            esc(e.category.replace(/_/g, ' ')) + '</span>' : '') +
          (e.source === 'pattern' ? '<span class="cat pat">дүрэм</span>' : '') +
          (e.source === 'pattern' && e.explanation ? '<div class="rule">' + esc(e.explanation) + '</div>'
            : cat && cat.rule_a2 ? '<div class="rule">' + esc(cat.rule_a2) + '</div>' : '') +
          (cat && cat.treatable === false
            ? '<div class="rule">Дүрэм биш, заншил — дасгал болгохгүй, дахин харуулна.</div>' : '') +
          '</li>';
      });
      h += '</ul><p class="corrected">' + esc(r.corrected) + '</p>' +
        (r.measure ? numbersLine(r.measure) : '') +
        (r.queued ? '<p class="fine">' + r.queued + ' өгүүлбэр маргаашийн дасгалд орлоо — засварыг уншаад ' +
          'өнгөрөөх биш, өөрөө засна.</p>' : '');
    }
    if (r.ambiguity && r.ambiguity.length) {
      h += '<p class="fine">Тодорхойгүй: ' + esc(r.ambiguity.join(' ')) + '</p>';
    }
    return h + '</div>';
  }

  function viewWrite() {
    const all = writeItems();
    const index = {};
    all.forEach(function (w) { index[w.id] = w; });
    const ids = SRS.pick(all.map(function (w) { return w.id; }), 5);
    const picked = ids.map(function (id) { return index[id]; });

    let h = '<div class="screen">' +
      '<header class="topline">' +
      '<span class="eyebrow">Small Step · Free translation</span>' +
      '<span class="metaline">' + all.length + '</span></header>' +
      '<h1 class="h1" style="padding:0 20px">Орчуулга</h1>' +
      (CORRECT.enabled()
        ? '<p class="fine" style="margin-top:10px">Өөрөө үнэлнэ — энэ хэсгийн үр дүн нарийвчлалын тоонд ' +
          'ордоггүй. «Шалгуулах» дарвал бичсэн англи өгүүлбэр тань Anthropic-ийн сервер рүү ' +
          'илгээгдэж, засварласан хувилбар буцаж ирнэ. Алдааг код тооцоолж, маргаашийн дасгалд оруулна.</p>'
        : '<p class="fine" style="margin-top:10px">Өөрөө үнэлнэ — энэ хэсгийн үр дүн нарийвчлалын тоонд ' +
          'ордоггүй. «Дүрмээр шалгах» ' + CORRECT.patternCount() + ' тогтсон дүрмээр, төхөөрөмж дээрээ, ' +
          'юу ч илгээлгүй шалгана — олсон алдаа нь маргаашийн дасгалд орно. ' +
          '<a href="#/settings">Тохиргоонд</a> API түлхүүр оруулбал бусад алдааг ч засуулж болно.</p>');

    h += freeBox() + tutorBox();

    h += '<div class="sectionhead"><span class="eyebrow">Орчуулга · Translation</span>' +
      '<span class="metaline">' + picked.length + ' / ' + all.length + '</span></div>';

    picked.forEach(function (w, i) {
      const isMarked = marked[w.id];
      h += '<article class="write-item">' +
        '<div class="wi-n">' + nn(i) + '</div><div class="wi-b">' +
        '<p class="wi-mn">' + esc(w.mn) + '</p>' +
        '<textarea rows="2" data-act="draft" data-id="' + esc(w.id) + '" ' +
        'placeholder="Англиар бичнэ үү">' + esc(drafts[w.id] || '') + '</textarea>' +
        '<div class="wi-actions">' +
        '<button class="btn" data-act="w-ok" data-id="' + esc(w.id) + '">' +
        (isMarked === true ? '✓ Чадсан' : 'Чадсан') + '</button>' +
        '<button class="btn" data-act="w-no" data-id="' + esc(w.id) + '">' +
        (isMarked === false ? '↻ Дахин' : 'Болоогүй') + '</button>' +
        (w.model
          ? '<button class="btn guide" data-act="w-reveal" data-id="' + esc(w.id) + '">' +
            (revealed[w.id] ? 'Нуух' : 'Загвар хариу') + '</button>'
          : '') +
        '<button class="btn primary" data-act="w-check" data-id="' + esc(w.id) + '"' +
        (checks[w.id] && checks[w.id].busy ? ' disabled' : '') + '>' +
        (CORRECT.enabled() ? 'Шалгуулах' : 'Дүрмээр шалгах') + '</button>' +
        '</div>' +
        (checks[w.id] ? renderCheck(w, checks[w.id]) : '');

      if (w.model && revealed[w.id]) {
        h += '<div class="wi-model"><div class="m">' + esc(w.model) + '</div>' +
          (w.why ? '<div class="w">' + esc(w.why) + '</div>' : '') + '</div>';
      } else if (!w.model) {
        h += '<p class="wi-nomodel">Энэ өгүүлбэрийн загвар хариу номд байхгүй — ' +
          'зохиож нэмээгүй. Номтойгоо тулгаж үзнэ үү.</p>';
      }
      h += '</div></article>';
    });

    h += '<div class="spacer"></div>' + tabbar('#/write') + '</div>';
    render(h);
  }

  // ---------------------------------------------------- own text (ADR-0016)
  // The plan's daily production task and the 3-minute transcripts. Personal
  // writing, so: corrector only, no coach voice, and an opt-out from the
  // queue for a text the learner does not want replayed as a drill.
  const FREE_ID = 'free';
  let freeState = { text: '', minutes: '', noQueue: false };

  function numbersLine(m) {
    return '<p class="nums">' +
      '<b>' + m.words + '</b> үг · <b>' + (m.per100 == null ? '—' : m.per100) + '</b> алдаа/100 үг · ' +
      '<b>' + (m.art100 == null ? '—' : m.art100) + '</b> ART/100 · ' +
      '<b>' + m.clausesPerSentence + '</b> өгүүлбэр тутмын дэд өгүүлбэр (тооцоо)' +
      (m.wpm ? ' · <b>' + m.wpm + '</b> үг/мин' : '') +
      (m.dominant ? ' · давамгай: <b>' + esc(m.dominant.replace(/_/g, ' ')) + '</b>' : '') + '</p>';
  }

  function freeBox() {
    const c = checks[FREE_ID];
    const isBaseline = !TRACK.baseline();
    return '<section class="write-item free"><div class="wi-b">' +
      '<div class="sectionhead tight"><span class="eyebrow">Өөрийн бичвэр · Own text</span>' +
      (isBaseline ? '<span class="metaline base">эхний шалгалт = суурь үзүүлэлт</span>' : '') + '</div>' +
      '<p class="fine">Өдрийн 10 өгүүлбэр, эсвэл 3 минутын бичлэгийн тэмдэглэл — үг үгээр, өөрөө буулгасан. ' +
      'Энд зөвхөн засвар ирнэ; тайлбар, урам өгөх үг ирэхгүй.</p>' +
      '<textarea rows="5" data-act="free-draft" placeholder="Today I worked on…">' + esc(freeState.text) + '</textarea>' +
      '<div class="wi-actions">' +
      '<label class="minutes">бичлэг <input id="free-min" type="number" min="0" step="0.5" inputmode="decimal" ' +
      'value="' + esc(freeState.minutes) + '" placeholder="—"> мин</label>' +
      '<label class="chk"><input type="checkbox" id="free-noq"' + (freeState.noQueue ? ' checked' : '') +
      '> дасгалд бүү оруул</label>' +
      '<button class="btn primary" data-act="free-check"' + (c && c.busy ? ' disabled' : '') + '>' +
      (CORRECT.enabled() ? 'Шалгуулах' : 'Дүрмээр шалгах') + '</button></div>' +
      (c ? renderCheck({ id: FREE_ID }, c) : '') +
      '</div></section>';
  }

  actions['free-draft'] = function () { /* value read on input below */ };
  actions['free-check'] = function () {
    const text = String(freeState.text).trim();
    if (!text) return;
    const minEl = document.getElementById('free-min');
    const noqEl = document.getElementById('free-noq');
    freeState.minutes = minEl ? minEl.value : '';
    freeState.noQueue = !!(noqEl && noqEl.checked);
    const minutes = parseFloat(freeState.minutes) || 0;
    const finish = function (r) {
      const entryId = 'free:' + hashStr(text);
      r.queued = freeState.noQueue ? 0 : ERRQ.fold(r.edits, entryId, r.text);
      r.measure = TRACK.measure(r.text, r.edits, minutes);
      TRACK.log(r.text, r.edits, { kind: 'free', minutes: minutes, offline: !!r.offline });
      checks[FREE_ID] = { result: r };
      if (location.hash === '#/write') viewWrite();
    };
    if (!CORRECT.enabled()) return finish(CORRECT.checkOffline(text));
    checks[FREE_ID] = { busy: true };
    viewWrite();
    CORRECT.check(text).then(finish, function (err) {
      checks[FREE_ID] = { error: (err && err.message) || 'network' };
      if (location.hash === '#/write') viewWrite();
    });
  };

  // ------------------------------------------------- tutor's list (ADR-0016)
  // "wrong → right", one per line. Code diffs each pair; the learner names
  // the code; nothing is sent anywhere. QQ English's correction hours land
  // in the same queue as everything else.
  let tutorState = { text: '', result: null };
  const TUTOR_CODES = Object.keys(TRACK.CODES);

  function parseTutorLines(text) {
    return String(text).split(/\r?\n/).map(function (line) {
      const m = /^(.*?)\s*(?:→|->|=>|\|)\s*(.*)$/.exec(line.trim());
      if (!m || !m[1].trim() || !m[2].trim()) return null;
      const wrong = m[1].trim(), right = m[2].trim();
      const edits = CORRECT.diff(wrong, right);
      return { wrong: wrong, right: right, edits: edits };
    }).filter(Boolean);
  }

  function tutorBox() {
    const r = tutorState.result;
    let h = '<section class="write-item tutor"><div class="wi-b">' +
      '<div class="sectionhead tight"><span class="eyebrow">Багш хэлсэн · From your tutor</span></div>' +
      '<p class="fine">Багшийн бичсэн алдааны жагсаалтыг мөр бүрт <code>буруу → зөв</code> гэж буулга. ' +
      'Юу ч илгээгдэхгүй: ялгааг код тооцоолж, ангиллыг та нэрлэнэ.</p>' +
      '<textarea rows="3" data-act="tutor-draft" placeholder="I work as operator → I work as an operator">' + esc(tutorState.text) + '</textarea>' +
      '<div class="wi-actions"><button class="btn" data-act="tutor-parse">Ялгааг харах</button></div>';
    if (r) {
      if (!r.length) h += '<p class="wi-check err">Мөр олдсонгүй. Мөр бүр «буруу → зөв» хэлбэртэй байх ёстой.</p>';
      else {
        h += '<div class="wi-check"><ul class="edits">';
        r.forEach(function (row, i) {
          row.edits.forEach(function (e, j) {
            h += '<li><span class="from">' + (e.original ? esc(e.original) : '∅') + '</span> → ' +
              '<span class="to">' + (e.corrected ? esc(e.corrected) : '∅') + '</span> ' +
              '<select data-tutor="' + i + ':' + j + '"><option value="">ангилал…</option>' +
              TUTOR_CODES.map(function (c) {
                return '<option value="' + TRACK.CODES[c] + '"' + (e.category === TRACK.CODES[c] ? ' selected' : '') + '>' +
                  c + ' · ' + TRACK.CODES[c].replace(/_/g, ' ') + '</option>';
              }).join('') + '</select>' +
              '<div class="rule">' + esc(row.wrong) + '</div></li>';
          });
        });
        h += '</ul><div class="wi-actions"><button class="btn primary" data-act="tutor-add">Дасгалд оруулах</button></div></div>';
      }
    }
    return h + '</div></section>';
  }

  actions['tutor-draft'] = function () {};
  actions['tutor-parse'] = function () {
    tutorState.result = parseTutorLines(tutorState.text);
    viewWrite();
  };
  actions['tutor-add'] = function () {
    const r = tutorState.result || [];
    app.querySelectorAll('select[data-tutor]').forEach(function (sel) {
      const ij = sel.getAttribute('data-tutor').split(':');
      const e = r[+ij[0]] && r[+ij[0]].edits[+ij[1]];
      if (e) e.category = sel.value || null;
    });
    let added = 0, all = [];
    r.forEach(function (row, i) {
      const labelled = row.edits.filter(function (e) { return e.category; });
      labelled.forEach(function (e) { e.source = 'tutor'; });
      all = all.concat(labelled);
      if (labelled.length) added += ERRQ.fold(labelled, 'tutor:' + hashStr(row.wrong), row.wrong);
    });
    if (all.length) TRACK.log(r.map(function (x) { return x.wrong; }).join(' '), all, { kind: 'tutor' });
    tutorState = { text: '', result: null, added: added, skipped: r.reduce(function (n, row) {
      return n + row.edits.filter(function (e) { return !e.category; }).length; }, 0) };
    viewWrite();
  };

  actions['draft'] = function () { /* value read on blur below */ };
  app.addEventListener('input', function (e) {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-act') === 'draft') {
      drafts[t.getAttribute('data-id')] = t.value;
    }
    if (t && t.getAttribute && t.getAttribute('data-act') === 'free-draft') freeState.text = t.value;
    if (t && t.getAttribute && t.getAttribute('data-act') === 'tutor-draft') tutorState.text = t.value;
  });
  actions['w-ok'] = function (el) {
    const id = el.getAttribute('data-id');
    marked[id] = true; SRS.grade(id, true); viewWrite();
  };
  actions['w-no'] = function (el) {
    const id = el.getAttribute('data-id');
    marked[id] = false; SRS.grade(id, false); viewWrite();
  };
  actions['w-check'] = function (el) {
    const id = el.getAttribute('data-id');
    const w = writeItems().filter(function (x) { return x.id === id; })[0];
    const text = String(drafts[id] || '').trim();
    if (!w || !text) return;
    if (!CORRECT.enabled()) {
      const r = CORRECT.checkOffline(text);
      r.queued = ERRQ.fold(r.edits, id + ':' + hashStr(text), r.text);
      TRACK.log(r.text, r.edits, { kind: 'translate', offline: true });
      checks[id] = { result: r };
      return viewWrite();
    }
    checks[id] = { busy: true };
    viewWrite();
    CORRECT.check(text, w.mn).then(function (r) {
      // Only edits with a category from the closed enum can be scheduled.
      const entryId = id + ':' + hashStr(text);
      r.queued = ERRQ.fold(r.edits, entryId, r.text);
      TRACK.log(r.text, r.edits, { kind: 'translate' });
      checks[id] = { result: r };
      if (location.hash === '#/write') viewWrite();
    }, function (err) {
      checks[id] = { error: (err && err.message) || 'network' };
      if (location.hash === '#/write') viewWrite();
    });
  };

  actions['w-reveal'] = function (el) {
    const id = el.getAttribute('data-id');
    revealed[id] = !revealed[id]; viewWrite();
  };

  // ---------------------------------------------------------- placement
  let placement = null;

  function buildPlacement() {
    const picked = [];
    ordered.forEach(function (u) {
      const items = EX.forUnit(u).filter(function (i) { return i.kind === 'choice'; });
      if (!items.length) return;
      [Math.floor(items.length * 0.25), Math.floor(items.length * 0.7)].forEach(function (ix) {
        if (items[ix] && picked.indexOf(items[ix]) === -1) picked.push(items[ix]);
      });
    });
    return picked;
  }

  function viewPlacement() {
    placement = { queue: buildPlacement(), pos: 0, by: {} };
    ordered.forEach(function (u) { placement.by[u.id] = { right: 0, total: 0 }; });
    renderPlacement();
  }

  function renderPlacement() {
    const p = placement;
    if (p.pos >= p.queue.length) return renderPlacementResult();
    const it = p.queue[p.pos];

    render('<div class="screen">' +
      '<div class="drillbar">' +
      '<button class="iconbtn" data-go="#/">✕</button>' +
      '<div class="track"><i style="width:' + pctw(p.pos, p.queue.length) + '"></i></div>' +
      '<span class="count">' + (p.pos + 1) + '/' + p.queue.length + '</span></div>' +
      '<div class="q"><div class="q-top">' +
      '<span class="eyebrow tight">Түвшин тогтоох</span>' +
      '<span class="q-src" style="color:var(--muted-2)">' + esc(it.source) + '</span></div>' +
      '<h1 class="prompt' + (it.prompt.length > 42 ? ' small' : '') + '">' + esc(it.prompt) + '</h1>' +
      (it.promptNote ? '<p class="q-note">' + esc(it.promptNote) + '</p>' : '') +
      '</div><div class="opts">' +
      it.options.map(function (o, i) {
        return '<button class="opt" data-act="pl" data-i="' + i + '">' +
          '<span class="k">' + String.fromCharCode(65 + i) + '</span>' +
          '<span>' + esc(o) + '</span></button>';
      }).join('') +
      '<button class="opt skip" data-act="pl" data-i="-1">Мэдэхгүй</button>' +
      '</div></div>');
  }

  actions['pl'] = function (el) {
    const p = placement;
    const it = p.queue[p.pos];
    const i = parseInt(el.getAttribute('data-i'), 10);
    const ok = i >= 0 && EX.norm(it.options[i]) === EX.norm(it.answer);
    const b = p.by[it.unitId];
    if (b) { b.total += 1; if (ok) b.right += 1; }
    p.pos += 1;
    renderPlacement();
  };

  function renderPlacementResult() {
    const scored = ordered.map(function (u) {
      const b = placement.by[u.id] || { right: 0, total: 0 };
      return { u: u, s: b.total ? b.right / b.total : 0, right: b.right, total: b.total };
    }).sort(function (a, b) {
      if (a.s !== b.s) return a.s - b.s;
      return path.indexOf(a.u.id) - path.indexOf(b.u.id);
    });

    let h = '<div class="screen">' +
      '<header class="topline"><span class="eyebrow">Small Step · Placement</span></header>' +
      '<h1 class="h1" style="padding:0 20px">Хаанаас эхлэх вэ</h1>' +
      '<p class="fine" style="margin-top:10px">Нэгж тус бүрээс хоёр асуулт. Юуг эхлэхийг ' +
      'тодорхойлоход хангалттай, харин мэдлэгийг хэмжихэд хангалтгүй.</p>' +
      '<ul class="pl-list">';

    scored.forEach(function (r) {
      const cls = r.s >= 1 ? 'strong' : (r.s >= 0.5 ? 'mid' : 'weak');
      h += '<li class="' + cls + '">' +
        '<div class="pl-head"><span class="pl-mn">' + esc(r.u.title_mn) + '</span>' +
        '<span class="pl-score">' + r.right + '/' + r.total + '</span></div>' +
        (S.get('showEnglish') ? '<p class="pl-en">' + esc(r.u.title_en) + '</p>' : '') +
        '</li>';
    });

    h += '</ul><div class="thumb">' +
      '<a class="btn primary block" href="#/study/' + scored[0].u.id + '">' +
      'Хамгийн сул хэсгээс эхлэх</a></div></div>';
    render(h);
  }

  // ----------------------------------------------------------- progress
  function viewProgress() {
    const allIds = [];
    ordered.forEach(function (u) { allIds.push.apply(allIds, unitItems(u)); });
    const s = SRS.stats(allIds);
    const d = SRS.dueBreakdown(allIds);
    const fs = SRS.fluencyStats();

    let h = '<div class="screen">' +
      '<header class="topline"><span class="eyebrow">Small Step · Progress</span></header>' +
      '<h1 class="h1" style="padding:0 20px">Ахиц</h1>' +
      '<p class="fine" style="margin-top:10px">Сурсан эсэхийг өнөөдрийн оноо хэлдэггүй — долоо хоногийн ' +
      'дараа санаж байгаа эсэх л хэлнэ. Дараалсан өдөр, оноо, тэмдэг энд байхгүй: тэдгээр нь дадлыг ' +
      'хэмждэг болохоос ахиц дэвшлийг хэмждэггүй.</p>' +

      '<div class="stats">' +
      '<div class="stat green"><div class="n">' + s.mastered + '</div>' +
      '<div class="l">эзэмшсэн</div>' +
      '<div class="s">' + SRS.MASTERY_DAYS + ' өөр өдөр зөв хариулсан</div></div>' +
      '<div class="stat plain"><div class="n">' + pct(s.delayed) + '</div>' +
      '<div class="l">хойшлуулсан нарийвчлал</div>' +
      '<div class="s">' + (s.delayedAnswers
        ? SRS.DELAYED_DAYS + '+ хоногийн дараах ' + s.delayedAnswers + ' анхны хариултаас'
        : SRS.DELAYED_DAYS + '+ хоногийн дараах давталт хараахан алга') + '</div></div>' +
      '<div class="stat navy"><div class="n">' + s.mature + '</div>' +
      '<div class="l">бичиж эзэмшсэн</div>' +
      '<div class="s">16+ хоногийн зайтай, сүүлд өөрөө бичсэн</div></div>' +
      '<div class="stat ochre"><div class="n">' + s.learning + '</div>' +
      '<div class="l">сурч байгаа</div>' +
      '<div class="s">эхэлсэн, эзэмшээгүй · ' + d.fresh + ' эхлээгүй</div></div>' +
      '</div>' +
      errorSummary() + trackingSheet() +
      (s.leeches
        ? '<p class="fine" style="margin-top:10px">' + s.leeches + ' зүйл ' + SRS.LEECH_LAPSES +
          ' удаа алдсан тул хуудсаа дахин уншихыг хүлээж байна. Эзэмшсэнд тооцохгүй.</p>'
        : '') +
      (fs.recentMs != null
        ? '<p class="fine" style="margin-top:10px">Хурд: эзэмшсэн зүйлд зөв хариулах дундаж ' +
          (fs.recentMs / 1000).toFixed(1) + ' с' +
          (fs.earlierMs != null ? ' (өмнө ' + (fs.earlierMs / 1000).toFixed(1) + ' с)' : '') +
          ' · ' + fs.answers + ' хариултаас.</p>'
        : '') +
      (s.answers
        ? '<p class="fine" style="margin-top:10px">Бүх оролдлогын түүхий нарийвчлал ' + pct(s.accuracy) +
          ' (' + s.answers + '). Энэ тоог толгойд бүү тавь — шинэ зүйл дээр хийсэн алдаа сурч байгаагийн шинж.</p>'
        : '') +

      '<div class="sectionhead"><span class="eyebrow">Нэгжээр · By unit</span></div>' +
      '<ul class="prog-list">';

    ordered.forEach(function (u) {
      const ids = unitItems(u);
      const us = SRS.stats(ids);
      const b = SRS.dueBreakdown(ids);
      h += '<li>' +
        '<div class="pl-title">' + esc(u.title_mn) + '</div>' +
        '<div class="bar"><i style="width:' + pctw(us.mastered, ids.length) + '"></i></div>' +
        '<div class="pl-nums">' +
        '<span><b>' + us.mastered + ' / ' + ids.length + '</b> эзэмшсэн</span>' +
        '<span><b>' + pct(us.accuracy) + '</b> нарийвчлал</span>' +
        '<span><b>' + b.review + '</b> давтах</span>' +
        '<span><b>' + b.fresh + '</b> шинэ</span>' +
        '</div></li>';
    });

    h += '</ul><div class="spacer"></div>' + tabbar('#/progress') + '</div>';
    render(h);
  }

  /** The plan's four numbers: baseline vs the last three checks. */
  function trackingSheet() {
    const b = TRACK.baseline();
    if (!b) return '';
    const r = TRACK.recent(3);
    const v = TRACK.verdict();
    const VERDICT = {
      working: 'Алдаа буурч, өгүүлбэр уртсаж байна — ажиллаж байна.',
      safe: 'Алдаа буурсан ч өгүүлбэр уртсаагүй — аюулгүй тоглож байна. Урт бүтэц оролд.',
      stretching: 'Алдаа буураагүй ч өгүүлбэр уртсаж байна — хэцүү бүтэц оролдож байна. Хэвийн.',
      flat: 'Хоёулаа хэвээр — засуулсан бичвэр дутуу. Илүү суралцах биш, илүү засуулах.'
    };
    const cell = function (x, suffix) { return x == null ? '—' : x + (suffix || ''); };
    const fmt = function (t) { const d = new Date(t); return d.getUTCMonth() + 1 + '.' + d.getUTCDate(); };
    return '<div class="sectionhead"><span class="eyebrow">Дөрвөн тоо · Tracking</span>' +
      '<span class="metaline">' + TRACK.all().length + ' шалгалт</span></div>' +
      '<div class="scroll"><table class="sheet"><tr><th></th><th>үг</th><th>алдаа/100</th><th>ART/100</th><th>дэд өг./өг.</th><th>үг/мин</th></tr>' +
      '<tr><td>суурь · ' + fmt(b.t) + '</td><td>' + b.words + '</td><td>' + cell(b.per100) + '</td><td>' + cell(b.art100) + '</td><td>' + b.cps + '</td><td>' + cell(b.wpm) + '</td></tr>' +
      (r && TRACK.all().length > 1
        ? '<tr><td>сүүлийн ' + r.n + '</td><td>' + cell(r.words) + '</td><td>' + cell(r.per100) + '</td><td>' + cell(r.art100) + '</td><td>' + cell(r.cps) + '</td><td>' + cell(r.wpm) + '</td></tr>'
        : '') +
      '</table></div>' +
      (v ? '<p class="fine" style="margin-top:10px">' + VERDICT[v] + '</p>'
         : '<p class="fine" style="margin-top:10px">Дүгнэлт 4 шалгалтын дараа гарна. Алдаа/100 үгийг ганцаараа бүү унш — богино өгүүлбэр бичвэл буурдаг.</p>');
  }

  /** The learner's own errors: graduated only by absence from checked drafts. */
  function errorSummary() {
    const q = ERRQ.summary();
    if (!q.tracked) return '';
    return '<div class="sectionhead"><span class="eyebrow">Таны алдаа · Your errors</span>' +
      '<span class="metaline">' + q.entries + ' шалгуулсан</span></div>' +
      '<div class="stats">' +
      '<div class="stat green"><div class="n">' + q.graduated + '</div><div class="l">төгссөн</div>' +
      '<div class="s">' + ERRQ.MASTERY_DAYS + ' өдөр зөв засаад, ' + ERRQ.CLEAN_ENTRIES + ' бичвэрт дахин гараагүй</div></div>' +
      '<div class="stat navy"><div class="n">' + q.queued + '</div><div class="l">дасгалд</div>' +
      '<div class="s">' + q.tracked + ' бүртгэгдсэнээс · ' + q.due + ' өнөөдөр</div></div>' +
      '</div>' +
      (q.categoriesGraduated.length
        ? '<p class="fine" style="margin-top:10px">Төгссөн ангилал: ' +
          esc(q.categoriesGraduated.join(', ').replace(/_/g, ' ')) + '</p>' : '') +
      (q.leeches
        ? '<p class="fine" style="margin-top:10px">' + q.leeches + ' өгүүлбэрийг ' + ERRQ.LEECH_LAPSES +
          ' удаа засаж чадсангүй — дасгалаас түр гаргалаа; дүрмийг нь уншсаны дараа эргэж ирнэ.</p>' : '') +
      (q.disputed
        ? '<p class="fine" style="margin-top:10px">' + q.disputed + ' засварыг та буруу гэж үзсэн; дахин асуухгүй.</p>' : '');
  }

  // ----------------------------------------------------------- settings
  let resetArmed = false;

  function sw(key, mn, en) {
    const on = !!S.get(key);
    return '<div class="set-row"><div class="set-label">' +
      '<div class="mn">' + esc(mn) + '</div>' +
      '<div class="en">' + esc(en) + '</div></div>' +
      '<button class="switch' + (on ? ' on' : '') + '" data-act="sw" data-k="' + key + '" ' +
      'role="switch" aria-checked="' + on + '" aria-label="' + esc(mn) + '"><i></i></button></div>';
  }

  function viewSettings() {
    let h = '<div class="screen">' +
      '<header class="topline"><span class="eyebrow">Small Step · Settings</span></header>' +
      '<h1 class="h1" style="padding:0 20px">Тохиргоо</h1>' +
      '<div class="spacer"></div>' +

      '<div class="set-group">' +
      '<div class="set-row"><div class="set-label">' +
      '<div class="mn">Нэг суултын урт</div>' +
      '<div class="en">Questions in one sitting</div></div>' +
      '<div class="seg">' + S.SESSION_CHOICES.map(function (n) {
        return '<button class="' + (S.get('sessionLength') === n ? 'on' : '') + '" ' +
          'data-act="sess" data-n="' + n + '">' + n + '</button>';
      }).join('') + '</div></div>' +
      sw('showEnglish', 'Англи тайлбар', 'Show the English gloss beside the Mongolian') +
      sw('showSource', 'Эх сурвалжийн шошго', 'Show НОМ / ГАРЫН АВЛАГА / ХОЁУЛАА labels') +
      sw('strictTyping', 'Хатуу шалгалт', 'Typed answers must match case and punctuation') +
      '</div>' +

      '<div class="set-group">' +
      '<div class="set-row col"><div class="set-label">' +
      '<div class="mn">Бичвэр засуулах · Anthropic API түлхүүр</div>' +
      '<div class="en">' + (CORRECT.enabled() ? 'Идэвхтэй · ' + CORRECT.MODEL : 'Хоосон — Бичих хэсэгт засвар байхгүй') + '</div></div>' +
      '<div class="keyrow"><input id="apikey" type="password" autocomplete="off" placeholder="sk-ant-…" ' +
      'value="' + esc(CORRECT.getKey()) + '">' +
      '<button class="btn" data-act="savekey">Хадгалах</button></div>' +
      '<p class="fine">Зөвхөн Бичих хэсгийн орчуулгууд илгээгдэнэ; дасгал, уншлага хэзээ ч илгээгдэхгүй. ' +
      'Загвар засварласан өгүүлбэр л буцаана — алдааны жагсаалтыг код тооцоолно. Түлхүүр энэ төхөөрөмж дээр ' +
      'хадгалагдаж, ахицын экспортод орохгүй.</p></div></div>' +

      '<p class="fine">Эзэмшсэн гэдгийг ' + SRS.MASTERY_DAYS + ' өөр өдөр зөв хариулсан гэж ' +
      'тодорхойлно. Энэ нь тохиргоо биш — апп ахицынхаа тухай мэдэгдлийг үүн дээр ' +
      'тулгуурлан хийдэг тул өөрчилж болохгүй.</p>' +

      '<div class="set-group">' +
      '<div class="set-row"><div class="set-label">' +
      '<div class="mn">Танилцуулгыг дахин үзэх</div>' +
      '<div class="en">Replay the three setup questions</div></div>' +
      '<a class="btn" href="#/onboarding">Үзэх</a></div>' +
      '<div class="set-row"><div class="set-label">' +
      '<div class="mn">Ахицыг хуулбарлах</div>' +
      '<div class="en">Copy your progress as JSON</div></div>' +
      '<button class="btn" data-act="export">Хуулах</button></div>' +
      '</div>' +

      '<div class="set-group">' +
      '<div class="set-row"><div class="set-label">' +
      '<div class="mn">Бүх ахицыг устгах</div>' +
      '<div class="en">' + (resetArmed ? 'Дахин дарвал устана — буцаах боломжгүй'
        : 'This cannot be undone') + '</div></div>' +
      '<button class="btn danger" data-act="reset">' +
      (resetArmed ? 'Устгах' : 'Устгах') + '</button></div></div>' +

      '<p class="fine">Ахиц зөвхөн энэ төхөөрөмж дээр хадгалагдана. Хаашаа ч илгээгддэггүй.</p>' +
      '<div class="spacer"></div>' + tabbar('#/settings') + '</div>';
    render(h);
  }

  actions['sw'] = function (el) { S.toggle(el.getAttribute('data-k')); viewSettings(); };
  actions['sess'] = function (el) {
    S.set('sessionLength', parseInt(el.getAttribute('data-n'), 10));
    viewSettings();
  };
  actions['savekey'] = function () {
    const inp = document.getElementById('apikey');
    CORRECT.setKey(inp ? inp.value : '');
    viewSettings();
  };
  actions['export'] = function () {
    const blob = SRS.exportState();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(blob).then(function () {
        window.alert('Ахицын өгөгдөл санах ойд хуулагдлаа.');
      }, function () { window.prompt('Хуулж авна уу:', blob); });
    } else {
      window.prompt('Хуулж авна уу:', blob);
    }
  };
  actions['reset'] = function () {
    if (!resetArmed) { resetArmed = true; return viewSettings(); }
    SRS.reset();
    ERRQ.reset();
    TRACK.reset();
    resetArmed = false;
    location.hash = '#/';
  };

  // -------------------------------------------------------------- routing
  function route() {
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);

    if (!S.get('onboarded') && parts[0] !== 'onboarding') {
      location.hash = '#/onboarding';
      return;
    }
    if (parts[0] !== 'settings') resetArmed = false;

    if (!parts.length) return viewHome();
    switch (parts[0]) {
      case 'onboarding': return viewOnboarding();
      case 'read': return viewRead(parts[1]);
      case 'study': return viewStudy(parts[1]);
      case 'fluency': return viewFluency();
      case 'results': return viewResults();
      case 'write': return viewWrite();
      case 'placement': return viewPlacement();
      case 'progress': return viewProgress();
      case 'settings': return viewSettings();
      default: return viewHome();
    }
  }

  // Keyboard: A-D or 1-4 pick an option, Enter advances.
  document.addEventListener('keydown', function (e) {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (e.key === 'Enter') {
      const d = app.querySelector('[data-act="drill"]') || app.querySelector('[data-act="fl-next"]');
      if (d) { e.preventDefault(); d.click(); return; }
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    let idx = -1;
    if (/^[1-9]$/.test(e.key)) idx = parseInt(e.key, 10) - 1;
    else if (/^[a-dA-D]$/.test(e.key)) idx = e.key.toLowerCase().charCodeAt(0) - 97;
    if (idx < 0) return;
    const opts = app.querySelectorAll('.opt:not([disabled])');
    if (opts.length > idx) { e.preventDefault(); opts[idx].click(); }
  });

  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline is a bonus */ });
  }
})();
