import { canSubmit, eventStatus } from '../../../shared/events.js'
import { badRequest, conflict, forbidden, notFound, valueOrThrow } from '../../core/errors.js'
import { loadPeople } from '../articles/people.js'
import { parseEntry } from './parse.js'
import { entryView } from './views.js'

const ALREADY_IN = 'You already have an entry in this event. Edit it instead.'

// Entries can only be sent or changed while the event is live.
function checkOpen(event) {
  const status = eventStatus(event)
  if (!canSubmit(status)) throw conflict(status === 'upcoming' ? 'This event has not started yet.' : 'Entries are closed for this event.')
}

async function view(store, entry, userId) {
  const people = await loadPeople(store, [entry.userId])
  return entryView(entry, people, userId)
}

// { title, description, repoUrl, videoUrl, demoUrl }: join an event with your entry.
export async function submitEntry(store, user, eventId, body) {
  // An entry is public, earns XP and gets votes: throwaway demo accounts can only look.
  if (user.isDemo) throw forbidden('Sign up to join events.')
  if (!body) throw badRequest()

  const event = await store.getEvent(eventId)
  if (!event) throw notFound('Event not found.')
  // The organizer picks the winners, so they can't be one.
  if (event.organizerId === user.id) throw forbidden("You can't enter your own event.")
  checkOpen(event)
  if (await store.findEntry(event.id, user.id)) throw conflict(ALREADY_IN)

  const value = valueOrThrow(parseEntry(body, event.requirements))
  const entry = await store.createEntry(event.id, user.id, value)
  // Two sends at once: the store keeps one, the other lands here.
  if (!entry) throw conflict(ALREADY_IN)
  await store.addNotification({ userId: event.organizerId, type: 'event_join', actorId: user.id, eventId: event.id })
  return view(store, entry, user.id)
}

// Change your entry while the event is live, until it gets its first vote (so nobody swaps in
// something else after people voted for it).
export async function updateEntry(store, user, id, body) {
  if (!body) throw badRequest()
  const entry = await store.getEntry(id)
  if (!entry) throw notFound('Entry not found.')
  if (entry.userId !== user.id) throw forbidden('You can only edit your own entry.')
  const event = await store.getEvent(entry.eventId)
  if (!event) throw notFound('Event not found.')
  checkOpen(event)
  if (entry.votes > 0) throw conflict('Your entry has votes now, so it can no longer change.')

  const value = valueOrThrow(parseEntry(body, event.requirements))
  return view(store, await store.updateEntry(user.id, entry.id, value), user.id)
}
