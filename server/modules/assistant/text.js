// Small text helpers shared by the assistant's prompts and context loaders.
import { fenceData } from '../../infra/ai/guard/fence.js'
import { pageName } from './guide.js'

export function clip(value, max) {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text
}

export const firstLines = (value, count) => String(value ?? '').split('\n').slice(0, count).join('\n')

// Wraps student content in a data fence that carries the request's random boundary token, so the
// content can't close it early (see infra/ai/guard/fence.js).
export const fence = (tag, content, boundary) => fenceData(tag, content, boundary)

const SPEAKER = { user: 'Student', assistant: 'Assistant' }

// The chat so far, oldest first. Each message is its own data block and the speaker sits outside
// it, set by the server from the role, so a message can't pass itself off as another turn.
export function conversationBlock(messages, boundary) {
  return messages.map((item) => `${SPEAKER[item.role]}:\n${fence('message', clip(item.content, 2000), boundary)}`).join('\n\n')
}

// "Current page: /board (Board; open case: c1)", so "here", "this case" and "this note" can be resolved.
export function describePage(page) {
  const details = [
    pageName(page.path),
    page.caseId && `open case: ${page.caseId}`,
    page.noteId && `open note: ${page.noteId}`,
    page.challengeId && `open gym challenge: ${page.challengeId}`,
  ].filter(Boolean)
  return `Current page: ${page.path}${details.length ? ` (${details.join('; ')})` : ''}`
}
