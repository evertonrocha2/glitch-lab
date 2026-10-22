import { LIMITS } from '../shared/limits.js'
import { generateJson } from './_lib/ai/index.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { buildCheckPrompt, CHECK_SCHEMA, CHECK_SYSTEM } from './_lib/prompts/check.js'
import { aiFailure, dailyLimitReached } from './_lib/responses.js'
import { getStore } from './_lib/store/index.js'
import { takeAiCall } from './_lib/usage.js'

export const PASSES_TO_SOLVE = 2

function parseVerdict(data) {
  if (typeof data?.passed !== 'boolean' || typeof data.feedback !== 'string' || data.feedback.trim() === '') {
    throw new Error('AI verdict is incomplete')
  }
  return { passed: data.passed, feedback: data.feedback }
}

// The AI grades the student's fix against the secret solution; passing twice solves the case.
// Daily and global puzzles have no case: they just pass (case is null in the answer).
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (typeof body?.challengeId !== 'string' || typeof body.code !== 'string') return fail(400, 'Invalid request.')
  if (body.code.trim() === '') return fail(400, 'Write your fix first.')
  if (body.code.length > LIMITS.code) return fail(413, `Too long. Keep the code under ${LIMITS.code} characters.`)

  const store = getStore()
  const userId = auth.user.id
  const challenge = await store.getChallenge(userId, body.challengeId)
  if (!challenge) return fail(404, 'Challenge not found.')
  if (challenge.status === 'passed') return fail(409, 'This challenge is already solved.')
  const kase = challenge.caseId ? await store.getCase(userId, challenge.caseId) : null

  // Sending the untouched exercise back is a free "no", not a paid AI call.
  if (body.code.trim() === challenge.brokenCode.trim()) {
    return ok({ passed: false, feedback: "You haven't changed anything yet.", case: kase })
  }

  if (!(await takeAiCall(store, auth.user))) return dailyLimitReached()

  let verdict
  try {
    const secret = await store.getChallengeSecret(challenge.id)
    const answer = await generateJson({
      system: CHECK_SYSTEM,
      prompt: buildCheckPrompt({ ...challenge, ...secret, studentCode: body.code }),
      schema: CHECK_SCHEMA,
    })
    verdict = parseVerdict(answer)
  } catch (err) {
    return aiFailure(err)
  }

  await store.updateChallenge(userId, challenge.id, {
    attempts: challenge.attempts + 1,
    status: verdict.passed ? 'passed' : 'open',
  })

  let updatedCase = kase
  // Extra practice on a solved case is welcome, but the case can't go past 2/2.
  if (verdict.passed && kase && kase.status !== 'solved') {
    const passedCount = kase.passedCount + 1
    updatedCase = await store.updateCase(userId, kase.id, {
      passedCount,
      status: passedCount >= PASSES_TO_SOLVE ? 'solved' : 'training',
    })
  }
  return ok({ ...verdict, case: updatedCase })
}
