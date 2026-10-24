import { CALLOUT_EMOJI, codeLanguage } from '../../../shared/note-blocks.js'

// Plain helpers for a note's block list. Every function returns a new list; nothing is edited in place.

export function newBlock(type, fields = {}) {
  const id = crypto.randomUUID()
  const text = fields.text ?? ''
  switch (type) {
    case 'case':
      return { id, type, caseId: fields.caseId }
    case 'todo':
      return { id, type, text, done: false }
    case 'heading':
      return fields.level > 1 ? { id, type, text, level: fields.level } : { id, type, text }
    case 'bullet':
    case 'numbered':
      return fields.indent === 1 ? { id, type, text, indent: 1 } : { id, type, text }
    case 'code':
      return { id, type, text, language: codeLanguage(fields.language) }
    case 'divider':
      return { id, type }
    case 'callout': {
      const tone = fields.tone ?? 'tip'
      return { id, type, text, tone, emoji: fields.emoji ?? CALLOUT_EMOJI[tone] }
    }
    default:
      return { id, type, text }
  }
}

// The "/" menu: every block it can make, with the words (English and Portuguese) that find it.
export const SLASH_ITEMS = [
  { key: 'text', type: 'text', words: ['text', 'texto', 'paragraph', 'paragrafo'] },
  { key: 'heading1', type: 'heading', level: 1, words: ['h1', 'heading', 'titulo', 'title', '#'] },
  { key: 'heading2', type: 'heading', level: 2, words: ['h2', 'heading', 'titulo', 'subtitulo', '##'] },
  { key: 'heading3', type: 'heading', level: 3, words: ['h3', 'heading', 'titulo', '###'] },
  { key: 'todo', type: 'todo', words: ['todo', 'to-do', 'tarefa', 'checkbox', 'check'] },
  { key: 'bullet', type: 'bullet', words: ['list', 'lista', 'bullet', 'marcador', '-'] },
  { key: 'numbered', type: 'numbered', words: ['numbered', 'numerada', 'numero', 'ordered', '1.'] },
  { key: 'quote', type: 'quote', words: ['quote', 'citacao', 'cite', '>'] },
  { key: 'code', type: 'code', words: ['code', 'codigo', 'snippet', '```'] },
  { key: 'divider', type: 'divider', words: ['divider', 'divisor', 'linha', 'line', 'hr', '---'] },
  { key: 'callout', type: 'callout', words: ['callout', 'destaque', 'aviso', 'dica', 'tip', 'info', 'warning'] },
  { key: 'case', type: 'case', words: ['case', 'caso', '@'] },
  { key: 'emoji', type: 'emoji', words: ['emoji', 'emoticon', 'carinha'] },
]

// Lowercase without accents, so "codigo" finds "Código" and "citação" finds "quote".
export const fold = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()

// Items whose words start with the query, or whose shown label holds it.
export function matchSlash(query, labelOf) {
  const needle = fold(query)
  if (!needle) return SLASH_ITEMS
  return SLASH_ITEMS.filter((item) => item.words.some((word) => fold(word).startsWith(needle)) || fold(labelOf(item)).includes(needle))
}

// "/cod" right before the caret, at the start of a line or after a space: the "/" menu, filtered by
// "cod", as { start, query }. A "/" inside a word or a URL ("a/b", "https://x") is just a slash.
export function slashAt(text, caret) {
  const match = /(^|\s)\/([^\s/]*)$/.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null
}

// A block's text cut around [start, end), the "/cod" or "@que" being typed: what comes before (no
// trailing spaces or line break) and what comes after (minus the line break at the cut).
export function splitText(text, start, end) {
  return { before: text.slice(0, start).trimEnd(), after: text.slice(end).replace(/^[ \t]*\n?/, '') }
}

// Puts block where the caret was in block id: the words before stay in it, the words after go to a
// new text block below the new one. With nothing before, the new block takes its place (and its id).
// Returns { blocks, block (as placed), tail (the words after, or null) }.
export function splitInsert(blocks, id, block, { before, after }) {
  const tail = after ? newBlock('text', { text: after }) : null
  let placed = block
  let next
  if (before) {
    next = insertAfter(updateBlock(blocks, id, { text: before }), id, block)
  } else {
    placed = { ...block, id }
    next = blocks.map((item) => (item.id === id ? placed : item))
  }
  if (tail) next = insertAfter(next, placed.id, tail)
  return { blocks: next, block: placed, tail }
}

// Markdown typed at the start of a text block becomes that block: { type, fields } or null.
// "```" waits for a space (or Enter) so a language can follow it; "---" turns at the third dash.
export function markdownShortcut(text) {
  let match = /^(#{1,3}) ([\s\S]*)$/.exec(text)
  if (match) return { type: 'heading', fields: { level: match[1].length, text: match[2] } }
  match = /^[-*] ([\s\S]*)$/.exec(text)
  if (match) return { type: 'bullet', fields: { text: match[1] } }
  match = /^1[.)] ([\s\S]*)$/.exec(text)
  if (match) return { type: 'numbered', fields: { text: match[1] } }
  match = /^\[ ?\] ([\s\S]*)$/.exec(text)
  if (match) return { type: 'todo', fields: { text: match[1] } }
  match = /^> ([\s\S]*)$/.exec(text)
  if (match) return { type: 'quote', fields: { text: match[1] } }
  match = /^```([\w+#.-]*) $/.exec(text)
  if (match) return { type: 'code', fields: { language: match[1] } }
  if (text === '---') return { type: 'divider', fields: {} }
  return null
}

// ":fogo" right before the caret, at the start or after a space, 2 letters or more: { start, query }.
export function emojiQueryAt(text, caret) {
  const match = /(^|\s):([\p{L}\p{N}_+-]{2,})$/u.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null
}

export function moveBlock(blocks, id, direction) {
  const index = blocks.findIndex((block) => block.id === id)
  const to = index + direction
  if (index === -1 || to < 0 || to >= blocks.length) return blocks
  const next = [...blocks]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

// Moves a block into a gap of the list as it is now: 0 is the top, blocks.length the end. The same
// list back when it would land where it already is.
export function moveBlockTo(blocks, id, spot) {
  const from = blocks.findIndex((block) => block.id === id)
  const gap = Math.max(0, Math.min(spot, blocks.length))
  if (from === -1 || gap === from || gap === from + 1) return blocks
  const next = blocks.filter((block) => block.id !== id)
  next.splice(gap > from ? gap - 1 : gap, 0, blocks[from])
  return next
}

// The first words of a block's text, short enough for a menu: "" when it has none.
export function blockWords(text, max = 32) {
  const line = String(text ?? '')
    .split('\n')
    .map((part) => part.replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim())
    .find(Boolean)
  if (!line) return ''
  return line.length > max ? `${line.slice(0, max).trimEnd()}...` : line
}

export function insertBefore(blocks, id, block) {
  const index = blocks.findIndex((item) => item.id === id)
  return index === -1 ? [block, ...blocks] : [...blocks.slice(0, index), block, ...blocks.slice(index)]
}

// The same block under a new id, right after it.
export function duplicateBlock(blocks, id) {
  const block = blocks.find((item) => item.id === id)
  if (!block) return { blocks, copyId: null }
  const copy = { ...block, id: crypto.randomUUID() }
  return { blocks: insertAfter(blocks, id, copy), copyId: copy.id }
}

// Ctrl+B / I / E / K: the marks go around the selection, or around an empty spot for the caret.
// Returns { value, start, end } with the selection on the wrapped words (or the link's URL).
export function wrapSelection({ value, start, end }, mark) {
  const picked = value.slice(start, end)
  if (mark === 'link') {
    const label = picked || 'link'
    const url = 'https://'
    const next = `${value.slice(0, start)}[${label}](${url})${value.slice(end)}`
    const urlStart = start + label.length + 3
    return { value: next, start: urlStart, end: urlStart + url.length }
  }
  const marks = { bold: '**', italic: '*', code: '`' }[mark]
  const next = `${value.slice(0, start)}${marks}${picked}${marks}${value.slice(end)}`
  return { value: next, start: start + marks.length, end: end + marks.length }
}

const INDENT = '  '

// Tab in a prose block: two spaces at the caret. Shift+Tab takes up to two back off the caret's line start.
export function indentText({ value, start, end }) {
  return { value: value.slice(0, start) + INDENT + value.slice(end), start: start + INDENT.length, end: start + INDENT.length }
}

export function outdentText({ value, start, end }) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const spaces = /^ {1,2}/.exec(value.slice(lineStart))?.[0].length ?? 0
  if (!spaces) return null
  return { value: value.slice(0, lineStart) + value.slice(lineStart + spaces), start: Math.max(lineStart, start - spaces), end: Math.max(lineStart, end - spaces) }
}

// "@que" right before the caret, at the start or after a space: { start, query }. Otherwise null.
export function mentionAt(text, caret) {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null
}

export function updateBlock(blocks, id, patch) {
  return blocks.map((block) => (block.id === id ? { ...block, ...patch } : block))
}

export function insertAfter(blocks, id, block) {
  const index = blocks.findIndex((item) => item.id === id)
  return index === -1 ? [...blocks, block] : [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)]
}

export function removeBlock(blocks, id) {
  return blocks.filter((block) => block.id !== id)
}

// The mention text ("@que") comes out of the block and the case goes where it was: the words before
// stay above it, the words after go to a text block below it (see splitInsert). A text block always
// follows so you can keep typing. Returns { blocks, focusId }.
export function placeCase(blocks, blockId, caseId, mention) {
  const block = blocks.find((item) => item.id === blockId)
  let caseBlock = newBlock('case', { caseId })
  let next
  if (!block) {
    next = [...blocks, caseBlock]
  } else {
    const placed = splitInsert(blocks, blockId, caseBlock, splitText(block.text, mention.start, mention.start + 1 + mention.query.length))
    if (placed.tail) return { blocks: placed.blocks, focusId: placed.tail.id }
    next = placed.blocks
    caseBlock = placed.block
  }
  const after = next[next.findIndex((item) => item.id === caseBlock.id) + 1]
  if (after?.type === 'text') return { blocks: next, focusId: after.id }
  const writing = newBlock('text')
  return { blocks: insertAfter(next, caseBlock.id, writing), focusId: writing.id }
}

// Cases whose error, bug type or language (or a question card's question, topic or title) contains
// the query, newest first as given.
export function matchCases(cases, query, labelOf) {
  const needle = query.trim().toLowerCase()
  if (!needle) return cases
  return cases.filter((item) =>
    [item.error, labelOf(item.concept), item.language, item.question, item.topic, item.title].some((value) => (value ?? '').toLowerCase().includes(needle)),
  )
}

export const mentionsCase = (note, caseId) => note.blocks.some((block) => block.type === 'case' && block.caseId === caseId)
