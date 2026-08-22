/* Material derived from docs/source/English-Mongolian-Contrastive-Guide.docx.
 *
 * WHY THIS IS A SEPARATE FILE
 * ---------------------------
 * content/lessons.js is a faithful record of a printed book. This file is a
 * second, independent source. They are never merged into one array of "facts",
 * because when they disagree the learner needs to see WHICH source said what.
 * The app labels everything here as coming from the guide.
 *
 * Three kinds of material:
 *
 *   warn    the book teaches something the guide identifies as a predicted
 *           error for Mongolian speakers. The book is not deleted; the
 *           conflict is shown.
 *   confirm the two sources independently agree. Worth saying out loud —
 *           agreement between a Mongolian classroom textbook and a
 *           contrastive analysis is evidence, not repetition.
 *   gap     the guide treats something as high priority that pages 6-22 of the
 *           book do not cover at all.
 *
 * Every note and unit carries `src`, the guide section it came from.
 */
window.BOLDOO_CONTRASTIVE = (function () {
  'use strict';

  const N = (kind, src, mn, en) => ({ t: 'note', kind: kind, src: src, mn: mn, en: en });

  // ------------------------------------------------------------------ notes
  // Attached to the book units they bear on, shown after the book's own blocks.
  const notes = {
    'u-pronouns': [
      N('confirm', '§1.3 · 4',
        'Ном "He — Тэр эрэгтэй", "She — Тэр эмэгтэй" гэж ялгаж бичсэн нь зөв арга барил. ' +
        'Монгол хэлний "тэр" нь he, she, it, that бүгдийг илэрхийлдэг тул англи хэл заавал ' +
        'хүйс сонгуулдаг.',
        'The guide calls this the right bridge, and adds a warning: this is a SPEED problem, ' +
        'not a knowledge problem. Learners know the rule and still say "My wife, he works…" ' +
        'under time pressure. Only automaticity fixes it.')
    ],

    'u-verbs': [
      N('confirm', '§KK · 30-31',
        'Номын PP2/PP3 хүснэгт нь дараах алдааг шууд заслаг: "I have went there" → ' +
        '"I have gone there"; "The report was wrote" → "was written".',
        'The guide lists exactly these as errors 30 and 31. The book\'s three-column table ' +
        'is the direct fix: PP2 after did/past simple, PP3 after have/had/was.')
    ],

    'u-tense-grid': [
      N('confirm', '§D',
        'Номын 4x4 хүснэгтийн эхний 12 нүд нь заавартай яг тохирч байна ' +
        '(Past/Present/Future x Simple/Continuous/Perfect/Perfect continuous).',
        'The guide gives the same 12 forms. The book adds four more — "future in the past", ' +
        'the would-forms — which the guide covers separately under reported speech (§X backshift). ' +
        'The two sources do not conflict; the book simply goes further.'),
      N('warn', '§D',
        'Ном "ago"-г Perfect continuous бүх нүдэнд түлхүүр үг болгон бичсэн. "ago" бол ' +
        'Past simple-ийн тэмдэг. Perfect хэлбэрүүдэд "for" ба "since" хэрэглэнэ.',
        'The book lists "ago, since" as keywords for all four Perfect Continuous cells. ' +
        '"ago" marks past simple — the book itself lists it correctly under Past Simple. ' +
        'With perfect forms use for and since: "I have been working here for two hours" / ' +
        '"…since 2019", not "…two hours ago".'),
      N('gap', '§D',
        'Ном "Ж, Ч байна → Tobe + Ving" дүрмийг болзолгүйгээр өгсөн. Гэвч зарим үйл үг ' +
        'үргэлжлэх хэлбэрт ОРДОГГҮЙ: know, understand, believe, want, need, like, own, ' +
        'contain, seem, belong.',
        'Applied without a guard, the book\'s mapping produces "I am knowing the answer" — ' +
        'error 26 in the guide\'s checklist. Stative verbs take the simple form: "I know the answer."')
    ],

    'u-sounds-vowels': [
      N('gap', '§1.5 · §1.6',
        'Номын эгшгийн хүснэгтэд /ə/ (schwa), /ɪ/ (богино и), /æ/ байхгүй. Мөн үгийн ' +
        'өргөлтийн тухай нэг ч мөр байхгүй.',
        'The guide calls /ə/ "the most frequent sound in English" and /iː/ vs /ɪ/ ' +
        '"the most important pair" — sheep/ship, deep/dip. It also says word stress is worth ' +
        'more than every consonant and vowel problem combined, because wrong stress makes you ' +
        'unintelligible even when every sound is right. None of that is on page 12. ' +
        'See the two added units below.')
    ],

    'u-sounds-consonants': [
      N('warn', '§1.6 · 3',
        'Ном "Wh — бусад тохиолдолд В-р дуудна" гэсэн. Энэ нь БУРУУ. What, white, wheel, why ' +
        'зэрэг үгс /w/ авиатай — уруул дугуйрч, шүд юунд ч хүрэхгүй. Кирилл "в" нь /v/ авиа ' +
        'бөгөөд шүд уруулд хүрдэг.',
        'This is the single most damaging line on page 13. The guide lists /v/ vs /w/ as ' +
        'predictable enemy #3 — the two are already merged for many Mongolian speakers, and ' +
        'the book actively reinforces the merger on the commonest question words in English. ' +
        '/w/ = lips rounded like a small kiss, teeth touch nothing. /v/ = teeth on lip, buzzing. ' +
        'Minimal pairs: vest/west, vine/wine, very/wary, vein/wane.'),
      N('warn', '§1.6 · 2',
        'Ном "Th → Т" ба "Th → Д" гэж өгсөн. Англи хэлний /θ/ ба /ð/ нь хэлний үзүүрийг ' +
        'ШҮДНИЙ ХООРОНД гаргаж дуудна — хэл харагдах ёстой. "Т"/"Д" гэж дуудвал think→tink, ' +
        'this→dis болно.',
        'The book is trying to describe /θ/ and /ð/ with the nearest Cyrillic letters, and its ' +
        'gloss "хэлний үзүүрээр сийгүүлэн" does point at the tongue tip. But a learner reading ' +
        '"Т" will produce /t/, which is exactly the substitution the guide names as enemy #2. ' +
        'Minimal pairs: think/sink, thick/sick, three/tree, path/pass, mouth/mouse.'),
      N('confirm', '§1.6 · 5',
        'Номын "kn → Н", "wr → р", "-ph → Ф", "tion → Шн", "sion → Жн" мөрүүд зөв.',
        'These lines agree with standard English phonics and the guide raises no objection ' +
        'to them. The problem on page 13 is confined to wh and th.')
    ],

    'u-prepositions': [
      N('confirm', '§R',
        'Номын цаг хугацааны хүснэгт зааврын "at → on → in" логиктой яг тохирч байна: ' +
        'at 7 o\'clock (цэг), on Saturday / on May 11 (өдөр), in March / in 2002 / in summer ' +
        '(урт хугацаа).',
        'The guide frames this as a shrinking hierarchy — at = a point, on = a surface or line, ' +
        'in = an enclosed space — and says time follows the same logic. The book\'s table is ' +
        'the same system without the name. Learn the hierarchy once and both tables collapse ' +
        'into one rule.'),
      N('warn', '§R',
        'Ном "nearby the flat — байрны ойр" гэж бичсэн. "nearby" нь угтвар үг БИШ. ' +
        'Зөв нь "near the flat".',
        '"nearby" is an adverb or adjective — "the flat nearby", "a nearby flat". ' +
        'Only "near" works as a preposition before a noun.'),
      N('gap', '§R · §KK 49-62',
        'Ном угтвар үгийг байршил, чиглэл, цаг хугацаагаар нь ангилсан. Гэвч англи хэлний ' +
        'алдааны хамгийн том эх сурвалж бол ХАМААРАЛТ угтвар үгс — үйл үг бүр өөрийн ' +
        'угтвар үгтэйгээ хамт цээжлэгддэг.',
        'depend ON, consist OF, result IN, focus ON, interested IN, responsible FOR, ' +
        'married TO, good AT. And the verbs that take NO preposition at all — discuss, enter, ' +
        'approach, marry, lack, resemble, mention, answer, reach, join, affect, phone. ' +
        'See the added unit below.')
    ],

    'l2-translation': [
      N('confirm', '§1.3 · 7',
        'Номын №1 буулгалт "Байх, бол → Tobe / am is are" нь зааварт "төгс эхний хичээл" ' +
        'гэж нэрлэсэн зүйл.',
        'The guide singles this out: "Би геологич" → "I am a geologist" is the perfect first ' +
        'lesson, because one four-word sentence contains two of the biggest enemies at once.'),
      N('gap', '§1.3 · 2 · §M',
        'Гэвч энэ буулгалт зөвхөн НЭГ дутууг нөхөж байна. "Би геологич" → "I am a geologist" ' +
        'гэхэд англи хэл ХОЁР зүйл нэмэхийг шаарддаг: "am" ба "a". Ном "a"-г огт заагаагүй.',
        'The book teaches the copula and stops. The guide calls articles "the biggest single ' +
        'enemy" and devotes errors 1-12 to them. A learner who applies mapping #1 faithfully ' +
        'still produces "I am geologist." See the added articles unit below.'),
      N('confirm', '§D',
        'Номын №18-24 буулгалтууд (чихсан/цан → have+Ved/pp3, саар л байна → have been+Ving) ' +
        'нь зааврын "trigger words" системтэй тохирч байна: since, for, already, yet, just, ' +
        'ever, never, so far, recently.',
        'The guide says these trigger words cover about 80% of present-perfect usage. ' +
        'The book reaches the same forms from the Mongolian ending instead. Two routes, ' +
        'one destination — use whichever fires first when you are speaking.')
    ],

    'l3-syntax': [
      N('confirm', '§T',
        'Номын "S + tobe + O + Ad + L + TE" бүтэц нь зааврын SVOMPT-тэй ЯГ ижил систем: ' +
        'Subject → Verb → Object → Manner → Place → Time.',
        'Ad = Manner, L = Place, TE = Time. Two independent sources — a Mongolian classroom ' +
        'textbook and a contrastive analysis — arrived at the same slot order. That is the ' +
        'strongest single piece of evidence in this app. Learn this order and errors 41-43 ' +
        'in the guide\'s checklist disappear: "We drilled last week three holes" ✗ → ' +
        '"We drilled three holes last week" ✓.'),
      N('warn', '§E',
        'Номын асуултын томьёо зөвхөн TOBE-г ашигласан: "TOBE + S + O + Ad + L + TE?". ' +
        'Гэвч англи хэлний ихэнх асуулт TOBE-гүй бөгөөд DO / DOES / DID шаарддаг.',
        'The book\'s own tense grid lists Do/Does and Did as the auxiliaries for the simple ' +
        'tenses, but the syntax lesson\'s question formulas never use them. The guide calls ' +
        'do-support "the strangest thing in the language" and the biggest question-error ' +
        'source: "Where you work?" ✗ → "Where do you work?" ✓. See the added unit below.'),
      N('confirm', '§1.3 · 4',
        'Номын 6 FORM хүснэгт (POS/NEG/GEN/DIS/SPE/SUB) нь асуултын төрлүүдийг ' +
        'системтэйгээр өгсөн бөгөөд зааварт үүнтэй зөрчилдөх зүйл алга.',
        'The six forms map cleanly onto the guide\'s categories: positive, negative, ' +
        'yes/no question, alternative question, wh-question, subject question.')
    ]
  };

  // ------------------------------------------------------------------ units
  // New drillable material for what pages 6-22 do not cover.

  const stress = {
    id: 'cg-stress',
    kind: 'guide',
    title_mn: 'Үгийн өргөлт ба schwa /ə/',
    title_en: 'Word stress and the schwa',
    src: '§1.5',
    pages: [],
    blurb_en: 'The guide ranks this above every consonant and vowel problem combined. ' +
      'Wrong sounds give you an accent, and accents are fine. Wrong stress makes you ' +
      'unintelligible — a listener may not recognise the word at all.',
    blocks: [
      N('gap', '§1.5',
        'Монгол хэлэнд өргөлт сул, урьдчилан таамаглах боломжтой (ихэвчлэн эхний үе) ба ' +
        'утга өөрчилдөггүй. Үе бүр бүтэн эгшгээ хадгална. Англи хэлэнд өргөлт хүчтэй, ' +
        'таамаглах боломжгүй, утга өөрчилдөг — өргөлтгүй үеийн эгшиг нурж /ə/ болдог.',
        'Stop giving every syllable equal weight. Make ONE syllable strong and crush the rest.'),
      {
        t: 'qa',
        label: 'Дагаварт суурилсан өргөлтийн дүрэм',
        drill: true,
        items: [
          { q: '-tion / -sion / -cian', a: 'Яг өмнөх үеийг өргөнө', why: 'ex-plo-RA-tion · pro-DUC-tion · in-for-MA-tion · pre-CI-sion' },
          { q: '-ity', a: 'Яг өмнөх үеийг өргөнө', why: 'fea-si-BIL-i-ty · ac-TIV-i-ty · ca-PAC-i-ty · DEN-si-ty' },
          { q: '-ic / -ical', a: 'Яг өмнөх үеийг өргөнө', why: 'ge-o-LOG-ic · vol-CAN-ic · tec-TON-ic · sta-TIS-ti-cal' },
          { q: '-ogy / -graphy / -ometry', a: 'Төгсгөлөөс гуравдахь үеийг өргөнө', why: 'ge-OL-o-gy · li-THOL-o-gy · tech-NOL-o-gy · ge-OG-ra-phy. Анхаар: GEO-logy ✗' },
          { q: '-ate (үйл үг)', a: 'Төгсгөлөөс гуравдахь үеийг өргөнө', why: 'ES-ti-mate · CAL-cu-late · e-VAL-u-ate · in-VES-ti-gate' },
          { q: '-ment / -ness / -less / -ful / -er / -ing / -ly / -able', a: 'Өргөлт хөдөлдөггүй', why: 'de-VEL-op → de-VEL-op-ment · MEA-sure → MEA-sure-ment' }
        ]
      },
      {
        t: 'qa',
        label: 'Нэр үг / үйл үгийн хос — өргөлт утга ялгана',
        drill: true,
        items: [
          { q: 'survey — нэр үг', a: '1-р үе: SUR-vey', why: 'The SUR-vey is finished. / We will sur-VEY the area.' },
          { q: 'survey — үйл үг', a: '2-р үе: sur-VEY', why: 'Nouns take stress 1, verbs take stress 2.' },
          { q: 'record — нэр үг', a: '1-р үе: REC-ord', why: 'Check the REC-ords. / Please re-CORD the data.' },
          { q: 'record — үйл үг', a: '2-р үе: re-CORD', why: 'Nouns take stress 1, verbs take stress 2.' },
          { q: 'project — нэр үг', a: '1-р үе: PRO-ject', why: 'A mining PRO-ject. / pro-JECT the growth.' },
          { q: 'project — үйл үг', a: '2-р үе: pro-JECT', why: 'Nouns take stress 1, verbs take stress 2.' },
          { q: 'increase — нэр үг', a: '1-р үе: IN-crease', why: 'A 5% IN-crease. / Costs will in-CREASE.' },
          { q: 'increase — үйл үг', a: '2-р үе: in-CREASE', why: 'Nouns take stress 1, verbs take stress 2.' },
          { q: 'contract — нэр үг', a: '1-р үе: CON-tract', why: 'Sign the CON-tract. / Metals con-TRACT when cold.' },
          { q: 'export — нэр үг', a: '1-р үе: EX-port', why: 'Coal EX-ports. / We ex-PORT coal.' }
        ]
      },
      {
        t: 'qa',
        label: 'Schwa /ə/ — өргөлтгүй үе хэрхэн нурдаг',
        drill: true,
        items: [
          { q: 'geology', a: 'dʒi-ˈɒl-ə-dʒi', why: 'ge-o-lo-gy (4 тэнцүү үе) ✗ — "o" нь /ə/ болж нурна.' },
          { q: 'deposit', a: 'də-ˈpɒz-ɪt', why: 'de-po-sit (3 тэнцүү үе) ✗ — эхний "e" нь /ə/ болно.' },
          { q: 'mineral', a: 'ˈmɪn-ə-rəl', why: 'Хоёр schwa. mi-ne-ral ✗' },
          { q: 'computer', a: 'kəm-ˈpjuː-tə', why: 'Хоёр schwa.' },
          { q: 'about', a: 'ə-ˈbaʊt', why: '"a" нь /ə/.' }
        ]
      }
    ]
  };

  const pron = {
    id: 'cg-pron',
    kind: 'guide',
    title_mn: 'Гийгүүлэгч ба эгшгийн ялгаа',
    title_en: 'The predictable sound enemies',
    src: '§1.6',
    pages: [],
    blurb_en: 'Six consonant problems and the vowel pairs, each one predictable from ' +
      'Mongolian. Two of them are made worse by page 13 of the book.',
    blocks: [
      {
        t: 'pron',
        label: 'Гийгүүлэгч',
        drill: true,
        items: [
          {
            key: '/θ/', name: '/θ/ — th, дүлий',
            how: 'Хэлний үзүүрийг шүдний хооронд гаргаж үлээнэ. Хэл чинь харагдах ёстой.',
            words: ['think', 'three', 'thirty', 'thick', 'depth', 'north', 'earth', 'method', 'thousand'],
            pairs: [['think', 'sink'], ['thick', 'sick'], ['three', 'tree'], ['path', 'pass'], ['mouth', 'mouse']],
            warn: 'Ном үүнийг "Т"-гээр өгсөн (х.13). "Т" гэж дуудвал think → tink болно.'
          },
          {
            key: '/ð/', name: '/ð/ — th, эгшигт',
            how: 'Мөн адил хэл шүдний хооронд, гэхдээ хоолой чичирнэ.',
            words: ['the', 'this', 'that', 'they', 'there', 'then', 'weather', 'mother', 'together', 'northern'],
            pairs: [],
            warn: 'Ном үүнийг "Д"-гээр өгсөн (х.13).'
          },
          {
            key: '/w/', name: '/w/ — уруул дугуйрна',
            how: 'Уруул жижиг үнсэлт мэт дугуйрна. Шүд юунд ч хүрэхгүй.',
            words: ['what', 'white', 'wheel', 'why', 'west', 'wine', 'wary', 'wane'],
            pairs: [['west', 'vest'], ['wine', 'vine'], ['wary', 'very'], ['wane', 'vein']],
            warn: 'Ном "Wh → В" гэсэн (х.13). Энэ нь БУРУУ — what, white, why бол /w/.'
          },
          {
            key: '/v/', name: '/v/ — шүд уруулд',
            how: 'Дээд шүд доод уруулд хүрч, агаар тасралтгүй урсана. Хоолой чичирнэ.',
            words: ['vest', 'vine', 'very', 'verse', 'vein', 'volume'],
            pairs: [['vest', 'west'], ['vine', 'wine'], ['very', 'wary']],
            warn: ''
          },
          {
            key: '/f/', name: '/f/ — шүд уруулд, дүлий',
            how: 'Дээд шүд доод уруулд. fffff гэж эцэс төгсгөлгүй сунгаж чадна.',
            words: ['fine', 'fall', 'fit', 'fail', 'coffee', 'fault', 'fold'],
            pairs: [['fine', 'pine'], ['fall', 'Paul'], ['fit', 'pit'], ['coffee', 'copy']],
            warn: ''
          },
          {
            key: '/p/', name: '/p/ — уруул хаагдана',
            how: 'Уруул нийлж, агаар зогсоод дэлбэрнэ. Сунгаж болохгүй.',
            words: ['pine', 'Paul', 'pit', 'pail', 'copy'],
            pairs: [['pine', 'fine'], ['pit', 'fit']],
            warn: ''
          },
          {
            key: '/r/', name: '/r/ — юунд ч хүрэхгүй',
            how: 'Хэлээ ухраан бага зэрэг өргөнө. Үзүүр нь юунд ч хүрэхгүй хөвнө. ' +
                 'Ямар нэг тачигнах чимээ гарвал буруу.',
            words: ['rig', 'reach', 'reserve', 'four', 'drill', 'ore'],
            pairs: [],
            warn: 'Монгол "р" нь чичиргээт. Англи /r/ огт чичирдэггүй.'
          },
          {
            key: '/ŋ/', name: '/ŋ/ — ng',
            how: 'Хэлний ард зөөлөн тагнайд хүрнэ. Төгсгөлд "г" сонсогдохгүй.',
            words: ['lung', 'bring', 'strong', 'king'],
            pairs: [],
            warn: ''
          }
        ]
      },
      {
        t: 'pron',
        label: 'Эгшиг',
        drill: true,
        items: [
          {
            key: '/iː/', name: '/iː/ — урт, чанга',
            how: 'Урт, чанга, уруул өргөн дэлгэрнэ.',
            words: ['sheep', 'feel', 'leave', 'seat', 'deep', 'reach'],
            pairs: [['sheep', 'ship'], ['feel', 'fill'], ['leave', 'live'], ['seat', 'sit'], ['deep', 'dip']],
            warn: 'Ном үүнийг өгсөн (х.12) — гэхдээ хосыг нь өгөөгүй.'
          },
          {
            key: '/ɪ/', name: '/ɪ/ — богино, сул',
            how: 'Богино, сул, ам илүү нээлттэй. Зүгээр л богино /iː/ БИШ — чанар нь өөр.',
            words: ['ship', 'fill', 'live', 'sit', 'dip', 'rich'],
            pairs: [['ship', 'sheep'], ['sit', 'seat'], ['dip', 'deep']],
            warn: 'Номын 12-р хуудсанд энэ авиа огт байхгүй. Заавар үүнийг ' +
                  '"хамгийн чухал хос" гэж нэрлэсэн.'
          },
          {
            key: '/æ/', name: '/æ/ — ам өргөн нээнэ',
            how: 'Ам өргөн нээгдэнэ.',
            words: ['sand', 'bad', 'man', 'sample', 'black'],
            pairs: [['sand', 'send'], ['bad', 'bed'], ['man', 'men']],
            warn: 'Номын 12-р хуудсанд байхгүй.'
          },
          {
            key: '/e/', name: '/e/ — ам хагас нээлттэй',
            how: 'Ам хагас нээлттэй.',
            words: ['send', 'bed', 'men', 'set', 'level'],
            pairs: [['send', 'sand'], ['bed', 'bad']],
            warn: ''
          },
          {
            key: '/ɜː/', name: '/ɜː/ — "er" авиа',
            how: 'Төвийг сахисан, уруул дугуйрахгүй, хэл хавтгай.',
            words: ['work', 'learn', 'earth', 'first', 'survey', 'reserve'],
            pairs: [],
            warn: 'Ном үүнийг "өө/ээ" гэж өгсөн (х.13). Заавар: монгол хэлэнд энэ авиа байхгүй.'
          },
          {
            key: '/ə/', name: '/ə/ — schwa',
            how: 'Ам бүрэн сулрахад гарах чимээ: "ə". Англи хэлний ХАМГИЙН ОЛОН ДАВТАГДАХ авиа.',
            words: ['about', 'mineral', 'computer', 'deposit', 'geology'],
            pairs: [],
            warn: 'Номын 12-р хуудсанд огт байхгүй.'
          }
        ]
      }
    ]
  };

  const articles = {
    id: 'cg-articles',
    kind: 'guide',
    title_mn: 'Артикль — a / an / the / хоосон',
    title_en: 'Articles',
    src: '§1.3 · 2 · §M · §KK 1-12',
    pages: [],
    blurb_en: 'The guide calls this "the biggest single enemy". Mongolian has no articles, ' +
      'so nothing in the learner\'s first language triggers the choice. Pages 6-22 of the ' +
      'book never mention them.',
    blocks: [
      N('gap', '§1.3 · 2',
        'Монгол хэлэнд артикль байхгүй. Гэхдээ ТОДОРХОЙ БАЙДЛЫГ монгол хэл тэмдэглэдэг — ' +
        'заахын тийн ялгалын -ыг / -ийг нөхцөл тодорхой зүйлд ордог, тодорхойгүй бол ' +
        'нүцгэн үлддэг. Ойлголт нь аль хэдийн байгаа; зөвхөн илэрхийлэх арга нь өөр.',
        'Use that as the bridge: the concept already exists, expressed as a case suffix ' +
        'instead of a separate word.'),
      {
        t: 'qa',
        label: 'Шийдвэрийн дараалал',
        drill: true,
        items: [
          { q: 'Сонсогч аль зүйлийг хэлж байгааг мэдэж байвал', a: 'the', why: 'Definite. "Pass me the hammer" — we both know which one.' },
          { q: 'Тоологддог, ганц тоо, анх удаа дурдаж байвал', a: 'a / an', why: 'Indefinite, first mention. "We found a new deposit."' },
          { q: 'Хоёр дахь удаа дурдаж байвал', a: 'the', why: 'Error 12: "I saw a rock. A rock was heavy" ✗ → "The rock was heavy."' },
          { q: 'Тоологдохгүй нэр үг, ерөнхий утгаар', a: 'артикльгүй', why: 'Error 9: "The geology is interesting" ✗ → "Geology is interesting."' },
          { q: 'Олон тоо, ерөнхий утгаар', a: 'артикльгүй', why: '"Geologists work outdoors." Not "The geologists…" for the profession in general.' },
          { q: 'Хэлний нэр', a: 'артикльгүй', why: 'Error 7: "He speaks the English" ✗ → "He speaks English."' },
          { q: 'Улсын нэр (ихэнх)', a: 'артикльгүй', why: 'Error 6: "I live in the Mongolia" ✗ → "in Mongolia."' },
          { q: 'a эсвэл an — аль нь вэ?', a: 'Дуудлагаар шийднэ, үсгээр биш', why: 'Errors 10-11: "a hour" ✗ → "an hour" (h чимээгүй). "an university" ✗ → "a university" (/juː/ гэж эхэлнэ).' }
        ]
      },
      {
        t: 'contrast',
        label: 'Алдаа 1-12 — засаж бичнэ үү',
        drill: true,
        items: [
          { bad: 'I am geologist.', good: 'I am a geologist.', why: 'Countable singular noun needs an article. The guide calls this the perfect first lesson.' },
          { bad: 'She is engineer.', good: 'She is an engineer.', why: '"engineer" starts with a vowel sound → an.' },
          { bad: 'We found new deposit.', good: 'We found a new deposit.', why: 'First mention, countable, singular.' },
          { bad: 'He speaks the English.', good: 'He speaks English.', why: 'Languages take no article.' },
          { bad: 'I live in the Mongolia.', good: 'I live in Mongolia.', why: 'Most country names take no article.' },
          { bad: 'The geology is interesting.', good: 'Geology is interesting.', why: 'A field of study in general takes no article.' },
          { bad: 'I go to the work at 8.', good: 'I go to work at 8.', why: '"go to work" is a fixed phrase with no article.' },
          { bad: 'It took a hour.', good: 'It took an hour.', why: 'Sound, not spelling: "hour" begins with a vowel sound.' },
          { bad: 'She is an university student.', good: 'She is a university student.', why: 'Sound, not spelling: "university" begins with /juː/.' },
          { bad: 'I work in mining industry.', good: 'I work in the mining industry.', why: 'A specific, shared referent takes the.' }
        ]
      }
    ]
  };

  const doSupport = {
    id: 'cg-do-support',
    kind: 'guide',
    title_mn: 'Do-support — асуулт ба үгүйсгэл',
    title_en: 'Do-support: questions and negation',
    src: '§E · §KK 71-76',
    pages: [],
    blurb_en: 'The book\'s question formulas use only TOBE. Most English questions have no ' +
      'TOBE in them and need do, does or did instead. The guide calls do-support ' +
      '"the strangest thing in the language".',
    blocks: [
      N('warn', '§E',
        'Монгол хэл асуултыг төгсгөлд нь бөөм нэмж үүсгэдэг (уу / үү / бэ / вэ) — үгийн ' +
        'дараалал өөрчлөгддөггүй. Англи хэл туслах үйл үгийг урагш гаргадаг, харин ' +
        'туслах үйл үг байхгүй бол DO-г ЗОРИУД оруулж ирдэг.',
        'There is no equivalent of do-support in Mongolian, so nothing prompts the learner ' +
        'to insert it. It has to become mechanical.'),
      {
        t: 'formula',
        label: 'Дүрэм',
        drill: true,
        items: [
          { name: 'Present simple — асуулт', pattern: 'Do / Does + S + V (үндсэн хэлбэр)?', gloss: 'Does she work here?' },
          { name: 'Past simple — асуулт', pattern: 'Did + S + V (үндсэн хэлбэр)?', gloss: 'Did you go?' },
          { name: 'Present simple — үгүйсгэл', pattern: 'S + do not / does not + V', gloss: "She doesn't know." },
          { name: 'Past simple — үгүйсгэл', pattern: 'S + did not + V', gloss: "I didn't go." },
          { name: 'Wh-асуулт', pattern: 'QWh + do / does / did + S + V?', gloss: 'Where do you work?' },
          { name: 'to be-тэй бол DO ХЭРЭГГҮЙ', pattern: 'TOBE + S + ...?', gloss: 'Are you ready? — номын томьёо энд хүчинтэй.' }
        ]
      },
      N('warn', '§KK 73',
        'Хамгийн чухал дүрэм: DO / DOES / DID цагийг үүрнэ. Үндсэн үйл үг ҮРГЭЛЖ ' +
        'үндсэн хэлбэртээ үлдэнэ. Хоёуланд нь цаг тавьж болохгүй.',
        'The auxiliary carries the tense, the main verb stays bare. Marking both is error 73 ' +
        '("Does she works here?") and error 33 ("I didn\'t went").'),
      {
        t: 'contrast',
        label: 'Алдаа 71-76 — засаж бичнэ үү',
        drill: true,
        items: [
          { bad: 'Where you work?', good: 'Where do you work?', why: 'A wh-question in present simple needs do.' },
          { bad: 'You work here?', good: 'Do you work here?', why: 'A yes/no question needs do at the front.' },
          { bad: 'Does she works here?', good: 'Does she work here?', why: 'Does already carries the tense — the main verb stays bare.' },
          { bad: 'I didn\'t went.', good: 'I didn\'t go.', why: 'Did already carries the past — the main verb stays bare.' },
          { bad: 'I no have time.', good: 'I don\'t have time.', why: 'English negates with do + not, not with a bare "no".' },
          { bad: 'She don\'t know.', good: 'She doesn\'t know.', why: 'He / she / it takes does.' },
          { bad: 'He asked where did I work.', good: 'He asked where I worked.', why: 'A reported question is not a question — the inversion comes back out.' }
        ]
      }
    ]
  };

  const wordOrder = {
    id: 'cg-word-order',
    kind: 'guide',
    title_mn: 'Өгүүлбэр доторх үгийн дараалал',
    title_en: 'Word order inside the sentence',
    src: '§T · §KK 41-48',
    pages: [],
    blurb_en: 'The same slot order the book teaches as S+tobe+O+Ad+L+TE, plus the two things ' +
      'the book does not cover: where adverbs may sit, and the order of stacked adjectives.',
    blocks: [
      N('confirm', '§T',
        'SVOMPT: Subject → Verb → Object → Manner → Place → Time. Энэ нь номын ' +
        '"S + tobe + O + Ad + L + TE" бүтэцтэй яг ижил (Ad = Manner, L = Place, TE = Time).',
        '"We | drilled | three holes | carefully | at the site | last week."'),
      {
        t: 'qa',
        label: 'Дайвар үгийн байрлал',
        drill: true,
        items: [
          { q: 'Давтамжийн дайвар үг (always, often, never) — үндсэн үйл үгтэй', a: 'Үйл үгийн ӨМНӨ', why: '"I always check the logs."' },
          { q: 'Давтамжийн дайвар үг — be үйл үгтэй', a: 'be-ийн ДАРАА', why: '"I am always careful." — алдаа 46.' },
          { q: 'Давтамжийн дайвар үг — туслах үйл үгтэй', a: 'Эхний туслах үйл үгийн ДАРАА', why: '"I have always worked here."' },
          { q: 'Үйл үг ба түүний тусагдахууны хооронд', a: 'ХЭЗЭЭ Ч БОЛОХГҮЙ', why: '"He examined carefully the core" ✗ → "He examined the core carefully." — алдаа 42.' },
          { q: 'Цаг хугацааны илэрхийлэл', a: 'Төгсгөлд, эсвэл онцлохоор эхэнд', why: '"Last week we drilled three holes" ✓, гэхдээ дунд нь хэзээ ч биш — алдаа 43.' }
        ]
      },
      {
        t: 'qa',
        label: 'Тэмдэг нэрийн дараалал',
        drill: true,
        items: [
          { q: 'Тэмдэг нэрийн зөв дараалал', a: 'Opinion → Size → Age → Shape → Colour → Origin → Material → Purpose', why: '"a beautiful large old round black Mongolian wooden storage box"' },
          { q: 'Практикт хэдэн тэмдэг нэр давхарладаг вэ?', a: 'Ихэнхдээ гурваас илүүгүй', why: '"a large old drilling rig" · "a high-grade copper deposit"' }
        ]
      },
      {
        t: 'contrast',
        label: 'Алдаа 41-48 — засаж бичнэ үү',
        drill: true,
        items: [
          { bad: 'I the samples analysed.', good: 'I analysed the samples.', why: 'Mongolian is object-then-verb. English is verb-then-object.' },
          { bad: 'He examined carefully the core.', good: 'He examined the core carefully.', why: 'Never split a verb from its object with an adverb.' },
          { bad: 'We drilled last week three holes.', good: 'We drilled three holes last week.', why: 'Time goes at the end, or at the front — never in the middle.' },
          { bad: 'I always am careful.', good: 'I am always careful.', why: 'Frequency adverbs go after be.' },
          { bad: 'Always I check the data.', good: 'I always check the data.', why: 'Frequency adverbs go before the main verb, not before the subject.' },
          { bad: 'a wooden black old box', good: 'an old black wooden box', why: 'Age → Colour → Material.' },
          { bad: 'Very I like it.', good: 'I like it very much.', why: '"very" cannot modify a verb on its own.' }
        ]
      }
    ]
  };

  const preps = {
    id: 'cg-prepositions',
    kind: 'guide',
    title_mn: 'Хамааралт угтвар үгс',
    title_en: 'Dependent prepositions',
    src: '§R · §KK 49-62',
    pages: [],
    blurb_en: 'The book sorts prepositions by meaning — place, direction, time. But most ' +
      'preposition errors are not about meaning at all: the preposition is fixed by the word ' +
      'in front of it and has to be memorised with that word.',
    blocks: [
      {
        t: 'qa',
        label: 'at → on → in — багасах шатлал',
        drill: true,
        items: [
          { q: 'at', a: 'Цэг', why: 'at the mine · at the office · at 500 m depth · at 3 p.m.' },
          { q: 'on', a: 'Гадаргуу эсвэл шугам', why: 'on the map · on the surface · on Monday · on 5 May' },
          { q: 'in', a: 'Хаалттай орон зай', why: 'in the pit · in the tunnel · in Mongolia · in July · in 2024' }
        ]
      },
      {
        t: 'qa',
        label: 'Үгтэйгээ хамт цээжил',
        drill: true,
        items: [
          { q: 'depend ___', a: 'on', why: '"It depends on the grade." — алдаа 53.' },
          { q: 'consist ___', a: 'of', why: '"The unit consists of three layers." — алдаа 59.' },
          { q: 'result ___ (үр дүн гарах)', a: 'in', why: '"The fault resulted in displacement."' },
          { q: 'result ___ (шалтгаанаас үүдэх)', a: 'from', why: '"The damage resulted from the blast."' },
          { q: 'responsible ___', a: 'for', why: '"responsible for safety" — алдаа 60.' },
          { q: 'interested ___', a: 'in', why: '"I am interested in geology." — алдаа 40 (interesting ✗).' },
          { q: 'good ___ (чадвар)', a: 'at', why: '"I\'m good at English." — алдаа 57.' },
          { q: 'married ___', a: 'to', why: '"She is married to him." — алдаа 55.' },
          { q: 'different ___', a: 'from', why: 'алдаа 58.' },
          { q: 'based ___', a: 'on', why: '"based on the survey data"' },
          { q: 'aware ___', a: 'of', why: '"aware of the risk"' },
          { q: 'comply ___', a: 'with', why: '"comply with the standard"' }
        ]
      },
      N('warn', '§R',
        'Дараах үйл үгс угтвар үг АВДАГГҮЙ — шууд тусагдахуун авна: ' +
        'discuss · enter · approach · marry · lack · resemble · mention · answer · reach · ' +
        'join · affect · phone.',
        'These are the ones Mongolian speakers most often over-prepose, because the Mongolian ' +
        'equivalent uses a case suffix that feels like a preposition.'),
      {
        t: 'contrast',
        label: 'Алдаа 49-62 — засаж бичнэ үү',
        drill: true,
        items: [
          { bad: 'Let\'s discuss about it.', good: 'Let\'s discuss it.', why: '"discuss" takes a direct object with no preposition.' },
          { bad: 'We arrived to the site.', good: 'We arrived at the site.', why: 'arrive at a point, arrive in a country or city.' },
          { bad: 'Explain me the data.', good: 'Explain the data to me.', why: '"explain" needs to before the person.' },
          { bad: 'It depends of the grade.', good: 'It depends on the grade.', why: 'Fixed: depend on.' },
          { bad: 'I listen music.', good: 'I listen to music.', why: 'Fixed: listen to.' },
          { bad: 'She is married with him.', good: 'She is married to him.', why: 'Fixed: married to.' },
          { bad: 'I am good in English.', good: 'I am good at English.', why: 'Fixed: good at.' },
          { bad: 'in the internet', good: 'on the internet', why: 'Fixed: on the internet.' },
          { bad: 'on July', good: 'in July', why: 'Months take in — the book\'s own table on p.14 says so.' },
          { bad: 'enter into the room', good: 'enter the room', why: '"enter" takes a direct object.' },
          { bad: 'responsible of safety', good: 'responsible for safety', why: 'Fixed: responsible for.' },
          { bad: 'About the report, it is late.', good: 'The report is late.', why: 'The Mongolian postposition тухай has been carried over in its Mongolian position.' }
        ]
      }
    ]
  };

  const verbTense = {
    id: 'cg-verb-tense',
    kind: 'guide',
    title_mn: 'Үйл үг ба цагийн алдаа',
    title_en: 'Verb and tense errors',
    src: '§D · §KK 23-40',
    pages: [],
    blurb_en: 'The guard rails the book\'s tense grid does not have: -s agreement under ' +
      'pressure, the stative verbs that never take -ing, and past simple vs present perfect.',
    blocks: [
      N('gap', '§D',
        'Дараах үйл үгс ҮРГЭЛЖЛЭХ хэлбэрт ОРДОГГҮЙ: know, understand, believe, want, need, ' +
        'like, own, contain, seem, belong. Номын "Ж, Ч байна → Tobe + Ving" дүрмийг эдгээрт ' +
        'хэрэглэж болохгүй.',
        'Stative verbs describe a state, not an action in progress. "I am knowing the answer" ✗ ' +
        '→ "I know the answer" ✓.'),
      {
        t: 'qa',
        label: 'Past simple эсвэл Present perfect?',
        drill: true,
        items: [
          { q: 'Дууссан, өнөөдөртэй холбоогүй', a: 'Past simple', why: '"I worked in Erdenet in 2019." — цэг.' },
          { q: 'Одоо цагтай холбоотой, үргэлжилж байгаа', a: 'Present perfect', why: '"I have worked here since 2019." — сум, өнөөдрийг хүрч байна.' },
          { q: 'since · for · already · yet · just · ever · never · so far', a: 'Present perfect', why: 'Эдгээр түлхүүр үг хэрэглээний ~80%-ийг хамарна.' },
          { q: 'ago · yesterday · last week · in 2019', a: 'Past simple', why: 'Ном үүнийг зөв өгсөн (х.11).' }
        ]
      },
      {
        t: 'contrast',
        label: 'Алдаа 23-40 — засаж бичнэ үү',
        drill: true,
        items: [
          { bad: 'He work here.', good: 'He works here.', why: 'HE-SHE-IT adds S. The most common error in English learning worldwide.' },
          { bad: 'She don\'t know.', good: 'She doesn\'t know.', why: 'He / she / it takes does.' },
          { bad: 'I work here since 2019.', good: 'I have worked here since 2019.', why: '"since" is a present-perfect trigger.' },
          { bad: 'I am knowing the answer.', good: 'I know the answer.', why: '"know" is stative — never continuous.' },
          { bad: 'I am agree.', good: 'I agree.', why: '"agree" is a verb, not an adjective.' },
          { bad: 'Yesterday I go to site.', good: 'Yesterday I went to the site.', why: '"yesterday" forces past simple — and the site takes the.' },
          { bad: 'I have went there.', good: 'I have gone there.', why: 'After have use PP3, not PP2. The book\'s table gives go — went — gone.' },
          { bad: 'The report was wrote.', good: 'The report was written.', why: 'After was use PP3. The book\'s table gives write — wrote — written.' },
          { bad: 'The accident was happened.', good: 'The accident happened.', why: '"happen" has no passive — nobody happens an accident.' },
          { bad: 'He can to swim.', good: 'He can swim.', why: 'Modals take the bare infinitive.' },
          { bad: 'He cans drive.', good: 'He can drive.', why: 'Modals never take -s.' },
          { bad: 'I enjoy to work here.', good: 'I enjoy working here.', why: '"enjoy" takes -ing.' },
          { bad: 'I am interesting in geology.', good: 'I am interested in geology.', why: '-ing describes the thing, -ed describes the person.' },
          { bad: 'If it will rain, we stop.', good: 'If it rains, we will stop.', why: 'Never put will inside the if-clause.' }
        ]
      }
    ]
  };


  // ------------------------------------------------------------ write
  // Free-translation prompts that DO have a model answer, because the model
  // came from a source rather than from us. The book's own Орчуулга pages have
  // no answer key, so those prompts stay unanswered rather than being invented.
  const writePrompts = [
    { id: 'w-copula', mn: 'Би геологич.', model: 'I am a geologist.',
      why: 'Монгол хэл холбоос үйл үгийг орхидог. Англи хэл ХОЁР зүйл нэмүүлдэг: am ба a.',
      src: 'Guide §1.3 · 7' },
    { id: 'w-svo', mn: 'Би ном уншсан.', model: 'I read a book.',
      why: 'Монгол: тусагдахуун → үйл үг. Англи: үйл үг → тусагдахуун.',
      src: 'Guide §1.3 · 1' },
    { id: 'w-postpos', mn: 'Ширээн дээр.', model: 'On the table.',
      why: 'Монгол дараах, англи өмнөх. Байрлалын үг нэрийн ӨМНӨ ордог.',
      src: 'Guide §1.3 · 3' },
    { id: 'w-about', mn: 'Геологийн тухай.', model: 'About geology.',
      why: '«тухай» нь монгол байрандаа үлдвэл "About the report, it is late" алдаа гарна.',
      src: 'Guide §1.3 · 3' },
    { id: 'w-plural', mn: 'Гурван ном.', model: 'Three books.',
      why: 'Тоо аль хэдийн олныг заасан ч англи хэл давхар тэмдэглэдэг.',
      src: 'Guide §1.3 · 6' },
    { id: 'w-student', mn: 'Би оюутан. Их сургуульд сурдаг.',
      model: 'I am a student. I study at university.',
      why: 'a student дээр артикль хэрэгтэй, at university дээр хэрэггүй.',
      src: 'Design' },
    { id: 'w-bus', mn: 'Тэр өчигдөр ажилдаа автобусаар явсан.',
      model: 'He went to work by bus yesterday.',
      why: 'SVOMPT: Manner (by bus) → Place (to work) → Time (yesterday).',
      src: 'Design' },
    { id: 'w-music', mn: 'Чи ямар хөгжим сонсдог вэ?',
      model: 'What music do you listen to?',
      why: 'do-тусламж, мөн төгсгөлд үлдсэн угтвар үг to.',
      src: 'Design' },
    { id: 'w-since', mn: 'Бид 2019 оноос хойш энд амьдарч байна.',
      model: 'We have lived here since 2019.',
      why: 'since / for бол perfect цагийн тэмдэг. ago биш.',
      src: 'Design' },
    { id: 'w-stative', mn: 'Тэр эмэгтэй хариултыг мэдэхгүй байна.',
      model: 'She does not know the answer.',
      why: 'know бол статив үйл үг — үргэлжлэх хэлбэргүй. Мөн does-тэй үгүйсгэл.',
      src: 'Design' }
  ];

  const units = [stress, pron, articles, doSupport, wordOrder, preps, verbTense];

  return {
    meta: {
      source: 'English–Mongolian Contrastive Guide',
      file: 'docs/source/English-Mongolian-Contrastive-Guide.docx',
      scope: 'Sections bearing on pages 6-22 of Boldoo\'s English Lesson.'
    },
    notes: notes,
    units: units,
    write: writePrompts,
    // Where the guide units sit in the study path, relative to the book units.
    pathAfter: {
      'u-sounds-consonants': ['cg-pron', 'cg-stress'],
      'u-prepositions': ['cg-prepositions'],
      'u-tense-grid': ['cg-verb-tense'],
      'l3-syntax': ['cg-do-support', 'cg-word-order'],
      'l2-translation': ['cg-articles']
    }
  };
})();
