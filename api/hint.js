import { fail, ok, readJson, requireUser } from '../server/core/http.js'
import { answerInterrogation, getInterrogation } from '../server/modules/interrogation/interrogation.service.js'
import { getStore } from '../server/infra/database/index.js'

// ?mode=interrogate is the guided debugging coach (see _lib/interrogation/handler.js). It shares this
// function to stay under Vercel's free-plan limit.
const interrogating = (request) => new URL(request.url).searchParams.get('mode') === 'interrogate'

export async function GET(request) {
  if (interrogating(request)) return getInterrogation(request)
  return fail(405, 'Method not allowed.')
}

// Hands out the next hint, vaguest first. No AI call: hints were written with the challenge.
export async function POST(request) {
  if (interrogating(request)) return answerInterrogation(request)
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (typeof body?.challengeId !== 'string') return fail(400, 'Invalid request.')

  const store = getStore()
  const record = await store.getChallenge(auth.user.id, body.challengeId)
  if (!record) return fail(404, 'Challenge not found.')
  if (record.hintsRevealed >= record.hints.length) return fail(409, 'No more hints.')

  const hintsRevealed = record.hintsRevealed + 1
  await store.updateChallenge(auth.user.id, record.id, { hintsRevealed })
  return ok({ hint: record.hints[hintsRevealed - 1], hintsRevealed })
}
