import { cleanQuery } from '../../../shared/community.js'
import { canPickWinners, EVENT_LIMITS, EVENT_TABS, eventStatus, rankEntries, VOTING_MS, winnersLocked } from '../../../shared/events.js'
import { loadPeople } from '../articles/people.js'
import { serverDay } from '../../core/days.js'
import { AppError, badRequest, forbidden, notFound, tooMany, valueOrThrow } from '../../core/errors.js'
import { pageOf } from '../../core/validation.js'
import { parseEvent } from './parse.js'
import { entryView, eventSummary, eventView } from './views.js'

const NOT_FOUND = 'Event not found.'
const MAX_PAGE = 500

// The daily limit on new events sits in the usage table, under its own key.
export const eventsKey = (userId) => `events:${userId}`

// One event with its entries ranked by votes, the viewer's own entry and votes.
async function eventDetail(store, event, viewerId) {
  const now = Date.now()
  const entries = await store.listEntries(event.id)
  const people = await loadPeople(store, [event.organizerId, ...entries.map((item) => item.userId)])
  const views = rankEntries(entries.map((item) => entryView(item, people, viewerId)))
  return {
    event: eventView(event, people, viewerId, now),
    entries: views,
    myEntry: views.find((item) => item.mine) ?? null,
    myVotes: viewerId ? await store.getVotes(event.id, viewerId) : [],
  }
}

// One event with its entries ranked by votes. No sign in needed.
export async function getEvent(store, id, viewer) {
  const event = await store.getEvent(id)
  if (!event) throw notFound(NOT_FOUND)
  return eventDetail(store, event, viewer?.id)
}

// A page of events for a tab (live, upcoming, ended), from { q, tab, page }. No sign in needed.
export async function listEvents(store, query) {
  const page = pageOf(query.page, MAX_PAGE)
  const tab = EVENT_TABS.includes(query.tab) ? query.tab : null
  const limit = EVENT_LIMITS.pageSize
  const now = Date.now()
  const { events, hasMore } = await store.listEvents({
    q: cleanQuery(query.q ?? ''),
    tab,
    now: new Date(now).toISOString(),
    offset: (page - 1) * limit,
    limit,
  })
  const people = await loadPeople(store, events.map((item) => item.organizerId))
  return { events: events.map((item) => eventSummary(item, people, now)), page, hasMore }
}

export async function createEvent(store, user, body) {
  // Demo accounts are free and throwaway: they can look around, not publish.
  if (user.isDemo) throw forbidden('Sign up to create events.')

  const value = valueOrThrow(parseEvent(body ?? {}))
  const key = eventsKey(user.id)
  const day = serverDay()
  if ((await store.countUsage(key, day)) >= EVENT_LIMITS.eventsPerDay) {
    throw tooMany(`You can create ${EVENT_LIMITS.eventsPerDay} events a day. Come back tomorrow.`)
  }
  await store.addUsage(key, day)
  const event = await store.createEvent(user.id, value)
  return eventDetail(store, event, user.id)
}

// Edit (before the start), close early (while live) or announce the winners (after the end).
// Every change everyone sees, so only the organizer may make it. action: 'edit' | 'close' | 'winners'.
export async function organizerAction(store, user, id, name, input) {
  // Closing takes no fields; editing and picking winners do.
  if (name !== 'close' && !input) throw badRequest()
  const body = input ?? {}
  const event = await store.getEvent(id)
  if (!event) throw notFound(NOT_FOUND)
  if (event.organizerId !== user.id) throw forbidden('Only the organizer can do that.')

  // Own keys only, so "constructor" or "__proto__" never reach Object's own functions.
  if (!Object.hasOwn(ACTIONS, name)) throw badRequest()
  const result = await ACTIONS[name]({ store, event, body, now: Date.now(), userId: user.id })
  if (result.status) throw new AppError(result.status, result.message)
  return eventDetail(store, result.event, user.id)
}

const ACTIONS = {
  async edit({ store, event, body, now, userId }) {
    if (eventStatus(event, now) !== 'upcoming') return { status: 409, message: 'You can only change an event before it starts.' }
    const parsed = parseEvent(body, now)
    if (!parsed.value) return parsed
    return { event: await store.updateEvent(userId, event.id, parsed.value) }
  },

  // The end moves to now; the voting window starts from there.
  async close({ store, event, now, userId }) {
    if (eventStatus(event, now) !== 'live') return { status: 409, message: 'This event is not live.' }
    const endsAt = new Date(now).toISOString()
    return { event: await store.updateEvent(userId, event.id, { endsAt, closesAt: new Date(now + VOTING_MS).toISOString() }) }
  },

  // winners: 1 to 3 different entry ids of this event, first place first. Voting closes with it.
  // The pick can change for WINNERS_EDIT_MS after it is first announced, then it is final.
  async winners({ store, event, body, now, userId }) {
    if (!canPickWinners(eventStatus(event, now))) return { status: 409, message: 'Pick the winners once the event ends.' }
    if (winnersLocked(event, now)) return { status: 409, message: 'The winners are final and can no longer change.' }
    const picked = body.winners
    const entries = await store.listEntries(event.id)
    const valid =
      Array.isArray(picked) &&
      picked.length >= 1 &&
      picked.length <= 3 &&
      new Set(picked).size === picked.length &&
      picked.every((id) => entries.some((item) => item.id === id))
    if (!valid) return { status: 400, message: 'Pick 1 to 3 different entries from this event.' }

    await store.setPlaces(event.id, Object.fromEntries(picked.map((id, index) => [id, index + 1])))
    const stamp = new Date(now).toISOString()
    const closesAt = Date.parse(event.closesAt) > now ? stamp : event.closesAt
    // announcedAt stays the first announcement, so changing the pick never moves the lock.
    const updated = await store.updateEvent(userId, event.id, { announcedAt: event.announcedAt ?? stamp, closesAt })
    // Everyone who took part hears about it (once, even if the organizer changes the pick).
    for (const item of entries) {
      await store.addNotification({ userId: item.userId, type: 'event_winner', actorId: userId, eventId: event.id })
    }
    return { event: updated }
  },
}
