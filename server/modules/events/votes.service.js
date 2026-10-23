import { canVote, eventStatus } from '../../../shared/events.js'
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.js'

// { vote: boolean }: one vote per person and entry, while the event is live or voting.
// Answers { voted, votes }.
export async function voteEntry(store, user, entryId, body) {
  if (typeof body?.vote !== 'boolean') throw badRequest()
  // Demo accounts are free and unlimited: their votes would decide rankings and hand out XP.
  if (user.isDemo) throw forbidden('Sign up to vote.')

  const entry = await store.getEntry(entryId)
  if (!entry) throw notFound('Entry not found.')
  if (entry.userId === user.id) throw forbidden("You can't vote for your own entry.")
  const event = await store.getEvent(entry.eventId)
  if (!event || !canVote(eventStatus(event))) throw conflict('Voting is closed for this event.')

  const result = await store.setVote(entry.id, user.id, body.vote)
  if (!result) throw notFound('Entry not found.')
  // The store announces each voter only once, so toggling never spams the author.
  if (body.vote) await store.addNotification({ userId: entry.userId, type: 'event_vote', actorId: user.id, eventId: event.id })
  return result
}
