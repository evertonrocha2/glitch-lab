import { conceptLabel } from '../../../shared/concepts.js'
import { NOTE_LIMITS } from '../../../shared/limits.js'
import { CALLOUT_TONES, codeLanguage, EMOJI_MAX, plainInline } from '../../../shared/note-blocks.js'
import { parseNoteTags } from '../../../shared/note-tags.js'
import { caseText, isQuestion } from '../../../shared/question.js'

const TOO_LONG = `Too long. Keep each block under ${NOTE_LIMITS.text} characters.`
const isText = (value) => typeof value === 'string'
const blockId = (block) => (isText(block.id) && block.id.length <= 64 ? block.id : crypto.randomUUID())

const TOO_LONG_CODE = `Too long. Keep each code block under ${NOTE_LIMITS.code} characters.`
const isEmoji = (value) => isText(value) && value.trim() !== '' && value.length <= EMOJI_MAX && !/[<>]/.test(value)

// Rebuilds one block with only the fields its type allows. A string is the error message.
// Optional fields (a heading's level, a list's indent) are stored only when they differ from the
// default, so blocks written before they existed read the same.
export function cleanBlock(block) {
  if (!block || typeof block !== 'object') return 'Invalid block.'
  const id = blockId(block)
  const long = isText(block.text) && block.text.length > (block.type === 'code' ? NOTE_LIMITS.code : NOTE_LIMITS.text)
  if (long) return block.type === 'code' ? TOO_LONG_CODE : TOO_LONG
  switch (block.type) {
    case 'text':
    case 'quote':
      if (!isText(block.text)) return 'Invalid block.'
      return { id, type: block.type, text: block.text }
    case 'heading': {
      if (!isText(block.text) || ![undefined, 1, 2, 3].includes(block.level)) return 'Invalid block.'
      return block.level > 1 ? { id, type: 'heading', text: block.text, level: block.level } : { id, type: 'heading', text: block.text }
    }
    case 'bullet':
    case 'numbered':
      if (!isText(block.text) || ![undefined, 0, 1].includes(block.indent)) return 'Invalid block.'
      return block.indent === 1 ? { id, type: block.type, text: block.text, indent: 1 } : { id, type: block.type, text: block.text }
    case 'code':
      if (!isText(block.text) || (block.language !== undefined && !isText(block.language))) return 'Invalid block.'
      return { id, type: 'code', text: block.text, language: codeLanguage(block.language) }
    case 'divider':
      return { id, type: 'divider' }
    case 'callout':
      if (!isText(block.text) || !CALLOUT_TONES.includes(block.tone) || !isEmoji(block.emoji)) return 'Invalid block.'
      return { id, type: 'callout', text: block.text, tone: block.tone, emoji: block.emoji }
    case 'todo':
      if (!isText(block.text) || typeof block.done !== 'boolean') return 'Invalid block.'
      return { id, type: 'todo', text: block.text, done: block.done }
    case 'case':
      if (!isText(block.caseId) || block.caseId === '' || block.caseId.length > 64) return 'Invalid block.'
      return { id, type: 'case', caseId: block.caseId }
    default:
      return 'Invalid block.'
  }
}

// { value: { title?, blocks?, tags?, isPublic?, folderId? } } or { status, message }. Missing fields
// stay undefined; folderId null takes the note out of every folder.
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
      if (typeof cleaned === 'string') return { status: cleaned === 'Invalid block.' ? 400 : 413, message: cleaned }
      value.blocks.push(cleaned)
    }
  }
  if (body.tags !== undefined) {
    const parsed = parseNoteTags(body.tags)
    if (parsed.problem) return { status: 400, message: parsed.problem }
    value.tags = parsed.tags
  }
  if (body.isPublic !== undefined) {
    if (typeof body.isPublic !== 'boolean') return { status: 400, message: 'Invalid request.' }
    value.isPublic = body.isPublic
  }
  if (body.folderId !== undefined) {
    if (body.folderId !== null && !(isText(body.folderId) && body.folderId !== '' && body.folderId.length <= 64)) return { status: 400, message: 'Invalid request.' }
    value.folderId = body.folderId
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
    .filter((block) => isText(block.text) && block.type !== 'code')
    .map((block) => oneLine(plainInline(block.text)))
    .filter(Boolean)
  return {
    id: note.id,
    title: note.title,
    tags: note.tags,
    updatedAt: note.updatedAt,
    excerpt: cut(words.join(' · '), EXCERPT),
    blockCount: note.blocks.length,
  }
}

// "TypeError: message" style first lines; anything else is a plain "Error". Same rule as the board.
const TYPED_ERROR = /^([A-Za-z_$][\w$.]*)\s*:\s*(.*)$/

// What a reader may learn about a case: the kind of error and how far along it is.
// Never the code, attached files, context, analysis, stack lines or the case id.
// A question card shows its topic where an error shows its type, and its question as the message.
function caseSummary(kase) {
  const question = isQuestion(kase)
  const firstLine = caseText(kase).split('\n')[0].trim()
  const match = question ? null : TYPED_ERROR.exec(firstLine)
  return {
    ...(question ? { kind: 'question' } : {}),
    errorType: question ? kase.topic : match ? match[1] : 'Error',
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
    if (block.type !== 'case') return cleanBlock(block)
    const kase = getCase(block.caseId)
    return { id: block.id, type: 'case', case: kase ? caseSummary(kase) : null }
  })
  // A stored block that no longer passes the rules (it never should) is left out, not shown raw.
  return { id: note.id, title: note.title, tags: note.tags, updatedAt: note.updatedAt, blocks: blocks.filter((block) => typeof block !== 'string') }
}
