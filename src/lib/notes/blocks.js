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

// "/cod" as the whole text of a block: the "/" menu, filtered by "cod". Otherwise null.
export const slashQuery = (text) => /^\/([^\s/]*)$/.exec(text)?.[1] ?? null

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

// The mention text ("@que") comes out of the block; the case goes in after it, or in its place
// when nothing else was written. A text block follows so you can keep typing.
// Returns { blocks, focusId }.
export function placeCase(blocks, blockId, caseId, mention) {
  const block = blocks.find((item) => item.id === blockId)
  const caseBlock = newBlock('case', { caseId })
  let next
  if (!block) {
    next = [...blocks, caseBlock]
  } else {
    const end = mention.start + 1 + mention.query.length
    const text = block.text.slice(0, mention.start) + block.text.slice(end)
    next =
      text.trim() === ''
        ? blocks.map((item) => (item.id === blockId ? caseBlock : item))
        : insertAfter(updateBlock(blocks, blockId, { text: text.trimEnd() }), blockId, caseBlock)
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
