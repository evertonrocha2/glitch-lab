import { canSubmit, eventStatus } from '../../../shared/events.js'
import { loadPeople } from '../articles/people.js'
import { fail, ok, readJson, requireUser } from '../../core/http.js'
import { getStore } from '../../infra/database/index.js'
import { parseEntry } from './parse.js'
import { entryView } from './views.js'

const isText = (value) => typeof value === 'string'

// Why an entry can't be sent or changed right now, or null while the event is live.
function closedProblem(event) {
  const status = eventStatus(event)
  if (canSubmit(status)) return null
  return fail(409, status === 'upcoming' ? 'This event has not started yet.' : 'Entries are closed for this event.')
}

async function respond(store, entry, userId, status = 200) {
  const people = await loadPeople(store, [entry.userId])
  return ok({ entry: entryView(entry, people, userId) }, status)
}

// POST { eventId, title, description, repoUrl, videoUrl, demoUrl }: join an event with your entry.
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  // An entry is public, earns XP and gets votes: throwaway demo accounts can only look.
  if (auth.user.isDemo) return fail(403, 'Sign up to join events.')

  const body = await readJson(request)
  if (!isText(body?.eventId)) return fail(400, 'Invalid request.')
  const store = getStore()
  const event = await store.getEvent(body.eventId)
  if (!event) return fail(404, 'Event not found.')
  // The organizer picks the winners, so they can't be one.
  if (event.organizerId === auth.user.id) return fail(403, "You can't enter your own event.")
  const closed = closedProblem(event)
  if (closed) return closed
  if (await store.findEntry(event.id, auth.user.id)) return fail(409, 'You already have an entry in this event. Edit it instead.')

  const parsed = parseEntry(body, event.requirements)
  if (!parsed.value) return fail(parsed.status, parsed.message)
  const entry = await store.createEntry(event.id, auth.user.id, parsed.value)
  // Two sends at once: the store keeps one, the other lands here.
  if (!entry) return fail(409, 'You already have an entry in this event. Edit it instead.')
  await store.addNotification({ userId: event.organizerId, type: 'event_join', actorId: auth.user.id, eventId: event.id })
  return respond(store, entry, auth.user.id, 201)
}

// PUT { id, ...fields }: change your entry while the event is live, until it gets its first vote
// (so nobody swaps in something else after people voted for it).
export async function PUT(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const body = await readJson(request)
  if (!isText(body?.id)) return fail(400, 'Invalid request.')
  const store = getStore()
  const entry = await store.getEntry(body.id)
  if (!entry) return fail(404, 'Entry not found.')
  if (entry.userId !== auth.user.id) return fail(403, 'You can only edit your own entry.')
  const event = await store.getEvent(entry.eventId)
  if (!event) return fail(404, 'Event not found.')
  const closed = closedProblem(event)
  if (closed) return closed
  if (entry.votes > 0) return fail(409, 'Your entry has votes now, so it can no longer change.')

  const parsed = parseEntry(body, event.requirements)
  if (!parsed.value) return fail(parsed.status, parsed.message)
  return respond(store, await store.updateEntry(auth.user.id, entry.id, parsed.value), auth.user.id)
}
