import { cleanQuery } from '../../../../shared/community.js'
import { chatPage, toChatMessage } from './messaging.js'

// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// Postgres unique_violation: the slug (or the membership) is already there.
const UNIQUE_VIOLATION = '23505'
const ACTIVE = ['owner', 'member']

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

const toCommunity = (row) =>
  row && {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    topics: row.topics ?? [],
    color: row.color,
    icon: row.icon,
    isPrivate: row.is_private,
    ownerId: row.owner_id,
    memberCount: row.member_count,
    createdAt: row.created_at,
  }

const toMember = (row) => row && { userId: row.user_id, role: row.role, joinedAt: row.joined_at }
const toMessage = (row) => toChatMessage(row, 'communityId')

// Communities, their members and their chat on Supabase. Spread into createSupabaseStore.
export function createSupabaseCommunities(db) {
  // The count lives on the community row; one SQL function recounts it after every change.
  const recount = async (communityId) => unwrap(await db.rpc('refresh_community_member_count', { p_community: communityId }))

  return {
    async createCommunity(ownerId, { slug, name, description = '', topics = [], color, icon }) {
      const inserted = await db.from('communities').insert({ slug, name, description, topics, color, icon, owner_id: ownerId, member_count: 1 }).select().single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      const community = toCommunity(unwrap(inserted))
      unwrap(await db.from('community_members').insert({ community_id: community.id, user_id: ownerId, role: 'owner' }))
      return community
    },

    async getCommunity(slug) {
      return toCommunity(unwrap(await db.from('communities').select('*').eq('slug', slug).maybeSingle()))
    },

    async getCommunityById(id) {
      return toCommunity(unwrap(await db.from('communities').select('*').eq('id', id).maybeSingle()))
    },

    // q is cleaned down to letters, numbers and a few symbols, then quoted, so it can't change the filter.
    async searchCommunities({ q = '', topic = null, offset = 0, limit = 12 } = {}) {
      let query = db.from('communities').select('*')
      if (topic) query = query.contains('topics', [topic])
      const needle = cleanQuery(q)
      if (needle) {
        const pattern = `"%${needle}%"`
        query = query.or(`name.ilike.${pattern},description.ilike.${pattern},topics.cs.{"${needle.toLowerCase()}"}`)
      }
      // One extra row says whether there is another page.
      const rows =
        unwrap(await query.order('member_count', { ascending: false }).order('created_at', { ascending: false }).range(offset, offset + limit)) ?? []
      return { communities: rows.slice(0, limit).map(toCommunity), hasMore: rows.length > limit }
    },

    async listUserCommunities(userId) {
      const rows = unwrap(
        await db.from('community_members').select('joined_at, communities(*)').eq('user_id', userId).in('role', ACTIVE).order('joined_at', { ascending: false }),
      )
      return (rows ?? []).map((row) => toCommunity(row.communities)).filter(Boolean)
    },

    async countOwnedCommunities(userId) {
      const { count, error } = await db.from('communities').select('*', { count: 'exact', head: true }).eq('owner_id', userId)
      if (error) throw new Error(`Supabase: ${error.message}`)
      return count ?? 0
    },

    async getCommunityMember(communityId, userId) {
      return toMember(unwrap(await db.from('community_members').select('*').eq('community_id', communityId).eq('user_id', userId).maybeSingle()))
    },

    async joinCommunity(communityId, userId) {
      const inserted = await db.from('community_members').insert({ community_id: communityId, user_id: userId, role: 'member' }).select().single()
      if (inserted.error?.code !== UNIQUE_VIOLATION) {
        const row = unwrap(inserted)
        await recount(communityId)
        return toMember(row)
      }
      return toMember(unwrap(await db.from('community_members').select('*').eq('community_id', communityId).eq('user_id', userId).maybeSingle()))
    },

    async leaveCommunity(communityId, userId) {
      const rows = unwrap(await db.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId).eq('role', 'member').select('user_id'))
      if (!rows?.length) return false
      await recount(communityId)
      return true
    },

    async removeCommunityMember(communityId, userId) {
      const rows = unwrap(
        await db.from('community_members').update({ role: 'removed' }).eq('community_id', communityId).eq('user_id', userId).eq('role', 'member').select('user_id'),
      )
      if (!rows?.length) return false
      await recount(communityId)
      return true
    },

    async listCommunityMembers(communityId, limit = 200) {
      const rows = unwrap(
        await db.from('community_members').select('*').eq('community_id', communityId).in('role', ACTIVE).order('joined_at', { ascending: true }).limit(limit),
      )
      const members = (rows ?? []).map(toMember)
      return [...members.filter((item) => item.role === 'owner'), ...members.filter((item) => item.role !== 'owner')]
    },

    async createCommunityMessage(communityId, senderId, body) {
      return toMessage(unwrap(await db.from('community_messages').insert({ community_id: communityId, sender_id: senderId, body }).select().single()))
    },

    async listCommunityMessages(communityId, cursor = {}) {
      return (await chatPage(db.from('community_messages').select('*').eq('community_id', communityId), cursor)).map(toMessage)
    },

    async getCommunityMessage(id) {
      return toMessage(unwrap(await db.from('community_messages').select('*').eq('id', id).maybeSingle()))
    },

    async deleteCommunityMessage(id) {
      const rows = unwrap(await db.from('community_messages').delete().eq('id', id).select('id'))
      return (rows ?? []).length > 0
    },
  }
}
