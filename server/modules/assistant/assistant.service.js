import { AppError, badRequest } from '../../core/errors.js'
import { aiFailure, withAi } from '../../infra/ai/failure.js'
import { screenInput, scrubHistory } from '../../infra/ai/guard/index.js'
import { spendAiCall, takeAiCall } from '../../infra/ai/quota.js'
import { guardAnswer, runAssistant, runAssistantStream } from './orchestrator.js'
import { parseAssistantRequest } from './request.js'

// Checks the request, runs the guard on the new question, and takes the question's first AI call
// from the daily limit, or throws. Both endpoints start here, so a bad request, the lockout or a
// used-up limit never opens a stream. A question the guard blocks comes back as { blocked } with
// nothing spent: it gets the guard's reply instead of an AI call.
export async function startQuestion(store, user, body) {
  if (!body) throw badRequest()
  const input = parseAssistantRequest(body)
  if (!input.value) throw new AppError(input.status, input.message)
  const question = input.value.messages.at(-1).content
  const blocked = await screenInput(store, user, { fields: [{ text: question }], scope: [question], feature: 'assistant' })
  if (blocked) return { ...input.value, blocked }
  await spendAiCall(store, user)
  return { ...input.value, messages: scrubHistory(input.value.messages) }
}

// The Lab assistant: a router agent hands the question to 1-2 specialist agents.
// The question takes one AI call from the daily limit up front (the short routing call rides on
// it); a second specialist takes another before it runs, and is skipped once the limit is used up.
export async function ask({ store, ai }, user, body, locale) {
  const { blocked, ...input } = await startQuestion(store, user, body)
  if (blocked) return guardAnswer(blocked.kind, locale)
  return withAi(() =>
    runAssistant({ store, userId: user.id, ...input, generate: ai.generateJson, locale, allowExtra: () => takeAiCall(store, user) }),
  )
}

// The same answer, streamed: emit(event, data) gets the steps and the text as it is written, and
// the result is the same payload ask returns. Here a second specialist's call is counted before it
// starts writing (it's skipped when the limit is used up), since its text is shown as it comes.
export async function askStream({ store, ai }, user, { blocked, ...input }, locale, { emit, signal }) {
  if (blocked) {
    const answer = guardAnswer(blocked.kind, locale)
    emit('delta', { agent: 'guide', text: answer.reply })
    return answer
  }
  try {
    return await runAssistantStream({
      store,
      userId: user.id,
      ...input,
      generate: ai.generateJson,
      stream: ai.streamText,
      locale,
      emit,
      signal,
      allowExtra: () => takeAiCall(store, user),
    })
  } catch (err) {
    // The student closed the panel or pressed Stop: not a failure worth logging.
    if (signal?.aborted) throw err
    throw aiFailure(err)
  }
}
