import { cleanQuery } from '../../../shared/community.js'
import { COMMUNITY_TOPICS, MESSAGE_LIMITS, slugify } from '../../../shared/messages.js'
import { serverDay } from '../../core/days.js'
import { badRequest, forbidden, notFound } from '../../core/errors.js'
import { spendUsage } from '../../core/usage.js'
import { pageOf } from '../../core/validation.js'
import { loadPeople } from '../articles/people.js'
import { parseCursor, parseMessageBody, refuseDemo, spendMessage, trimPage } from '../messages/messages.model.js'
import { canReadCommunity, isMember, isOwner } from './communities.access.js'
import { isSlug, parseCommunity } from './communities.model.js'

const NOT_FOUND = 'Community not found.'
const REMOVED = 'You were removed from this community.'
const DEMO_JOIN = 'Sign up to join communities.'
const SLUG_TRIES = 50
const MAX_PAGE = 50

export const communityView = (community, joined = false) => ({
  id: community.id,
  slug: community.slug,
  name: community.name,
  description: community.description,
  topics: community.topics,
  color: community.color,
  icon: community.icon,
  memberCount: community.memberCount,
  createdAt: community.createdAt,
  joined,
})

async function findCommunity(store, slug) {
  const community = isSlug(slug) ? await store.getCommunity(slug) : null
  if (!community) throw notFound(NOT_FOUND)
  return community
}

const membershipOf = (store, community, viewer) => (viewer ? store.getCommunityMember(community.id, viewer.id) : null)

// The community you can read, with your membership (null signed out or not joined).
async function readable(store, slug, viewer) {
  const community = await findCommunity(store, slug)
  const membership = await membershipOf(store, community, viewer)
  // A private community looks like no community at all to everyone outside it.
  if (!canReadCommunity(community, membership)) throw notFound(NOT_FOUND)
  return { community, membership }
}

// { communities, page, hasMore, mine }. mine: the ones I'm in (empty signed out).
export async function listCommunities(store, viewer, query) {
  const q = cleanQuery(query.q ?? '').slice(0, MESSAGE_LIMITS.query)
  const topic = COMMUNITY_TOPICS.includes(query.topic) ? query.topic : null
  const page = pageOf(query.page, MAX_PAGE)
  const size = MESSAGE_LIMITS.communitiesPerPage
  const [found, mine] = await Promise.all([
    store.searchCommunities({ q, topic, offset: (page - 1) * size, limit: size }),
    viewer ? store.listUserCommunities(viewer.id) : [],
  ])
  const joined = new Set(mine.map((item) => item.id))
  return {
    communities: found.communities.map((item) => communityView(item, joined.has(item.id))),
    page,
    hasMore: found.hasMore,
    mine: mine.map((item) => communityView(item, true)),
  }
}

// The page's header and members: { community (with owner), membership, canPost, members }.
// Member ids only go to the owner, who needs them to remove someone.
export async function getCommunity(store, slug, viewer) {
  const { community, membership } = await readable(store, slug, viewer)
  const members = await store.listCommunityMembers(community.id)
  const people = await loadPeople(store, [community.ownerId, ...members.map((item) => item.userId)])
  const owner = isOwner(membership)
  return {
    community: { ...communityView(community, isMember(membership)), owner: people[community.ownerId] },
    membership: membership ? { role: membership.role } : null,
    canPost: Boolean(viewer && !viewer.isDemo && isMember(membership)),
    members: members.map((item) => ({
      ...(owner ? { id: item.userId } : {}),
      person: people[item.userId],
      role: item.role,
      joinedAt: item.joinedAt,
    })),
  }
}

// Picks the first free slug: the name's, then name-2, name-3...
async function createWithFreeSlug(store, user, fields) {
  const base = slugify(fields.name)
  const root = base.length >= 2 ? base : `community${base ? `-${base}` : ''}`
  for (let n = 1; n <= SLUG_TRIES; n++) {
    const created = await store.createCommunity(user.id, { ...fields, slug: n === 1 ? root : `${root}-${n}` })
    if (created) return created
  }
  throw badRequest('Pick another name for the community.')
}

export async function createCommunity(store, user, input) {
  refuseDemo(user, 'Sign up to create a community.')
  const fields = parseCommunity(input)
  // The owned count alone can't stop a burst (every request reads the same count before any
  // insert), so creations also spend a daily counter, which can't be raced.
  const spent = await spendUsage(store, `communities:${user.id}`, serverDay(), MESSAGE_LIMITS.ownedCommunities)
  if (!spent || (await store.countOwnedCommunities(user.id)) >= MESSAGE_LIMITS.ownedCommunities) {
    throw forbidden(`You can create up to ${MESSAGE_LIMITS.ownedCommunities} communities.`)
  }
  return communityView(await createWithFreeSlug(store, user, fields), true)
}

// Open to anyone signed up, except someone the owner removed.
export async function join(store, user, slug) {
  refuseDemo(user, DEMO_JOIN)
  const { community, membership } = await readable(store, slug, user)
  if (membership?.role === 'removed') throw forbidden(REMOVED)
  if (!membership) await store.joinCommunity(community.id, user.id)
  return getCommunity(store, slug, user)
}

export async function leave(store, user, slug) {
  refuseDemo(user, DEMO_JOIN)
  const { community, membership } = await readable(store, slug, user)
  if (isOwner(membership)) throw badRequest("The owner can't leave their own community.")
  await store.leaveCommunity(community.id, user.id)
  return getCommunity(store, slug, user)
}

const messageView = (message, people, viewerId, owner) => ({
  id: message.id,
  body: message.body,
  mine: message.senderId === viewerId,
  sender: people[message.senderId],
  createdAt: message.createdAt,
  // My own messages, or any of them when the community is mine.
  canDelete: Boolean(viewerId) && (message.senderId === viewerId || owner),
})

// The chat: { messages (oldest first), hasMore } for ?before= / ?after= cursors.
export async function listMessages(store, viewer, slug, query) {
  const cursor = parseCursor(query)
  const { community, membership } = await readable(store, slug, viewer)
  const raw = await store.listCommunityMessages(community.id, { ...cursor, limit: MESSAGE_LIMITS.pageSize + 1 })
  const { items, hasMore } = trimPage(raw, cursor)
  const people = await loadPeople(store, items.map((item) => item.senderId))
  return { messages: items.map((item) => messageView(item, people, viewer?.id ?? null, isOwner(membership))), hasMore }
}

// { body }: a message in the chat. Members only.
export async function postMessage(store, user, slug, input) {
  refuseDemo(user)
  const body = parseMessageBody(input)
  const { community, membership } = await readable(store, slug, user)
  if (membership?.role === 'removed') throw forbidden(REMOVED)
  if (!isMember(membership)) throw forbidden('Join the community to post.')
  await spendMessage(store, user)
  const message = await store.createCommunityMessage(community.id, user.id, body)
  const people = await loadPeople(store, [user.id])
  return messageView(message, people, user.id, isOwner(membership))
}

// The sender can delete their own message; the owner can delete any message in their community.
export async function deleteMessage(store, user, id) {
  const message = typeof id === 'string' && id.length <= 64 ? await store.getCommunityMessage(id) : null
  if (!message) throw notFound('Message not found.')
  const community = await store.getCommunityById(message.communityId)
  if (message.senderId !== user.id && community?.ownerId !== user.id) throw forbidden('You can only delete your own messages.')
  await store.deleteCommunityMessage(message.id)
}

// The owner takes someone out; they can't join again.
export async function removeMember(store, user, slug, userId) {
  const community = await findCommunity(store, slug)
  if (community.ownerId !== user.id) throw forbidden('Only the owner can remove members.')
  if (userId === user.id) throw badRequest("The owner can't be removed.")
  const membership = typeof userId === 'string' && userId.length <= 64 ? await store.getCommunityMember(community.id, userId) : null
  if (!isMember(membership)) throw notFound('Member not found.')
  await store.removeCommunityMember(community.id, userId)
}
