import { AppError, badRequest } from '../../core/errors.js'
import { withAi } from '../../infra/ai/failure.js'
import { spendAiCall, takeAiCall } from '../../infra/ai/quota.js'
import { runAssistant } from './orchestrator.js'
import { parseAssistantRequest } from './request.js'

// "Ask the detective": a router agent hands the question to 1-2 specialist agents.
// The question takes one AI call from the daily limit up front; a second specialist takes another
// afterwards, so the limit keeps tracking the real Gemini usage.
export async function ask({ store, ai }, user, body, locale) {
  if (!body) throw badRequest()
  const input = parseAssistantRequest(body)
  if (!input.value) throw new AppError(input.status, input.message)

  await spendAiCall(store, user)
  return withAi(async () => {
    const result = await runAssistant({ store, userId: user.id, ...input.value, generate: ai.generateJson, locale })
    for (let extra = 1; extra < result.agents.length; extra++) await takeAiCall(store, user)
    return result
  })
}
