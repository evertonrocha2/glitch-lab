import { AppError, badRequest } from '../../core/errors.js'
import { aiFailure, withAi } from '../../infra/ai/failure.js'
import { spendAiCall, takeAiCall } from '../../infra/ai/quota.js'
import { runAssistant, runAssistantStream } from './orchestrator.js'
import { parseAssistantRequest } from './request.js'

// Checks the request and takes the question's first AI call from the daily limit, or throws.
// Both endpoints start here, so a bad request or a used-up limit never opens a stream.
export async function startQuestion(store, user, body) {
  if (!body) throw badRequest()
  const input = parseAssistantRequest(body)
  if (!input.value) throw new AppError(input.status, input.message)
  await spendAiCall(store, user)
  return input.value
}

// The Lab assistant: a router agent hands the question to 1-2 specialist agents.
// The question takes one AI call from the daily limit up front; a second specialist takes another
// afterwards, so the limit keeps tracking the real Gemini usage.
export async function ask({ store, ai }, user, body, locale) {
  const input = await startQuestion(store, user, body)
  return withAi(async () => {
    const result = await runAssistant({ store, userId: user.id, ...input, generate: ai.generateJson, locale })
    for (let extra = 1; extra < result.agents.length; extra++) await takeAiCall(store, user)
    return result
  })
}

// The same answer, streamed: emit(event, data) gets the steps and the text as it is written, and
// the result is the same payload ask returns. Here a second specialist's call is counted before it
// starts writing (it's skipped when the limit is used up), since its text is shown as it comes.
export async function askStream({ store, ai }, user, input, locale, { emit, signal }) {
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
