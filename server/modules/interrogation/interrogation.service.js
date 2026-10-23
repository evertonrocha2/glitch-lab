import {
  advance,
  currentStep,
  emptyInterrogation,
  INTERROGATION_LIMITS,
  INTERROGATION_STEPS,
  INTERROGATION_XP,
  isFinished,
} from '../../../shared/interrogation.js'
import { AppError, badRequest, conflict, notFound } from '../../core/errors.js'
import { buildInterrogatePrompt, INTERROGATE_SCHEMA, interrogateSystem } from './interrogate.prompt.js'
import { withAi } from '../../infra/ai/failure.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { guardReply } from './guard.js'

// Interrogation: guided debugging on one case, one step at a time, coached by the AI.

const validId = (id) => typeof id === 'string' && id !== '' && id.length <= 64

// What the app gets: the stored record (or an empty one) plus the step list.
const view = (state, caseId) => {
  const record = state ?? emptyInterrogation(caseId)
  return {
    caseId,
    steps: INTERROGATION_STEPS,
    step: record.step,
    turns: record.turns,
    completedAt: record.completedAt ?? null,
    finished: isFinished(record),
    xp: INTERROGATION_XP,
  }
}

function parseVerdict(data) {
  if (typeof data?.passed !== 'boolean' || typeof data.feedback !== 'string' || data.feedback.trim() === '') {
    throw new Error('AI verdict is incomplete')
  }
  return { passed: data.passed, feedback: data.feedback.trim(), question: typeof data.question === 'string' ? data.question.trim() : '' }
}

// { case, interrogation }: the case and where I am in its interrogation.
export async function getInterrogation(store, user, caseId) {
  if (!validId(caseId)) throw badRequest()
  const kase = await store.getCase(user.id, caseId)
  if (!kase) throw notFound('Case not found.')
  return { case: kase, interrogation: view(await store.getInterrogation(user.id, caseId), caseId) }
}

// One answer for the current step ({ answer }): { interrogation, turn, finished, xp }.
export async function answerInterrogation({ store, ai }, user, caseId, body, locale) {
  if (!validId(caseId) || typeof body?.answer !== 'string') throw badRequest()
  const answer = body.answer.trim()
  if (answer === '') throw badRequest('Write your answer first.')
  if (answer.length > INTERROGATION_LIMITS.answer) throw new AppError(413, `Too long. Keep your answer under ${INTERROGATION_LIMITS.answer} characters.`)

  const userId = user.id
  const kase = await store.getCase(userId, caseId)
  if (!kase) throw notFound('Case not found.')
  const state = (await store.getInterrogation(userId, kase.id)) ?? emptyInterrogation(kase.id)
  if (isFinished(state)) throw conflict('This interrogation is finished.')
  if (state.turns.length >= INTERROGATION_LIMITS.turns) throw conflict('This interrogation has too many answers.')

  await spendAiCall(store, user)

  const step = currentStep(state)
  const verdict = await withAi(async () => {
    const reply = await ai.generateJson({
      system: interrogateSystem(locale),
      prompt: buildInterrogatePrompt({ kase, state, answer }, locale),
      schema: INTERROGATE_SCHEMA,
    })
    // The prompt says never to give the fix early; this makes sure of it.
    return guardReply(parseVerdict(reply), { step, fix: kase.analysis?.correcao, code: kase.code, locale }).verdict
  })

  const next = advance(state, answer, verdict)
  const saved = await store.saveInterrogation(userId, kase.id, next, state.turns.length)
  if (!saved) throw conflict('Another answer landed at the same time. Try again.')
  const finished = isFinished(saved)
  return {
    interrogation: view(saved, kase.id),
    turn: saved.turns.at(-1),
    finished,
    // XP only on the answer that finishes it: one interrogation per case, so once per case.
    xp: finished && !isFinished(state) ? INTERROGATION_XP : 0,
  }
}
