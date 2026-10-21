import { conceptLabel } from '../shared/concepts.js'
import { generateJson } from './_lib/ai/index.js'
import { parseChallenge, toPublicChallenge } from './_lib/challenges.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { buildChallengePrompt, CHALLENGE_SCHEMA, CHALLENGE_SYSTEM } from './_lib/prompts/challenge.js'
import { aiFailure, dailyLimitReached } from './_lib/responses.js'
import { getStore } from './_lib/store/index.js'
import { takeAiCall } from './_lib/usage.js'

// Starts a gym challenge for one of my cases, or resumes the open one (no AI call, no quota).
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (typeof body?.caseId !== 'string') return fail(400, 'Invalid request.')

  const store = getStore()
  const kase = await store.getCase(auth.user.id, body.caseId)
  if (!kase) return fail(404, 'Case not found.')

  const open = await store.findOpenChallenge(auth.user.id, kase.id)
  if (open) return ok({ challenge: toPublicChallenge(open, kase.concept) })

  if (!(await takeAiCall(store, auth.user))) return dailyLimitReached()

  let parsed
  try {
    const answer = await generateJson({
      system: CHALLENGE_SYSTEM,
      prompt: buildChallengePrompt({
        conceptName: conceptLabel(kase.concept),
        language: kase.language,
        error: kase.error,
        why: kase.analysis.causa,
      }),
      schema: CHALLENGE_SCHEMA,
    })
    parsed = parseChallenge(answer)
  } catch (err) {
    return aiFailure(err)
  }

  const record = await store.createChallenge(auth.user.id, { caseId: kase.id, language: kase.language, ...parsed.challenge }, parsed.secret)
  if (kase.status === 'new') await store.updateCase(auth.user.id, kase.id, { status: 'training' })
  return ok({ challenge: toPublicChallenge(record, kase.concept) }, 201)
}

export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const id = new URL(request.url).searchParams.get('id') ?? ''
  const store = getStore()
  const record = await store.getChallenge(auth.user.id, id)
  if (!record) return fail(404, 'Challenge not found.')
  const kase = await store.getCase(auth.user.id, record.caseId)
  return ok({ challenge: toPublicChallenge(record, kase?.concept ?? 'other') })
}
