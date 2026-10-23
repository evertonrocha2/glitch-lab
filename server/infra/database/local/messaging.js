import { randomUUID } from 'node:crypto'

const copy = (value) => (value == null ? null : structuredClone(value))
const PREVIEW = 200

// Message times only ever go forward, even within one millisecond, so "before" and "after"
// cursors never skip a message sent in the same instant as another.
let lastStamp = 0
export function stamp() {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return new Date(lastStamp).toISOString()
}

// Newest `limit` items before `before` (or the newest overall), oldest first; with `after`, the
// first `limit` items after it. Items are kept in time order.
export function page(items, { before, after, limit = 50 }) {
  if (after) return items.filter((item) => item.createdAt > after).slice(0, limit)
  const older = before ? items.filter((item) => item.createdAt < before) : items
  return older.slice(Math.max(0, older.length - limit))
}

const pairKey = (a, b) => [a, b].sort().join(':')

const toConversation = (item) => ({ id: item.id, memberIds: [...item.memberIds], createdAt: item.createdAt, lastMessageAt: item.lastMessageAt ?? null })

// Direct messages, blocks, reports and "who can message me" for the JSON file store.
// Spread into createLocalStore, sharing its load and save.
export function createLocalMessaging({ load, save }) {
  // Files saved before messages existed don't have these lists yet.
  const lists = (data) => {
    data.conversations ??= []
    data.conversationMembers ??= []
    data.messages ??= []
    data.blocks ??= []
    data.reports ??= []
    return data
  }
  const memberRow = (data, conversationId, userId) =>
    lists(data).conversationMembers.find((item) => item.conversationId === conversationId && item.userId === userId)

  return {
    // { allowMessages, isDemo } for an account, or null when there is no such account.
    async getMessaging(userId) {
      const found = (await load()).users?.find((user) => user.id === userId)
      return found ? { allowMessages: found.allowMessages ?? 'everyone', isDemo: Boolean(found.isDemo) } : null
    },

    async setMessagePolicy(userId, allowMessages) {
      const found = (await load()).users?.find((user) => user.id === userId)
      if (!found) return null
      found.allowMessages = allowMessages
      await save()
      return allowMessages
    },

    async addBlock(blockerId, blockedId) {
      const data = lists(await load())
      if (!data.blocks.some((item) => item.blockerId === blockerId && item.blockedId === blockedId)) {
        data.blocks.push({ blockerId, blockedId, createdAt: new Date().toISOString() })
        await save()
      }
      return true
    },

    async removeBlock(blockerId, blockedId) {
      const data = lists(await load())
      const before = data.blocks.length
      data.blocks = data.blocks.filter((item) => !(item.blockerId === blockerId && item.blockedId === blockedId))
      if (data.blocks.length === before) return false
      await save()
      return true
    },

    // { blocked: a blocked b, blockedBy: b blocked a }
    async blockState(a, b) {
      const { blocks } = lists(await load())
      return {
        blocked: blocks.some((item) => item.blockerId === a && item.blockedId === b),
        blockedBy: blocks.some((item) => item.blockerId === b && item.blockedId === a),
      }
    },

    async listBlockedIds(userId) {
      return lists(await load())
        .blocks.filter((item) => item.blockerId === userId)
        .map((item) => item.blockedId)
    },

    async findConversationBetween(a, b) {
      const found = lists(await load()).conversations.find((item) => item.pairKey === pairKey(a, b))
      return found ? toConversation(found) : null
    },

    // The one conversation between two people, made on first use.
    async openConversation(a, b) {
      const data = lists(await load())
      const key = pairKey(a, b)
      let found = data.conversations.find((item) => item.pairKey === key)
      if (!found) {
        found = { id: randomUUID(), pairKey: key, memberIds: [a, b].sort(), createdAt: stamp(), lastMessageAt: null, lastSenderId: null, lastBody: null }
        data.conversations.push(found)
        for (const userId of found.memberIds) {
          data.conversationMembers.push({ conversationId: found.id, userId, lastReadAt: null, unread: false, lastMessageAt: null })
        }
        await save()
      }
      return toConversation(found)
    },

    async getConversation(id) {
      const found = lists(await load()).conversations.find((item) => item.id === id)
      return found ? toConversation(found) : null
    },

    // My conversations that have messages, the latest first, with the last message and my unread mark.
    async listConversations(userId, limit = 50) {
      const data = lists(await load())
      return data.conversationMembers
        .filter((item) => item.userId === userId && item.lastMessageAt)
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
        .slice(0, limit)
        .map((member) => {
          const found = data.conversations.find((item) => item.id === member.conversationId)
          return {
            ...toConversation(found),
            lastMessage: { senderId: found.lastSenderId, body: found.lastBody, createdAt: found.lastMessageAt },
            lastReadAt: member.lastReadAt,
            unread: member.unread,
          }
        })
    },

    async countUnreadConversations(userId) {
      return lists(await load()).conversationMembers.filter((item) => item.userId === userId && item.unread).length
    },

    async markConversationRead(conversationId, userId) {
      const found = memberRow(await load(), conversationId, userId)
      if (!found) return false
      found.unread = false
      found.lastReadAt = new Date().toISOString()
      await save()
      return true
    },

    // Sending marks the conversation read for the sender and unread for the other person.
    async createMessage(conversationId, senderId, body) {
      const data = lists(await load())
      const conversation = data.conversations.find((item) => item.id === conversationId)
      if (!conversation) return null
      const created = { id: randomUUID(), conversationId, senderId, body, createdAt: stamp() }
      data.messages.push(created)
      Object.assign(conversation, { lastMessageAt: created.createdAt, lastSenderId: senderId, lastBody: body.slice(0, PREVIEW) })
      for (const member of data.conversationMembers.filter((item) => item.conversationId === conversationId)) {
        member.lastMessageAt = created.createdAt
        if (member.userId === senderId) Object.assign(member, { unread: false, lastReadAt: created.createdAt })
        else member.unread = true
      }
      await save()
      return copy(created)
    },

    async listMessages(conversationId, cursor = {}) {
      const mine = lists(await load()).messages.filter((item) => item.conversationId === conversationId)
      return copy(page(mine, cursor))
    },

    async getMessage(id) {
      return copy(lists(await load()).messages.find((item) => item.id === id))
    },

    // One report per person and message: null when this one was already sent.
    async createReport({ reporterId, reportedUserId, kind, messageId, reason, note = '', snapshot = '' }) {
      const data = lists(await load())
      if (data.reports.some((item) => item.reporterId === reporterId && item.kind === kind && item.messageId === messageId)) return null
      const created = { id: randomUUID(), reporterId, reportedUserId, kind, messageId, reason, note, snapshot, status: 'open', createdAt: new Date().toISOString() }
      data.reports.push(created)
      await save()
      return copy(created)
    },

    // Open reports, newest first, for whoever reviews them.
    async listReports(limit = 50) {
      return copy(
        lists(await load())
          .reports.filter((item) => item.status === 'open')
          .reverse()
          .slice(0, limit),
      )
    },
  }
}
