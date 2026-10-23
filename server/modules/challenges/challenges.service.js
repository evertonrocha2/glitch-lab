import { conceptLabel } from '../../../shared/concepts.js'
import { LIMITS } from '../../../shared/limits.js'
import { isQuestion } from '../../../shared/question.js'
import { AppError, badRequest, conflict, notFound } from '../../core/errors.js'
import { withAi } from '../../infra/ai/failure.js'
import { createBoundary, findLeak, guardText, screenInput, secretLines } from '../../infra/ai/guard/index.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { buildChallengePrompt, CHALLENGE_SCHEMA, challengeSystem } from './challenge.prompt.js'
import { hintAt, parseChallenge, toPublicChallenge, toPublicPuzzleChallenge } from './challenges.model.js'
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

// A doubt not tied to one language still needs code to train on: JavaScript, the one most
// students meet first.
const QUESTION_FALLBACK_LANGUAGE = 'javascript'
const challengeLanguage = (kase) => (isQuestion(kase) && (!kase.language || kase.language === 'unknown') ? QUESTION_FALLBACK_LANGUAGE : kase.language)

// What a question case trains: its topic, the doubt as asked and the card's summary.
const questionOf = (kase) =>
  isQuestion(kase) ? { topic: kase.topic || conceptLabel(kase.concept), question: kase.question, summary: kase.analysis.explicacao, conceptName: kase.concept === 'other' ? null : conceptLabel(kase.concept) } : null

// Starts a gym challenge for one of my cases, or resumes the open one (no AI call, no quota).
// { challenge, created }: created tells a new challenge (201) from the open one (200).
export async function startChallenge({ store, ai }, user, body, locale) {
  if (typeof body?.caseId !== 'string') throw badRequest()
  const kase = await store.getCase(user.id, body.caseId)
  if (!kase) throw notFound('Case not found.')

  const open = await store.findOpenChallenge(user.id, kase.id)
  if (open) return { challenge: toPublicChallenge(open, kase.concept), created: false }

  await spendAiCall(store, user)
  const language = challengeLanguage(kase)
  const boundary = createBoundary()
  // Hints and the bug explanation in the reader's language; the symptom stays the real error text.
  const parsed = await withAi(async () => {
    const answer = await ai.generateJson({
      system: challengeSystem(locale, { boundary }),
      prompt: buildChallengePrompt({ conceptName: conceptLabel(kase.concept), language, error: kase.error, why: kase.analysis.causa, question: questionOf(kase) }, locale, boundary),
      schema: CHALLENGE_SCHEMA,
    })
    return parseChallenge(answer)
  })

  const record = await store.createChallenge(user.id, { caseId: kase.id, language, ...parsed.challenge }, parsed.secret)
  if (kase.status === 'new') await store.updateCase(user.id, kase.id, { status: 'training' })
  return { challenge: toPublicChallenge(record, kase.concept), created: true }
}

// One of my challenges, a case one or a daily/global puzzle one (that one in the reader's language;
// a case challenge was already written in the language of its reader).
export async function getChallenge(store, user, id, locale = 'en') {
  const record = await store.getChallenge(user.id, id)
  if (!record) throw notFound(NOT_FOUND)
  if (record.puzzleId) return toPublicPuzzleChallenge(record, await store.getPuzzle(record.puzzleId), locale)
  const kase = await store.getCase(user.id, record.caseId)
  return toPublicChallenge(record, kase?.concept ?? 'other')
}

// Hands out the next hint, vaguest first. No AI call: hints were written with the challenge.
export async function revealHint(store, user, id, locale = 'en') {
  const record = await store.getChallenge(user.id, id)
  if (!record) throw notFound(NOT_FOUND)
  if (record.hintsRevealed >= record.hints.length) throw conflict('No more hints.')

  const hintsRevealed = record.hintsRevealed + 1
  await store.updateChallenge(user.id, record.id, { hintsRevealed })
  const puzzle = record.puzzleId ? await store.getPuzzle(record.puzzleId) : null
  return { hint: hintAt(record, puzzle, hintsRevealed - 1, locale), hintsRevealed }
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

  // Instructions to the grader inside the code: refused before any AI call, no attempt counted.
  const blocked = await screenInput(store, user, { fields: [{ text: body.code, prose: false }], feature: 'gym' })
  if (blocked) return { passed: false, feedback: guardText(`gym_${blocked.kind === 'injection' ? 'injection' : 'off_topic'}`, locale), case: kase, guard: blocked.kind }

  await spendAiCall(store, user)
  const boundary = createBoundary()
  const verdict = await withAi(async () => {
    const secret = await store.getChallengeSecret(challenge.id)
    const answer = await ai.generateJson({
      system: checkSystem(locale, { boundary }),
      prompt: buildCheckPrompt({ ...challenge, ...secret, studentCode: body.code }, locale, boundary),
      schema: CHECK_SCHEMA,
    })
    if (answer?.off_topic === true) return { guard: 'off_topic' }
    const parsed = parseVerdict(answer)
    // Solution lines the student's code doesn't have yet, or the prompt itself, never reach them.
    const lines = secretLines(secret?.solution, `${challenge.brokenCode}\n${body.code}`)
    return findLeak(parsed.feedback, { boundary, lines }) ? { ...parsed, feedback: guardText('leak', locale), leaked: true } : parsed
  })
  // Not an attempt at the exercise: said kindly, and not counted as one.
  if (verdict.guard) return { passed: false, feedback: guardText('gym_off_topic', locale), case: kase, guard: verdict.guard }

  await store.updateChallenge(userId, challenge.id, { attempts: challenge.attempts + 1, status: verdict.passed ? 'passed' : 'open' })

  let updatedCase = kase
  // Extra practice on a solved case is welcome, but the case can't go past 2/2.
  if (verdict.passed && kase && kase.status !== 'solved') {
    const passedCount = kase.passedCount + 1
    updatedCase = await store.updateCase(userId, kase.id, { passedCount, status: passedCount >= PASSES_TO_SOLVE ? 'solved' : 'training' })
  }
  return { ...verdict, case: updatedCase }
}
