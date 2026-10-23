// Direct messages and communities: rules shared by the API (which enforces them) and the pages
// (which hint at them).
// body: longest message. perMinute / perDay: messages one person may send, DMs and communities
// together. newConversationsPerDay: people you can start talking to in a day. ownedCommunities:
// communities one account may create. pageSize: messages per page of a chat.
export const MESSAGE_LIMITS = {
  body: 2000,
  // The composer starts counting down this close to the limit.
  counterFrom: 1800,
  perMinute: 20,
  perDay: 500,
  newConversationsPerDay: 20,
  ownedCommunities: 3,
  nameMin: 3,
  nameMax: 40,
  description: 300,
  topics: 3,
  query: 60,
  pageSize: 50,
  communitiesPerPage: 12,
  reportNote: 300,
}

// Who can start a conversation with me.
export const MESSAGE_POLICIES = ['everyone', 'nobody']

export const COMMUNITY_TOPICS = ['javascript', 'python', 'java', 'backend', 'frontend', 'data', 'career', 'study-group']

// The colors are the avatar colors; the icons are drawn by the community-badge component.
export const COMMUNITY_COLORS = ['violet', 'cobalt', 'grape', 'sky', 'ink']
export const COMMUNITY_ICONS = ['bug', 'code', 'chat', 'book', 'rocket', 'coffee', 'star', 'globe']

export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'other']

// "Café & Código JS!" -> "cafe-codigo-js". Empty when nothing usable is left.
export function slugify(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

// Line breaks and tabs kept, other control characters dropped, then trimmed.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g
export const cleanBody = (value) => String(value ?? '').replace(/\r\n?/g, '\n').replace(CONTROL, '').trim()

// Only http(s) links become links. Trailing punctuation that usually ends a sentence stays text.
const LINK = /\bhttps?:\/\/[^\s<>"'`]+/gi
const TRAILING = /[.,;:!?)\]}]+$/

// A message's text as pieces: { type: 'text', value } or { type: 'link', value, href }. The page
// renders each piece as a text node or an <a>, so no HTML ever comes from a message.
export function linkParts(value) {
  const text = String(value ?? '')
  const parts = []
  let last = 0
  for (const match of text.matchAll(LINK)) {
    const tail = match[0].match(TRAILING)?.[0] ?? ''
    const link = match[0].slice(0, match[0].length - tail.length)
    let href = null
    try {
      const url = new URL(link)
      if (url.protocol === 'http:' || url.protocol === 'https:') href = url.href
    } catch {
      href = null
    }
    if (!href) continue
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) })
    parts.push({ type: 'link', value: link, href })
    last = match.index + link.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
