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
  return { value }
}
