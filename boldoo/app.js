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
    const n = Math.min(S.get('sessionLength'), d.total || S.get('sessionLength'));

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
      (d.total
        ? '<button class="btn gold block" data-go="#/study">Хичээллэх · ' + n + ' асуулт</button>'
        : '<button class="btn gold block" disabled>Өнөөдөрт дууссан</button>') +
      '</section>' +

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

    h += '<div class="thumb">' +
      '<a class="btn primary block" href="#/study/' + u.id + '">Энэ нэгжийг дасгалжуулах · ' +
      S.get('sessionLength') + ' асуулт</a></div></div>';
    render(h);
  }

  // --------------------------------------------------------------- drill
  let session = null;

  function buildSession(unitId) {
    const units = unitId ? [byId[unitId]] : ordered;
    const items = EX.forUnits(units);
    const index = {};
    items.forEach(function (i) { index[i.id] = i; });
    const ids = SRS.pick(items.map(function (i) { return i.id; }), S.get('sessionLength'));
    return {
      unitId: unitId || null,
      label: unitId ? byId[unitId].title_mn : 'Холимог',
      queue: ids.map(function (id) { return index[id]; }),
      pos: 0, right: 0, missed: [],
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
      '<span class="eyebrow tight">' + esc(it.tag || (u ? u.title_mn : '')) + '</span>' +
      (S.get('showSource')
        ? '<span class="q-src" style="color:' + tone + '">' + esc(it.source) + '</span>' : '') +
      '</div>' +
      '<h1 class="prompt' + (it.prompt.length > 42 ? ' small' : '') + '">' + esc(it.prompt) + '</h1>' +
      (it.promptNote ? '<p class="q-note">' + esc(it.promptNote) + '</p>' : '') +
      '</div>' + body;

    if (s.checked) {
      h += '<div class="fb ' + (ok ? 'good' : 'bad') + '">' +
        '<div class="fb-top"><span class="fb-verdict">' + (ok ? 'Зөв' : 'Буруу') + '</span>' +
        (S.get('showSource') ? '<span class="fb-src">' + esc(it.source) + '</span>' : '') +
        '</div>' +
        (ok ? '' : '<div class="fb-answer">' + esc(it.answer) + '</div>') +
        (it.explain ? '<div class="fb-explain">' + esc(it.explain).replace(/\n/g, '<br>') + '</div>' : '') +
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
      SRS.grade(it.id, ok);
      if (ok) s.right += 1;
      else s.missed.push({
        prompt: it.prompt,
        given: it.kind === 'choice'
          ? (s.picked == null ? '—' : it.options[s.picked])
          : (String(s.typed).trim() || '—'),
        answer: it.answer
      });
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
    const total = s.queue.length;
    const again = total - s.right;

    let h = '<div class="screen"><div class="res">' +
      '<div class="res-head">' +
      '<div class="eyebrow">Дууслаа · Session done</div>' +
      '<div class="res-score">' + pct(s.right / total) + '</div>' +
      '<p class="res-line">' + s.right + ' / ' + total + ' зөв · ' + esc(s.label) + '</p>' +
      '</div>' +
      '<div class="res-cards">' +
      '<div class="res-card green"><div class="n">' + s.right + '</div>' +
      '<div class="l">зөв хариулт</div>' +
      '<div class="s">Эзэмшсэн гэхэд ' + SRS.MASTERY_DAYS + ' өөр өдөр зөв</div></div>' +
      '<div class="res-card ochre"><div class="n">' + again + '</div>' +
      '<div class="l">дахин ирнэ</div>' +
      '<div class="s">Удахгүй давтагдана</div></div>' +
      '</div>';

    if (s.missed.length) {
      h += '<div class="sectionhead" style="padding-left:4px;padding-right:4px">' +
        '<span class="eyebrow tight">Алдсан зүйл · Missed</span></div>' +
        '<div class="missed">' + s.missed.map(function (m) {
          return '<div class="row"><div class="p">' + esc(m.prompt) + '</div>' +
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
      '<p class="fine" style="margin-top:10px">Эдгээрийг машин шалгаж чадахгүй. Өөрөө бичээд ' +
      'үнэлнэ үү — энэ хэсгийн үр дүн нарийвчлалын тоонд ордоггүй.</p>';

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
        '</div>';

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

  actions['draft'] = function () { /* value read on blur below */ };
  app.addEventListener('input', function (e) {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-act') === 'draft') {
      drafts[t.getAttribute('data-id')] = t.value;
    }
  });
  actions['w-ok'] = function (el) {
    const id = el.getAttribute('data-id');
    marked[id] = true; SRS.grade(id, true); viewWrite();
  };
  actions['w-no'] = function (el) {
    const id = el.getAttribute('data-id');
    marked[id] = false; SRS.grade(id, false); viewWrite();
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

    let h = '<div class="screen">' +
      '<header class="topline"><span class="eyebrow">Small Step · Progress</span></header>' +
      '<h1 class="h1" style="padding:0 20px">Ахиц</h1>' +
      '<p class="fine" style="margin-top:10px">Хоёрхон тоо чухал: хэдийг эзэмшсэн, хэр зөв ' +
      'хариулсан. Дараалсан өдөр, оноо, тэмдэг энд байхгүй — тэдгээр нь дадал зуршлыг ' +
      'хэмждэг болохоос ахиц дэвшлийг хэмждэггүй.</p>' +

      '<div class="stats">' +
      '<div class="stat green"><div class="n">' + s.mastered + '</div>' +
      '<div class="l">эзэмшсэн</div>' +
      '<div class="s">' + SRS.MASTERY_DAYS + ' өөр өдөр зөв хариулсан</div></div>' +
      '<div class="stat plain"><div class="n">' + pct(s.accuracy) + '</div>' +
      '<div class="l">нарийвчлал</div>' +
      '<div class="s">' + s.answers + ' хариултаас</div></div>' +
      '<div class="stat navy"><div class="n">' + s.learning + '</div>' +
      '<div class="l">сурч байгаа</div>' +
      '<div class="s">эхэлсэн, эзэмшээгүй</div></div>' +
      '<div class="stat ochre"><div class="n">' + d.fresh + '</div>' +
      '<div class="l">эхлээгүй</div>' +
      '<div class="s">нийт ' + s.known + '-аас</div></div>' +
      '</div>' +

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
      const d = app.querySelector('[data-act="drill"]');
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
