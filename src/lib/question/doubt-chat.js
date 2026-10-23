import { QUESTION_LIMITS } from '../../../shared/question.js'

// "Ask a question": the chat lives in the browser session, one per signed-in user, and the whole
// history goes with each turn (the API cuts it down to what the tutor reads).
const keyFor = (userId) => `gd:doubt:${userId}`

export function loadChat(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(keyFor(userId)))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function saveChat(userId, messages) {
  try {
    if (messages.length) sessionStorage.setItem(keyFor(userId), JSON.stringify(messages))
    else sessionStorage.removeItem(keyFor(userId))
  } catch {
    // Storage blocked: the chat still works, it just won't survive a reload.
  }
}

// Questions the student asked in this chat.
export const turnsUsed = (messages) => messages.filter((item) => item.role === 'user').length
export const atTurnCap = (messages) => turnsUsed(messages) >= QUESTION_LIMITS.turns

// What the API accepts: role and text, the code pasted with a question, and the topic of a card
// the chat showed (so the tutor doesn't propose it again). A stopped answer with no text is left out.
export const toApiMessages = (messages) =>
  messages
    .filter((item) => item.role === 'user' || item.content.trim())
    .map((item) => {
      const clean = { role: item.role, content: item.content.slice(0, QUESTION_LIMITS.message) }
      if (item.role === 'user' && item.code) clean.code = item.code.slice(0, QUESTION_LIMITS.code)
      if (item.role === 'assistant' && item.card) clean.cardTopic = item.card.topic
      return clean
    })
