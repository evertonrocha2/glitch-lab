import { ASSISTANT_LIMITS } from '../../../shared/assistant.js'

// Kept for the browser session only, one conversation per signed-in user.
const keyFor = (userId) => `gd:assistant:${userId}`
const KEEP = 40

export function loadConversation(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(keyFor(userId)))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function saveConversation(userId, messages) {
  try {
    if (messages.length) sessionStorage.setItem(keyFor(userId), JSON.stringify(messages.slice(-KEEP)))
    else sessionStorage.removeItem(keyFor(userId))
  } catch {
    // Storage blocked: the chat still works, it just won't survive a reload.
  }
}

// What the API accepts: the last messages, role and text only, each under the limit.
export const toApiMessages = (messages) =>
  messages.slice(-ASSISTANT_LIMITS.messages).map((item) => ({ role: item.role, content: item.content.slice(0, ASSISTANT_LIMITS.content) }))

// The page the question was asked on, so "this case" or "this note" means something.
// `focus` is what a page reported (the board's open case).
export function pageFromLocation(pathname, focus) {
  const page = { path: pathname }
  const gym = /^\/gym\/([^/]+)$/.exec(pathname)
  const note = /^\/notes\/([^/]+)$/.exec(pathname)
  const interrogation = /^\/interrogate\/([^/]+)$/.exec(pathname)
  if (gym) page.challengeId = gym[1]
  if (note) page.noteId = note[1]
  if (interrogation) page.caseId = interrogation[1]
  if (focus?.caseId) page.caseId = focus.caseId
  return page
}

const FENCE = /^```/
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/

// Reply text as blocks: paragraphs, "- " lists and ``` code blocks. Rendered as React text, never as HTML.
export function parseReply(text) {
  const blocks = []
  const lines = String(text ?? '').split('\n')
  let paragraph = []
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
    paragraph = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE.test(line.trim())) {
      flush()
      const code = []
      while (++i < lines.length && !FENCE.test(lines[i].trim())) code.push(lines[i])
      blocks.push({ type: 'code', text: code.join('\n') })
    } else if (LIST_ITEM.test(line)) {
      flush()
      const items = [line.replace(LIST_ITEM, '')]
      while (i + 1 < lines.length && LIST_ITEM.test(lines[i + 1])) items.push(lines[++i].replace(LIST_ITEM, ''))
      blocks.push({ type: 'list', items })
    } else if (line.trim() === '') {
      flush()
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return blocks
}

// `code` and **bold** inside a line.
export function parseInline(text) {
  const tokens = []
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) })
    tokens.push(match[1] !== undefined ? { type: 'code', text: match[1] } : { type: 'strong', text: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) })
  return tokens
}
