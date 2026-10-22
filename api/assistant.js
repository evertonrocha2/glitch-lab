import { generateJson } from './_lib/ai/index.js'
import { runAssistant } from './_lib/assistant/orchestrator.js'
import { parseAssistantRequest } from './_lib/assistant/request.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { aiFailure, dailyLimitReached } from './_lib/responses.js'
import { getStore } from './_lib/store/index.js'
import { takeAiCall } from './_lib/usage.js'

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
    const result = await runAssistant({ store, userId: auth.user.id, ...input.value, generate: generateJson })
    for (let extra = 1; extra < result.agents.length; extra++) await takeAiCall(store, auth.user)
    return ok(result)
  } catch (err) {
    return aiFailure(err)
  }
}
