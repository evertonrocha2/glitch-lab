import { ASSISTANT_LIMITS } from '../../../shared/assistant.js'

const INVALID = { status: 400, message: 'Invalid request.' }
const ROLES = ['user', 'assistant']
const PAGE_IDS = ['caseId', 'noteId', 'challengeId']
const isText = (value) => typeof value === 'string'

// Only a same-site path ("/board", "/gym/<id>"), never a full URL.
const isPath = (value) => isText(value) && value.length <= 200 && /^\/[\w\-/]*$/.test(value)
const isId = (value) => isText(value) && value !== '' && value.length <= 64

function cleanPage(page) {
  if (page === undefined) return { path: '/' }
  if (!page || typeof page !== 'object' || !isPath(page.path)) return null
  const clean = { path: page.path }
  for (const key of PAGE_IDS) {
    if (page[key] === undefined) continue
    if (!isId(page[key])) return null
    clean[key] = page[key]
  }
  return clean
}

// { value: { messages, page } } or { status, message }. Only the last messages are kept,
// rebuilt with just role and content, and the last one must be the student's question.
export function parseAssistantRequest(body) {
  if (!Array.isArray(body?.messages) || body.messages.length === 0) return INVALID
  const messages = []
  for (const item of body.messages.slice(-ASSISTANT_LIMITS.messages)) {
    if (!item || !ROLES.includes(item.role) || !isText(item.content)) return INVALID
    if (item.content.length > ASSISTANT_LIMITS.content) {
      return { status: 413, message: `Too long. Keep each message under ${ASSISTANT_LIMITS.content} characters.` }
    }
    messages.push({ role: item.role, content: item.content })
  }
  const last = messages.at(-1)
  if (last.role !== 'user' || last.content.trim() === '') return INVALID

  const page = cleanPage(body.page)
  if (!page) return INVALID
  return { value: { messages, page } }
}
