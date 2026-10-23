import { randomUUID } from 'node:crypto'
import { cleanQuery } from '../../../shared/community.js'
import { HOST_MIN_ENTRIES, isSampleAccount, summarizeEventStats } from '../../../shared/events.js'

const now = () => new Date().toISOString()
const copy = (value) => (value == null ? null : structuredClone(value))
const time = (iso) => Date.parse(iso)
const EVENT_FIELDS = ['title', 'summary', 'description', 'rules', 'prizes', 'kind', 'tags', 'startsAt', 'endsAt', 'closesAt', 'requirements', 'announcedAt']
const ENTRY_FIELDS = ['title', 'description', 'repoUrl', 'videoUrl', 'demoUrl']

// Community events, their entries and votes for the JSON file store. Spread into createLocalStore,
// sharing its load and save so every write lands in the same file.
export function createLocalEvents({ load, save }) {
  // Files saved before events existed don't have these lists yet.
  const lists = (data) => {
    data.events ??= []
    data.eventEntries ??= []
    data.eventVotes ??= []
    return data
  }
  const eventById = (data, id) => lists(data).events.find((item) => item.id === id)
  const entryById = (data, id) => lists(data).eventEntries.find((item) => item.id === id)
  const recountEntries = (data, eventId) => {
    const found = eventById(data, eventId)
    if (found) found.entryCount = data.eventEntries.filter((item) => item.eventId === eventId).length
  }

  function matches(item, q) {
    if (!q) return true
    const needle = q.toLowerCase()
    return item.title.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle) || item.tags.includes(needle)
  }

  // Live (and voting) events end soonest first, upcoming ones start soonest first, ended ones newest first.
  const TABS = {
    live: { keep: (item, at) => time(item.startsAt) <= at && time(item.closesAt) > at, order: (a, b) => time(a.endsAt) - time(b.endsAt) },
    upcoming: { keep: (item, at) => time(item.startsAt) > at, order: (a, b) => time(a.startsAt) - time(b.startsAt) },
    ended: { keep: (item, at) => time(item.closesAt) <= at, order: (a, b) => time(b.closesAt) - time(a.closesAt) },
  }

  return {
    async createEvent(organizerId, fields) {
      const data = lists(await load())
      const stamp = now()
      const created = { id: randomUUID(), organizerId, announcedAt: null, ...copy(fields), entryCount: 0, createdAt: stamp, updatedAt: stamp }
      data.events.push(created)
      await save()
      return copy(created)
    },

    async getEvent(id) {
      return copy(eventById(await load(), id))
    },

    // Only the fields given change. null when it isn't the organizer's.
    async updateEvent(organizerId, id, patch) {
      const found = eventById(await load(), id)
      if (!found || found.organizerId !== organizerId) return null
      for (const field of EVENT_FIELDS) if (patch[field] !== undefined) found[field] = copy(patch[field])
      found.updatedAt = now()
      await save()
      return copy(found)
    },

    // { events, hasMore }. tab: live | upcoming | ended at `now` (an ISO time); none lists the newest.
    async listEvents({ q = '', tab = null, now: at = now(), organizerId = null, offset = 0, limit = 12 }) {
      const data = lists(await load())
      const needle = cleanQuery(q)
      const view = TABS[tab]
      const moment = time(at)
      const found = data.events.filter((item) => (!organizerId || item.organizerId === organizerId) && (!view || view.keep(item, moment)) && matches(item, needle))
      // Array order is creation order, and sort is stable: ties keep the oldest first.
      if (view) found.sort(view.order)
      else found.reverse()
      return { events: copy(found.slice(offset, offset + limit)), hasMore: found.length > offset + limit }
    },

    // null when this person already has an entry in the event.
    async createEntry(eventId, userId, fields) {
      const data = lists(await load())
      if (data.eventEntries.some((item) => item.eventId === eventId && item.userId === userId)) return null
      const stamp = now()
      const created = { id: randomUUID(), eventId, userId, ...copy(fields), votes: 0, place: null, createdAt: stamp, updatedAt: stamp }
      data.eventEntries.push(created)
      recountEntries(data, eventId)
      await save()
      return copy(created)
    },

    async getEntry(id) {
      return copy(entryById(await load(), id))
    },

    async findEntry(eventId, userId) {
      return copy(lists(await load()).eventEntries.find((item) => item.eventId === eventId && item.userId === userId))
    },

    // Oldest first.
    async listEntries(eventId) {
      return copy(lists(await load()).eventEntries.filter((item) => item.eventId === eventId))
    },

    async updateEntry(userId, id, patch) {
      const found = entryById(await load(), id)
      if (!found || found.userId !== userId) return null
      for (const field of ENTRY_FIELDS) if (patch[field] !== undefined) found[field] = patch[field]
      found.updatedAt = now()
      await save()
      return copy(found)
    },

    // { [entryId]: 1 | 2 | 3 }: the event's winners. Every other entry loses its place.
    async setPlaces(eventId, places) {
      const data = lists(await load())
      for (const item of data.eventEntries) if (item.eventId === eventId) item.place = places[item.id] ?? null
      await save()
    },

    // The ids of the entries in this event that this person voted for.
    async getVotes(eventId, userId) {
      return lists(await load())
        .eventVotes.filter((item) => item.eventId === eventId && item.userId === userId)
        .map((item) => item.entryId)
    },

    // One vote per person and entry. { voted, votes }, or null when the entry is gone.
    async setVote(entryId, userId, voted) {
      const data = lists(await load())
      const entry = entryById(data, entryId)
      if (!entry) return null
      const index = data.eventVotes.findIndex((item) => item.entryId === entryId && item.userId === userId)
      if (voted && index === -1) data.eventVotes.push({ entryId, userId, eventId: entry.eventId, authorId: entry.userId, createdAt: now() })
      if (!voted && index !== -1) data.eventVotes.splice(index, 1)
      entry.votes = data.eventVotes.filter((item) => item.entryId === entryId).length
      await save()
      return { voted: Boolean(voted), votes: entry.votes }
    },

    // What computeProgress reads: entries sent, placings and events hosted (real events only, see
    // summarizeEventStats), votes received, and the day of each entry for the activity graph.
    async eventStats(userId) {
      const data = lists(await load())
      const mine = data.eventEntries.filter((item) => item.userId === userId)
      const placedIds = new Set(mine.filter((item) => item.place).map((item) => item.eventId))
      const events = data.events.filter((item) => placedIds.has(item.id) || (item.organizerId === userId && item.entryCount >= HOST_MIN_ENTRIES))
      const ids = new Set(events.map((item) => item.id))
      const users = new Map((data.users ?? []).map((user) => [user.id, user]))
      const entrants = data.eventEntries
        .filter((item) => ids.has(item.eventId))
        .map((item) => ({ eventId: item.eventId, userId: item.userId, sample: isSampleAccount(users.get(item.userId) ?? {}) }))
      const votesReceived = data.eventVotes.filter((item) => item.authorId === userId).length
      return summarizeEventStats({ userId, mine, events, entrants, votesReceived })
    },
  }
}
