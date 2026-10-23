import {
  advance,
  currentStep,
  emptyInterrogation,
  INTERROGATION_LIMITS,
  INTERROGATION_STEPS,
  INTERROGATION_XP,
  isFinished,
} from '../../../shared/interrogation.js'
import { isQuestion } from '../../../shared/question.js'
import { AppError, badRequest, conflict, notFound } from '../../core/errors.js'
import { buildInterrogatePrompt, INTERROGATE_SCHEMA, interrogateSystem } from './interrogate.prompt.js'
import { withAi } from '../../infra/ai/failure.js'
import { createBoundary, findLeak, guardText, screenInput } from '../../infra/ai/guard/index.js'
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

// The guard's answer to a turn (a blocked attempt, an off-topic answer, a reply that leaked): shown
// like a "not yet", but never saved, so the step and its tries stay as they were.
function guardTurn(state, caseId, step, answer, kind, locale) {
  const turn = { step, answer, feedback: guardText(kind, locale), question: '', passed: false, at: new Date().toISOString() }
  return { interrogation: view(state, caseId), turn, finished: false, xp: 0, guard: kind }
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

  const step = currentStep(state)
  const blocked = await screenInput(store, user, { fields: [{ text: answer }], scope: [answer], feature: 'interrogation' })
  if (blocked) return guardTurn(state, kase.id, step, answer, blocked.kind, locale)

  await spendAiCall(store, user)

  // A question case (a doubt, no error) walks the same steps from the doubt instead.
  const question = isQuestion(kase)
  const boundary = createBoundary()
  const verdict = await withAi(async () => {
    const reply = await ai.generateJson({
      system: interrogateSystem(locale, { question, boundary }),
      prompt: buildInterrogatePrompt({ kase, state, answer }, locale, boundary),
      schema: INTERROGATE_SCHEMA,
    })
    if (reply?.off_topic === true) return { guard: 'off_topic' }
    const parsed = parseVerdict(reply)
    if (findLeak(`${parsed.feedback}\n${parsed.question}`, { boundary })) return { guard: 'leak' }
    // The prompt says never to give the fix early; this makes sure of it.
    return guardReply(parsed, { step, fix: kase.analysis?.correcao, code: kase.code, locale, question }).verdict
  })
  if (verdict.guard) return guardTurn(state, kase.id, step, answer, verdict.guard, locale)

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
