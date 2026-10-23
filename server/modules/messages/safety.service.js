import { MESSAGE_LIMITS, MESSAGE_POLICIES, REPORT_REASONS } from '../../../shared/messages.js'
import { normalizeHandle } from '../../../shared/profile.js'
import { badRequest, forbidden, notFound, tooLarge } from '../../core/errors.js'
import { canReadCommunity } from '../communities/communities.access.js'
import { refuseDemo } from './messages.model.js'

const NO_MESSAGE = 'Message not found.'

// "Who can message me": { allowMessages }.
export async function getSettings(store, user) {
  return { allowMessages: (await store.getMessaging(user.id))?.allowMessages ?? 'everyone' }
}

export async function saveSettings(store, user, input) {
  if (!MESSAGE_POLICIES.includes(input?.allowMessages)) throw badRequest('Pick who can message you.')
  const saved = await store.setMessagePolicy(user.id, input.allowMessages)
  if (!saved) throw notFound('Account not found.')
  return { allowMessages: saved }
}

// The person to block: { handle } (a public profile) or { conversationId } (one of my conversations,
// for someone whose profile went private).
async function targetOf(store, user, input) {
  if (typeof input?.conversationId === 'string' && input.conversationId.length <= 64) {
    const conversation = await store.getConversation(input.conversationId)
    if (!conversation?.memberIds.includes(user.id)) throw notFound('Conversation not found.')
    return { userId: conversation.memberIds.find((id) => id !== user.id) ?? user.id, conversationId: conversation.id }
  }
  const handle = typeof input?.handle === 'string' ? normalizeHandle(input.handle) : ''
  if (!handle || handle.length > 40) throw badRequest()
  const found = await store.findPublicProfile(handle)
  if (!found) throw notFound('No public profile here.')
  return { userId: found.userId, conversationId: (await store.findConversationBetween(user.id, found.userId))?.id ?? null }
}

// Blocks both ways: neither of us can message the other, and their messages hide from me.
export async function block(store, user, input) {
  refuseDemo(user)
  const target = await targetOf(store, user, input)
  if (target.userId === user.id) throw badRequest("You can't block yourself.")
  await store.addBlock(user.id, target.userId)
  // What they sent before the block no longer counts as news.
  if (target.conversationId) await store.markConversationRead(target.conversationId, user.id)
  return { blocked: true }
}

export async function unblock(store, user, input) {
  refuseDemo(user)
  const target = await targetOf(store, user, input)
  await store.removeBlock(user.id, target.userId)
  return { blocked: false }
}

// The reported message, if I may see it: { message, ownerId }.
async function reportedMessage(store, user, kind, messageId) {
  if (kind === 'dm') {
    const message = await store.getMessage(messageId)
    const conversation = message && (await store.getConversation(message.conversationId))
    if (!conversation?.memberIds.includes(user.id)) throw notFound(NO_MESSAGE)
    return message
  }
  const message = await store.getCommunityMessage(messageId)
  const community = message && (await store.getCommunityById(message.communityId))
  const membership = community && (await store.getCommunityMember(community.id, user.id))
  if (!community || !canReadCommunity(community, membership)) throw notFound(NO_MESSAGE)
  return message
}

// { kind: 'dm' | 'community', messageId, reason, note? }: kept with a copy of the text for review.
// Reporting the same message twice is fine; it's stored once.
export async function report(store, user, input) {
  refuseDemo(user, 'Sign up to report messages.')
  const { kind, messageId, reason } = input ?? {}
  if (!['dm', 'community'].includes(kind) || typeof messageId !== 'string' || !messageId || messageId.length > 64) throw badRequest()
  if (!REPORT_REASONS.includes(reason)) throw badRequest('Pick a reason for the report.')
  const note = typeof input.note === 'string' ? input.note.trim() : ''
  if (input.note !== undefined && typeof input.note !== 'string') throw badRequest()
  if (note.length > MESSAGE_LIMITS.reportNote) throw tooLarge(`Too long. Keep the note under ${MESSAGE_LIMITS.reportNote + 1} characters.`)
  const message = await reportedMessage(store, user, kind, messageId)
  if (message.senderId === user.id) throw forbidden("You can't report your own message.")
  await store.createReport({ reporterId: user.id, reportedUserId: message.senderId, kind, messageId: message.id, reason, note, snapshot: message.body })
  return { reported: true }
}
