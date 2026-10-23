import { openEventStream } from '../../core/event-stream.js'
import { ask, askStream, startQuestion } from './assistant.service.js'

export async function question(req, res) {
  res.json(await ask(req.deps, req.user, req.body, req.locale))
}

// Server-Sent Events: `step` and `delta` while the answer is written, then `done` with the same
// payload as POST /api/assistant, or `error` with the same message. A bad request or the daily
// limit still answers with a plain JSON error, before any stream opens.
export async function stream(req, res) {
  const input = await startQuestion(req.deps.store, req.user, req.body)
  const events = openEventStream(res)
  try {
    const result = await askStream(req.deps, req.user, input, req.locale, { emit: events.send, signal: events.signal })
    events.send('done', result)
  } catch (err) {
    // Nobody is listening once the student left.
    if (!events.signal.aborted) events.send('error', { message: err.message })
  } finally {
    events.close()
  }
}
