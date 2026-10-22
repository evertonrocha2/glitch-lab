import { conceptLabel } from '../../shared/concepts.js'
import { NOTE_LIMITS } from '../../shared/limits.js'

const TOO_LONG = `Too long. Keep each block under ${NOTE_LIMITS.text} characters.`
const isText = (value) => typeof value === 'string'
const blockId = (block) => (isText(block.id) && block.id.length <= 64 ? block.id : crypto.randomUUID())

// Rebuilds one block with only the fields its type allows. A string is the error message.
function cleanBlock(block) {
  if (!block || typeof block !== 'object') return 'Invalid block.'
  const id = blockId(block)
  switch (block.type) {
    case 'text':
    case 'heading':
      if (!isText(block.text)) return 'Invalid block.'
      return block.text.length > NOTE_LIMITS.text ? TOO_LONG : { id, type: block.type, text: block.text }
    case 'todo':
      if (!isText(block.text) || typeof block.done !== 'boolean') return 'Invalid block.'
      return block.text.length > NOTE_LIMITS.text ? TOO_LONG : { id, type: 'todo', text: block.text, done: block.done }
    case 'case':
      if (!isText(block.caseId) || block.caseId === '' || block.caseId.length > 64) return 'Invalid block.'
      return { id, type: 'case', caseId: block.caseId }
    default:
      return 'Invalid block.'
  }
}

// { value: { title?, blocks? } } or { status, message }. Missing fields stay undefined.
export function parseNote(body) {
  const value = {}
  if (body.title !== undefined) {
    if (!isText(body.title)) return { status: 400, message: 'Invalid request.' }
    if (body.title.length > NOTE_LIMITS.title) return { status: 413, message: `Too long. Keep the title under ${NOTE_LIMITS.title} characters.` }
    value.title = body.title
  }
  if (body.blocks !== undefined) {
    if (!Array.isArray(body.blocks)) return { status: 400, message: 'Invalid request.' }
    if (body.blocks.length > NOTE_LIMITS.blocks) return { status: 413, message: `Too long. A note holds up to ${NOTE_LIMITS.blocks} blocks.` }
    value.blocks = []
    for (const block of body.blocks) {
      const cleaned = cleanBlock(block)
      if (typeof cleaned === 'string') return { status: cleaned === TOO_LONG ? 413 : 400, message: cleaned }
      value.blocks.push(cleaned)
    }
  }
  if (body.isPublic !== undefined) {
    if (typeof body.isPublic !== 'boolean') return { status: 400, message: 'Invalid request.' }
    value.isPublic = body.isPublic
  }
  return { value }
}

const EXCERPT = 140
const ERROR_MESSAGE = 160
const oneLine = (text) => text.replace(/\s+/g, ' ').trim()
const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text)

// A public note in a list: never the blocks themselves, just a taste of the writing.
export function publicNoteSummary(note) {
  // A dot between blocks, so a heading doesn't run into the sentence after it.
  const words = note.blocks
    .filter((block) => block.type !== 'case')
    .map((block) => oneLine(block.text))
    .filter(Boolean)
  return {
    id: note.id,
    title: note.title,
    updatedAt: note.updatedAt,
    excerpt: cut(words.join(' · '), EXCERPT),
    blockCount: note.blocks.length,
  }
}

// "TypeError: message" style first lines; anything else is a plain "Error". Same rule as the board.
const TYPED_ERROR = /^([A-Za-z_$][\w$.]*)\s*:\s*(.*)$/

// What a reader may learn about a case: the kind of error and how far along it is.
// Never the code, attached files, context, analysis, stack lines or the case id.
function caseSummary(kase) {
  const firstLine = kase.error.split('\n')[0].trim()
  const match = TYPED_ERROR.exec(firstLine)
  return {
    errorType: match ? match[1] : 'Error',
    message: cut(match ? match[2] : firstLine, ERROR_MESSAGE),
    bugType: conceptLabel(kase.concept),
    language: kase.language,
    status: kase.status,
  }
}

// A public note, read-only. getCase must only find the author's own cases, so a note that names
// someone else's case id shows nothing about it.
export async function publicNote(note, getCase) {
  const blocks = note.blocks.map((block) => {
    // Rebuilt field by field, like on save, so nothing extra rides along.
    if (block.type === 'todo') return { id: block.id, type: 'todo', text: block.text, done: block.done }
    if (block.type !== 'case') return { id: block.id, type: block.type, text: block.text }
    const kase = getCase(block.caseId)
    return { id: block.id, type: 'case', case: kase ? caseSummary(kase) : null }
  })
  return { id: note.id, title: note.title, updatedAt: note.updatedAt, blocks }
}
