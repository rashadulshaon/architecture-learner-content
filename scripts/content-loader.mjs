/**
 * Reads outline.yaml and every <topic>/<segment>.yaml file, validates them
 * against the authoring contract (see AUTHORING.md) and returns a normalized
 * tree that scripts/build.mjs turns into the JSON files the app loads.
 *
 * All content is written in English; the Bangla view is a machine translation
 * made in the browser, so there is nothing to load for it here.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export const SLIDE_KINDS = ['story', 'concept', 'howto', 'pitfall', 'compare', 'recap']
export const TONES = ['default', 'good', 'bad', 'warn', 'muted', 'accent']
export const BLOCK_TYPES = ['text', 'metaphor', 'points', 'quote', 'code', 'visual']
export const VISUAL_KINDS = ['flow', 'sequence', 'layers', 'compare', 'steps', 'table', 'bars']
export const ASIDE_TYPES = ['story', 'problem', 'remember', 'commands', 'tips', 'pitfalls', 'terms', 'when', 'refs']
export const POINT_STYLES = ['dot', 'check', 'cross', 'number']
export const LANGS = [
  'php', 'vue', 'ts', 'js', 'yaml', 'sql', 'bash', 'json', 'http', 'nginx', 'dockerfile',
  'twig', 'text', 'diff', 'ini', 'xml', 'html', 'graphql', 'protobuf', 'env',
]
export const ICONS = [
  'user', 'users', 'browser', 'mobile', 'server', 'api', 'gateway', 'lb', 'db', 'cache', 'queue',
  'worker', 'cdn', 'dns', 'cloud', 'storage', 'file', 'search', 'lock', 'key', 'shield', 'clock',
  'bell', 'mail', 'money', 'bank', 'card', 'cart', 'shop', 'box', 'truck', 'code', 'gear', 'flag',
  'bug', 'fire', 'chart', 'eye', 'book', 'robot', 'check', 'cross', 'warning', 'home', 'building',
  'ticket', 'link', 'globe', 'bolt', 'layers', 'puzzle', 'calendar', 'phone', 'map', 'tools',
  'trash', 'pencil', 'chat', 'star', 'hourglass', 'compass', 'cpu', 'wallet', 'receipt', 'rocket',
  'lightbulb', 'heart', 'plug', 'switch', 'filter', 'list', 'graph', 'stopwatch', 'tag', 'archive',
  'terminal', 'shuffle', 'repeat', 'school', 'megaphone', 'target', 'wifi', 'wifi-off', 'send',
  'inbox', 'image', 'id', 'history',
]

/** Logical geometry of the flow diagram; the app's renderer uses the same numbers. */
const CELL_W = 176
const CELL_H = 104
const NODE_W = 148
const NODE_H = 64

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NODE_ID = /^[a-z][a-z0-9_]*$/
const LINK = /\[\[([^\]|]+)\|([^\]|]+)\]\]/gu

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' })

/** Visible length: markup characters (**, `, link targets) do not count. */
export function len(value) {
  const plain = value.replace(LINK, '$2').replaceAll('**', '').replaceAll('`', '')
  let count = 0
  for (const _ of graphemes.segment(plain)) count++
  return count
}

/** Length in code points, like PHP's mb_strlen. */
const chars = (value) => [...value].length
/** PHP's trim(): only ASCII whitespace and NUL. */
const trim = (value) => value.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '')
const rtrim = (value) => value.replace(/[ \t\n\r\0\x0B]+$/, '')
const isMap = (value) => value !== null && typeof value === 'object'
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const get = (data, key) => (isMap(data) && Object.hasOwn(data, key) ? data[key] : undefined) ?? null

export function loadContent(dir) {
  const result = { topics: [], errors: [], warnings: [], missing: [], stats: { segments: 0, slides: 0, flashcards: 0, quiz: 0 } }
  let scope = 'outline'
  let trail = []
  const outlineSegments = new Set()
  const slideIndex = new Map()
  let linkCount = 0

  // ---------------------------------------------------------------- helpers
  const where = () => (trail.length === 0 ? '' : `${trail.join(' › ')}: `)
  const err = (message) => result.errors.push({ scope, message: where() + message })
  const warn = (message) => result.warnings.push({ scope, message: where() + message })

  function parseFile(file, label) {
    try {
      return parse(readFileSync(file, 'utf8'), { uniqueKeys: true }) ?? null
    } catch (error) {
      err(`YAML syntax error in ${label} — ${error.message}`)
      return null
    }
  }

  function keys(data, allowed) {
    for (const key of Object.keys(data)) {
      if (!allowed.includes(key)) err(`unknown key '${key}' (allowed: ${allowed.join(', ')})`)
    }
  }

  function slug(data, key) {
    const value = get(data, key)
    if (typeof value !== 'string' || !SLUG.test(value) || value.length > 48) {
      err(`'${key}' must be a lowercase-english-slug (a–z, 0–9, hyphens, max 48)`)
      return null
    }
    return value
  }

  function text(data, key, max, required = true, min = 1) {
    let value = get(data, key)
    if (isNumber(value)) value = String(value)
    if (value === null || value === '') {
      if (required) err(`'${key}' is required`)
      return null
    }
    if (typeof value !== 'string') {
      err(`'${key}' must be text (quote it: '${key}': '…')`)
      return null
    }
    value = trim(value)
    const length = len(value)
    if (length > max) {
      err(`'${key}' is too long (${length} > ${max} characters): "${[...value].slice(0, 48).join('')}…"`)
    } else if (length < min) {
      err(`'${key}' is too short (${length} < ${min} characters)`)
    }
    if (value.includes('\t')) err(`'${key}' contains a tab character — use spaces`)
    return value
  }

  /** A code or command string: kept verbatim apart from trailing whitespace. */
  function code(data, key, maxLines, maxWidth = 96) {
    let value = get(data, key)
    if (typeof value !== 'string' || trim(value) === '') {
      err(`'${key}' is required and must be text (use a | block)`)
      return null
    }
    value = rtrim(value.replaceAll('\r\n', '\n'))
    if (value.includes('\t')) err(`'${key}' contains tab characters — indent with spaces`)
    const lines = value.split('\n')
    if (lines.length > maxLines) {
      err(`'${key}' is too long (${lines.length} > ${maxLines} lines) — show only the part that matters`)
    }
    for (let i = 0; i < lines.length; i++) {
      if (chars(lines[i]) > maxWidth) {
        err(`'${key}' line ${i + 1} is too wide (${chars(lines[i])} > ${maxWidth} characters) — wrap it`)
        break
      }
    }
    return value
  }

  function oneOf(data, key, allowed, fallback = null) {
    const value = get(data, key)
    if (value === null || value === '') {
      if (fallback === null) err(`'${key}' is required (one of: ${allowed.join(', ')})`)
      return fallback
    }
    if (typeof value !== 'string' || !allowed.includes(value)) {
      const shown = isMap(value) ? (Array.isArray(value) ? 'array' : 'object') : String(value)
      err(`'${key}' has an unknown value '${shown}' (allowed: ${allowed.join(', ')})`)
      return fallback
    }
    return value
  }

  function items(data, key, min, max) {
    const value = get(data, key)
    if (value === null) {
      if (min > 0) err(`'${key}' is required (a list of ${min} to ${max} items)`)
      return []
    }
    if (!Array.isArray(value)) {
      err(`'${key}' must be a list`)
      return []
    }
    if (value.length < min || value.length > max) {
      err(`'${key}' must have ${min} to ${max} items, found ${value.length}`)
    }
    return value
  }

  function strings(data, key, min, max, maxLength, allowEmpty = false) {
    const out = []
    items(data, key, min, max).forEach((raw, i) => {
      let value = isNumber(raw) ? String(raw) : raw
      if (typeof value !== 'string') {
        err(`'${key}' item ${i + 1} must be text`)
        return
      }
      value = trim(value)
      if (value === '' && !allowEmpty) {
        err(`'${key}' item ${i + 1} is empty`)
        return
      }
      const length = len(value)
      if (length > maxLength) {
        err(`'${key}' item ${i + 1} is too long (${length} > ${maxLength} characters): "${[...value].slice(0, 48).join('')}…"`)
      }
      out.push(value)
    })
    return out
  }

  function gridNumber(data, key, max) {
    const value = get(data, key)
    if (!isNumber(value)) {
      err(`'${key}' is required and must be a number (0–${max}, halves allowed)`)
      return null
    }
    if (value < 0 || value > max || (value * 2) % 1 !== 0) {
      err(`'${key}' must be between 0 and ${max} in steps of 0.5`)
      return null
    }
    return value
  }

  /** Runs fn with one more step on the trail. */
  function within(step, fn) {
    trail.push(step)
    try {
      return fn()
    } finally {
      trail.pop()
    }
  }

  // ---------------------------------------------------------------- outline
  function readOutline(rawTopics) {
    const topics = []
    const seenTopics = new Set()
    rawTopics.forEach((raw, i) => {
      trail = [`topics[${i}]`]
      if (!isMap(raw)) {
        err('topic must be a mapping')
        return
      }
      keys(raw, ['slug', 'code', 'title', 'summary', 'icon', 'segments'])
      const topicSlug = slug(raw, 'slug')
      if (topicSlug === null) return
      if (seenTopics.has(topicSlug)) {
        err(`duplicate topic slug '${topicSlug}'`)
        return
      }
      seenTopics.add(topicSlug)
      const topic = {
        slug: topicSlug,
        code: text(raw, 'code', 5) ?? '',
        title: text(raw, 'title', 77) ?? topicSlug,
        summary: text(raw, 'summary', 272) ?? '',
        icon: oneOf(raw, 'icon', ICONS, 'layers'),
        segments: [],
      }
      const seenSegments = new Set()
      items(raw, 'segments', 1, 30).forEach((rawSegment, j) => {
        trail = [`topics[${i}]`, `segments[${j}]`]
        if (!isMap(rawSegment)) {
          err('segment must be a mapping')
          return
        }
        keys(rawSegment, ['slug', 'title', 'scope'])
        const segmentSlug = slug(rawSegment, 'slug')
        if (segmentSlug === null) return
        if (seenSegments.has(segmentSlug)) {
          err(`duplicate segment slug '${segmentSlug}'`)
          return
        }
        seenSegments.add(segmentSlug)
        outlineSegments.add(`${topicSlug}/${segmentSlug}`)
        topic.segments.push({
          slug: segmentSlug,
          title: text(rawSegment, 'title', 96) ?? segmentSlug,
          loaded: false,
          slides: [],
          flashcards: [],
          quiz: [],
        })
      })
      topics.push(topic)
    })
    trail = []
    return topics
  }

  // ---------------------------------------------------------------- segment
  function readSegment(data, segment) {
    keys(data, ['slides', 'flashcards', 'quiz'])

    let seen = new Set()
    trail = []
    items(data, 'slides', 2, 6).forEach((raw, i) => {
      const label = isMap(raw) && typeof raw.slug === 'string' ? raw.slug : String(i)
      trail = [`slide '${label}'`]
      if (!isMap(raw)) {
        err('slide must be a mapping')
        return
      }
      const slide = readSlide(raw)
      if (slide === null) return
      if (seen.has(slide.slug)) {
        err(`duplicate slide slug '${slide.slug}' in this segment`)
        return
      }
      seen.add(slide.slug)
      segment.slides.push(slide)
    })

    trail = []
    seen = new Set()
    items(data, 'flashcards', 5, 12).forEach((raw, i) => {
      trail = [`flashcard #${i + 1}`]
      if (!isMap(raw)) {
        err('flashcard must be a mapping')
        return
      }
      keys(raw, ['q', 'a', 'more', 'ref'])
      const card = {
        q: text(raw, 'q', 224, true, 8),
        a: text(raw, 'a', 368, true, 2),
        more: text(raw, 'more', 992, true, 60),
        ref: text(raw, 'ref', 192),
      }
      if (card.q === null || card.a === null || card.more === null) return
      if (seen.has(card.q)) {
        err('duplicate flashcard question in this segment')
        return
      }
      seen.add(card.q)
      segment.flashcards.push(card)
    })

    trail = []
    seen = new Set()
    items(data, 'quiz', 4, 10).forEach((raw, i) => {
      trail = [`quiz #${i + 1}`]
      if (!isMap(raw)) {
        err('quiz question must be a mapping')
        return
      }
      const question = readQuiz(raw)
      if (question === null) return
      if (seen.has(question.q)) {
        err('duplicate quiz question in this segment')
        return
      }
      seen.add(question.q)
      segment.quiz.push(question)
    })
    trail = []
  }

  function readQuiz(raw) {
    keys(raw, ['q', 'code', 'lang', 'hint', 'options', 'ref'])
    const question = {
      q: text(raw, 'q', 480, true, 10),
      code: null,
      lang: null,
      hint: text(raw, 'hint', 352, true, 8),
      options: [],
      ref: text(raw, 'ref', 192),
    }
    if (get(raw, 'code') !== null) {
      question.code = code(raw, 'code', 24)
      question.lang = oneOf(raw, 'lang', LANGS, 'php')
    }

    let correct = 0
    const texts = new Set()
    items(raw, 'options', 3, 5).forEach((rawOption, i) => {
      const option = within(`option #${i + 1}`, () => {
        if (!isMap(rawOption)) {
          err('option must be a mapping')
          return null
        }
        keys(rawOption, ['text', 'correct', 'why'])
        if (typeof get(rawOption, 'correct') !== 'boolean') err("'correct' must be true or false")
        return {
          text: text(rawOption, 'text', 272, true, 1),
          correct: get(rawOption, 'correct') === true,
          why: text(rawOption, 'why', 448, true, 8),
        }
      })
      if (option === null || option.text === null || option.why === null) return
      if (texts.has(option.text)) {
        err('two options have the same text')
        return
      }
      texts.add(option.text)
      correct += option.correct ? 1 : 0
      question.options.push(option)
    })
    if (question.q === null || question.hint === null) return null
    if (question.options.length < 3) return null
    if (correct === 0) {
      err('at least one option must be correct')
      return null
    }
    if (correct === question.options.length) {
      err('at least one option must be wrong')
      return null
    }
    return question
  }

  // ------------------------------------------------------------------ slide
  function readSlide(raw) {
    keys(raw, ['slug', 'title', 'kind', 'tldr', 'keywords', 'blocks', 'aside', 'check'])
    const slideSlug = slug(raw, 'slug')
    const slide = {
      slug: slideSlug,
      title: text(raw, 'title', 112, true, 3),
      kind: oneOf(raw, 'kind', SLIDE_KINDS),
      tldr: text(raw, 'tldr', 272, true, 12),
      keywords: [],
      blocks: [],
      aside: [],
      check: null,
    }

    for (const rawKeyword of items(raw, 'keywords', 2, 10)) {
      if (typeof rawKeyword !== 'string' && !Number.isInteger(rawKeyword)) {
        err('every keyword must be a string')
        continue
      }
      const keyword = trim(String(rawKeyword))
      if (keyword === '' || len(keyword) > 40) {
        err(`keyword '${keyword}' must be 1–40 characters`)
        continue
      }
      slide.keywords.push(keyword)
    }

    const counts = Object.fromEntries(BLOCK_TYPES.map((type) => [type, 0]))
    let narrative = 0
    let hasVisualOrCode = false
    items(raw, 'blocks', 2, 5).forEach((rawBlock, i) => {
      hasVisualOrCode ||= isMap(rawBlock) && ['visual', 'code'].includes(get(rawBlock, 'type'))
      const block = within(`blocks[${i}]`, () => {
        if (!isMap(rawBlock)) {
          err('block must be a mapping')
          return null
        }
        return readBlock(rawBlock)
      })
      if (block === null) return
      counts[block.type]++
      if (block.type === 'text' || block.type === 'metaphor') narrative += len(block.body)
      slide.blocks.push(block)
    })
    const limits = { text: 2, metaphor: 1, points: 2, quote: 1, code: 2, visual: 2 }
    for (const [type, max] of Object.entries(limits)) {
      if (counts[type] > max) err(`too many '${type}' blocks on one slide (${counts[type]} > ${max}) — split the slide`)
    }
    if (!hasVisualOrCode) err('every slide needs at least one visual or code block')
    const maxNarrative = 1248
    if (narrative > maxNarrative) {
      err(`too much narrative text on one slide (${narrative} > ${maxNarrative} characters across text + metaphor) — trim or split`)
    }

    items(raw, 'aside', 1, 4).forEach((rawSection, i) => {
      const section = within(`aside[${i}]`, () => {
        if (!isMap(rawSection)) {
          err('aside section must be a mapping')
          return null
        }
        return readAside(rawSection)
      })
      if (section !== null) slide.aside.push(section)
    })

    const check = get(raw, 'check')
    if (!isMap(check)) {
      err("'check' (a recall question with q and a) is required")
    } else {
      within('check', () => {
        keys(check, ['q', 'a'])
        const q = text(check, 'q', 272, true, 8)
        const a = text(check, 'a', 416, true, 2)
        if (q !== null && a !== null) slide.check = { q, a }
      })
    }

    if (slideSlug === null || slide.title === null || slide.kind === null || slide.tldr === null) return null
    return slide
  }

  function readBlock(raw) {
    const type = oneOf(raw, 'type', BLOCK_TYPES)
    switch (type) {
      case 'text': {
        keys(raw, ['type', 'body'])
        const body = text(raw, 'body', 896, true, 20)
        return body === null ? null : { type: 'text', body }
      }
      case 'metaphor': {
        keys(raw, ['type', 'title', 'body', 'icon'])
        const title = text(raw, 'title', 77)
        const body = text(raw, 'body', 736, true, 20)
        return title === null || body === null
          ? null
          : { type: 'metaphor', title, body, icon: oneOf(raw, 'icon', ICONS, 'lightbulb') }
      }
      case 'points': {
        keys(raw, ['type', 'title', 'style', 'items'])
        const list = strings(raw, 'items', 2, 5, 240)
        return list.length === 0
          ? null
          : {
              type: 'points',
              title: text(raw, 'title', 77, false),
              style: oneOf(raw, 'style', POINT_STYLES, 'dot'),
              items: list,
            }
      }
      case 'quote': {
        keys(raw, ['type', 'body', 'by'])
        const body = text(raw, 'body', 304, true, 8)
        return body === null ? null : { type: 'quote', body, by: text(raw, 'by', 64, false) }
      }
      case 'code': {
        keys(raw, ['type', 'lang', 'file', 'variant', 'code', 'marks'])
        const source = code(raw, 'code', 36)
        if (source === null) return null
        const lineCount = source.split('\n').length
        const marks = []
        items(raw, 'marks', 0, 5).forEach((rawMark, i) => {
          within(`marks[${i}]`, () => {
            if (!isMap(rawMark)) {
              err('mark must be a mapping with line and tip')
              return
            }
            keys(rawMark, ['line', 'tip'])
            const line = get(rawMark, 'line')
            const tip = text(rawMark, 'tip', 320, true, 8)
            if (!Number.isInteger(line) || line < 1 || line > lineCount) {
              err(`'line' must be a line number between 1 and ${lineCount}`)
            } else if (tip !== null) {
              marks.push({ line, tip })
            }
          })
        })
        return {
          type: 'code',
          lang: oneOf(raw, 'lang', LANGS),
          file: text(raw, 'file', 112, false),
          variant: oneOf(raw, 'variant', ['good', 'bad', 'neutral'], 'neutral'),
          code: source,
          marks,
        }
      }
      case 'visual':
        return readVisual(raw)
    }
    return null
  }

  // ---------------------------------------------------------------- visuals
  function readVisual(raw) {
    const kind = oneOf(raw, 'kind', VISUAL_KINDS)
    if (kind === null) return null
    return within(kind, () => {
      const caption = text(raw, 'caption', 192, true, 6)
      const readers = { flow: readFlow, sequence: readSequence, layers: readLayers, compare: readCompare, steps: readSteps, table: readTable, bars: readBars }
      const visual = readers[kind](raw)
      if (visual === null || caption === null) return null
      return { type: 'visual', kind, caption, ...visual }
    })
  }

  function readFlow(raw) {
    keys(raw, ['type', 'kind', 'caption', 'nodes', 'edges', 'animate'])
    let animate = get(raw, 'animate') ?? true
    if (typeof animate !== 'boolean') {
      err("'animate' must be true or false")
      animate = true
    }

    const nodes = new Map()
    items(raw, 'nodes', 2, 9).forEach((rawNode, i) => {
      within(`nodes[${i}]`, () => {
        if (!isMap(rawNode)) {
          err('node must be a mapping')
          return
        }
        keys(rawNode, ['id', 'label', 'sub', 'icon', 'col', 'row', 'tone', 'tip'])
        let id = get(rawNode, 'id')
        if (typeof id !== 'string' || !NODE_ID.test(id)) {
          err("'id' must look like api, db_main, user2")
          id = null
        } else if (nodes.has(id)) {
          err(`duplicate node id '${id}'`)
          id = null
        }
        const col = gridNumber(rawNode, 'col', 4)
        const row = gridNumber(rawNode, 'row', 3)
        const node = {
          id,
          label: text(rawNode, 'label', 36),
          sub: text(rawNode, 'sub', 42, false),
          icon: oneOf(rawNode, 'icon', ICONS, ''),
          col,
          row,
          tone: oneOf(rawNode, 'tone', TONES, 'default'),
          tip: text(rawNode, 'tip', 352, true, 8),
        }
        if (id === null || node.label === null || node.tip === null || col === null || row === null) return
        nodes.set(id, node)
      })
    })

    const list = [...nodes.values()]
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const dx = Math.abs(list[a].col - list[b].col) * CELL_W
        const dy = Math.abs(list[a].row - list[b].row) * CELL_H
        if (dx < NODE_W + 12 && dy < NODE_H + 12) {
          err(`nodes '${list[a].id}' and '${list[b].id}' overlap — keep them at least 1 col or 1 row apart`)
        }
      }
    }

    const edges = []
    items(raw, 'edges', 1, 10).forEach((rawEdge, i) => {
      within(`edges[${i}]`, () => {
        if (!isMap(rawEdge)) {
          err('edge must be a mapping')
          return
        }
        keys(rawEdge, ['from', 'to', 'label', 'tone', 'dashed', 'tip'])
        const from = get(rawEdge, 'from')
        const to = get(rawEdge, 'to')
        let ok = true
        for (const [key, value] of [['from', from], ['to', to]]) {
          if (typeof value !== 'string' || !nodes.has(value)) {
            err(`'${key}' must be the id of a node in this diagram`)
            ok = false
          }
        }
        if (ok && from === to) {
          err('an edge cannot start and end on the same node')
          ok = false
        }
        let dashed = get(rawEdge, 'dashed') ?? false
        if (typeof dashed !== 'boolean') {
          err("'dashed' must be true or false")
          dashed = false
        }
        const edge = {
          from,
          to,
          label: text(rawEdge, 'label', animate ? 103 : 32),
          tone: oneOf(rawEdge, 'tone', TONES, 'default'),
          dashed,
          tip: text(rawEdge, 'tip', 352, false, 8),
        }
        if (ok) {
          for (const other of nodes.values()) {
            if (other.id === from || other.id === to) continue
            if (segmentHitsNode(nodes.get(from), nodes.get(to), other)) {
              err(`the line ${from} → ${to} runs straight through node '${other.id}' — move a node or route via it`)
              ok = false
              break
            }
          }
        }
        if (ok && edge.label !== null) edges.push(edge)
      })
    })

    if (nodes.size < 2 || edges.length === 0) return null
    return { animate, nodes: list, edges }
  }

  function readSequence(raw) {
    keys(raw, ['type', 'kind', 'caption', 'actors', 'messages'])
    const actors = new Map()
    items(raw, 'actors', 2, 4).forEach((rawActor, i) => {
      within(`actors[${i}]`, () => {
        if (!isMap(rawActor)) {
          err('actor must be a mapping')
          return
        }
        keys(rawActor, ['id', 'label', 'icon', 'tone', 'tip'])
        let id = get(rawActor, 'id')
        if (typeof id !== 'string' || !NODE_ID.test(id)) {
          err("'id' must look like api, db_main, user2")
          id = null
        } else if (actors.has(id)) {
          err(`duplicate actor id '${id}'`)
          id = null
        }
        const actor = {
          id,
          label: text(rawActor, 'label', 29),
          icon: oneOf(rawActor, 'icon', ICONS, ''),
          tone: oneOf(rawActor, 'tone', TONES, 'default'),
          tip: text(rawActor, 'tip', 352, true, 8),
        }
        if (id !== null && actor.label !== null && actor.tip !== null) actors.set(id, actor)
      })
    })

    const messages = []
    items(raw, 'messages', 2, 9).forEach((rawMessage, i) => {
      within(`messages[${i}]`, () => {
        if (!isMap(rawMessage)) {
          err('message must be a mapping')
          return
        }
        const tone = oneOf(rawMessage, 'tone', TONES, 'default')
        const tip = text(rawMessage, 'tip', 352, false, 8)
        if (Object.hasOwn(rawMessage, 'at')) {
          keys(rawMessage, ['at', 'note', 'tone', 'tip'])
          const at = rawMessage.at
          const note = text(rawMessage, 'note', 74)
          if (typeof at !== 'string' || !actors.has(at)) {
            err("'at' must be the id of an actor")
          } else if (note !== null) {
            messages.push({ at, note, tone, tip })
          }
        } else {
          keys(rawMessage, ['from', 'to', 'label', 'tone', 'dashed', 'tip'])
          const from = get(rawMessage, 'from')
          const to = get(rawMessage, 'to')
          const label = text(rawMessage, 'label', 74)
          let dashed = get(rawMessage, 'dashed') ?? false
          if (typeof dashed !== 'boolean') {
            err("'dashed' must be true or false")
            dashed = false
          }
          if (typeof from !== 'string' || !actors.has(from) || typeof to !== 'string' || !actors.has(to)) {
            err("'from' and 'to' must be actor ids (or use at + note for a note on one actor)")
          } else if (from === to) {
            err(`'from' and 'to' are the same — use {at: ${from}, note: '…'} instead`)
          } else if (label !== null) {
            messages.push({ from, to, label, tone, dashed, tip })
          }
        }
      })
    })

    if (actors.size < 2 || messages.length < 2) return null
    return { actors: [...actors.values()], messages }
  }

  function readLayers(raw) {
    keys(raw, ['type', 'kind', 'caption', 'layers'])
    const layers = []
    items(raw, 'layers', 2, 6).forEach((rawLayer, i) => {
      within(`layers[${i}]`, () => {
        if (!isMap(rawLayer)) {
          err('layer must be a mapping')
          return
        }
        keys(rawLayer, ['label', 'sub', 'tone', 'tip'])
        const layer = {
          label: text(rawLayer, 'label', 42),
          sub: text(rawLayer, 'sub', 77, false),
          tone: oneOf(rawLayer, 'tone', TONES, 'default'),
          tip: text(rawLayer, 'tip', 352, true, 8),
        }
        if (layer.label !== null && layer.tip !== null) layers.push(layer)
      })
    })
    return layers.length < 2 ? null : { layers }
  }

  function readCompare(raw) {
    keys(raw, ['type', 'kind', 'caption', 'columns'])
    const columns = []
    items(raw, 'columns', 2, 3).forEach((rawColumn, i) => {
      within(`columns[${i}]`, () => {
        if (!isMap(rawColumn)) {
          err('column must be a mapping')
          return
        }
        keys(rawColumn, ['title', 'tone', 'icon', 'items', 'tip'])
        const column = {
          title: text(rawColumn, 'title', 48),
          tone: oneOf(rawColumn, 'tone', TONES, 'default'),
          icon: oneOf(rawColumn, 'icon', ICONS, ''),
          items: strings(rawColumn, 'items', 1, 5, 154),
          tip: text(rawColumn, 'tip', 352, true, 8),
        }
        if (column.title !== null && column.tip !== null && column.items.length > 0) columns.push(column)
      })
    })
    return columns.length < 2 ? null : { columns }
  }

  function readSteps(raw) {
    keys(raw, ['type', 'kind', 'caption', 'steps'])
    const steps = []
    items(raw, 'steps', 3, 6).forEach((rawStep, i) => {
      within(`steps[${i}]`, () => {
        if (!isMap(rawStep)) {
          err('step must be a mapping')
          return
        }
        keys(rawStep, ['title', 'body', 'tone', 'tip'])
        const step = {
          title: text(rawStep, 'title', 48),
          body: text(rawStep, 'body', 192),
          tone: oneOf(rawStep, 'tone', TONES, 'default'),
          tip: text(rawStep, 'tip', 352, true, 8),
        }
        if (step.title !== null && step.body !== null && step.tip !== null) steps.push(step)
      })
    })
    return steps.length < 3 ? null : { steps }
  }

  function readTable(raw) {
    keys(raw, ['type', 'kind', 'caption', 'headers', 'rows'])
    const headers = strings(raw, 'headers', 2, 5, 36, true)
    const rows = []
    items(raw, 'rows', 2, 7).forEach((rawRow, i) => {
      within(`rows[${i}]`, () => {
        if (!isMap(rawRow)) {
          err('row must be a mapping with cells and tip')
          return
        }
        keys(rawRow, ['cells', 'tip'])
        const cells = strings(rawRow, 'cells', 2, 5, 84, true)
        const tip = text(rawRow, 'tip', 352, true, 8)
        if (cells.length !== headers.length) {
          err(`a row must have exactly as many cells as there are headers (${headers.length})`)
        } else if (tip !== null) {
          rows.push({ cells, tip })
        }
      })
    })
    return headers.length < 2 || rows.length < 2 ? null : { headers, rows }
  }

  function readBars(raw) {
    keys(raw, ['type', 'kind', 'caption', 'items'])
    const bars = []
    items(raw, 'items', 2, 6).forEach((rawItem, i) => {
      within(`items[${i}]`, () => {
        if (!isMap(rawItem)) {
          err('bar item must be a mapping')
          return
        }
        keys(rawItem, ['label', 'value', 'display', 'tone', 'tip'])
        let value = get(rawItem, 'value')
        if (!isNumber(value) || value < 0) {
          err("'value' must be a number ≥ 0 (it sets the bar length)")
          value = null
        }
        const item = {
          label: text(rawItem, 'label', 42),
          value,
          display: text(rawItem, 'display', 29),
          tone: oneOf(rawItem, 'tone', TONES, 'default'),
          tip: text(rawItem, 'tip', 352, true, 8),
        }
        if (value !== null && item.label !== null && item.display !== null && item.tip !== null) bars.push(item)
      })
    })
    if (bars.length >= 2 && Math.max(...bars.map((bar) => bar.value)) === 0) {
      err('at least one bar needs a value above 0')
    }
    return bars.length < 2 ? null : { items: bars }
  }

  // ------------------------------------------------------------------ aside
  function readAside(raw) {
    const type = oneOf(raw, 'type', ASIDE_TYPES)
    switch (type) {
      case 'story': {
        keys(raw, ['type', 'title', 'body'])
        const title = text(raw, 'title', 77)
        const body = text(raw, 'body', 704, true, 20)
        return title === null || body === null ? null : { type: 'story', title, body }
      }
      case 'problem':
      case 'remember': {
        keys(raw, ['type', 'body'])
        const body = text(raw, 'body', type === 'problem' ? 512 : 352, true, 10)
        return body === null ? null : { type, body }
      }
      case 'tips':
      case 'pitfalls': {
        keys(raw, ['type', 'items'])
        const list = strings(raw, 'items', 1, 4, 240)
        return list.length === 0 ? null : { type, items: list }
      }
      case 'commands': {
        keys(raw, ['type', 'title', 'items'])
        const list = []
        items(raw, 'items', 1, 6).forEach((rawItem, i) => {
          within(`items[${i}]`, () => {
            if (!isMap(rawItem)) {
              err('command must be a mapping with cmd and desc')
              return
            }
            keys(rawItem, ['cmd', 'desc'])
            const cmd = code(rawItem, 'cmd', 3, 110)
            const desc = text(rawItem, 'desc', 176)
            if (cmd !== null && desc !== null) list.push({ cmd, desc })
          })
        })
        return list.length === 0 ? null : { type: 'commands', title: text(raw, 'title', 64, false), items: list }
      }
      case 'terms': {
        keys(raw, ['type', 'items'])
        const list = []
        items(raw, 'items', 1, 5).forEach((rawItem, i) => {
          within(`items[${i}]`, () => {
            if (!isMap(rawItem)) {
              err('term must be a mapping with term and meaning')
              return
            }
            keys(rawItem, ['term', 'meaning'])
            const term = text(rawItem, 'term', 58)
            const meaning = text(rawItem, 'meaning', 240)
            if (term !== null && meaning !== null) list.push({ term, meaning })
          })
        })
        return list.length === 0 ? null : { type: 'terms', items: list }
      }
      case 'when': {
        keys(raw, ['type', 'use', 'avoid'])
        const use = strings(raw, 'use', 1, 3, 192)
        const avoid = strings(raw, 'avoid', 1, 3, 192)
        return use.length === 0 || avoid.length === 0 ? null : { type: 'when', use, avoid }
      }
      case 'refs': {
        keys(raw, ['type', 'items'])
        const list = []
        items(raw, 'items', 1, 3).forEach((rawItem, i) => {
          within(`items[${i}]`, () => {
            if (!isMap(rawItem)) {
              err('ref must be a mapping with to and label')
              return
            }
            keys(rawItem, ['to', 'label'])
            const to = text(rawItem, 'to', 192)
            const label = text(rawItem, 'label', 96)
            if (to !== null && label !== null) list.push({ to, label })
          })
        })
        return list.length === 0 ? null : { type: 'refs', items: list }
      }
    }
    return null
  }

  // ------------------------------------------------------------- references
  function resolveSegment(segment, here) {
    for (const slide of segment.slides) {
      trail = [`slide '${slide.slug}'`]
      linkCount = 0
      const self = `${here}/${slide.slug}`

      slide.blocks = resolveLinks(slide.blocks, here)
      slide.check = slide.check === null ? null : resolveLinks(slide.check, here)

      const aside = []
      for (const section of slide.aside) {
        if (section.type !== 'refs') {
          aside.push(resolveLinks(section, here))
          continue
        }
        const refs = []
        for (const item of section.items) {
          linkCount++
          const target = resolveRef(item.to, here)
          if (target === self) {
            err(`a slide must not link to itself ('${item.to}')`)
          } else if (target !== null) {
            refs.push({ to: target, label: item.label })
          }
        }
        if (refs.length > 0) aside.push({ type: 'refs', items: refs })
      }
      slide.aside = aside

      if (linkCount > 4) {
        err(`too many reference links on one slide (${linkCount} > 4) — keep only the most useful ones`)
      }
    }

    segment.flashcards.forEach((card, i) => {
      trail = [`flashcard #${i + 1}`]
      card.more = resolveLinks(card.more, here)
      card.q = stripLinks(card.q)
      card.a = stripLinks(card.a)
      card.ref = card.ref === null ? null : resolveRef(card.ref, here)
    })

    segment.quiz.forEach((question, i) => {
      trail = [`quiz #${i + 1}`]
      question.q = stripLinks(question.q)
      question.hint = stripLinks(question.hint)
      for (const option of question.options) {
        option.text = stripLinks(option.text)
        option.why = stripLinks(option.why)
      }
      question.ref = question.ref === null ? null : resolveRef(question.ref, here)
    })
    trail = []
  }

  /**
   * Rewrites every [[target|label]] in the strings of value to its canonical
   * "topic/segment/slide" form. Code and command strings are left untouched.
   */
  function resolveLinks(value, here, key = '') {
    if (Array.isArray(value)) return value.map((item, i) => resolveLinks(item, here, i))
    if (isMap(value)) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveLinks(v, here, k)]))
    }
    if (typeof value !== 'string' || ['code', 'cmd', 'id', 'from', 'to', 'at', 'lang', 'file'].includes(key)) {
      return value
    }
    return value.replace(LINK, (_, target, label) => {
      linkCount++
      const resolved = resolveRef(trim(target), here)
      return resolved === null ? label : `[[${resolved}|${label}]]`
    })
  }

  function stripLinks(value) {
    if (new RegExp(LINK.source, 'u').test(value)) {
      err('links ([[…|…]]) are only allowed in slide text, aside sections and flashcard "more"')
    }
    return value.replace(LINK, '$2')
  }

  /** @returns canonical "topic/segment/slide", or null when the target has no content yet */
  function resolveRef(ref, here) {
    const parts = ref.split('/')
    for (const part of parts) {
      if (!SLUG.test(part)) {
        err(`bad reference '${ref}' — use slide-slug, topic/segment or topic/segment/slide`)
        return null
      }
    }

    if (parts.length === 1) {
      if (!(slideIndex.get(here) ?? []).includes(ref)) {
        err(`reference '${ref}' is not a slide of this segment (for other segments write topic/segment)`)
        return null
      }
      return `${here}/${ref}`
    }

    if (parts.length > 3) {
      err(`bad reference '${ref}' — at most topic/segment/slide`)
      return null
    }

    const segmentPath = `${parts[0]}/${parts[1]}`
    if (!outlineSegments.has(segmentPath)) {
      err(`reference '${ref}' points to a segment that is not in outline.yaml`)
      return null
    }
    const slides = slideIndex.get(segmentPath) ?? []
    if (slides.length === 0) {
      warn(`reference '${ref}' — target segment has no content yet, the link is dropped until it exists`)
      return null
    }
    if (parts.length === 2) return `${segmentPath}/${slides[0]}`
    if (!slides.includes(parts[2])) {
      err(`reference '${ref}' — segment '${segmentPath}' has no slide '${parts[2]}'`)
      return null
    }
    return ref
  }

  // ------------------------------------------------------------------- load
  const outline = parseFile(join(dir, 'outline.yaml'), 'outline.yaml')
  if (!isMap(outline) || !Array.isArray(outline.topics)) {
    err('outline.yaml must contain a "topics" list')
    return result
  }

  const topics = readOutline(outline.topics)

  // Pass 1 — read and validate every segment file.
  for (const topic of topics) {
    for (const segment of topic.segments) {
      const path = `${topic.slug}/${segment.slug}`
      scope = path
      trail = []
      const file = join(dir, `${path}.yaml`)
      if (!existsSync(file)) continue
      const data = parseFile(file, `${path}.yaml`)
      if (!isMap(data) || Array.isArray(data)) {
        err('file must be a YAML mapping with slides, flashcards and quiz')
        continue
      }
      readSegment(data, segment)
      slideIndex.set(path, segment.slides.map((slide) => slide.slug))
      segment.loaded = true
    }
  }

  // Pass 2 — resolve every reference now that all slide slugs are known.
  for (const topic of topics) {
    for (const segment of topic.segments) {
      const path = `${topic.slug}/${segment.slug}`
      scope = path
      if (!segment.loaded) {
        result.missing.push(path)
        continue
      }
      resolveSegment(segment, path)
      trail = []
      result.stats.segments++
      result.stats.slides += segment.slides.length
      result.stats.flashcards += segment.flashcards.length
      result.stats.quiz += segment.quiz.length
    }
  }

  result.topics = topics
  return result
}

/** Does the straight line between the centres of a and b cross the box of c? */
function segmentHitsNode(a, b, c) {
  const x1 = a.col * CELL_W
  const y1 = a.row * CELL_H
  const x2 = b.col * CELL_W
  const y2 = b.row * CELL_H
  const cx = c.col * CELL_W
  const cy = c.row * CELL_H
  const halfW = NODE_W / 2 + 4
  const halfH = NODE_H / 2 + 4

  // Liang–Barsky clipping of the segment against the (slightly inflated) box.
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  const checks = [
    [-dx, x1 - (cx - halfW)],
    [dx, cx + halfW - x1],
    [-dy, y1 - (cy - halfH)],
    [dy, cy + halfH - y1],
  ]
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      t0 = Math.max(t0, t)
    } else {
      if (t < t0) return false
      t1 = Math.min(t1, t)
    }
  }
  return t0 <= t1
}
