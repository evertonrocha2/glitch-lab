import { conceptLabel } from '../../../shared/concepts.js'
import { LIMITS } from '../../../shared/limits.js'
import { AppError, badRequest, conflict, notFound } from '../../core/errors.js'
import { withAi } from '../../infra/ai/failure.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { buildChallengePrompt, CHALLENGE_SCHEMA, challengeSystem } from './challenge.prompt.js'
import { parseChallenge, toPublicChallenge } from './challenges.model.js'
import { buildCheckPrompt, CHECK_SCHEMA, checkSystem } from './check.prompt.js'

export const PASSES_TO_SOLVE = 2

const UNCHANGED = { en: "You haven't changed anything yet.", 'pt-BR': 'Você ainda não mudou nada.' }
const NOT_FOUND = 'Challenge not found.'

function parseVerdict(data) {
  if (typeof data?.passed !== 'boolean' || typeof data.feedback !== 'string' || data.feedback.trim() === '') {
    throw new Error('AI verdict is incomplete')
  }
  return { passed: data.passed, feedback: data.feedback }
}

// Starts a gym challenge for one of my cases, or resumes the open one (no AI call, no quota).
// { challenge, created }: created tells a new challenge (201) from the open one (200).
export async function startChallenge({ store, ai }, user, body, locale) {
  if (typeof body?.caseId !== 'string') throw badRequest()
  const kase = await store.getCase(user.id, body.caseId)
  if (!kase) throw notFound('Case not found.')

  const open = await store.findOpenChallenge(user.id, kase.id)
  if (open) return { challenge: toPublicChallenge(open, kase.concept), created: false }

  await spendAiCall(store, user)
  // Hints and the bug explanation in the reader's language; the symptom stays the real error text.
  const parsed = await withAi(async () => {
    const answer = await ai.generateJson({
      system: challengeSystem(locale),
      prompt: buildChallengePrompt({ conceptName: conceptLabel(kase.concept), language: kase.language, error: kase.error, why: kase.analysis.causa }, locale),
      schema: CHALLENGE_SCHEMA,
    })
    return parseChallenge(answer)
  })

  const record = await store.createChallenge(user.id, { caseId: kase.id, language: kase.language, ...parsed.challenge }, parsed.secret)
  if (kase.status === 'new') await store.updateCase(user.id, kase.id, { status: 'training' })
  return { challenge: toPublicChallenge(record, kase.concept), created: true }
}

// One of my challenges, a case one or a daily/global puzzle one.
export async function getChallenge(store, user, id) {
  const record = await store.getChallenge(user.id, id)
  if (!record) throw notFound(NOT_FOUND)
  if (record.puzzleId) {
    const puzzle = await store.getPuzzle(record.puzzleId)
    return toPublicChallenge(record, puzzle?.concept ?? 'other', puzzle)
  }
  const kase = await store.getCase(user.id, record.caseId)
  return toPublicChallenge(record, kase?.concept ?? 'other')
}

// Hands out the next hint, vaguest first. No AI call: hints were written with the challenge.
export async function revealHint(store, user, id) {
  const record = await store.getChallenge(user.id, id)
  if (!record) throw notFound(NOT_FOUND)
  if (record.hintsRevealed >= record.hints.length) throw conflict('No more hints.')

  const hintsRevealed = record.hintsRevealed + 1
  await store.updateChallenge(user.id, record.id, { hintsRevealed })
  return { hint: record.hints[hintsRevealed - 1], hintsRevealed }
}

// The AI grades the student's fix against the secret solution; passing twice solves the case.
// Daily and global puzzles have no case: they just pass (case is null in the answer).
export async function checkFix({ store, ai }, user, id, body, locale) {
  if (typeof body?.code !== 'string') throw badRequest()
  if (body.code.trim() === '') throw badRequest('Write your fix first.')
  if (body.code.length > LIMITS.code) throw new AppError(413, `Too long. Keep the code under ${LIMITS.code} characters.`)

  const userId = user.id
  const challenge = await store.getChallenge(userId, id)
  if (!challenge) throw notFound(NOT_FOUND)
  if (challenge.status === 'passed') throw conflict('This challenge is already solved.')
  const kase = challenge.caseId ? await store.getCase(userId, challenge.caseId) : null

  // Sending the untouched exercise back is a free "no", not a paid AI call.
  if (body.code.trim() === challenge.brokenCode.trim()) return { passed: false, feedback: UNCHANGED[locale], case: kase }

  await spendAiCall(store, user)
  const verdict = await withAi(async () => {
    const secret = await store.getChallengeSecret(challenge.id)
    const answer = await ai.generateJson({
      system: checkSystem(locale),
      prompt: buildCheckPrompt({ ...challenge, ...secret, studentCode: body.code }, locale),
      schema: CHECK_SCHEMA,
    })
    return parseVerdict(answer)
  })

  await store.updateChallenge(userId, challenge.id, { attempts: challenge.attempts + 1, status: verdict.passed ? 'passed' : 'open' })

  let updatedCase = kase
  // Extra practice on a solved case is welcome, but the case can't go past 2/2.
  if (verdict.passed && kase && kase.status !== 'solved') {
    const passedCount = kase.passedCount + 1
    updatedCase = await store.updateCase(userId, kase.id, { passedCount, status: passedCount >= PASSES_TO_SOLVE ? 'solved' : 'training' })
  }
  return { ...verdict, case: updatedCase }
}
