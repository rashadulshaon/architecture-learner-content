# Architecture Learner — content

The lessons, flashcards and quiz questions of
[Architecture Learner](https://github.com/rashadulshaon/architecture-learner), a visual course on
system design and software architecture for engineers who can already build a CRUD app.

Everything here is plain YAML. The app has no backend: it downloads the JSON that this
repository's GitHub Action builds from these files.

## Layout

```
outline.yaml               every topic and sub-segment, in course order
<topic>/<segment>.yaml     one sub-segment: its slides, flashcards and quiz
AUTHORING.md               how content is written (learning rules + the full schema)
scripts/                   the validator and JSON builder (Node.js)
```

## Editing content

1. Edit or add a file under `<topic>/` (add a new sub-segment to `outline.yaml` first).
2. Check it:

   ```bash
   npm install
   npm run check -- <topic>/<segment>
   ```

3. Commit and push to `main` (or open a pull request: the check runs on it too).

`AUTHORING.md` explains the format and the learning-design rules every lesson follows
(one idea per slide, problem first, picture + words, recall question, …).

## How it is published

On every push to `main`, [.github/workflows/publish.yml](.github/workflows/publish.yml):

1. validates every file (`npm run check`) and stops if anything is wrong;
2. builds the JSON (`npm run build` → `dist/`);
3. force-pushes `dist/` as the only commit of the `build` branch.

The app reads the `build` branch through `raw.githubusercontent.com`:

| File | What it holds |
|---|---|
| `outline.json` | topics → sub-segments → slide headlines (outline + search) |
| `topics/<topic>/slides.json` | every slide of one topic |
| `topics/<topic>/flashcards.json` | every flashcard of one topic |
| `topics/<topic>/quiz.json` | every quiz question of one topic |

GitHub caches those files for about five minutes, so a change shows up in the app within
a few minutes. Never edit the `build` branch by hand: the next push replaces it.

### Preview a change in the app locally

```bash
npm run build                                   # writes dist/
cd ../architecture-learner
CONTENT_DIR=../architecture-learner-content/dist yarn dev
```

## IDs and saved progress

Learners' progress lives in their browser, keyed by stable IDs:

- a slide's ID is its path, `topic/segment/slide` — renaming a slug resets "read" ticks for it;
- a flashcard's or quiz question's ID is built from its question text — rewording the
  question resets that one card's "knew / forgot" mark. Fixing an answer or explanation
  keeps it.
