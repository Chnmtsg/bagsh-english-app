# Small Step

**Англи хэл, алхам алхмаар.** A bilingual English study app for Mongolian
speakers — read, drill, write, place.

Standalone and offline. Independent of the Багш journal app in this repo:
separate folder, separate storage keys, no shared code. Nothing here can break
`src/`, `webapp/` or the parent test suite.

## Run it

No build step, no dependencies, no API key.

```bash
python -m http.server 8000 --directory boldoo
# then open http://localhost:8000
```

Opening `boldoo/index.html` from disk also works — content loads as a plain
script rather than being fetched. The service worker (offline caching,
installable to a home screen) only registers over http(s).

## Tests

```bash
node boldoo/tests/test_boldoo.js       # book content, exercise generation, grading, scheduler
node boldoo/tests/test_contrastive.js  # the guide layer stays separable and grades correctly
node boldoo/tests/test_render.js       # every screen renders, against a stub DOM
```

Three dependency-free Node scripts, 6,879 assertions.

## Two sources

Everything the app teaches comes from one of two places, and every item says
which:

| Chip | Source |
|---|---|
| `НОМ` | *Boldoo's English Lesson*, pages 6–22, transcribed from `../BE_Lesson/` |
| `ГАРЫН АВЛАГА` | `../docs/source/English-Mongolian-Contrastive-Guide.docx` |
| `ХОЁУЛАА` | a book page the guide has commentary on |

**932 machine-graded items** (793 book + 139 guide) across 17 units, plus 91
free-translation prompts.

The book layer is `content/lessons.js`; the guide layer is
`content/contrastive.js`. They are never merged. Where the two disagree — and on
five points they do — the app shows the conflict rather than silently picking a
winner. The book is never edited to match the guide.

### The five conflicts

| Book | Problem |
|---|---|
| p.13 `wh → В` | Teaches *what / white / why* with a **v**. They are /w/. |
| p.13 `th → Т / Д` | /θ/ and /ð/ need the tongue tip between the teeth. |
| p.14 `nearby the flat` | *nearby* is not a preposition. |
| p.11 `ago` under Perfect Continuous | *ago* marks past simple; perfect takes *for* / *since*. |
| p.19 questions use only `TOBE` | Most English questions need do / does / did. |

The strongest agreement: the book's `S + tobe + O + Ad + L + TE` is exactly the
guide's **SVOMPT**. Two independent sources, same slot order.

## Screens

**Onboarding** — three questions (language, sitting length, where to start),
shown once. Skippable.

**Зам / Path** — `Өнөөдөр`. Two counts that are never added together: what is due
for review, and what has not been started. One gold call to action. Then every
unit with its source chip, mastery bar and counts.

**Дасгал / Drill** — one question at a time. Multiple choice where typing would
be unfair (Cyrillic, long structures), typed answers for verb forms and error
correction. Distractors are always real answers from the same table.

**Дүн / Results** — score, what was missed, and a reminder that one correct
answer is not knowing.

**Унших / Reader** — the book rendered properly. The 16-tense grid is printed
sideways across a page in the original; here it is a table you can read on a
phone. The guide's commentary appears under the page it bears on.

**Бичих / Write** — free translation. Self-assessed and excluded from accuracy,
because no code here can honestly grade a free translation. Ten prompts carry a
model answer because the model came from a source; the book's own 81 Орчуулга
prompts have no answer key, so they say so rather than showing an invented one.

**Түвшин тогтоох / Placement** — two questions per unit, then a recommended
order, weakest first.

**Ахиц / Progress** — mastered, accuracy, learning, not started. Nothing else.

**Тохиргоо / Settings** — sitting length, English gloss, source labels, strict
typing. Every switch does something; the design's audio and reminder toggles are
left out until there is something behind them.

## Design rules

1. **The content files are the only source of English.** Exercises are generated
   and graded by code. Nothing is produced by a model at runtime, so an exercise
   cannot invent English the sources do not contain, and a right answer cannot be
   marked wrong on a whim.
2. **Two sources, never merged.** Separate files, separate id namespaces, every
   item labelled.
3. **Mastery is a criterion, not an event.** Three correct answers on three
   *different* days. This is not a setting — the app makes claims against it.
4. **Habit numbers are never progress.** No streaks, no XP, no badges. Progress
   answers two questions: how much is mastered, and how accurate you are.
5. **New work and review are counted separately, never summed.**
6. **Free translation is self-assessed and excluded from accuracy.**
7. **The book's typos are recorded, not taught.** Where the printed text would
   teach something false, the corrected form is drilled and the original is
   shown as a note — `know`/PP3 printed "Know", `stride`/PP2 printed "strod",
   `at the ago of 21` for *age*.
8. **Handwriting is not an answer key.** The previous owner's pencilled answers
   appear in several photographs. Some are wrong. None are transcribed.
9. **Every tap target is at least 44px**, and the primary action sits at the
   bottom of the screen, within thumb reach.
10. **Wide content scrolls in its own box.** The page never scrolls sideways.

## Visual system

Warm paper and navy, IBM Plex throughout — one of the few families that sets
Cyrillic and Latin with the same voice. Purple is reserved for the second
source, ochre for review, green for correct, red for wrong. Those four colours
never mean anything else.

Fonts are bundled (`fonts/`, ~156KB, Latin + Cyrillic subsets only) so the app
works with no network. Plex Sans is the variable font, so one file per subset
covers every weight.

## Files

```
boldoo/
├── index.html              app shell
├── style.css               the visual system
├── fonts.css + fonts/      IBM Plex, subset and bundled
├── app.js                  screens, routing, session builder
├── settings.js             the settings that actually do something
├── srs.js                  scheduler, mastery, honest stats
├── exercises.js            generators and deterministic graders
├── content/lessons.js      the book transcription
├── content/contrastive.js  the guide layer — notes, units, write models
├── sw.js                   offline cache
├── manifest.webmanifest    installable
└── tests/                  three dependency-free Node suites
```

`Zam - English Study App.html` is the design bundle this interface was built
from — kept for reference, not part of the app.

## Extending

Add a unit to `content/lessons.js` and put its id in `path`. All three suites
walk whatever is in the files, so a new unit is checked for completeness the
moment it is added. Block types the reader and generators understand: `note`,
`pairs`, `verbs`, `grid`, `sound`, `prep`, `map`, `formula`, `table`,
`translate`, `text`, `qa`, `contrast`, `pron`.

To add guide material, put a note in `content/contrastive.js` under the book
unit it bears on (kind `warn`, `confirm` or `gap`, with a `src` citation), or
add a `cg-` prefixed unit and place it in `pathAfter`.

`ХИЧЭЭЛ‑1` is on pages 1–5, which are not in the photograph set, so lesson
numbering starts at 2. Pages 23–153 are photographed but not yet transcribed.

Progress lives in `localStorage` under `boldoo.srs.v1`, settings under
`boldoo.settings.v1`. Nothing leaves the device.
