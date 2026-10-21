import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { getStore } from './_lib/store/index.js'

// Hands out the next hint, vaguest first. No AI call: hints were written with the challenge.
export async function POST(request) {
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
