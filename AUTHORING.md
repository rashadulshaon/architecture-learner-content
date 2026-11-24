# Easy Architecture — content authoring guide

Easy Architecture is a visual learning site, in **English and Bangla**, that teaches system
design and software architecture. You write the content. The site renders it; you never write
HTML.

Read this whole guide, then read the two finished example files — they are the quality bar:

- `content/bn/start/how-to-learn.yaml` (and its English edition in `content/en/start/`)
- `content/bn/start/crud-to-architecture.yaml`

## 0. Two editions, one structure

The course exists twice: an **English edition** (`content/en/`, the site's default) and a
**Bangla edition** (`content/bn/`). The learner switches between them in the header.

They are **two editions, not a translation**. A sentence that is exactly right in English can
sound stiff and foreign when carried word for word into Bangla, and the other way round. So
each edition is written in its own natural voice (sections 2 and 2a): rephrase, reorder,
split or merge sentences, pick the idiom a native writer would use. What must not change is
the *teaching*: the same idea on each slide, the same facts, numbers and code behaviour.

Both editions share **one structure**, so that a bookmark, a progress mark or a link points to
the same thing in either language. The validator compares the editions and fails on any
difference in:

- slide `slug`s, their order and `kind`
- the blocks of each slide: same `type`s in the same order, same visual `kind`, same number
  of nodes, edges, actors, messages, layers, columns, steps, rows, bars, points and items
- every identifier and setting: node/actor `id`, `from`/`to`/`at`, `col`/`row`, `tone`, `icon`,
  `style`, `variant`, `lang`, `dashed`, `animate`, bar `value`
- aside sections (same `type`s, same number of items, same `refs` targets)
- flashcards (same number, same order, same `ref`) and quiz questions (same number and order,
  same options in the same order with the same `correct` flags, same `ref`, `code` present or not)

Free to differ: every piece of prose, `keywords` (search terms of that language — any number),
comments inside code, and the line a code `mark` points to (when a comment wraps differently).

When you write a new segment, write both editions. When you change the structure of one
(add a slide, a node, an option), make the same change in the other.

## 1. The learner

An average software engineer who can build a CRUD app in a framework (Symfony, Vue) but has
never been told what breaks an application in the long run, and does not know the accepted
"right way" of doing things. They are busy, easily overwhelmed by walls of text, and will
come back mid-project to look something up.

Write so that **a 10-year-old could follow the idea**, and so that **an engineer could
implement it tomorrow**. Both at once. Most tutorials stop at the high-level idea; ours must
show exactly how to do it properly.

## 2. Voice and language — Bangla edition

- Bangla, চলিত ভাষা, friendly, addressing the learner as **তুমি**. Short sentences.
- Precise technical terms stay in English/Latin script: cache, queue, request, response,
  index, lock, transaction, retry, timeout, token, idempotency key, deploy.
  Words that are everyday Bangla are written in Bangla: সার্ভার, ডেটাবেস, কোড, অ্যাপ, ইমেইল,
  পাসওয়ার্ড, টেবিল, ফাইল, ব্যবহারকারী.
- The first time a term appears in a segment, say what it means in a few plain words.
- Bangla digits in prose (১০ জন, ৫ মিনিট); ASCII digits inside code, commands and units
  glued to English (`200ms`, `p99`).
- Every abstract idea gets a **real-life metaphor from everyday Bangladeshi life**: চায়ের
  দোকান, বিরিয়ানির হোটেল, মুদি দোকানের বাকির খাতা, ট্রেনের টিকিট কাউন্টার, বিকাশ/মোবাইল ব্যাংকিং,
  ডাকপিয়ন, স্কুলের হাজিরা খাতা, লাইব্রেরি, বাসের কন্ডাক্টর, ফার্মেসি, কুরিয়ার, বিয়েবাড়ির রান্না,
  ট্রাফিক সিগন্যাল. The metaphor must map onto the mechanism point by point — not decoration.
  Reuse the same metaphor through a whole segment so the learner builds one mental picture.
- No filler, no hype, no "চলো শুরু করা যাক". No emoji in prose. Every sentence must teach.
- Be technically correct. State the industry-standard opinion plainly; when something is a
  genuine trade-off, say what decides it.

## 2a. Voice and language — English edition

- Plain, international English, as a good senior engineer would explain it to a colleague:
  friendly, direct, addressing the learner as **you**. Short sentences, active voice,
  contractions are fine ("don't", "it's"). Write it as if English were the original — never
  translationese ("This is called as…", "Let us see…", "In this case what happens is…").
- Technical terms stay as engineers say them (cache, queue, idempotency key, deploy). The
  first time a term appears in a segment, say what it means in a few plain words.
- ASCII digits everywhere (`10 people`, `5 minutes`). Money in the story world stays in taka
  (`500 taka`, `Tk 500`).
- Metaphors: keep the everyday Bangladeshi scene when it travels well — a tea stall, a biryani
  restaurant, the corner shop's credit ledger, a train ticket counter, a mobile wallet like
  bKash, a courier, the wedding kitchen, a bus conductor. Add the two or three words a reader
  from elsewhere needs to picture it ("the corner shop's credit ledger, where the shopkeeper
  writes down who owes what"). The metaphor must still map onto the mechanism point by point.
- People keep their names (Rahim, Karim, Nadia, …); the story world is the same in both editions.
- Every other rule of section 2 applies: no filler, no hype, no emoji, every sentence teaches.
- Interface words, when a lesson mentions them: the four rooms are **Learn**, **Flashcards**,
  **Quiz** and **Bookmarks**; the recall question under a slide is **Ask yourself**; the button
  on a flashcard is **Learn more**; slide kinds are labelled Problem, Concept, Hands-on,
  Pitfall, Compare and Recap.

## 3. Unit of work: one file per sub-segment

`content/outline.yaml` lists every topic and its sub-segments (with an English `scope` note
describing what to cover, and every title and summary in both editions:
`title: {en: '…', bn: '…'}`). Each sub-segment is one file per edition:

    content/en/<topic-slug>/<segment-slug>.yaml
    content/bn/<topic-slug>/<segment-slug>.yaml

with three top-level keys: `slides`, `flashcards`, `quiz`. Cover the segment's `scope`
completely — nothing left unexplained — but in small steps.

| Per segment file | Target | Hard limits |
|---|---|---|
| slides | 3–5 | 2–6 |
| flashcards | 6–9 | 5–12 |
| quiz questions | 5–7 | 4–10 |

## 4. How a segment is built (the learning design)

These rules are the point of the platform. Apply every one of them.

**One idea per slide (chunking).** If a slide needs "and also…", split it. A slide's
narrative is **4–5 sentences at most** across its text and metaphor blocks.

**A fixed rhythm (so the learner always knows where they are).** Order the slides of a
segment like this, choosing `kind` accordingly:

1. `story` — the problem first: a small, concrete scene where things go wrong without this
   knowledge. The learner must feel *why* before *what*.
2. `concept` — the idea, through the metaphor plus a visual that shows the mechanism.
3. `howto` — the practical implementation: real Symfony (and Vue where the client matters)
   code that could be pasted into a project. Bigger topics get 2 howto slides.
4. `pitfall` — the classic mistake, shown as bad code or a bad sequence, and the fix.
5. `compare` — only when there is a real choice to make: options side by side and what decides.
6. `recap` — optional final slide for big segments: the decision rule / checklist in one view.

Small segments can skip 4–6; never skip 1–3's substance.

**Picture + words together (dual coding).** Every slide has at least one `visual` or `code`
block; most have a visual. The visual must show the *same* thing the text says, with the same
names and numbers. Put the visual right after the sentence that introduces it.

**Concrete before abstract.** Example and metaphor first, the definition after.

**Worked examples.** For implementation, show `variant: bad` (what a CRUD developer would
naturally write) and then `variant: good`. Use `marks` to explain the 1–3 lines that matter.

**Make truths stand out (isolation effect).** A non-negotiable rule goes in a `quote` block,
one per slide at most, phrased so it can be memorised word for word.

**Break narrative into recallable points.** Whenever a narrative is really a list (reasons,
steps, rules, criteria), use a `points` block of 2–5 solid points instead of a paragraph.
This applies most to non-technical topics.

**Retrieval practice.** Each slide ends with a `check` question that makes the learner
recall or apply the slide's one idea (not a yes/no question).

**Memory hooks.** Use an aside `remember` section for a one-line rule of thumb, rhyme or
mnemonic when you have a good one.

**The right-hand side (`aside`)** holds what supports the idea without being the idea:
`story` (a short real-world incident), `problem` (what problem this solves), `commands`
(cheat-sheet commands), `tips`, `pitfalls`, `terms` (mini glossary), `when` (use it when /
avoid it when), `refs` (links). 1–3 sections per slide; do not repeat the slide text.

**Reference links, sparingly.** When a slide leans on another topic, link it — at most 1–2
links per slide (hard limit 4). Not every slide needs one. See section 8.

## 5. Code rules

- Backend: **PHP 8.3+, Symfony 7/8** style — attributes (`#[Route]`, `#[AsMessageHandler]`,
  `#[MapRequestPayload]`, `#[IsGranted]`), constructor promotion, `readonly`, autowiring;
  **Doctrine ORM 3**. Prefer real Symfony components over hand-rolled code: Messenger, Lock,
  RateLimiter, Cache (contracts), Workflow, Scheduler, HttpClient, Notifier, Uid, Clock,
  Validator, Security voters, Serializer, ExpressionLanguage, Doctrine Migrations.
- Frontend (only where the client side matters): **Vue 3, `<script setup lang="ts">`,
  Composition API, Pinia**. `lang: vue` for single-file components, `lang: ts` for plain TS.
- Also fine where they are the real artefact: `sql`, `yaml` (Symfony config), `bash`,
  `json`, `http`, `nginx`, `dockerfile`, `env`, `diff`, `text`, `graphql`, `protobuf`.
- Code must be correct and realistic — real class and method names, no pseudo-code, no
  `// ...do stuff`. Show only the part that matters: **max 36 lines, max 96 columns**,
  spaces not tabs. Omit `<?php`, `namespace` and `use` lines unless they are the point.
- Short comments inside code are welcome where they aim the eye — in the language of the
  edition. Apart from its comments, the code is the same in both editions.
- `file` is the path label (`src/Service/PaymentService.php`, `config/packages/cache.yaml`).

## 6. Flashcards

A flashcard is shown for 15 seconds to someone with **no context** — it must stand alone.

- `q`: one short question (max 140 characters). `a`: the answer in one or two short
  sentences (max 230). No "as we saw above".
- `more`: 2–4 sentences of extra explanation shown when the learner asks to learn more.
- `ref`: the slide that teaches it.
- Cover every important fact of the segment: definitions, rules, numbers, "X vs Y",
  "when would you use…", "what goes wrong if…". One fact per card.

## 7. Quiz questions

- Test understanding and application, not wording: prefer small scenarios ("রহিমের অ্যাপে…
  কী করা উচিত?") and "what is wrong with this code" (optional `code` + `lang`).
- 3–5 options. Wrong options must be the mistakes a real beginner would make — plausible,
  never silly. Vary the position of the correct option.
- Roughly **one question in four has more than one correct option** (the site shows
  checkboxes then). Do not write "(একাধিক)" in the question; the site labels it.
- Every option has a `why`: for a wrong option, why it is wrong; for a correct one, why it
  is right. `hint` nudges thinking without giving the answer away. `ref` is the slide to study.
- Spread the questions across all slides of the segment.

## 8. Links between slides

Three forms, usable in `ref`, in aside `refs[].to`, and inline as `[[target|visible label]]`
(inline links are allowed in slide text, aside text and flashcard `more` only):

| Form | Meaning |
|---|---|
| `slide-slug` | a slide in **this same file** |
| `topic/segment` | first slide of any segment in `outline.yaml` — **use this for other segments** |
| `topic/segment/slide` | a specific slide; only when you wrote that file yourself |

Other segments are written by other authors at the same time, so their slide slugs are
unknown to you: always link to them as `topic/segment`. A link to a segment whose file does
not exist yet only produces a warning — that is expected and fine.

## 9. Inline formatting

Inside any prose string: `**bold**` for the one phrase that must be seen, `` `code` `` for
identifiers, and `[[target|label]]` links. Nothing else — no headings, lists or HTML.
A blank line starts a new paragraph.

## 10. YAML rules (these prevent almost every syntax error)

- One-line strings: **always single-quoted** — `title: 'Cache-aside কী?'`.
  Inside single quotes nothing is special except `'` itself, which is written `''`
  (`'Conway''s Law'`). Backslashes need no escaping.
- Multi-line prose and **all code**: a literal block — `body: |` then the text indented
  two spaces deeper. Nothing needs escaping inside a block.
- Never use double-quoted strings (backslashes in PHP namespaces break them) and never
  leave prose unquoted (a `: ` or ` #` inside it breaks the file).
- `true` / `false` and numbers are unquoted. Indent with 2 spaces, never tabs.
- Compact `{key: 'value', other: 1}` mappings are fine for nodes, edges, bars and steps.

## 11. Schema reference

Lengths are counted in visible characters (a Bangla letter with its vowel sign counts once;
markup does not count). Limits are enforced by the validator. The numbers below are for the
Bangla edition; **English limits are 1.6× larger** (the same idea takes more Latin letters,
and they are narrower on screen) — the validator applies this for you.

### Slide

```yaml
- slug: cache-aside-flow        # unique in this file; lowercase english, hyphens
  title: '…'                    # max 70
  kind: concept                 # story | concept | howto | pitfall | compare | recap
  tldr: '…'                     # the whole slide in one line, 12–170; shown in search results
  keywords: ['cache aside', 'lazy loading', 'ক্যাশ']   # 2–10 search terms, English AND Bangla
  blocks: [ … ]                 # 2–5 blocks, at least one visual or code
  aside: [ … ]                  # 1–4 sections
  check: {q: '…', a: '…'}       # q max 170, a max 260
```

Per slide at most: 2 `text`, 1 `metaphor`, 2 `points`, 1 `quote`, 2 `code`, 2 `visual`;
text + metaphor bodies together max 780 characters.

### Blocks

```yaml
- type: text
  body: |                       # 20–560
    …
- type: metaphor
  title: 'মুদি দোকানের বাকির খাতা'   # max 48
  icon: shop                    # optional, from the icon list
  body: |                       # 20–460
    …
- type: points
  title: 'মনে রাখো'              # optional, max 48
  style: check                  # dot (default) | check | cross | number
  items: ['…', '…']             # 2–5 items, each max 150
- type: quote
  body: '…'                     # 8–190 — a rule worth memorising
  by: 'Conway''s Law'           # optional, max 40
- type: code
  lang: php                     # php vue ts js yaml sql bash json http nginx dockerfile twig
                                # text diff ini xml html graphql protobuf env
  file: 'src/Service/OrderService.php'   # optional label, max 70
  variant: good                 # good | bad | neutral (default)
  code: |                       # max 36 lines × 96 columns
    …
  marks:                        # optional, max 5 — highlighted lines with a hover explanation
    - {line: 4, tip: '…'}       # tip 8–200
- type: visual                  # see below
```

### Visuals

Every visual needs a `caption` (6–120) and a `tip` on every element — the tip is the short
explanation shown when the learner hovers that element (8–220 characters; say what the
element *is or does*, do not repeat its label).

`tone` (optional everywhere): `default`, `good` (green), `bad` (red), `warn` (amber),
`muted` (faded), `accent` (solid — the star of the diagram; use once).

**flow** — boxes on a grid with arrows. The site plays the arrows **one at a time, in the
order you list them**, showing each edge's `label` as a caption under the diagram. So the
edges are the story: write each label as a full short sentence of what happens in that step.

```yaml
- type: visual
  kind: flow
  caption: '…'
  animate: true                 # default. false = static diagram (state machines, structure):
                                #   all arrows drawn at once with their labels ON the arrows,
                                #   so labels must then be max 20 characters
  nodes:                        # 2–9
    - {id: api, label: 'API', sub: 'Symfony', icon: api, tone: accent, col: 1, row: 0, tip: '…'}
  edges:                        # 1–10, in story order
    - {from: api, to: db, label: 'অর্ডারটা ডেটাবেসে লেখে', tip: '…', tone: good, dashed: false}
```

- `id`: lowercase, starts with a letter (`api`, `db_main`). `label` max 22, `sub` max 26.
- Grid: `col` 0–4, `row` 0–3, in steps of 0.5. Left-to-right is the natural reading order.
  Two nodes must be at least 1 col or 1 row apart, and **an arrow must not pass through a
  third node** — the validator checks both; move a node off the line if it complains.
- The same pair may appear in several edges (request, then response). `dashed: true` for
  responses/async. Edge `tip` is optional.
- Keep it small: 3–6 nodes reads best.

**sequence** — who talks to whom over time (race conditions, protocols, handshakes).

```yaml
- type: visual
  kind: sequence
  caption: '…'
  actors:                       # 2–4 columns, left to right
    - {id: rahim, label: 'রহিম', icon: user, tip: '…'}          # label max 18
  messages:                     # 2–9 rows, top to bottom, played one at a time
    - {from: rahim, to: db, label: 'ব্যালেন্স পড়ো', tip: '…'}     # label max 46; tip optional
    - {from: db, to: rahim, label: '১০০ টাকা', dashed: true}
    - {at: db, note: 'ব্যালেন্স এখন −৫০', tone: bad}             # a note on one actor's line
```

**layers** — a stack drawn in 3D, top to bottom (architecture layers, a request passing
down, "easy to change" → "hard to change").

```yaml
  kind: layers
  layers:                       # 2–6
    - {label: 'Controller', sub: 'HTTP বোঝে', tone: default, tip: '…'}   # label 26, sub 48
```

**compare** — 2–3 columns side by side (bad vs good, option A vs B).

```yaml
  kind: compare
  columns:
    - title: 'Offset pagination'   # max 30
      tone: bad
      icon: cross                  # optional
      tip: '…'
      items: ['…', '…']            # 1–5, each max 96
```

**steps** — an ordered process, highlighted one step at a time.

```yaml
  kind: steps
  steps:                        # 3–6
    - {title: '১. Expand', body: 'নতুন কলাম যোগ করো', tip: '…'}   # title 30, body 120
```

**table** — a cheat-sheet grid. First header may be `''`.

```yaml
  kind: table
  headers: ['', 'REST', 'gRPC']          # 2–5, each max 22
  rows:                                  # 2–7
    - cells: ['গতি', 'মাঝারি', 'দ্রুত']    # one per header, each max 52
      tip: '…'
```

**bars** — compare a few numbers (latency percentiles, cost, sizes).

```yaml
  kind: bars
  items:                        # 2–6
    - {label: 'p50', value: 40, display: '40ms', tone: good, tip: '…'}   # value sets bar length
```

Which one? Something *moves between parts* → flow. *Order of messages over time* matters →
sequence. *Stacked levels* → layers. *A or B* → compare. *Do this, then this* → steps.
*Many properties × few options* → table. *Magnitudes* → bars.

### Aside sections

```yaml
- {type: story, title: '…', body: '…'}        # title max 48, body 20–440
- {type: problem, body: '…'}                  # what problem this solves; max 320
- {type: remember, body: '…'}                 # one-line memory hook; max 220
- type: tips                                  # also: pitfalls
  items: ['…']                                # 1–4, each max 150
- type: commands
  title: 'Messenger কমান্ড'                    # optional, max 40
  items:                                      # 1–6
    - {cmd: 'php bin/console messenger:consume async', desc: 'worker চালু করো'}
- type: terms
  items:                                      # 1–5
    - {term: 'TTL', meaning: 'কতক্ষণ পরে জিনিসটা বাসি ধরা হবে'}
- type: when
  use: ['…']                                  # 1–3, each max 120
  avoid: ['…']                                # 1–3
- type: refs
  items:                                      # 1–3
    - {to: 'caching/cache-stampede', label: 'Cache stampede ঠেকানো'}
```

### Flashcards and quiz

```yaml
flashcards:
  - q: '…'                      # 8–140
    a: '…'                      # max 230
    more: |                     # 60–620
      …
    ref: cache-aside-flow

quiz:
  - q: '…'                      # 10–300
    lang: php                   # only with code
    code: |                     # optional, max 24 lines
      …
    hint: '…'                   # 8–220
    options:                    # 3–5; at least one correct and one wrong
      - {text: '…', correct: true, why: '…'}     # text max 170, why 8–280
      - {text: '…', correct: false, why: '…'}
    ref: cache-aside-flow
```

### Icons

`user users browser mobile server api gateway lb db cache queue worker cdn dns cloud storage
file search lock key shield clock bell mail money bank card cart shop box truck code gear
flag bug fire chart eye book robot check cross warning home building ticket link globe bolt
layers puzzle calendar phone map tools trash pencil chat star hourglass compass cpu wallet
receipt rocket lightbulb heart plug switch filter list graph stopwatch tag archive terminal
shuffle repeat school megaphone target wifi wifi-off send inbox image id history`

## 12. Validate before you finish

From the `backend/` directory:

    php bin/validate-content.php <topic>/<segment> [<topic>/<segment> …]

It checks both editions of each segment and that their structures match. It must end with
`OK — no errors`. Warnings about links to segments that have "no content
yet" are fine. Fix every error; do not delete content to silence the validator — rephrase
or split instead. Do not edit any file outside your assigned `content/<edition>/<topic>/` files.

## 13. Final checklist per file

- Does each edition read as if it had been written in that language first?
- Does the first slide make the learner feel the problem?
- Could a 10-year-old retell each slide's idea after reading it once?
- Does at least one slide show real, correct, paste-able Symfony (or Vue) code for doing it properly?
- Does every visual match its text exactly, and does every element have a useful tip?
- Are the non-negotiable rules in `quote` blocks?
- Is the segment's whole `scope` from the outline covered by slides, flashcards and quiz?
- Do the flashcards make sense with zero context?
- Does every quiz option have an honest `why`?
