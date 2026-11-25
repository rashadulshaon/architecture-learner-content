#!/usr/bin/env node
/**
 * Checks the content files and turns them into the JSON files the app loads.
 *
 *   node scripts/build.mjs check                      # validate everything
 *   node scripts/build.mjs check caching              # one topic
 *   node scripts/build.mjs check caching/cache-stampede api/pagination
 *   node scripts/build.mjs build [--out dist]         # validate, then write the JSON
 *
 * The build refuses to write anything while there are errors, so a broken
 * lesson never reaches learners.
 *
 * Output (what the app fetches):
 *   outline.json                         topics → segments → slide headlines
 *   topics/<topic>/slides.json           every slide of one topic
 *   topics/<topic>/flashcards.json
 *   topics/<topic>/quiz.json
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadContent } from './content-loader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const [command = 'check', ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((arg) => arg.startsWith('-')))
const scopes = rest.filter((arg, i) => !arg.startsWith('-') && rest[i - 1] !== '--out')
const outIndex = rest.indexOf('--out')
const outDir = resolve(ROOT, outIndex >= 0 ? rest[outIndex + 1] : 'dist')

if (command === 'check') {
  process.exit(check(scopes, flags.has('--quiet')))
} else if (command === 'build') {
  if (check([], true) !== 0) {
    process.exit(1)
  }
  build(outDir)
} else {
  console.error(`Unknown command '${command}'. Use: check [topic[/segment] …] | build [--out dir]`)
  process.exit(2)
}

// ------------------------------------------------------------------- check
function check(scopes, quiet) {
  const result = loadContent(ROOT)
  const inScope = (path) => scopes.length === 0 || scopes.some((scope) => path === scope || path.startsWith(`${scope}/`))

  // Problems in the outline itself always matter.
  const errors = result.errors.filter((item) => item.scope === 'outline' || inScope(item.scope))
  const warnings = result.warnings.filter((item) => inScope(item.scope))

  let known = false
  const rows = []
  const missing = []
  for (const topic of result.topics) {
    for (const segment of topic.segments) {
      const path = `${topic.slug}/${segment.slug}`
      if (!inScope(path)) continue
      known = true
      if (!segment.loaded) {
        missing.push(path)
        continue
      }
      rows.push(`  ${path.padEnd(46)} ${segment.slides.length} slides · ${segment.flashcards.length} flashcards · ${segment.quiz.length} quiz`)
    }
  }

  if (!known && scopes.length > 0) {
    console.error(`No segment in outline.yaml matches: ${scopes.join(', ')}`)
    return 2
  }

  if (!quiet) {
    console.log(`Content files read\n${rows.length === 0 ? '  (none)' : rows.join('\n')}`)
  }
  if (missing.length > 0) {
    console.log(`\nNot written yet (${missing.length})`)
    for (const path of missing) console.log(`  ${path}`)
  }
  if (warnings.length > 0 && !quiet) {
    console.log(`\nWarnings (${warnings.length})`)
    for (const warning of warnings) console.log(`  [${warning.scope}] ${warning.message}`)
  }
  if (errors.length > 0) {
    console.log(`\nERRORS (${errors.length})`)
    for (const error of errors) console.log(`  [${error.scope}] ${error.message}`)
    console.log('\nFAILED — fix the errors above.')
    return 1
  }

  const { segments, slides, flashcards, quiz } = result.stats
  console.log(`\nOK — no errors${missing.length > 0 ? ' in the files that exist' : ''}. ${segments} segments · ${slides} slides · ${flashcards} flashcards · ${quiz} quiz questions.`)
  return 0
}

// ------------------------------------------------------------------- build
function build(out) {
  const { topics } = loadContent(ROOT)
  rmSync(out, { recursive: true, force: true })

  const outline = []
  for (const topic of topics) {
    const segments = topic.segments.filter((segment) => segment.loaded && segment.slides.length > 0)
    if (segments.length === 0) {
      continue // a topic without content is not shown at all
    }

    const slides = []
    const cards = []
    const questions = []
    const ids = new Set()
    const uniqueId = (id) => {
      if (ids.has(id)) throw new Error(`Two items share the id '${id}' — change one question's wording slightly.`)
      ids.add(id)
      return id
    }

    for (const segment of segments) {
      const path = `${topic.slug}/${segment.slug}`
      for (const slide of segment.slides) {
        slides.push({
          id: `${path}/${slide.slug}`,
          path: `${path}/${slide.slug}`,
          segment: segment.slug,
          slug: slide.slug,
          title: slide.title,
          kind: slide.kind,
          tldr: slide.tldr,
          blocks: slide.blocks,
          aside: slide.aside,
          check: slide.check,
        })
      }
      // Flashcard and quiz ids come from the question text, so adding, removing or
      // reordering items keeps every other learner's saved marks on the right card.
      for (const card of segment.flashcards) {
        cards.push({
          id: uniqueId(`${path}/card-${hash(card.q)}`),
          topic: topic.slug,
          segment: segment.slug,
          q: card.q,
          a: card.a,
          more: card.more,
          ref: card.ref,
        })
      }
      for (const question of segment.quiz) {
        questions.push({
          id: uniqueId(`${path}/quiz-${hash(question.q)}`),
          segment: segment.slug,
          q: question.q,
          code: question.code,
          lang: question.lang,
          hint: question.hint,
          options: question.options,
          ref: question.ref,
        })
      }
    }

    write(out, `topics/${topic.slug}/slides.json`, { slides })
    write(out, `topics/${topic.slug}/flashcards.json`, { flashcards: cards })
    write(out, `topics/${topic.slug}/quiz.json`, { questions })

    outline.push({
      slug: topic.slug,
      code: topic.code,
      title: topic.title,
      summary: topic.summary,
      icon: topic.icon,
      segments: segments.map((segment) => ({
        slug: segment.slug,
        title: segment.title,
        flashcards: segment.flashcards.length,
        quiz: segment.quiz.length,
        slides: segment.slides.map((slide) => ({
          id: `${topic.slug}/${segment.slug}/${slide.slug}`,
          slug: slide.slug,
          title: slide.title,
          kind: slide.kind,
          tldr: slide.tldr,
          keywords: slide.keywords,
        })),
      })),
    })
  }

  write(out, 'outline.json', {
    version: process.env.GITHUB_SHA ?? 'local',
    builtAt: new Date().toISOString(),
    topics: outline,
  })
  writeFileSync(
    join(out, 'README.md'),
    '# Generated files\n\nBuilt by `npm run build` from the YAML on the `main` branch. Do not edit by hand.\n',
  )
  console.log(`Wrote ${outline.length} topics to ${out}`)
}

function write(out, file, data) {
  const target = join(out, file)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(data))
}

/** FNV-1a: a short, stable fingerprint of a string. */
function hash(value) {
  let h = 0x811c9dc5
  for (const byte of new TextEncoder().encode(value)) {
    h ^= byte
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
