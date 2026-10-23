import { QUESTION_LIMITS } from '../../../shared/question.js'

const INVALID = { status: 400, message: 'Invalid request.' }
const ROLES = ['user', 'assistant']
const isText = (value) => typeof value === 'string'

export const turnCapMessage = () => `This chat reached its limit of ${QUESTION_LIMITS.turns} questions. Start a new chat to keep going.`

// One message rebuilt with only what the API reads: role and text, the code a student pasted
// with a question, and the topic of a card the tutor proposed in an answer.
function cleanMessage(item) {
  if (!item || !ROLES.includes(item.role) || !isText(item.content)) return INVALID
  if (item.content.length > QUESTION_LIMITS.message) {
    return { status: 413, message: `Too long. Keep each message under ${QUESTION_LIMITS.message} characters.` }
  }
  const clean = { role: item.role, content: item.content }
  if (item.role === 'user' && item.code !== undefined && item.code !== '') {
    if (!isText(item.code)) return INVALID
    if (item.code.length > QUESTION_LIMITS.code) return { status: 413, message: `Too long. Keep the code under ${QUESTION_LIMITS.code} characters.` }
    clean.code = item.code
  }
  if (item.role === 'assistant' && isText(item.cardTopic) && item.cardTopic.trim()) clean.cardTopic = item.cardTopic.trim().slice(0, QUESTION_LIMITS.cardTopic)
  return { value: clean }
}

// { value: { messages } } or { status, message }. The chat opens with the student's doubt; for a
// turn (endsWithUser) the last message is their new question. Past the turn cap: 409.
export function parseConversation(body, { endsWithUser = true } = {}) {
  const list = body?.messages
  if (!Array.isArray(list) || list.length === 0 || list.length > QUESTION_LIMITS.turns * 2) {
    if (Array.isArray(list) && list.filter((item) => item?.role === 'user').length > QUESTION_LIMITS.turns) return { status: 409, message: turnCapMessage() }
    return INVALID
  }
  const messages = []
  for (const item of list) {
    const clean = cleanMessage(item)
    if (!clean.value) return clean
    messages.push(clean.value)
  }
  if (messages[0].role !== 'user' || messages[0].content.trim() === '') return { status: 400, message: 'Write your question first.' }
  const last = messages.at(-1)
  if (endsWithUser && (last.role !== 'user' || last.content.trim() === '')) return INVALID
  if (messages.filter((item) => item.role === 'user').length > QUESTION_LIMITS.turns) return { status: 409, message: turnCapMessage() }
  return { value: { messages } }
}

const sizeOf = (item) => item.content.length + (item.code?.length ?? 0)

// What the tutor reads of a long chat: the opening doubt, then the newest messages that fit in
// `max` characters. { messages, dropped }: dropped counts the ones left out in between.
export function fitHistory(messages, max = QUESTION_LIMITS.history) {
  const [first, ...rest] = messages
  let room = max - sizeOf(first)
  const tail = []
  for (let index = rest.length - 1; index >= 0; index--) {
    const size = sizeOf(rest[index])
    // The newest message always goes in: it is what the tutor answers.
    if (size > room && tail.length) break
    tail.unshift(rest[index])
    room -= size
  }
  return { messages: [first, ...tail], dropped: rest.length - tail.length }
}
