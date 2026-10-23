import { cleanQuery } from '../../../shared/community.js'
import { canPickWinners, EVENT_LIMITS, EVENT_TABS, eventStatus, rankEntries, VOTING_MS } from '../../../shared/events.js'
import { getUser } from '../auth.js'
import { loadPeople } from '../community/people.js'
import { serverDay } from '../days.js'
import { fail, ok, readJson, requireUser } from '../http.js'
import { getStore } from '../store/index.js'
import { parseEvent } from './parse.js'
import { entryView, eventSummary, eventView } from './views.js'

const NOT_FOUND = 'Event not found.'
const MAX_PAGE = 500
const isText = (value) => typeof value === 'string'

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

// GET ?id=: one event. GET otherwise: a page of events for a tab (live, upcoming, ended). No sign in needed.
export async function GET(request) {
  const params = new URL(request.url).searchParams
  const store = getStore()
  const viewer = await getUser(request)

  if (params.has('id')) {
    const event = await store.getEvent(params.get('id'))
    return event ? ok(await eventDetail(store, event, viewer?.id)) : fail(404, NOT_FOUND)
  }

  const page = Math.min(Math.max(Number.parseInt(params.get('page') ?? '1', 10) || 1, 1), MAX_PAGE)
  const tab = EVENT_TABS.includes(params.get('tab')) ? params.get('tab') : null
  const limit = EVENT_LIMITS.pageSize
  const now = Date.now()
  const { events, hasMore } = await store.listEvents({
    q: cleanQuery(params.get('q') ?? ''),
    tab,
    now: new Date(now).toISOString(),
    offset: (page - 1) * limit,
    limit,
  })
  const people = await loadPeople(store, events.map((item) => item.organizerId))
  return ok({ events: events.map((item) => eventSummary(item, people, now)), page, hasMore })
}

export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  // Demo accounts are free and throwaway: they can look around, not publish.
  if (auth.user.isDemo) return fail(403, 'Sign up to create events.')

  const parsed = parseEvent((await readJson(request)) ?? {})
  if (!parsed.value) return fail(parsed.status, parsed.message)
  const store = getStore()
  const key = eventsKey(auth.user.id)
  const day = serverDay()
  if ((await store.countUsage(key, day)) >= EVENT_LIMITS.eventsPerDay) {
    return fail(429, `You can create ${EVENT_LIMITS.eventsPerDay} events a day. Come back tomorrow.`)
  }
  await store.addUsage(key, day)
  const event = await store.createEvent(auth.user.id, parsed.value)
  return ok(await eventDetail(store, event, auth.user.id), 201)
}

// Edit (before the start), close early (while live) or announce the winners (after the end).
// Every change everyone sees, so only the organizer may make it.
export async function PUT(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const body = await readJson(request)
  if (!isText(body?.id)) return fail(400, 'Invalid request.')
  const store = getStore()
  const event = await store.getEvent(body.id)
  if (!event) return fail(404, NOT_FOUND)
  if (event.organizerId !== auth.user.id) return fail(403, 'Only the organizer can do that.')

  const action = ACTIONS[body.action ?? 'edit']
  if (!action) return fail(400, 'Invalid request.')
  const now = Date.now()
  const result = await action({ store, event, body, now, userId: auth.user.id })
  if (result.status) return fail(result.status, result.message)
  return ok(await eventDetail(store, result.event, auth.user.id))
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
  async winners({ store, event, body, now, userId }) {
    if (!canPickWinners(eventStatus(event, now))) return { status: 409, message: 'Pick the winners once the event ends.' }
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
    const updated = await store.updateEvent(userId, event.id, { announcedAt: stamp, closesAt })
    // Everyone who took part hears about it (once, even if the organizer changes the pick).
    for (const item of entries) {
      await store.addNotification({ userId: item.userId, type: 'event_winner', actorId: userId, eventId: event.id })
    }
    return { event: updated }
  },
}
