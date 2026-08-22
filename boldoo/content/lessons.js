/* Boldoo's English Lesson — transcribed content.
 *
 * Source: BE_Lesson/ photographs of "Boldoo's english lesson".
 * This file covers pages 6-22 (Image (4).jpeg .. Image (20).jpeg).
 *
 * Fidelity rules used while transcribing:
 *   - Mongolian text is reproduced as printed, including Cyrillic spelling.
 *   - Where the book has a clear typo that would TEACH SOMETHING FALSE, the
 *     corrected form is used for drilling and `note` records what is printed.
 *     (e.g. know/PP3 is printed "Know"; stride/PP2 is printed "strod".)
 *   - Where the typo is harmless (capitalisation), it is silently normalised.
 *   - Handwriting in the photographs is the previous owner's own attempt at the
 *     exercises. It is NOT transcribed and is NOT treated as an answer key.
 *
 * Loaded as a plain script so the app runs from file:// with no server.
 */
window.BOLDOO = (function () {
  'use strict';

  // ---------------------------------------------------------------- p6
  const pronouns = {
    id: 'u-pronouns',
    kind: 'reference',
    title_mn: 'Төлөөний үг ба асуух үг',
    title_en: 'Pronouns and question words',
    pages: [6],
    blurb_en: 'The closed-class words the rest of the book assumes you know.',
    blocks: [
      {
        t: 'pairs',
        label: 'Төлөөний үг / Pronouns',
        drill: 'both',
        items: [
          ['I', 'Би'], ['We', 'Бид, бид нар'], ['You', 'Чи, та, та нар'],
          ['They', 'Тэд, тэд нар'], ['He', 'Тэр эрэгтэй'], ['She', 'Тэр эмэгтэй'],
          ['It', 'Энэ /амьгүй зүйл/'], ['My', 'Миний'], ['Your', 'Чиний'],
          ['His', 'Тэр эрэгтэйн'], ['Her', 'Тэр эмэгтэйн'], ['Its', 'Энэний'],
          ['Our', 'Манай'], ['Their', 'Тэдний'], ['Him', 'Тэр эр'],
          ['Her', 'Тэр эм'], ['Me', 'Надад'], ['Us', 'Бидний'], ['Them', 'Тэдний'],
          ['Myself', 'Би өөрөө'], ['Yourself', 'Чи өөрөө'], ['Himself', 'Тэр эр өөрөө'],
          ['Herself', 'Тэр эм өөрөө'], ['Itself', 'Энэ өөрөө'],
          ['Ourselves', 'Бид нар өөрөө'], ['Themselves', 'Тэд нар өөрөө'],
          ['Which of you', 'Та нарын хэн нь'], ['Someone', 'Хэн нэгэн, 1-р хэсэг'],
          ['Something', 'Ямар нэг зүйл'], ['Somewhere', 'Хаа нэгтэй'],
          ['How', 'Яаж / хэрхэн']
        ]
      },
      {
        t: 'pairs',
        label: 'Асуух үг ба тодорхойгүй үг / Question and indefinite words',
        drill: 'both',
        items: [
          ['Where', 'Хаана'], ['When', 'Хэзээ'], ['What', 'Юу / яасан'],
          ['Which', 'Аль, ямар'], ['Who', 'Хэн'], ['Whom', 'Хэнтэй'],
          ['Whose', 'Хэний'], ['Any', 'Ямар нэгэн'], ['Anyone', 'Хэн нэгэн'],
          ['Anywhere', 'Хаа нэгтэй'], ['Anything', 'Ямар нэгэн зүйл'],
          ['Everyone', 'Хүн бүр'], ['Everywhere', 'Хаа сайгүй'],
          ['Everything', 'Аливаа зүйл'], ['Nobody', 'Хэн ч'], ['Nothing', 'Юу ч биш'],
          ['Each', 'Бүр болно'], ['Every', 'Бүр'], ['All', 'Бүгд'],
          ['How many', 'Хэр зэрэг /тоолдог/'], ['How much', 'Хэр их /тоолохгүй/'],
          ['How long', 'Хэр урт'], ['How often', 'Хэр зэрэг'],
          ['How many hours', 'Хэдийтэй үргэлжлэх'], ['This', 'Энэ'],
          ['These', 'Эдгээр'], ['That', 'Тэр'], ['Those', 'Тэдгээр'],
          ['Some', 'Хэсэг'], ['Why', 'Яагаад'], ['What time', 'Хэдэн цаг']
        ]
      }
    ]
  };

  // ------------------------------------------------------------- p7-p10
  // Infinitive (PP1) / Simple past (PP2) / Past participle (PP3)
  const V = (v, mn, pp2, pp3, note) => ({ v, mn, pp2, pp3, note });

  const verbs = {
    id: 'u-verbs',
    kind: 'reference',
    title_mn: 'Дүрсгүй үйл үг',
    title_en: 'Irregular verbs (PP1 / PP2 / PP3)',
    pages: [7, 8, 9, 10],
    blurb_en: 'The four pages of irregular forms the tense grid keeps pointing at.',
    blocks: [
      {
        t: 'note',
        mn: 'PP1 — Анхны хэлбэр. PP2 /Сан⁴/ — Өнгөрсөн цаг. PP3 /Чихсан/Цан/ — Тэгс өнгөрсөн цаг.',
        en: 'PP1 infinitive, PP2 simple past, PP3 past participle. A slash means the book gives both forms as acceptable.'
      },
      {
        t: 'verbs',
        label: 'Дүрсгүй үйл үгийн хүснэгт',
        drill: 'forms',
        items: [
          V('awake', 'сэрэх, сэрээх', 'awoke', 'awoken'),
          V('be', 'байх', 'was, were', 'been'),
          V('bear', 'тэсэх', 'bore', 'born'),
          V('beat', 'цохих', 'beat', 'beat'),
          V('become', 'бий болох', 'became', 'become'),
          V('begin', 'эхлэх', 'began', 'begun'),
          V('bend', 'нугалах, тахийлгах', 'bent', 'bent'),
          V('beset', 'бэрхшээл учруулах', 'beset', 'beset'),
          V('bet', 'мөрий тавих', 'bet', 'bet'),
          V('bid', 'үнэ хаялцах', 'bid / bade', 'bid / bidden'),
          V('bind', 'хүлэх, боох', 'bound', 'bound'),
          V('bite', 'хазах', 'bit', 'bitten'),
          V('bleed', 'цус гоожих', 'bled', 'bled'),
          V('blow', 'үлээх', 'blew', 'blown'),
          V('break', 'хагарах, хугарах', 'broke', 'broken'),
          V('breed', 'үржих', 'bred', 'bred'),
          V('bring', 'авчрах', 'brought', 'brought'),
          V('broadcast', 'нэвтрүүлэх', 'broadcast', 'broadcast'),
          V('build', 'барих', 'built', 'built'),
          V('burn', 'шатах', 'burned / burnt', 'burned / burnt'),
          V('burst', 'хагарах, тэсрэх', 'burst', 'burst'),
          V('buy', 'худалдан авах', 'bought', 'bought'),
          V('cast', 'хаях, шидэх, дүрд тоглох', 'cast', 'cast'),
          V('catch', 'барьж авах', 'caught', 'caught'),
          V('choose', 'сонгох', 'chose', 'chosen'),
          V('cling', 'наалдах', 'clung', 'clung'),
          V('come', 'ирэх', 'came', 'come'),
          V('cost', 'үнэ хүрэх', 'cost', 'cost'),
          V('creep', 'мөлхөх', 'crept', 'crept'),
          V('cut', 'зүсэх, хайчлах', 'cut', 'cut'),
          V('deal', 'хэлэлцэх', 'dealt', 'dealt'),
          V('dig', 'ухах', 'dug', 'dug'),
          V('dive', 'шумбах', 'dived / dove', 'dived'),
          V('do', 'хийх', 'did', 'done'),
          V('draw', 'зурах', 'drew', 'drawn'),
          V('dream', 'зүүдлэх, мөрөөдөх', 'dreamed', 'dreamed'),
          V('drive', 'жолоодох', 'drove', 'driven'),
          V('drink', 'уух', 'drank', 'drunk'),
          V('eat', 'идэх', 'ate', 'eaten'),
          V('fall', 'унах', 'fell', 'fallen'),
          V('feed', 'хооллох, тэжээх', 'fed', 'fed'),
          V('feel', 'мэдрэх', 'felt', 'felt'),
          V('fight', 'зодолдох, хэрэлдэх', 'fought', 'fought'),
          V('find', 'олох', 'found', 'found'),
          V('fit', 'таарах, тохирох', 'fit', 'fit'),
          V('flee', 'зугтах, дүрвэх', 'fled', 'fled'),
          V('fling', 'шидэх, чулуудах', 'flung', 'flung'),
          V('fly', 'нисэх', 'flew', 'flown'),
          V('forbid', 'хориглох', 'forbade', 'forbidden'),
          V('forget', 'мартах', 'forgot', 'forgotten'),
          V('forgive', 'уучлах, өршөөх', 'forgave', 'forgiven'),
          V('forsake', 'бүр мөсөн хаях', 'forsook', 'forsaken'),
          V('freeze', 'хөлдөх, хөлдөөх', 'froze', 'frozen'),
          V('get', 'олж авах', 'got', 'gotten'),
          V('give', 'өгөх', 'gave', 'given'),
          V('go', 'явах', 'went', 'gone'),
          V('grind', 'нунтаглах', 'ground', 'ground'),
          V('grow', 'өсөх, ургах', 'grew', 'grown'),
          V('hang', 'өлгөх', 'hung', 'hung'),
          V('hear', 'сонсох', 'heard', 'heard'),
          V('hide', 'нуух, нуугдах', 'hid', 'hidden'),
          V('hit', 'цохих', 'hit', 'hit'),
          V('hold', 'барих', 'held', 'held'),
          V('hurt', 'өвтгөх', 'hurt', 'hurt'),
          V('keep', 'хадгалах', 'kept', 'kept'),
          V('kneel', 'өвдөг сөхрөх', 'knelt', 'knelt'),
          V('knit', 'нэхэх, сүлжих', 'knit', 'knit'),
          V('know', 'мэдэх', 'knew', 'known', 'Номд PP3 нь "Know" гэж хэвлэгдсэн — үсгийн алдаа. Зөв нь known.'),
          V('lay', 'хэвтээгээр тавих', 'laid', 'laid'),
          V('lead', 'удирдах, тэргүүлэх', 'led', 'led'),
          V('leap', 'харайх, цовхрох', 'leaped / leapt', 'leaped / leapt'),
          V('learn', 'сурах, судлах', 'learned / learnt', 'learned / learnt'),
          V('leave', 'орхих', 'left', 'left'),
          V('lend', 'зээлүүлэх', 'lent', 'lent'),
          V('let', 'зөвшөөрөх', 'let', 'let'),
          V('lie', 'хэвтэх', 'lay', 'lain'),
          V('light', 'гэрэл асах', 'lighted / lit', 'lighted'),
          V('lose', 'гээх, ялагдах', 'lost', 'lost'),
          V('make', 'хийх', 'made', 'made'),
          V('mean', 'утгатай байх', 'meant', 'meant'),
          V('meet', 'уулзах', 'met', 'met'),
          V('misspell', 'буруу бичих', 'misspelled / misspelt', 'misspelled / misspelt'),
          V('mistake', 'алдаа хийх', 'mistook', 'mistaken'),
          V('mow', 'өвс хадах', 'mowed', 'mowed / mown'),
          V('overcome', 'ялах, дийлэх', 'overcame', 'overcome'),
          V('overdo', 'хэтрүүлэх', 'overdid', 'overdone'),
          V('overtake', 'гүйцэж түрүүлэх', 'overtook', 'overtaken'),
          V('overthrow', 'түлхэн унагаах', 'overthrew', 'overthrown'),
          V('pay', 'төлөх', 'paid', 'paid'),
          V('plead', 'царайчлах, мэдэгдэх', 'pled', 'pled'),
          V('prove', 'батлах', 'proved', 'proved / proven'),
          V('put', 'тавих', 'put', 'put'),
          V('quit', 'шууд хаях / орхих', 'quit', 'quit'),
          V('read', 'унших', 'read', 'read'),
          V('rid', 'салах, ангижрах', 'rid', 'rid'),
          V('ride', 'унах, мордох', 'rode', 'ridden'),
          V('ring', 'утас дуугарах', 'rang', 'rung'),
          V('rise', 'мандах, цацрах', 'rose', 'risen'),
          V('run', 'гүйх', 'ran', 'run'),
          V('saw', 'хөрөөдөх', 'sawed', 'sawed / sawn'),
          V('say', 'хэлэх', 'said', 'said'),
          V('see', 'үзэх, харах', 'saw', 'seen'),
          V('seek', 'хайх', 'sought', 'sought'),
          V('sell', 'зарах, худалдах', 'sold', 'sold'),
          V('send', 'илгээх', 'sent', 'sent'),
          V('set', 'тааруулах', 'set', 'set'),
          V('sew', 'оёх', 'sewed', 'sewed / sewn'),
          V('shake', 'сэгсрэх, гар барих', 'shook', 'shaken'),
          V('shave', 'хусах', 'shaved', 'shaved / shaven'),
          V('shear', 'хонь хяргах', 'shore', 'shorn'),
          V('shed', 'унагах, асгаруулах', 'shed', 'shed'),
          V('shine', 'гэрэлтэх, тусах', 'shone', 'shone'),
          V('shoe', 'морь тахлах', 'shoed', 'shoed / shod'),
          V('shoot', 'буудах', 'shot', 'shot'),
          V('show', 'үзүүлэх', 'showed', 'showed / shown'),
          V('shrink', 'агшаах', 'shrank', 'shrunk'),
          V('shut', 'хаах', 'shut', 'shut'),
          V('sing', 'дуулах', 'sang', 'sung'),
          V('sink', 'живэх', 'sank', 'sunk'),
          V('sit', 'суух', 'sat', 'sat'),
          V('slay', 'алах, зэрлэгээр хөнөөх', 'slew', 'slain'),
          V('sleep', 'унтах', 'slept', 'slept'),
          V('slide', 'гулсах, хальтрах', 'slid', 'slid'),
          V('sling', 'хүчтэй шидэх', 'slung', 'slung'),
          V('slit', 'огтлох, зүсэх', 'slit', 'slit'),
          V('smite', 'нам цохих', 'smote', 'smitten'),
          V('sow', 'тарих, тариалах', 'sowed', 'sowed / sown'),
          V('speak', 'ярих', 'spoke', 'spoken'),
          V('speed', 'хурдлах', 'sped', 'sped'),
          V('spend', 'үрэх, зарцуулах', 'spent', 'spent'),
          V('spin', 'эргэх', 'spun', 'spun'),
          V('spit', 'шүлсээ хаях', 'spit / spat', 'spit'),
          V('split', 'салах, хуваагдах', 'split', 'split'),
          V('spread', 'тараах', 'spread', 'spread'),
          V('spring', 'үсрэх, хүчтэй хаагдах', 'sprang / sprung', 'sprung'),
          V('stand', 'зогсох', 'stood', 'stood'),
          V('steal', 'хулгайлах', 'stole', 'stolen'),
          V('stick', 'наалдах', 'stuck', 'stuck'),
          V('sting', 'хатгах', 'stung', 'stung'),
          V('stink', 'өмхийрөх', 'stank', 'stunk'),
          V('stride', 'алхах', 'strode', 'stridden', 'Номд PP2 нь "strod" гэж хэвлэгдсэн — үсгийн алдаа. Зөв нь strode.'),
          V('strike', 'ажил хаях, хүчтэй цохилт өгөх', 'struck', 'struck'),
          V('string', 'уях, хэлхэх', 'strung', 'strung'),
          V('strive', 'хичээх, мэрийх', 'strove', 'striven'),
          V('swear', 'тангараглах', 'swore', 'sworn'),
          V('sweep', 'шүүрдэх', 'swept', 'swept'),
          V('swell', 'хавдах, хөөх', 'swelled', 'swelled / swollen'),
          V('swim', 'сэлэх', 'swam', 'swum'),
          V('swing', 'дүүжигнэх, савах', 'swung', 'swung'),
          V('take', 'авах', 'took', 'taken'),
          V('teach', 'заах', 'taught', 'taught'),
          V('tear', 'урах, тасдах', 'tore', 'torn'),
          V('tell', 'хэлэх', 'told', 'told'),
          V('think', 'бодох', 'thought', 'thought'),
          V('thrive', 'амжилт гаргах', 'thrived / throve', 'thrived'),
          V('throw', 'шидэх, чулуудах', 'threw', 'thrown'),
          V('thrust', 'түлхэх, ёврох', 'thrust', 'thrust'),
          V('tread', 'гишгэх, дэвсэх', 'trod', 'trodden'),
          V('understand', 'ойлгох', 'understood', 'understood'),
          V('uphold', 'дэмжих, баримтлах', 'upheld', 'upheld'),
          V('upset', 'сэтгэл гонсойх', 'upset', 'upset'),
          V('wake', 'сэрэх', 'woke', 'woken'),
          V('wear', 'өмсөх', 'wore', 'worn'),
          V('weave', 'сүлжих, нэхэх', 'weaved / wove', 'weaved / woven'),
          V('wed', 'хуримлах', 'wed', 'wed'),
          V('weep', 'уйлах', 'wept', 'wept'),
          V('win', 'ялах', 'won', 'won'),
          V('wind', 'салхилах', 'wound', 'wound'),
          V('withhold', 'татгалзах, болих', 'withheld', 'withheld'),
          V('withstand', 'даах, тэсвэрлэх', 'withstood', 'withstood'),
          V('wring', 'мушгих', 'wrung', 'wrung'),
          V('write', 'бичих', 'wrote', 'written')
        ]
      }
    ]
  };

  // --------------------------------------------------------------- p11
  const C = (trans, aux, vf, kw, formula) => ({ trans, aux, vf, kw, formula });

  const grid = {
    id: 'u-tense-grid',
    kind: 'reference',
    title_mn: 'Цагийн хүснэгт',
    title_en: 'The 16-tense grid',
    pages: [11],
    blurb_en: 'The spine of the book. Every row is a time, every column an aspect. ' +
      'Read a cell as: the Mongolian ending that signals it, the auxiliary, the verb form, the keywords, the formula.',
    blocks: [
      {
        t: 'grid',
        label: 'Цаг ба төлөв',
        drill: 'grid',
        rows: ['Present', 'Past', 'Future', 'Future in the past'],
        cols: ['Simple', 'Continuous', 'Perfect', 'Perfect continuous'],
        cells: {
          'Present|Simple': C('даг⁴', 'Do / Does (neg, gen, dis, spe)',
            'V(s) — He, She, It + V(s); I, You, We, They + V',
            'always, usually, often, sometimes, seldom, rarely, hardly, never; once/twice a week, 3 times a year',
            'S + Af + Vs + O + Ad + L + Te'),
          'Present|Continuous': C('ж байна, ч байна', 'to be (am / is / are)', 'V + ing',
            'right now, at the moment, at this time', 'S + tobe + Ving + O + Ad + L + Te'),
          'Present|Perfect': C('чихсан, чихаад байна, цан (үзсэн үү?)', 'Have / Has', 'Ved / pp3',
            'just, already, recently, yet, for, ever', 'S + Have/Has + Ved/pp3 + O + Ad + L + Te'),
          'Present|Perfect continuous': C('саар л байна, ж л байна, турш ж байна, хойш ж байна',
            'Have / Has been', 'V + ing', 'ago, since', 'S + Have/Has + been + Ving + O + Ad + L + Te'),

          'Past|Simple': C('сан⁴', 'Did (neg, gen, dis, spe)', 'V + ed / pp2',
            'last, yesterday, ago', 'S + Ved/pp2 + O + Ad + L + Te'),
          'Past|Continuous': C('ж байсан, ч байсан', 'Was / Were', 'V + ing',
            'at the moment, at this time', 'S + tobe + Ving + O + Ad + L + Te'),
          'Past|Perfect': C('чихсан байсан, цан байсан, чихаад байсан', 'Had', 'Ved / pp3',
            'just, already, recently, yet, for, ever', 'S + had + Ved/pp3 + O + Ad + L + Te'),
          'Past|Perfect continuous': C('саар л бсн, ж л бсн, турш ж бсн, хойш ж байсан',
            'Had been', 'V + ing', 'ago, since', 'S + had + been + Ving + O + Ad + L + Te'),

          'Future|Simple': C('на⁴', 'Will',
            'Will + V; to be going to (төлөвлөсөн) / Will (төлөвлөөгүй)',
            'tomorrow, next', 'S + Will + V + O + Ad + L + Te'),
          'Future|Continuous': C('ж байх болно, ч байх болно', 'Will be', 'V + ing',
            'at the moment, at this time', 'S + will be + Ving + O + Ad + L + Te'),
          'Future|Perfect': C('чихаад байх болно, чихсан байх болно', 'Will have', 'Ved / pp3',
            'just, already, recently, yet, for, ever', 'S + will have + Ved/pp3 + O + Ad + L + Te'),
          'Future|Perfect continuous': C('саар л бх болно, ж л байх болно, турш ж байх болно',
            'Will have been', 'V + ing', 'ago, since', 'S + Will have + been + Ving + O + Ad + L + Te'),

          'Future in the past|Simple': C('на гэж бодсон', 'Would', 'V', 'that / гэж',
            'Past simple + that + S + would + V'),
          'Future in the past|Continuous': C('ж байх болно гэж итгэсэн', 'Would be', 'V + ing',
            'that / гэж', 'Past simple + that + S + would be + Ving'),
          'Future in the past|Perfect': C('чихсан байх болно гэж найдсан', 'Would have', 'V + ed / pp3',
            'that / гэж', 'Past simple + that + S + would have + Ved/pp3'),
          'Future in the past|Perfect continuous': C('саар л байх юм гэж төсөөлсөн', 'Would have been',
            'V + ing', 'that / гэж', 'Past simple + that + S + would have been + Ving')
        }
      }
    ]
  };

  // --------------------------------------------------------------- p12
  const vowels = {
    id: 'u-sounds-vowels',
    kind: 'reference',
    title_mn: 'Эгшиг үсгийн нийлэмж',
    title_en: 'Vowel spellings and their sounds',
    pages: [12],
    blurb_en: 'Which letter combination makes which sound. The Cyrillic is the book\'s approximation, not IPA.',
    blocks: [
      {
        t: 'sound',
        label: 'Эгшиг үсгийн нийлэмж',
        drill: 'sound',
        items: [
          { spelling: 'e, ea, ee, ei, ie', sound: '/i:/ ий', examples: ['these', 'mete', 'be', 'lead', 'mean', 'speak', 'reach', 'need', 'see', 'meet', 'niece', 'receive'], note: 'Номд "recieve" гэж хэвлэгдсэн — зөв нь receive.' },
          { spelling: 'e, ea', sound: '/e/ э', examples: ['pen', 'red', 'bed', 'wet', 'lend', 'ready'] },
          { spelling: 'a, ai, ay, ey, eigh', sound: '/ei/ эй', examples: ['late', 'make', 'rate', 'date', 'rain', 'today', 'say', 'eight', 'way', 'play'] },
          { spelling: 'i, y, ind /aind/, igh, ild /aild/', sound: '/ai/ ай', examples: ['like', 'time', 'shine', 'mind', 'wild', 'right', 'child'] },
          { spelling: 'oor, or, ore, all /o:l/, alk /o:k/, au, aw, wa /wo/, our', sound: '/o:/ оо', examples: ['door', 'floor', 'for', 'sport', 'short', 'more', 'small', 'all', 'ball', 'wall', 'water', 'warm', 'because', 'saw'] },
          { spelling: 'o, wa /wo/', sound: '/o/ о', examples: ['along', 'frost', 'want', 'wash', 'was'] },
          { spelling: 'ar, ath, as + гийгүүлэгч', sound: '/a/ аа', examples: ['car', 'bar', 'card', 'hard', 'father', 'bath', 'ask', 'past'] },
          { spelling: 'o, oa, ow, old /ould/, ost /oust/', sound: '/ou/ өу', examples: ['note', 'rode', 'go', 'rose', 'know', 'snow', 'cold', 'post', 'old', 'road'] },
          { spelling: 'ow, ou', sound: '/au/ ay', examples: ['town', 'down', 'brown', 'out', 'about', 'sound'] }
        ]
      }
    ]
  };

  // --------------------------------------------------------------- p13
  const consonants = {
    id: 'u-sounds-consonants',
    kind: 'reference',
    title_mn: 'Гийгүүлэгч үсгийн нийлэмж',
    title_en: 'Consonant spellings and their sounds',
    pages: [13],
    blocks: [
      {
        t: 'sound',
        label: 'Гийгүүлэгч үсгийн нийлэмж',
        drill: 'sound',
        items: [
          { spelling: '-ch, -tch', sound: 'ч', examples: ['change', 'chance', 'catch', 'touch'] },
          { spelling: 'ge, dge', sound: 'ж', examples: ['page', 'bridge', 'judge', 'cage'] },
          { spelling: 'sh', sound: 'ш', examples: ['shine', 'cash', 'flash', 'ash'] },
          { spelling: 'ng (үгийн төгсгөлд)', sound: 'н', examples: ['lung', 'bring', 'strong', 'king'] },
          { spelling: 'ng (үгийн дунд)', sound: 'нг', examples: ['language', 'longer', 'stronger'] },
          { spelling: 'ck', sound: 'к', examples: ['track', 'ticket', 'rock', 'back'] },
          { spelling: '-ph', sound: 'ф', examples: ['photo', 'phrase', 'philosophy'] },
          { spelling: 'wh- (o үсгийн өмнө)', sound: 'х', examples: ['whose', 'whom', 'who'] },
          { spelling: 'wh- (бусад тохиолдолд)', sound: 'в', examples: ['what', 'white', 'wheel', 'why'] },
          { spelling: 'er, ur, ir', sound: 'өө / ээ', examples: ['fur', 'purse', 'dirty', 'tern'] },
          { spelling: 'th (хэлний үзүүрээр сийгүүлэн)', sound: 'т', examples: ['think', 'thick', 'month', 'three'] },
          { spelling: 'th', sound: 'д', examples: ['this', 'those', 'weather', 'either'] },
          { spelling: 'kn', sound: 'н', examples: ['knee', 'know', 'knife'] },
          { spelling: 'wr', sound: 'р', examples: ['write', 'wrist', 'wrong'] },
          { spelling: 'tion', sound: 'шн', examples: ['emotion', 'information', 'nation'] },
          { spelling: 'sion', sound: 'жн', examples: ['television', 'decision'] },
          { spelling: 'ture', sound: 'чээ', examples: ['picture', 'nature', 'furniture'] },
          { spelling: 'c (i, y, e үсгийн өмнө)', sound: 'с', examples: ['city', 'center', 'cycling'] },
          { spelling: 'c (бусад тохиолдолд)', sound: 'к', examples: ['class', 'cut', 'close', 'coat'] },
          { spelling: 's (хоёр эгшигийн дунд)', sound: 'з', examples: ['use', 'music', 'base', 'opposite'] },
          { spelling: 's (бусад тохиолдолд)', sound: 'с', examples: ['sun', 'sorry', 'son', 'soup'] },
          { spelling: 'g (i, e, y үсгийн өмнө)', sound: 'ж', examples: ['ginger', 'gym'] },
          { spelling: 'g (бусад тохиолдолд)', sound: 'г', examples: ['grass', 'glass'] }
        ]
      }
    ]
  };

  // ------------------------------------------------------------ p14-p15
  const P = (en, mn, ex_en, ex_mn) => ({ en, mn, ex_en, ex_mn });

  const preps = {
    id: 'u-prepositions',
    kind: 'reference',
    title_mn: 'Угтвар үгс',
    title_en: 'Prepositions',
    pages: [14, 15],
    blurb_en: 'Place, direction and time. Mongolian marks these with case endings; English uses a separate word before the noun.',
    blocks: [
      {
        t: 'note',
        mn: 'Англи хэлний нэр үг нь тийн ялгалын утгыг Саксоны хамаатуулах болон Заахын тийн ялгалын өмнөх өгөх оршихын тийн ялгалаас бусад тохиолдолд үйл үгээс гадна угтвар үгийн тусламжтайгаар монгол хэлний 7 тийн ялгалтай дүйцэх утгыг гаргаж өгдөг.',
        en: 'Mongolian has seven cases marked by endings. English marks the same relations with a preposition placed before the noun.'
      },
      {
        t: 'prep',
        label: 'Орон байр заах угтвар үг (Prepositions of place)',
        drill: 'prep',
        items: [
          P('on', 'дээр', 'on the house', 'байшин дээр'),
          P('in', 'дотор', 'in the house', 'байшин дотор'),
          P('at', 'дэргэд, дотор, дээр', 'at the house', 'байшингийн дэргэд'),
          P('over', 'дээр, дээгүүр', 'over the house', 'байшин дээгүүр'),
          P('near', 'ойролцоо', 'near the flat', 'байрны ойролцоо'),
          P('in front of', 'өмнө, нүүрэн талд', 'in front of the flat', 'байрны өмнө'),
          P('behind', 'цаана, ар талд', 'behind the flat', 'байрны ар талд'),
          P('across', 'хөндлөн', 'across the street', 'гудамж хөндлөн'),
          P('through', 'нэвт, шувт, -аар', 'through the window', 'цонхоор, цонх нэвт'),
          P('between', 'хооронд, завсар', 'between the vases', 'ваарнуудын хооронд'),
          P('among', 'дунд', 'among the students', 'оюутнуудын дунд'),
          P('around (round)', 'дэргэд, тойроод', 'around the table', 'ширээг тойроод'),
          P('atop', 'орой дээр, дээр', 'atop his head', 'түүний толгой дээр'),
          P('beneath', 'дор, доор', 'beneath the tree', 'модны дор'),
          P('beside', 'дэргэд, хажууд', 'beside the house', 'байшингийн хажууд'),
          P('beyond', 'цаана, нөгөө талд', 'beyond the building', 'байшингийн нөгөө талд'),
          P('by', 'дэргэд, ойр, хажууд', 'by the river', 'голын дэргэд'),
          P('nearby', 'ойр, ойрхон', 'nearby the flat', 'байрны ойр'),
          P('within', 'дотор', 'within the city', 'хотын дотор'),
          P('under (below, beneath)', 'дор, доор', 'under the house', 'байшин доор')
        ]
      },
      {
        t: 'prep',
        label: 'Чиглэл заах угтвар үг (Prepositions of direction)',
        drill: 'prep',
        items: [
          P('to', '-руу, -д, -т', 'to the house', 'байшин руу'),
          P('into', '-руу, -д, -т (дотогш)', 'into the house', 'байшин руу (дотогш)'),
          P('out of', '-аас (гадагш чиглэл)', 'out of the house', 'байшингаас'),
          P('round', 'тойрон', 'round the house', 'байшинг тойрон'),
          P('from', '-аас', 'from the flat', 'байрнаас'),
          P('over', 'дээгүүр', 'over the city', 'хотын дээгүүр'),
          P('along', 'дагуу, тууш', 'along the river', 'голын дагуу'),
          P('towards (toward)', 'руу, ...-ны чиглэлд, зүг, тийш, өөд', 'towards the house', 'байшингийн зүг')
        ]
      },
      {
        t: 'prep',
        label: 'Цаг хугацаа заах угтвар үг (Prepositions of time)',
        drill: 'prep',
        items: [
          P('on', '-д, -т (өдөр)', 'on Saturday', 'Бямба гаригт'),
          P('on', '-д, -т (өдөр)', 'on May 11', '5 сарын 11-нд'),
          P('on', '-д, -т (өдөр)', 'on week days', 'ажлын өдрүүдэд'),
          P('in', '-д, -т, дараа', 'in March', '3-р сард'),
          P('in', '-д, -т, дараа', 'in 2002', '2002 онд'),
          P('in', '-д, -т, дараа', 'in summer', 'зун(д)'),
          P('in', '-д, -т, дараа', 'in the morning', 'өглөө(д)'),
          P('in', '-д, -т, дараа', 'in an hour', 'цагийн дараа'),
          P('in', '-д, -т, дараа', 'in a day', 'нэг өдрийн дараа'),
          P('in', '-д, -т, дараа', 'in 4 months', '4 сарын дараа'),
          P('in', '-д, -т, дараа', 'in 5 years', '5 жилийн дараа'),
          P('at', '-д, -т (цаг)', 'at 7 o\'clock', '7 цагт'),
          P('at', '-д, -т (цаг)', 'at first', 'эхэндээ'),
          P('at', '-д, -т (цаг)', 'at the beginning', 'эхээр'),
          P('by', 'гэхэд (тодорхой хугацаа)', 'by 3 o\'clock', '3 цаг гэхэд'),
          P('since', '-аас хойш', 'since 1997', '1997 оноос хойш'),
          P('since', '-аас хойш', 'since 1 o\'clock', '1 цагаас хойш'),
          P('for', 'турш', 'for an hour', 'нэг цагийн турш'),
          P('for', 'турш', 'for 5 months', '5 сарын турш'),
          P('during', 'үед, турш', 'during the lesson', 'хичээлийн үед / турш'),
          P('before', 'өмнө, урьд', 'before the lesson', 'хичээлийн өмнө'),
          P('before', 'өмнө, урьд', 'before lunch', 'үдийн үндны өмнө'),
          P('after', 'дараа', 'after the lesson', 'хичээлийн дараа'),
          P('after', 'дараа', 'after 3 years', '3 жилийн дараа'),
          P('till, until', 'хүртэл', 'till June', '6-р сар хүртэл'),
          P('till, until', 'хүртэл', 'until I come back', 'намайг эргэж иртэл'),
          P('from ... till', '...-аас ... хүртэл', 'from 2 till 4 o\'clock', 'гурваас дөрвөн цаг хүртэл'),
          P('last', 'өнгөрсөн', 'last night', 'өнгөрсөн шөнө'),
          P('last', 'өнгөрсөн', 'last month', 'өнгөрсөн сард'),
          P('next', 'дараагийн', 'next week', 'ирэх долоо хоногт'),
          P('next', 'дараагийн', 'next month', 'ирэх сард'),
          P('next', 'дараагийн', 'next April', 'ирэх 4 сард'),
          P('ago', 'өмнө, урьд', 'a day ago', 'нэг өдрийн өмнө'),
          P('ago', 'өмнө, урьд', 'a month ago', 'сарын өмнө'),
          P('at the age of', '-насандаа', 'at the age of 21', '21 насандаа'),
          P('around', 'орчимд', 'at around 10 o\'clock', '10 цагийн орчимд'),
          P('between', 'хооронд', 'between one and two o\'clock', 'нэгээс хоёр цагийн хооронд')
        ]
      },
      {
        t: 'note',
        mn: 'Анхаар: номын 15-р хуудсанд "at the ago of 21" гэж хэвлэгдсэн. Зөв нь at the age of 21.',
        en: 'The book prints "at the ago of 21" on p.15. The correct form is "at the age of 21".'
      }
    ]
  };

  // --------------------------------------------------------------- p16
  const conj = {
    id: 'u-conjunctions',
    kind: 'reference',
    title_mn: 'Холбоо үгс',
    title_en: 'Conjunctions',
    pages: [16],
    blurb_en: 'The words that join independent clauses.',
    blocks: [
      {
        t: 'note',
        mn: 'Холбоос үг нь бие даасан үг өгүүлбэрүүдийг холбох үүрэгтэй ба холбоос үгийн дараах төрлүүд байдаг.',
        en: 'A conjunction joins independent words and clauses. These are the types.'
      },
      {
        t: 'pairs',
        label: 'Жишээ / Examples',
        drill: null,
        items: [
          ['I and my brother', 'ах бид хоёр'],
          ['He is small but strong.', 'Тэр жижиг гэвч хүчтэй.'],
          ['He can\'t (either) read or write.', 'Тэр уншиж бичиж чаддаггүй.'],
          ['I know both you and your friend.', 'Би чамайг ч чиний найзыг ч мэднэ.']
        ]
      },
      {
        t: 'pairs',
        label: 'Холбоо үгс / Conjunctions',
        drill: 'both',
        items: [
          ['that', 'гэж'],
          ['till (until)', 'хүртэл, болтол'],
          ['because', 'учир нь, яагаад гэвэл'],
          ['lest', '...-гүйн тулд'],
          ['though, although', 'хэдийгээр ... боловч'],
          ['before', '...-ээс өмнө'],
          ['where', 'хаана, хаашаа'],
          ['as soon as', '-магц(4), -нгуут(2) (хугацаа)'],
          ['as long as', 'зөвхөн, -х тохиолдолд'],
          ['as', 'тул, учир, үед, -хад(4)'],
          ['supposing', 'хэрвээ ... сан(4) бол'],
          ['after', '-аас(4) хойш'],
          ['wherever', 'хаана ч, хэзээ ч'],
          ['so that', 'тулд, гэж'],
          ['in case', '-бал, -вал, хэрэв, -ж магадгүй тул'],
          ['but', 'гэвч'],
          ['while', '-х зуур, хооронд'],
          ['if', 'хэрэв'],
          ['when', '... үед, -хад(4)'],
          ['unless', '-гүй л бол'],
          ['for', 'тул, учир'],
          ['whether', 'уу(2), ... ууь үгүй юу'],
          ['while', 'үед'],
          ['since', '-аас хойш, учраас, тул'],
          ['in order that', '...-ын тулд, ... сан(4) байхын тулд'],
          ['provided (that)', '(гэсэн) нөхцөлд'],
          ['and', 'ба, бөгөөд, харин'],
          ['neither ... nor', '... ч биш'],
          ['both ... and', 'аль аль нь, ... ч тэр'],
          ['whereas', 'гэтэл, харин'],
          ['or', 'буюу'],
          ['as well as', 'мөн түүнчлэн'],
          ['not only ... but also', 'зөвхөн ... төдийгүй, мөн түүнчлэн'],
          ['either ... or', 'эсвэл']
        ]
      },
      {
        t: 'note',
        mn: 'Анхаар: номд "if weather" гэж хэвлэгдсэн. Утгаараа "whether" байх ёстой.',
        en: 'The book prints "if weather". From the Mongolian gloss the intended word is "whether".'
      }
    ]
  };

  // ------------------------------------------------------------ p17-p18
  const lesson2 = {
    id: 'l2-translation',
    kind: 'lesson',
    lesson_no: 2,
    title_mn: 'ХИЧЭЭЛ - 2 · Translation /active/',
    title_en: 'Lesson 2 — Reading the Mongolian ending, choosing the English form',
    pages: [17, 18],
    blurb_en: 'The method of the book: a Mongolian verb ending tells you which English structure to build. Learn the 28 mappings and translation stops being guesswork.',
    blocks: [
      { t: 'formula', label: 'Ерөнхий бүтэц', items: [{ name: 'Active', pattern: 'S + TOBE + O + Ad + L + TE' }] },
      {
        t: 'map',
        label: 'Монгол төгсгөл → Англи бүтэц',
        drill: 'map',
        items: [
          { n: 1, mn: 'Байх, бол', en: 'Tobe / am is are' },
          { n: 2, mn: 'Байсан', en: 'Was / were' },
          { n: 3, mn: 'Болно', en: 'Will be' },
          { n: 4, mn: 'Байдаг', en: 'There tobe' },
          { n: 5, mn: 'Байдаг байсан', en: 'There was / were' },
          { n: 6, mn: 'Тай³', en: 'Have / has got' },
          { n: 7, mn: 'Тай³ байсан', en: 'Had' },
          { n: 8, mn: 'Тай³ болно', en: 'Will have got' },
          { n: 9, mn: 'Даг', en: 'V/s/' },
          { n: 10, mn: 'Сан, жээ, лээ', en: 'Ved / pp2' },
          { n: 11, mn: 'Даг байсан', en: 'Used to + V' },
          { n: 12, mn: 'На⁴', en: 'Will + V  /  Tobe going to + V' },
          { n: 13, mn: 'Х гэж байгаа', en: 'Tobe about to + V  /  Tobe + Ving ... tomorrow' },
          { n: 14, mn: 'Х гэж байсан', en: 'was, were + about to + V  /  was, were + going to + V' },
          { n: 15, mn: 'Ж, Ч байна', en: 'Tobe + Ving' },
          { n: 16, mn: 'Ж, Ч байсан', en: 'Was / were + Ving' },
          { n: 17, mn: 'Ж, Ч байх болно', en: 'Will be + Ving' },
          { n: 18, mn: 'Чихсан, Цан⁴, аад байна', en: 'have / has + Ved/pp3' },
          { n: 19, mn: 'Чихсан байсан, Цан⁴ байсан, чихаад байсан', en: 'Had + Ved/pp3' },
          { n: 20, mn: 'Чихсан байх болно, Цан⁴ байх болно, чихаад байх болно', en: 'Will have + Ved/pp3' },
          { n: 21, mn: 'Үзсэн үү', en: 'Have + S + ever + Ved/pp3' },
          { n: 22, mn: 'Саар л байна, ж л байна, турш / хойш ж байна', en: 'have / has been + Ving' },
          { n: 23, mn: 'Саар л байсан, ж л байсан, турш / хойш ж байсан', en: 'had been + Ving' },
          { n: 24, mn: 'Саар л байх болно, ж л байх болно, турш ж байх болно', en: 'Will have been + Ving' },
          { n: 25, mn: 'На гэж бодсон', en: 'Past simple + that + S + would + V' },
          { n: 26, mn: 'Байх болно гэж найдсан', en: 'Past simple + that + S + would be + Ving' },
          { n: 27, mn: 'Чихсан байх болно гэж итгэсэн', en: 'Past simple + that + S + would have + Ved/pp3' },
          { n: 28, mn: 'Ж л байх болно гэж бодсон', en: 'Past simple + that + S + would have been + Ving' }
        ]
      },
      {
        t: 'translate',
        label: 'Орчуулга (х.18)',
        dir: 'mn_en',
        items: [
          'Оюутнууд жилдээ хоёр удаа шалгалт өгдөг.',
          'Хөвгүүд хичээлийнхээ дараа усанд сэлж байна.',
          'Нар зүүнээс манддаг.',
          'Бид Флоридад хэд хэдэн удаа очсон.',
          'Аав аль хэдийн цамцаа индүүдчихсэн.',
          'Тэр энд хоёр цагийн турш хүлээж байна.',
          'Ээж маань 30 настайгаасаа хойш тогооч хийж байгаа.',
          'Тэр залуу хийл тоглосоор л байна.',
          'Бид өчигдөр найзуудтайгаа хамт сагсан бөмбөг тоглосон.',
          'Жэйн өнгөрсөн лхагва гарагт Томтой хамт кино театрт кино үзсэн.',
          'Туяа гэрийн даалгавраа хийсээр л байсан.',
          'Бид энэ зуны амралтаараа Америкруу аялна.',
          'Маргааш яг өдийд би ажлаа хийж байх болно.',
          'Орой долоон цаг гэхэд ээж хоолоо хийчихсэн байна.',
          'Тэр эмэгтэй нарийн бичгээр ажилладаг.',
          'Бат хөгжим сонсож байна.',
          'Би хэзээ ч тэмээ унаж үзээгүй.',
          'Тэд англи хэлийг дөрвөн жилийн турш сурч байна.',
          'Би өдрөөс өдөрт шаргуу ажиллаж л байна.',
          'Миний сарын цалин бол нэг сая төгрөг.',
          '3 жилийн өмнө монголд бусад орны ерөнхийлөгч ерөнхий сайдууд ирсэн.',
          'Найдангийн Түвшинбаяр 2008, 2012 оны зуны олимпиос жудо-р алт, мөнгөн медаль авчихаад байна.',
          'БНСУ-н Ханян их сургууль 2000 оноос хойш монгол улстай хамтран ажиллаж байна.',
          'Солонгосын олон эмнэлэгт монголчууд эмчлүүлэхээр очиж байна.',
          'Би энэ байгууллагыг 1990 онд байгуулласан.',
          'Бид 3 хоногийн өмнө IELTS-н шалгалт өгчихөөд байна.',
          'Дэлхийн хүн амын буруутай үйлдэл дэлхийн дулааралд нөлөөллөж байна.',
          'Бид цагаан сараар байнга өвөө эмээ дээрээ очдог.',
          'Монгол улсын эдийн засаг өмнөх оноос 20%-р өссөн байна.',
          'Би хэд хэдэн удаа америкийн визэнд орсон.',
          'Myself /over 200 words/ essay'
        ]
      }
    ]
  };

  // ------------------------------------------------------------ p19-p21
  const lesson3 = {
    id: 'l3-syntax',
    kind: 'lesson',
    lesson_no: 3,
    title_mn: 'ХИЧЭЭЛ - 3 · Syntax / Өгүүлбэр зүй',
    title_en: 'Lesson 3 — Sentence order and the six forms',
    pages: [19, 20, 21],
    blurb_en: 'One slot order for every English sentence, and the six things you can do with it: positive, negative, and four kinds of question.',
    blocks: [
      {
        t: 'formula',
        label: 'Үндсэн бүтэц',
        drill: 'formula',
        items: [
          { name: 'Positive', pattern: 'S + tobe + O + Ad + L + TE' },
          { name: 'Negative', pattern: 'S + tobe + not + O + Ad + L + TE', gloss: 'Гүй, биш' },
          { name: 'General question', pattern: 'TOBE + S + O + Ad + L + TE?', gloss: 'уу, үү ?' },
          { name: 'Disjunctive question', pattern: 'TOBE + S₁ or S₂ + O₁ or O₂ + Ad₁ or Ad₂ + L₁ or L₂ + TE₁ or TE₂?', gloss: 'уу, үү ?' },
          { name: 'Special question', pattern: 'QWH + TOBE + S + O + Ad + L + TE?', gloss: 'вэ, бэ ?' },
          { name: 'Subject question', pattern: 'SQWh + TOBE + O + Ad + L + TE?', gloss: 'вэ, бэ ?' }
        ]
      },
      {
        t: 'pairs',
        label: 'Байрлалын нэрс / The slots',
        drill: 'both',
        items: [
          ['Subject', 'Үйлийн эзэн / Хэн /'],
          ['Auxiliary verb', 'Туслах үйл үг'],
          ['Verb formula', 'Үйл үгийн хувиргалт'],
          ['Object', 'Тусагдахуун / Юу /'],
          ['Adverb', 'Дайвар үг / Хэрхэн яаж /'],
          ['Location', 'Байршил / Хаана /'],
          ['Time expression', 'Цаг хугацаа / Хэзээ /']
        ]
      },
      {
        t: 'table',
        label: '6 FORM',
        cols: ['', 'Subject', 'Subject', 'Subject', 'Subject'],
        rows: [
          ['POS', 'I', 'WE', 'MY', 'HE, SHE, IT'],
          ['NEG', 'I', 'WE', 'MY', 'HE, SHE, IT'],
          ['GEN', 'YOU', 'THEY', 'YOUR', 'HE, SHE, IT'],
          ['DIS', 'YOU', 'THEY', 'YOUR', 'HE, SHE, IT'],
          ['SPE', 'YOU', 'THEY', 'YOUR', 'HE, SHE, IT'],
          ['SUB', 'WHO', 'WHO', 'WHOSE', 'WHO']
        ]
      },
      {
        t: 'translate',
        label: 'Орчуулга (х.20-21) — ярилцлагын асуултууд',
        dir: 'mn_en',
        items: [
          'Та монголоор ярих уу, англиар ярих уу?',
          'Та ямар хэлээр ярих вэ?',
          'Таны очих газар хаана вэ?',
          'Та яаж өөрийгөө буцаж монголдоо ирнэ гэдгээ батлах вэ?',
          'АНУ руу ямар учраас явах гэж байна вэ?',
          'Та яагаад энэ сургуулийг сонгосон бэ?',
          'Та ямар чиглэлээр сурахаар явах гэж байна?',
          'Яагаад энэ мэргэжлийг сонгох болсон бэ?',
          'АНУ-д хэр удаан суралцах гэж байна?',
          'АНУ-д таны хамаатан садан амьдардаг уу?',
          'Та сургалтандаа хэдэн төгрөг зарцуулах гэж байна?',
          'Таны АНУ-д байх жилийн зардал ойролцоогоор хэд вэ?',
          'Таны зардлыг хэн төлөх вэ?',
          'Ямар хүн, байгууллага таныг ивээн тэтгэх вэ?',
          'Та тэр компанитай ямар холбоотой вэ?',
          'Таны эцэг эх юу хийдэг вэ?',
          'Таны сарын цалин хэд вэ?',
          'Урьд өмнө өөр улсад зорчиж байсан уу?',
          'Та өөрийгөө танилцуулна уу?',
          'Та өмнө нь виз хүсч байсан уу?',
          'Та яагаад Америк явахыг хүссэн бэ?',
          'Таныг хэн ивээн тэтгэж байгаа вэ?',
          'Та ямар ажил эрхэлдэг вэ?',
          'Таны жилийн орлогын хэмжээ хэд вэ?',
          'Таны нэрийн хуудсыг үзэж болох уу?',
          'Таны эзгүйд /бизнесмэн бол/ бизнесийг чинь хэн эрхлэх вэ?',
          'Танд кредит карт байдаг уу?',
          'Та хэдэн хүүхэдтэй вэ? Тэд хаана амьдардаг, юу хийдэг вэ?',
          'АНУ-д таны хэн байдаг вэ?',
          'АНУ-д хэр удаан байх вэ?',
          'Тэнд ажиллах уу?',
          'Эргэж ирэх үү?',
          'Эргэж ирэхээ яаж батлах вэ?',
          'Таны хүү, охин /хүргэн, бэр/ юу хийдэг вэ?',
          'Америкийн компанид та ямар ажил үүрэг гүйцэтгэдэг вэ?',
          'Америкийн компани чинь хэдэн ажиллагсадтай вэ?',
          'Америкийн компанийн жилийн хөрөнгийн эргэлт ямар хэмжээтэй вэ?',
          'Америкт хаана ажиллах вэ?',
          'Та одоогийн байгууллагадаа хэр удаан ажиллаж байна вэ?',
          'Таны одоогийн цалин хэд вэ?',
          'Ажилгүй болж үзсэн үү?',
          'Одоогийн компанид таны гүйцэтгэх үүрэг юу вэ?',
          'АНУ-ын аль нэг их сургуульд сурч байсан уу?',
          'Таны эрдмийн зэрэг цол юу вэ?',
          'Америкт хаана байх вэ?',
          'АНУ-д хэр удаан байхаар төлөвлөж байгаа вэ?',
          'АНУ-ын ямар мужид байх вэ? Тэр мужийн талаархи таны бодол?',
          'Таны сарын цалин нэг сая төгрөг юмуу хоёр сая төгрөг юм уу?',
          'What do you think about study in abroad? /Over 150 words/',
          'Translate to Mongolian — the letter below.'
        ]
      },
      {
        t: 'text',
        label: '50. Translate to Mongolian (х.21)',
        en: [
          'Dear Sir and Madam',
          'My name is Stanley Morgan and with this letter, I would like to express my strong interest in applying a Master\'s Degree Program in Actuarial Management offered by CASS Business School.',
          'I have graduated in 2018, from Tbilisi State University in Georgia and I hold a BA Degree in Financial Management. Through this undergraduate program, I have set the ground towards achieving an in-depth knowledge in the field of Management. I studied various subjects relating to diverse aspects of Management science including Financial Management. Studying at CASS Business School I perceive as a prestigious opportunity to broaden my knowledge in order to become professional expert in social security systems in the future.',
          'Through growing up in a developing country I have witnessed many development issues such as poverty, income inequality and others, which later on driven me to choose profession in the field of social security. Through this specialization, I would like to contribute to poverty reduction and public welfare.',
          'After graduation, I have started to work in Public Insurance Trust of Georgia. Thanks to this job, I have learned about extent of poverty prevalence and I realized I would have to put my personal career focus on improvement of public welfare. To achieve that goal I would like to improve my knowledge of economics and gain a degree at higher level, preferably form prestigious University. With better knowledge, I am confident that I will be able to understand the economic and social problem better.',
          'Owing to my career goal to become successful expert, I have decided to familiarize with actuarial sciences by doing Master Degree in Actuarial Management. This major involves the actuarial risk management, health insurance, life insurance, pension and other benefits, Finance and investment. After a board search, i found the Master Degree of Actuarial Management at Cass Business School as the best choice for me because your school has good experts in this field and I hope to collaborate with them. Cass Business School at City University is one of the best learning facilities in Europe and the mathematic is the language in the economics field. Due to that fact, I would make an effort to improve quantitative skills by taking calculus and statistic in mathematics. I would highly appreciate to be accepted to this scholarship program as well. I would offer my leadership skills, a strong educational background and desire to go one-step further than the others would. I have the right academic record, the right skills and attitude to succeed and I am convinced that this program is the right stepping-stone for my professional ambitions.',
          'Thank you for your time and consideration. I am waiting for your response.',
          'Yours faithfully, S. Morgan'
        ]
      }
    ]
  };

  // --------------------------------------------------------------- p22
  const lesson4 = {
    id: 'l4-future-in-past',
    kind: 'lesson',
    lesson_no: 4,
    title_mn: 'ХИЧЭЭЛ - 4 · Future in the past / Өнгөрсөн дэх ирээдүй хэлбэр',
    title_en: 'Lesson 4 — Future in the past',
    pages: [22],
    blurb_en: 'What you once expected to happen. Main clause in past simple, "that", then would + the aspect you need.',
    blocks: [
      {
        t: 'note',
        mn: 'Энэхүү хэлбэр нь өмнө нэг үйл явдал болно гэж найдаж байсан, итгэж байсан, төсөөлж байсан, бодож байсанаа хожим хэн нэгэн хүнд дамжуулан хэлэхдээ ашигладаг.',
        en: 'Use this when you are reporting, later, what you once hoped, believed, imagined or thought would happen.'
      },
      {
        t: 'pairs',
        label: 'Жишээ / Examples',
        drill: null,
        items: [
          ['I used to think that my son would be a doctor', 'Би хүүгээ эмч болно гэж боддог байсан'],
          ['I knew that my son would devote to the science himself', 'Би хүүгээ шинжлэх ухаанд өөрийгөө зориулна гэдгийг мэдээд байсан юм.'],
          ['I didn\'t imagine that you wouldn\'t come in my birthday party', 'Чамайг миний төрсөн өдөрт ирэхгүй байна гэж төсөөлсөнгүй']
        ]
      },
      {
        t: 'table',
        label: 'Future in the past — бүтэц',
        cols: ['Tenses / Цагууд', 'Main clause (Past simple)', 'Conjunction / Холбоос', 'Subordinate / Гишүүн өгүүлбэр'],
        rows: [
          ['Future simple in the past /на гэж/', 'I thought', 'That /гэж, гэсэн, гэдэгт/', 'Would + V'],
          ['Future continuous in the past /ж байх болно гэж/', 'I knew', 'That', 'Would be + Ving'],
          ['Future perfect in the past /чихсан байх болно гэж/', 'I promised', 'That', 'Would have + Ved/pp3'],
          ['Future perfect continuous in the past /ж л байх болно гэж/', 'I recognised / I imagined', 'That', 'Would have been + Ving']
        ]
      },
      {
        t: 'formula',
        label: 'Дүрэм',
        drill: 'formula',
        items: [
          { name: 'Future simple in the past', pattern: 'Past simple + that + S + would + V', gloss: 'на гэж' },
          { name: 'Future continuous in the past', pattern: 'Past simple + that + S + would be + Ving', gloss: 'ж байх болно гэж' },
          { name: 'Future perfect in the past', pattern: 'Past simple + that + S + would have + Ved/pp3', gloss: 'чихсан байх болно гэж' },
          { name: 'Future perfect continuous in the past', pattern: 'Past simple + that + S + would have been + Ving', gloss: 'ж л байх болно гэж' }
        ]
      },
      {
        t: 'note',
        mn: 'Анхаарах: Та бүхэн өгүүлбэрээ орчуулахдаа гэж, гэсэн, гэдэгт холбоос үгээр энэхүү цагуудаа таньж болох юм. Мөн холбоосны өмнө ямар нөхцөлөөр төгсөж байгааг харан цагаа тодорхойлох боломжтой юм. Холбоосны ард талын өгүүлбэрийг гол өгүүлбэр гэх, холбоосны өмнөх өгүүлбэрийг гишүүн өгүүлбэр гэж ойлгож болно.',
        en: 'The conjunction гэж / гэсэн / гэдэгт is the signal. Look at the ending just before it to decide which of the four you need.'
      }
    ]
  };

  const units = [
    pronouns, verbs, grid, vowels, consonants, preps, conj,
    lesson2, lesson3, lesson4
  ];

  // Study order. Reference units that later lessons lean on come first.
  const path = [
    'u-pronouns', 'u-verbs', 'u-tense-grid', 'l2-translation',
    'l3-syntax', 'l4-future-in-past', 'u-prepositions', 'u-conjunctions',
    'u-sounds-vowels', 'u-sounds-consonants'
  ];

  return {
    meta: {
      title: 'Boldoo\'s English Lesson',
      subtitle: 'Англи хэлний хичээл — монгол хэлээр',
      source: 'BE_Lesson/ — photographed pages',
      pages_transcribed: [6, 22],
      pages_available: [6, 153],
      gap_note: 'ХИЧЭЭЛ - 1 falls on pages 1-5, which are not in the photograph set. ' +
        'Lesson numbering therefore starts at 2.'
    },
    units: units,
    path: path
  };
})();
