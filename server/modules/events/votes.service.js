import { canVote, eventStatus } from '../../../shared/events.js'
import { fail, ok, readJson, requireUser } from '../../core/http.js'
import { getStore } from '../../infra/database/index.js'

// POST { entryId, vote: boolean }: one vote per person and entry, while the event is live or voting.
// Answers { voted, votes }.
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (typeof body?.entryId !== 'string' || typeof body.vote !== 'boolean') return fail(400, 'Invalid request.')
  // Demo accounts are free and unlimited: their votes would decide rankings and hand out XP.
  if (auth.user.isDemo) return fail(403, 'Sign up to vote.')

  const store = getStore()
  const entry = await store.getEntry(body.entryId)
  if (!entry) return fail(404, 'Entry not found.')
  if (entry.userId === auth.user.id) return fail(403, "You can't vote for your own entry.")
  const event = await store.getEvent(entry.eventId)
  if (!event || !canVote(eventStatus(event))) return fail(409, 'Voting is closed for this event.')

  const result = await store.setVote(entry.id, auth.user.id, body.vote)
  if (!result) return fail(404, 'Entry not found.')
  // The store announces each voter only once, so toggling never spams the author.
  if (body.vote) await store.addNotification({ userId: entry.userId, type: 'event_vote', actorId: auth.user.id, eventId: event.id })
  return ok(result)
}
