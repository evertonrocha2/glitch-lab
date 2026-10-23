import { MESSAGE_LIMITS } from '../../../shared/messages.js'
import { normalizeHandle } from '../../../shared/profile.js'
import { serverDay } from '../../core/days.js'
import { badRequest, forbidden, notFound, tooMany } from '../../core/errors.js'
import { loadPeople } from '../articles/people.js'
import { parseCursor, parseMessageBody, refuseDemo, spendMessage, trimPage, UNAVAILABLE, YOU_BLOCKED } from './messages.model.js'

const NO_PROFILE = 'No public profile here.'
const NO_CONVERSATION = 'Conversation not found.'

// Why I can't message someone right now, or null when I can. A block the other person made reads
// like "not taking messages", so nobody learns they were blocked.
export async function messageBlocker(store, user, otherId) {
  if (user.id === otherId) return 'self'
  if (user.isDemo) return 'demo'
  const other = await store.getMessaging(otherId)
  if (!other || other.isDemo || other.allowMessages === 'nobody') return 'unavailable'
  const { blocked, blockedBy } = await store.blockState(user.id, otherId)
  if (blocked) return 'blocked'
  return blockedBy ? 'unavailable' : null
}

const REFUSALS = { self: "You can't message yourself.", demo: 'Sign up to send messages.', blocked: YOU_BLOCKED, unavailable: UNAVAILABLE }

const otherOf = (conversation, userId) => conversation.memberIds.find((id) => id !== userId) ?? userId

// The conversation, if I'm in it. Anyone else gets the same "not found" as for a made-up id.
async function myConversation(store, user, id) {
  const conversation = typeof id === 'string' && id.length <= 64 ? await store.getConversation(id) : null
  if (!conversation?.memberIds.includes(user.id)) throw notFound(NO_CONVERSATION)
  return conversation
}

async function conversationView(store, user, conversation, people) {
  const otherId = otherOf(conversation, user.id)
  const reason = await messageBlocker(store, user, otherId)
  return { id: conversation.id, other: people[otherId], blocked: reason === 'blocked', canSend: reason === null, reason }
}

const messageView = (message, people, userId) => ({
  id: message.id,
  body: message.body,
  mine: message.senderId === userId,
  sender: people[message.senderId],
  createdAt: message.createdAt,
})

// A public profile's account id from a handle, or a 404.
async function userIdForHandle(store, rawHandle) {
  const handle = typeof rawHandle === 'string' ? normalizeHandle(rawHandle) : ''
  if (!handle || handle.length > 40) throw badRequest()
  const found = await store.findPublicProfile(handle)
  if (!found) throw notFound(NO_PROFILE)
  return found.userId
}

// For the "Send message" button on a profile: { canMessage, reason, blocked, conversationId }.
export async function messagingWith(store, user, rawHandle) {
  const otherId = await userIdForHandle(store, rawHandle)
  const reason = await messageBlocker(store, user, otherId)
  const existing = reason === 'self' ? null : await store.findConversationBetween(user.id, otherId)
  return { canMessage: reason === null, reason, blocked: reason === 'blocked', conversationId: existing?.id ?? null }
}

// { handle }: opens (or reopens) my conversation with that person.
export async function startConversation(store, user, input) {
  refuseDemo(user)
  const otherId = await userIdForHandle(store, input?.handle)
  const reason = await messageBlocker(store, user, otherId)
  if (reason) throw forbidden(REFUSALS[reason])
  let conversation = await store.findConversationBetween(user.id, otherId)
  if (!conversation) {
    const started = await store.addUsage(`conversations:${user.id}`, serverDay())
    if (started > MESSAGE_LIMITS.newConversationsPerDay) {
      throw tooMany(`You can start ${MESSAGE_LIMITS.newConversationsPerDay} new conversations a day. Come back tomorrow.`)
    }
    conversation = await store.openConversation(user.id, otherId)
  }
  const people = await loadPeople(store, conversation.memberIds)
  return conversationView(store, user, conversation, people)
}

// My inbox, latest first: { conversations, unread } (unread: how many conversations have news).
export async function listConversations(store, user) {
  const [items, unread, blockedIds] = await Promise.all([
    store.listConversations(user.id),
    store.countUnreadConversations(user.id),
    store.listBlockedIds(user.id),
  ])
  const people = await loadPeople(store, items.flatMap((item) => item.memberIds))
  const blocked = new Set(blockedIds)
  const conversations = items.map((item) => {
    const otherId = otherOf(item, user.id)
    const hidden = blocked.has(otherId)
    const last = item.lastMessage
    return {
      id: item.id,
      other: people[otherId],
      blocked: hidden,
      // Someone I blocked: their words don't show, not even in the preview.
      lastMessage: last && !(hidden && last.senderId === otherId) ? { body: last.body, mine: last.senderId === user.id, createdAt: last.createdAt } : null,
      lastMessageAt: item.lastMessageAt,
      unread: item.unread && !hidden,
    }
  })
  return { conversations, unread }
}

export async function unreadCount(store, user) {
  return { unread: await store.countUnreadConversations(user.id) }
}

// { conversation, messages (oldest first), hasMore } for ?before= / ?after= cursors.
export async function listMessages(store, user, id, query) {
  const cursor = parseCursor(query)
  const conversation = await myConversation(store, user, id)
  const [raw, blockedIds, people] = await Promise.all([
    store.listMessages(conversation.id, { ...cursor, limit: MESSAGE_LIMITS.pageSize + 1 }),
    store.listBlockedIds(user.id),
    loadPeople(store, conversation.memberIds),
  ])
  const { items, hasMore } = trimPage(raw, cursor)
  const blocked = new Set(blockedIds)
  return {
    conversation: await conversationView(store, user, conversation, people),
    messages: items.filter((item) => !blocked.has(item.senderId)).map((item) => messageView(item, people, user.id)),
    hasMore,
  }
}

// { body }: a message in my conversation. The other person hears about it in the bell.
export async function sendMessage(store, user, id, input) {
  refuseDemo(user)
  const body = parseMessageBody(input)
  const conversation = await myConversation(store, user, id)
  const otherId = otherOf(conversation, user.id)
  const reason = await messageBlocker(store, user, otherId)
  if (reason) throw forbidden(REFUSALS[reason])
  await spendMessage(store, user)
  const message = await store.createMessage(conversation.id, user.id, body)
  await store.addNotification({ userId: otherId, type: 'message', actorId: user.id })
  const people = await loadPeople(store, [user.id])
  return messageView(message, people, user.id)
}

// Answers with how many conversations are still unread.
export async function markRead(store, user, id) {
  const conversation = await myConversation(store, user, id)
  await store.markConversationRead(conversation.id, user.id)
  return unreadCount(store, user)
}
