# Study Log

A personal study app for exams and qualifications: practice questions, notes, highlights and
handwriting with Apple Pencil. It runs entirely in the browser and is hosted on GitHub Pages, like
Reading Log and Money Log. Your data stays on your devices and syncs to a private GitHub repo
(`study-data`).

## What it does

- **Exams**: a list of the exams you're studying for. Each exam has question sets (one per imported
  sheet or file) and topics (the "Domain" column).
- **Import**: CSV or Excel (.xlsx) files, choosing which sheets to bring in. Re-importing an updated
  file shows what's new, what changed (word by word) and what's missing before anything is saved.
  Questions keep their notes, highlights, handwriting and answers when they're updated.
- **Edit in the app**: question, options (add, remove, reorder), correct answer(s), explanation, topic
  and reference. Export back to CSV in the same layout.
- **Study mode**: choose sets, topics, which questions (all, new, wrong, flagged) and the order.
  Check your answer, see the explanation, flag questions, continue later on any device.
  Exam mode (timed, scored) comes later.
- **Notes**: a typed note per question, text highlights (select words in the question, an option or
  the explanation), and handwriting: over the question itself and on a memo pad below it.
- **Clean / Notes**: Clean hides every note, highlight and handwriting; Notes shows all of it.

## Using it

1. Open the site: `https://margof94.github.io/study-app/`
2. **Settings → Sync**: enter your GitHub username, `study-data`, and a fine-grained token with
   *Contents: Read and write* on that repo only. Do this on each device.
3. On iPad and iPhone: Safari → Share → **Add to Home Screen** to install it as an app.
4. **Import file** → choose the workbook → pick the sheets → Import.

### The file layout

One row per question under a heading row (a title above it is fine). Recognised headings, in English
or Japanese:

| Heading | Meaning |
|---|---|
| `Q#` (or ID, No.) | The question's number; how an updated file finds the question it replaces |
| `Question` | The question |
| `Answer options` | All options in one cell, separated by blank lines, **or** one column each: `Option A`, `Option B`… |
| `Correct answer` | The option's text, letter(s) (`B`, `A,C`) or number(s) (`2`, `1,3`). If empty, `Correct: 2` at the start of the explanation is used |
| `Overall explanation`, `Domain`, `Reference` | Optional |
| `Set` | Optional: which question set (exported files have it) |

### Handwriting on iPad

Tap **Write**. With **Pencil only** (the default), Apple Pencil writes and your finger scrolls, so your
hand never leaves marks. Handwriting over a question is stored in page units: in Notes mode the
question is laid out at a fixed page width and scaled to the screen, so marks stay on the same words on
every device.

## Data

Two repositories:

- `study-app` (this repo, public): the app's code only. **Never** put question files here.
- `study-data` (private): your data.

```
study-data/
  study.json                         exams, question sets, study sessions, settings
  exams/<exam>/questions.json        questions
  exams/<exam>/notes.json            typed notes and highlights
  exams/<exam>/progress.json         answers and flags
  exams/<exam>/ink/<question>.json   handwriting for one question
```

One record per line with sorted keys, so GitHub's history shows exactly what changed. Sync downloads
only files that changed, merges record by record (newest edit wins) and uploads only what differs.

## Development

```sh
npm install
npm run dev      # local dev server
npm run check    # type check
npm test         # unit tests
npm run build    # production build into dist/
```

Pushes to the default branch are built, tested and deployed by `.github/workflows/deploy.yml`.
