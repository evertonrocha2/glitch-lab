import { NOTE_LIMITS } from '../../../shared/limits.js'
import { NOTE_AI_ACTIONS } from '../../../shared/note-ai.js'
import { CALLOUT_EMOJI, CALLOUT_TONES, headingLevel, WRITTEN } from '../../../shared/note-blocks.js'
import { cleanBlock } from './notes.model.js'

// Blocks the AI may move but never rewrite. Their content always comes back from the note itself,
// never from the model: code (checked to the character), cases and dividers.
const FIXED = ['code', 'case', 'divider']
// What the model writes: every written block but code.
const REWRITABLE = WRITTEN.filter((type) => type !== 'code')

const isText = (value) => typeof value === 'string'

// { value: { action, blockIds } } or { status, message }. blockIds null: the whole note.
export function parseAiRequest(body) {
  if (!body || !NOTE_AI_ACTIONS.includes(body.action)) return { status: 400, message: 'Invalid request.' }
  if (body.blockIds === undefined || body.blockIds === null) return { value: { action: body.action, blockIds: null } }
  const ids = body.blockIds
  const valid = Array.isArray(ids) && ids.length > 0 && ids.length <= NOTE_LIMITS.blocks && ids.every((id) => isText(id) && id !== '' && id.length <= 64)
  if (!valid || new Set(ids).size !== ids.length) return { status: 400, message: 'Invalid request.' }
  return { value: { action: body.action, blockIds: ids } }
}

// The note's blocks the request is about, in note order. null when an id isn't in the note.
export function scopeBlocks(blocks, blockIds) {
  if (!blockIds) return blocks
  const wanted = new Set(blockIds)
  const scope = blocks.filter((block) => wanted.has(block.id))
  return scope.length === wanted.size ? scope : null
}

// Something the AI can work on: words outside code.
export const hasWriting = (blocks) => blocks.some((block) => REWRITABLE.includes(block.type) && block.text.trim() !== '')

// The blocks as the model reads them: each with a ref (k1, k2...) it uses to place the fixed ones.
// caseLabel(caseId) names a case card in a few words.
export function aiItems(blocks, caseLabel) {
  return blocks.map((block, index) => {
    const ref = `k${index + 1}`
    switch (block.type) {
      case 'code':
        return { ref, type: 'code', language: block.language || '', text: block.text }
      case 'case':
        return { ref, type: 'case', about: caseLabel(block.caseId) }
      case 'divider':
        return { ref, type: 'divider' }
      case 'heading':
        return { ref, type: 'heading', level: headingLevel(block), text: block.text }
      case 'bullet':
      case 'numbered':
        return { ref, type: block.type, indent: block.indent === 1 ? 1 : 0, text: block.text }
      case 'todo':
        return { ref, type: 'todo', done: block.done, text: block.text }
      case 'callout':
        return { ref, type: 'callout', tone: block.tone, text: block.text }
      default:
        return { ref, type: block.type, text: block.text }
    }
  })
}

// The same strings, each as many times, in any order.
function sameItems(a, b) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((value, index) => value === right[index])
}
const codeTexts = (blocks) => blocks.filter((block) => block.type === 'code').map((block) => block.text)
const caseIds = (blocks) => blocks.filter((block) => block.type === 'case').map((block) => block.caseId)

// Every code block of the input is in the output, character for character, exactly once, and no
// other code is. The check that makes "the AI never touches your code" true.
export const keepsCode = (input, output) => sameItems(codeTexts(input), codeTexts(output))

// One written block from the model. base: the block it replaces when the note kept its shape (the
// "improve" case): its id, check mark, callout emoji and levels stay.
function writtenBlock(item, base) {
  if (!REWRITABLE.includes(item.type) || !isText(item.text)) return null
  const text = item.text.trim()
  const id = base?.id ?? crypto.randomUUID()
  switch (item.type) {
    case 'heading': {
      const level = [1, 2, 3].includes(item.level) ? item.level : base ? headingLevel(base) : 1
      return { id, type: 'heading', text, level }
    }
    case 'bullet':
    case 'numbered':
      return { id, type: item.type, text, ...(item.indent === 1 ? { indent: 1 } : {}) }
    case 'todo':
      return { id, type: 'todo', text, done: base?.type === 'todo' ? base.done : item.done === true }
    case 'callout': {
      const tone = CALLOUT_TONES.includes(item.tone) ? item.tone : (base?.tone ?? 'info')
      // A hand-picked emoji stays while the tone does; otherwise the tone's own.
      const emoji = base?.type === 'callout' && base.tone === tone ? base.emoji : CALLOUT_EMOJI[tone]
      return { id, type: 'callout', text, tone, emoji }
    }
    default:
      return { id, type: item.type, text }
  }
}

// The model's blocks turned back into note blocks, checked with the same rules as a save.
// { blocks } or { problem: 'code' } (code changed, lost or made up) or { problem: 'invalid' }.
export function resolveBlocks(items, scope) {
  if (!Array.isArray(items) || items.length === 0 || items.length > NOTE_LIMITS.blocks) return { problem: 'invalid' }
  const byRef = new Map(scope.map((block, index) => [`k${index + 1}`, block]))
  // Same count and types in the same order: the model only rewrote the words, so ids stay.
  const sameShape = items.length === scope.length && items.every((item, index) => item?.type === scope[index].type)
  const used = new Set()
  const blocks = []
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== 'object' || !isText(item.type)) return { problem: 'invalid' }
    if (item.type === 'divider') {
      blocks.push(sameShape ? scope[index] : { id: crypto.randomUUID(), type: 'divider' })
      continue
    }
    if (FIXED.includes(item.type)) {
      let original = byRef.get(item.ref)
      // A code block copied out without its ref still counts when its text is one of the note's, as is.
      if (original?.type !== item.type && item.type === 'code' && isText(item.text)) {
        original = scope.find((block) => block.type === 'code' && block.text === item.text && !used.has(block.id))
      }
      if (original?.type !== item.type) return { problem: item.type === 'code' ? 'code' : 'invalid' }
      // The model may leave the text out (the ref brings it back) but never send it changed.
      if (item.type === 'code' && isText(item.text) && item.text !== '' && item.text !== original.text) return { problem: 'code' }
      used.add(original.id)
      blocks.push(original)
      continue
    }
    const block = writtenBlock(item, sameShape ? scope[index] : null)
    const cleaned = block && cleanBlock(block)
    if (!cleaned || typeof cleaned === 'string') return { problem: 'invalid' }
    blocks.push(cleaned)
  }
  if (!keepsCode(scope, blocks)) return { problem: 'code' }
  if (!sameItems(caseIds(scope), caseIds(blocks))) return { problem: 'invalid' }
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) return { problem: 'invalid' }
  return { blocks }
}

// "Summarize": one callout on top with the summary, then the blocks exactly as they were.
export function summaryBlocks(summary, scope, language) {
  if (!isText(summary) || summary.trim() === '') return { problem: 'invalid' }
  const label = language === 'pt-BR' ? 'Resumo' : 'Summary'
  const text = `**${label}:** ${summary.trim()}`
  const callout = cleanBlock({ id: crypto.randomUUID(), type: 'callout', text, tone: 'info', emoji: '📝' })
  if (typeof callout === 'string') return { problem: 'invalid' }
  return { blocks: [callout, ...scope] }
}

// Words that only one of the two languages uses much. Short words both share ("a", "as", "do",
// "no", "se") are left out, and so is code: identifiers are English in any note.
const PT_WORDS = new Set(
  'não nao você voce é está esta isso isto para com uma um que de da dos das em na nas nos por mais como também tambem quando porque mas ele ela muito sem ao aos foi ser tem são sao já ja aqui então entao depois antes sobre pelo pela quero preciso usar funciona erro'.split(' '),
)
const EN_WORDS = new Set('the and is are you with for this that of to in it not when because how also but if was be have has from on at an my what why then before after about so use works need'.split(' '))
const ACCENT = /[ãõçáéíóúâêôà]/

// 'pt-BR', 'en', or null when the writing doesn't say clearly.
export function noteLanguage(blocks, title = '') {
  const words = [title, ...blocks.filter((block) => REWRITABLE.includes(block.type)).map((block) => block.text)]
    .join(' ')
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  let pt = 0
  let en = 0
  for (const word of words) {
    if (PT_WORDS.has(word) || ACCENT.test(word)) pt += 1
    else if (EN_WORDS.has(word)) en += 1
  }
  if (pt >= 2 && pt > en * 1.5) return 'pt-BR'
  if (en >= 2 && en > pt * 1.5) return 'en'
  return null
}
