import { generateJson } from '../server/infra/ai/index.js'
import { runAssistant } from '../server/modules/assistant/orchestrator.js'
import { parseAssistantRequest } from '../server/modules/assistant/request.js'
import { fail, ok, readJson, requireUser } from '../server/core/http.js'
import { localeOf } from '../server/core/locale.js'
import { aiFailure, dailyLimitReached } from '../server/infra/ai/failure.js'
import { getStore } from '../server/infra/database/index.js'
import { takeAiCall } from '../server/infra/ai/quota.js'

// "Ask the detective": a router agent hands the question to 1-2 specialist agents.
// The question takes one AI call from the daily limit up front; a second specialist takes another
// afterwards, so the limit keeps tracking the real Gemini usage.
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (!body) return fail(400, 'Invalid request.')
  const input = parseAssistantRequest(body)
  if (!input.value) return fail(input.status, input.message)

  const store = getStore()
  if (!(await takeAiCall(store, auth.user))) return dailyLimitReached()

  try {
    const result = await runAssistant({ store, userId: auth.user.id, ...input.value, generate: generateJson, locale: localeOf(request) })
    for (let extra = 1; extra < result.agents.length; extra++) await takeAiCall(store, auth.user)
    return ok(result)
  } catch (err) {
    return aiFailure(err)
  }
}
