import { cleanBody, MESSAGE_LIMITS } from '../../../shared/messages.js'
import { serverDay } from '../../core/days.js'
import { badRequest, forbidden, tooLarge, tooMany } from '../../core/errors.js'

// Rules every chat shares: DMs and community chats.
export const DEMO_MESSAGES = 'Sign up to send messages.'
export const UNAVAILABLE = "This person isn't taking messages right now."
export const YOU_BLOCKED = 'You blocked this person. Unblock them to send a message.'

// { body } from the client: trimmed, plain text, 1 to MESSAGE_LIMITS.body characters.
export function parseMessageBody(input) {
  if (typeof input?.body !== 'string') throw badRequest()
  const body = cleanBody(input.body)
  if (!body) throw badRequest('Write a message first.')
  if (body.length > MESSAGE_LIMITS.body) throw tooLarge(`Too long. Keep your message under ${MESSAGE_LIMITS.body + 1} characters.`)
  return body
}

// Server times only: Postgres sends microseconds and an offset, the JSON store milliseconds and Z.
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const timeOrNull = (value) => (typeof value === 'string' && TIME.test(value) && !Number.isNaN(Date.parse(value)) ? value : null)

// ?before= (older page) or ?after= (what's new since the last message I have).
export function parseCursor(query) {
  const first = (value) => (Array.isArray(value) ? value[0] : value)
  const before = first(query?.before)
  const after = first(query?.after)
  if ((before !== undefined && !timeOrNull(before)) || (after !== undefined && !timeOrNull(after))) throw badRequest()
  return { before: before ?? undefined, after: after ?? undefined }
}

// Counts one message against the per-minute and per-day limits (DMs and communities together).
// Each counter goes up first, then is checked, so two requests at once can't both slip under it.
export async function spendMessage(store, user, now = new Date()) {
  const day = serverDay(now)
  const minute = Math.floor(now.getTime() / 60_000)
  if ((await store.addUsage(`messages-minute:${user.id}:${minute}`, day)) > MESSAGE_LIMITS.perMinute) {
    throw tooMany(`You can send ${MESSAGE_LIMITS.perMinute} messages a minute. Wait a moment.`)
  }
  if ((await store.addUsage(`messages:${user.id}`, day)) > MESSAGE_LIMITS.perDay) {
    throw tooMany(`You can send ${MESSAGE_LIMITS.perDay} messages a day. Come back tomorrow.`)
  }
}

// A page of chat messages from the store, asked for one more than a page: { items, hasMore }.
// Going forward (after) never says there's more; the next check picks up the rest.
export function trimPage(items, cursor, size = MESSAGE_LIMITS.pageSize) {
  if (cursor.after) return { items: items.slice(0, size), hasMore: false }
  return { items: items.slice(Math.max(0, items.length - size)), hasMore: items.length > size }
}

export function refuseDemo(user, message = DEMO_MESSAGES) {
  if (user.isDemo) throw forbidden(message)
}
