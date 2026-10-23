import { openEventStream } from '../../core/event-stream.js'
import { startTurn, tutorTurn } from './questions.service.js'

// Server-Sent Events: `delta` while the tutor writes, then `done` with { reply, card, turns,
// turnsLeft }, or `error` with the message. A bad request, the turn cap or the daily limit answers
// with a plain JSON error before any stream opens.
export async function stream(req, res) {
  const input = await startTurn(req.deps.store, req.user, req.body)
  const events = openEventStream(res)
  try {
    events.send('done', await tutorTurn(req.deps, input, req.locale, { emit: events.send, signal: events.signal }))
  } catch (err) {
    if (!events.signal.aborted) events.send('error', { message: err.message })
  } finally {
    events.close()
  }
}
