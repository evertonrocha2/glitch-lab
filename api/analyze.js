import { generateJson } from './_lib/ai/index.js'
import { parseAnalysis, validateInput } from './_lib/analysis.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { buildPrompt, RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from './_lib/prompts/analyze.js'
import { aiFailure, dailyLimitReached } from './_lib/responses.js'
import { getStore } from './_lib/store/index.js'
import { takeAiCall } from './_lib/usage.js'

export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (!body) return fail(400, 'Invalid request.')
  const input = validateInput(body)
  if (!input.ok) return fail(input.status, input.message)

  const store = getStore()
  if (!(await takeAiCall(store, auth.user))) return dailyLimitReached()

  let parsed
  try {
    const answer = await generateJson({ system: SYSTEM_INSTRUCTION, prompt: buildPrompt(input.value), schema: RESPONSE_SCHEMA })
    parsed = parseAnalysis(answer)
  } catch (err) {
    return aiFailure(err)
  }

  const saved = await store.createCase(auth.user.id, { ...input.value, ...parsed })
  return ok({ case: saved }, 201)
}
