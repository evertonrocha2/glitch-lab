// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// Postgres unique_violation: another request made the same row in between.
const UNIQUE_VIOLATION = '23505'
const PREVIEW = 200

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

function counted({ count, error }) {
  if (error?.code === INVALID_UUID) return 0
  if (error) throw new Error(`Supabase: ${error.message}`)
  return count ?? 0
}

const pairKey = (a, b) => [a, b].sort().join(':')

const toConversation = (row) =>
  row && { id: row.id, memberIds: [...row.member_ids].sort(), createdAt: row.created_at, lastMessageAt: row.last_message_at ?? null }

export const toChatMessage = (row, place) =>
  row && { id: row.id, [place]: row[place === 'conversationId' ? 'conversation_id' : 'community_id'], senderId: row.sender_id, body: row.body, createdAt: row.created_at }

const toMessage = (row) => toChatMessage(row, 'conversationId')

const toReport = (row) =>
  row && {
    id: row.id,
    reporterId: row.reporter_id,
    reportedUserId: row.reported_user_id ?? null,
    kind: row.kind,
    messageId: row.message_id,
    reason: row.reason,
    note: row.note,
    snapshot: row.snapshot,
    status: row.status,
    createdAt: row.created_at,
  }

// A page of chat rows (messages or community_messages) for one place, oldest first: the newest
// `limit` before `before`, or the first `limit` after `after`.
export async function chatPage(query, { before, after, limit = 50 }) {
  if (after) return unwrap(await query.gt('created_at', after).order('created_at', { ascending: true }).limit(limit)) ?? []
  const scoped = before ? query.lt('created_at', before) : query
  return (unwrap(await scoped.order('created_at', { ascending: false }).limit(limit)) ?? []).reverse()
}

// Direct messages, blocks, reports and "who can message me" on Supabase. Spread into createSupabaseStore.
export function createSupabaseMessaging(db) {
  const findByPair = async (key) => toConversation(unwrap(await db.from('conversations').select('*').eq('pair_key', key).maybeSingle()))

  return {
    async getMessaging(userId) {
      const row = unwrap(await db.from('users').select('allow_messages, is_demo').eq('id', userId).maybeSingle())
      return row ? { allowMessages: row.allow_messages ?? 'everyone', isDemo: Boolean(row.is_demo) } : null
    },

    async setMessagePolicy(userId, allowMessages) {
      const row = unwrap(await db.from('users').update({ allow_messages: allowMessages }).eq('id', userId).select('allow_messages').maybeSingle())
      return row ? row.allow_messages : null
    },

    async addBlock(blockerId, blockedId) {
      unwrap(await db.from('blocks').upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }))
      return true
    },

    async removeBlock(blockerId, blockedId) {
      const rows = unwrap(await db.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId).select('blocker_id'))
      return (rows ?? []).length > 0
    },

    async blockState(a, b) {
      const rows = unwrap(await db.from('blocks').select('blocker_id').or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)) ?? []
      return { blocked: rows.some((row) => row.blocker_id === a), blockedBy: rows.some((row) => row.blocker_id === b) }
    },

    async listBlockedIds(userId) {
      const rows = unwrap(await db.from('blocks').select('blocked_id').eq('blocker_id', userId))
      return (rows ?? []).map((row) => row.blocked_id)
    },

    async findConversationBetween(a, b) {
      return findByPair(pairKey(a, b))
    },

    async openConversation(a, b) {
      const key = pairKey(a, b)
      const existing = await findByPair(key)
      if (existing) return existing
      const inserted = await db.from('conversations').insert({ pair_key: key, member_ids: [a, b].sort() }).select().single()
      // Both people opened it at the same moment: the other request's row wins.
      if (inserted.error?.code === UNIQUE_VIOLATION) return findByPair(key)
      const conversation = toConversation(unwrap(inserted))
      const members = conversation.memberIds.map((userId) => ({ conversation_id: conversation.id, user_id: userId }))
      unwrap(await db.from('conversation_members').upsert(members, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }))
      return conversation
    },

    async getConversation(id) {
      return toConversation(unwrap(await db.from('conversations').select('*').eq('id', id).maybeSingle()))
    },

    async listConversations(userId, limit = 50) {
      const rows = unwrap(
        await db
          .from('conversation_members')
          .select('last_read_at, unread, last_message_at, conversations(*)')
          .eq('user_id', userId)
          .not('last_message_at', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(limit),
      )
      return (rows ?? [])
        .filter((row) => row.conversations)
        .map((row) => ({
          ...toConversation(row.conversations),
          lastMessage: { senderId: row.conversations.last_sender_id, body: row.conversations.last_message_body, createdAt: row.conversations.last_message_at },
          lastReadAt: row.last_read_at ?? null,
          unread: row.unread,
        }))
    },

    async countUnreadConversations(userId) {
      return counted(await db.from('conversation_members').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('unread', true))
    },

    async markConversationRead(conversationId, userId) {
      const rows = unwrap(
        await db
          .from('conversation_members')
          .update({ unread: false, last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', userId)
          .select('user_id'),
      )
      return (rows ?? []).length > 0
    },

    async createMessage(conversationId, senderId, body) {
      const message = toMessage(unwrap(await db.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, body }).select().single()))
      if (!message) return null
      const at = message.createdAt
      // Sending marks it read for the sender and unread for the other person.
      await Promise.all([
        db
          .from('conversations')
          .update({ last_message_at: at, last_sender_id: senderId, last_message_body: body.slice(0, PREVIEW) })
          .eq('id', conversationId)
          .then(unwrap),
        db.from('conversation_members').update({ last_message_at: at, last_read_at: at, unread: false }).eq('conversation_id', conversationId).eq('user_id', senderId).then(unwrap),
        db.from('conversation_members').update({ last_message_at: at, unread: true }).eq('conversation_id', conversationId).neq('user_id', senderId).then(unwrap),
      ])
      return message
    },

    async listMessages(conversationId, cursor = {}) {
      return (await chatPage(db.from('messages').select('*').eq('conversation_id', conversationId), cursor)).map(toMessage)
    },

    async getMessage(id) {
      return toMessage(unwrap(await db.from('messages').select('*').eq('id', id).maybeSingle()))
    },

    async createReport({ reporterId, reportedUserId, kind, messageId, reason, note = '', snapshot = '' }) {
      const inserted = await db
        .from('reports')
        .insert({ reporter_id: reporterId, reported_user_id: reportedUserId ?? null, kind, message_id: messageId, reason, note, snapshot })
        .select()
        .single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      return toReport(unwrap(inserted))
    },

    async listReports(limit = 50) {
      const rows = unwrap(await db.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(limit))
      return (rows ?? []).map(toReport)
    },
  }
}
