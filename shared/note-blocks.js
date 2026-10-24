// Note blocks: the kinds a note can hold and the little markdown they carry. Shared by the API
// (which checks every block), the exports, the public pages and the editor.
import { KNOWN_LANGUAGES, knownLanguage } from './question.js'

export const HEADING_LEVELS = [1, 2, 3]
export const LIST_TYPES = ['bullet', 'numbered']
export const CALLOUT_TONES = ['info', 'tip', 'warning']
export const CALLOUT_EMOJI = { info: 'ℹ️', tip: '💡', warning: '⚠️' }
export const CODE_LANGUAGES = KNOWN_LANGUAGES
// Blocks you write in: a textarea in the editor, a text field when stored.
export const WRITTEN = ['text', 'heading', 'todo', 'quote', 'bullet', 'numbered', 'callout', 'code']
// Longest emoji on a callout, in UTF-16 units (flags and skin tones run long).
export const EMOJI_MAX = 16

export const isList = (block) => LIST_TYPES.includes(block?.type)
export const headingLevel = (block) => (HEADING_LEVELS.includes(block.level) ? block.level : 1)
export const codeLanguage = (language) => (language ? (knownLanguage(language) ?? '') : '')

// Pieces of a line: plain text, **bold**, *italic*, `code`, ~~strike~~ and [text](https://link).
// Never nested, and never HTML: the pages render each piece as a text node.
const INLINE = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*([^*\n]+?)\*\*|~~([^~\n]+?)~~|\*([^*\s][^*\n]*?)\*/g

// Only web links: "javascript:" or "data:" in a note must never become something to click.
export function safeHref(url) {
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

export function parseInline(text) {
  const parts = []
  let last = 0
  const plain = (value) => {
    if (!value) return
    const previous = parts.at(-1)
    if (previous?.type === 'text') previous.text += value
    else parts.push({ type: 'text', text: value })
  }
  for (const match of String(text ?? '').matchAll(INLINE)) {
    plain(text.slice(last, match.index))
    const [whole, code, label, url, bold, strike, italic] = match
    if (code !== undefined) parts.push({ type: 'code', text: code })
    else if (label !== undefined) {
      const href = safeHref(url)
      if (href) parts.push({ type: 'link', text: label, href })
      else plain(whole)
    } else if (bold !== undefined) parts.push({ type: 'bold', text: bold })
    else if (strike !== undefined) parts.push({ type: 'strike', text: strike })
    else parts.push({ type: 'italic', text: italic })
    last = match.index + whole.length
  }
  plain(String(text ?? '').slice(last))
  return parts
}

// Whether a line has any mark worth drawing (the editor shows plain lines as they are).
export const hasMarks = (text) => parseInline(text).some((part) => part.type !== 'text')

// The words without their marks: "**Tip:** see [docs](https://x)" -> "Tip: see docs".
export const plainInline = (text) =>
  parseInline(text)
    .map((part) => part.text)
    .join('')

// Numbers for the numbered items: each run of numbered blocks counts from 1, per indent level.
export function listNumbers(blocks) {
  const numbers = new Map()
  const counters = [0, 0]
  for (const block of blocks) {
    if (block.type !== 'numbered') {
      counters[0] = 0
      counters[1] = 0
      continue
    }
    const level = block.indent === 1 ? 1 : 0
    if (level === 0) counters[1] = 0
    counters[level] += 1
    numbers.set(block.id, counters[level])
  }
  return numbers
}

// A note as plain text with its structure (headings, lists, quotes, ``` fences), for the AI.
export function noteAsText(blocks, caseLine) {
  const numbers = listNumbers(blocks)
  return blocks
    .map((block) => {
      const pad = block.indent === 1 ? '  ' : ''
      switch (block.type) {
        case 'heading':
          return `${'#'.repeat(headingLevel(block))} ${plainInline(block.text)}`
        case 'todo':
          return `[${block.done ? 'x' : ' '}] ${plainInline(block.text)}`
        case 'bullet':
          return `${pad}- ${plainInline(block.text)}`
        case 'numbered':
          return `${pad}${numbers.get(block.id)}. ${plainInline(block.text)}`
        case 'quote':
          return plainInline(block.text)
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n')
        case 'callout':
          return `${block.emoji} ${plainInline(block.text)}`
        case 'code':
          return `\`\`\`${block.language ?? ''}\n${block.text}\n\`\`\``
        case 'divider':
          return '---'
        case 'case':
          return caseLine(block)
        default:
          return plainInline(block.text)
      }
    })
    .filter(Boolean)
    .join('\n')
}
