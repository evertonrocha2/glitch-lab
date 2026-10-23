import { randomUUID } from 'node:crypto'
import { page, stamp } from './messaging.js'

const copy = (value) => (value == null ? null : structuredClone(value))
const ACTIVE = new Set(['owner', 'member'])
const toMember = (item) => ({ userId: item.userId, role: item.role, joinedAt: item.joinedAt })

// Communities, their members and their chat for the JSON file store. Spread into createLocalStore.
export function createLocalCommunities({ load, save }) {
  // Files saved before communities existed don't have these lists yet.
  const lists = (data) => {
    data.communities ??= []
    data.communityMembers ??= []
    data.communityMessages ??= []
    return data
  }
  const memberRow = (data, communityId, userId) =>
    lists(data).communityMembers.find((item) => item.communityId === communityId && item.userId === userId)

  // The count lives on the community, so lists can sort by it without adding it up.
  function recount(data, communityId) {
    const found = data.communities.find((item) => item.id === communityId)
    if (found) found.memberCount = data.communityMembers.filter((item) => item.communityId === communityId && ACTIVE.has(item.role)).length
  }

  function matches(item, needle) {
    if (!needle) return true
    const q = needle.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.topics.includes(q)
  }

  return {
    // null when the slug is taken. The owner is its first member.
    async createCommunity(ownerId, { slug, name, description = '', topics = [], color, icon }) {
      const data = lists(await load())
      if (data.communities.some((item) => item.slug === slug)) return null
      const created = {
        id: randomUUID(),
        slug,
        name,
        description,
        topics: [...topics],
        color,
        icon,
        isPrivate: false,
        ownerId,
        memberCount: 1,
        createdAt: new Date().toISOString(),
      }
      data.communities.push(created)
      data.communityMembers.push({ communityId: created.id, userId: ownerId, role: 'owner', joinedAt: created.createdAt })
      await save()
      return copy(created)
    },

    async getCommunity(slug) {
      return copy(lists(await load()).communities.find((item) => item.slug === slug))
    },

    async getCommunityById(id) {
      return copy(lists(await load()).communities.find((item) => item.id === id))
    },

    // Most members first, then the newest. q matches the name, description or an exact topic.
    async searchCommunities({ q = '', topic = null, offset = 0, limit = 12 } = {}) {
      const found = [...lists(await load()).communities]
        .reverse()
        .filter((item) => (!topic || item.topics.includes(topic)) && matches(item, q))
        .sort((a, b) => b.memberCount - a.memberCount)
      return { communities: copy(found.slice(offset, offset + limit)), hasMore: found.length > offset + limit }
    },

    // The ones I own or joined, the latest joined first.
    async listUserCommunities(userId) {
      const data = lists(await load())
      return data.communityMembers
        .filter((item) => item.userId === userId && ACTIVE.has(item.role))
        .reverse()
        .map((item) => copy(data.communities.find((community) => community.id === item.communityId)))
        .filter(Boolean)
    },

    async countOwnedCommunities(userId) {
      return lists(await load()).communities.filter((item) => item.ownerId === userId).length
    },

    // { userId, role, joinedAt } (role 'removed' for someone the owner removed), or null.
    async getCommunityMember(communityId, userId) {
      const found = memberRow(await load(), communityId, userId)
      return found ? toMember(found) : null
    },

    // Joins, or hands back the membership already there (a removed member stays removed).
    async joinCommunity(communityId, userId) {
      const data = lists(await load())
      let found = memberRow(data, communityId, userId)
      if (!found) {
        found = { communityId, userId, role: 'member', joinedAt: new Date().toISOString() }
        data.communityMembers.push(found)
        recount(data, communityId)
        await save()
      }
      return toMember(found)
    },

    // Only a plain member can leave; the owner and removed people stay as they are.
    async leaveCommunity(communityId, userId) {
      const data = lists(await load())
      const index = data.communityMembers.findIndex((item) => item.communityId === communityId && item.userId === userId && item.role === 'member')
      if (index === -1) return false
      data.communityMembers.splice(index, 1)
      recount(data, communityId)
      await save()
      return true
    },

    // Marks a member removed, so joining again is refused.
    async removeCommunityMember(communityId, userId) {
      const data = lists(await load())
      const found = memberRow(data, communityId, userId)
      if (!found || found.role !== 'member') return false
      found.role = 'removed'
      recount(data, communityId)
      await save()
      return true
    },

    // The owner first, then everyone else in the order they joined. Removed people are left out.
    async listCommunityMembers(communityId, limit = 200) {
      const members = lists(await load()).communityMembers.filter((item) => item.communityId === communityId && ACTIVE.has(item.role))
      const sorted = [...members.filter((item) => item.role === 'owner'), ...members.filter((item) => item.role !== 'owner')]
      return sorted.slice(0, limit).map(toMember)
    },

    async createCommunityMessage(communityId, senderId, body) {
      const data = lists(await load())
      const created = { id: randomUUID(), communityId, senderId, body, createdAt: stamp() }
      data.communityMessages.push(created)
      await save()
      return copy(created)
    },

    async listCommunityMessages(communityId, cursor = {}) {
      const items = lists(await load()).communityMessages.filter((item) => item.communityId === communityId)
      return copy(page(items, cursor))
    },

    async getCommunityMessage(id) {
      return copy(lists(await load()).communityMessages.find((item) => item.id === id))
    },

    async deleteCommunityMessage(id) {
      const data = lists(await load())
      const index = data.communityMessages.findIndex((item) => item.id === id)
      if (index === -1) return false
      data.communityMessages.splice(index, 1)
      await save()
      return true
    },
  }
}
