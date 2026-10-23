// Small text helpers shared by the assistant's prompts and context loaders.
import { pageName } from './guide.js'

export function clip(value, max) {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text
}

export const firstLines = (value, count) => String(value ?? '').split('\n').slice(0, count).join('\n')

// Wraps student content in tags the prompts call data. A student can't close the fence early:
// any copy of the tag inside the content is taken out.
export function fence(tag, content) {
  const clean = String(content ?? '').replace(new RegExp(`</?${tag}>`, 'gi'), '')
  return `<${tag}>\n${clean}\n</${tag}>`
}

const SPEAKER = { user: 'Student', assistant: 'Assistant' }

// The chat so far, oldest first, fenced off as data.
export function conversationBlock(messages) {
  return fence('conversation', messages.map((item) => `${SPEAKER[item.role]}: ${clip(item.content, 2000)}`).join('\n\n'))
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
