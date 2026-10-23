import {
  advance,
  currentStep,
  emptyInterrogation,
  INTERROGATION_LIMITS,
  INTERROGATION_STEPS,
  INTERROGATION_XP,
  isFinished,
} from '../../../shared/interrogation.js'
import { generateJson } from '../ai/index.js'
import { fail, ok, readJson, requireUser } from '../http.js'
import { localeOf } from '../locale.js'
import { buildInterrogatePrompt, INTERROGATE_SCHEMA, interrogateSystem } from '../prompts/interrogate.js'
import { aiFailure, dailyLimitReached } from '../responses.js'
import { getStore } from '../store/index.js'
import { takeAiCall } from '../usage.js'
import { guardReply } from './guard.js'

// Interrogation: guided debugging on one case. Lives on /api/hint?mode=interrogate to stay under
// Vercel's free-plan function limit.
//   GET  ?mode=interrogate&caseId=...        -> { case, interrogation }
//   POST ?mode=interrogate { caseId, answer } -> { interrogation, turn, finished, xp }

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

export async function getInterrogation(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const caseId = new URL(request.url).searchParams.get('caseId')
  if (!validId(caseId)) return fail(400, 'Invalid request.')

  const store = getStore()
  const kase = await store.getCase(auth.user.id, caseId)
  if (!kase) return fail(404, 'Case not found.')
  return ok({ case: kase, interrogation: view(await store.getInterrogation(auth.user.id, caseId), caseId) })
}

export async function answerInterrogation(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (!validId(body?.caseId) || typeof body.answer !== 'string') return fail(400, 'Invalid request.')
  const answer = body.answer.trim()
  if (answer === '') return fail(400, 'Write your answer first.')
  if (answer.length > INTERROGATION_LIMITS.answer) return fail(413, `Too long. Keep your answer under ${INTERROGATION_LIMITS.answer} characters.`)

  const store = getStore()
  const userId = auth.user.id
  const kase = await store.getCase(userId, body.caseId)
  if (!kase) return fail(404, 'Case not found.')
  const state = (await store.getInterrogation(userId, kase.id)) ?? emptyInterrogation(kase.id)
  if (isFinished(state)) return fail(409, 'This interrogation is finished.')
  if (state.turns.length >= INTERROGATION_LIMITS.turns) return fail(409, 'This interrogation has too many answers.')

  if (!(await takeAiCall(store, auth.user))) return dailyLimitReached()

  const locale = localeOf(request)
  const step = currentStep(state)
  let verdict
  try {
    const reply = await generateJson({
      system: interrogateSystem(locale),
      prompt: buildInterrogatePrompt({ kase, state, answer }, locale),
      schema: INTERROGATE_SCHEMA,
    })
    // The prompt says never to give the fix early; this makes sure of it.
    verdict = guardReply(parseVerdict(reply), { step, fix: kase.analysis?.correcao, code: kase.code, locale }).verdict
  } catch (err) {
    return aiFailure(err)
  }

  const next = advance(state, answer, verdict)
  const saved = await store.saveInterrogation(userId, kase.id, next, state.turns.length)
  if (!saved) return fail(409, 'Another answer landed at the same time. Try again.')
  const finished = isFinished(saved)
  return ok({
    interrogation: view(saved, kase.id),
    turn: saved.turns.at(-1),
    finished,
    // XP only on the answer that finishes it: one interrogation per case, so once per case.
    xp: finished && !isFinished(state) ? INTERROGATION_XP : 0,
  })
}
