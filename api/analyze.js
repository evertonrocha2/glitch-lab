import { generateJson } from './_lib/ai/index.js'
import { parseAnalysis, validateInput } from './_lib/analysis.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { localeOf } from './_lib/locale.js'
import { analyzeSystem, buildPrompt, RESPONSE_SCHEMA } from './_lib/prompts/analyze.js'
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
    // Explanation, clues and exercise come back in the reader's language; the error stays as printed.
    const locale = localeOf(request)
    const answer = await generateJson({ system: analyzeSystem(locale), prompt: buildPrompt(input.value, locale), schema: RESPONSE_SCHEMA })
    parsed = parseAnalysis(answer)
  } catch (err) {
    return aiFailure(err)
  }

  const saved = await store.createCase(auth.user.id, { ...input.value, ...parsed })
  return ok({ case: saved }, 201)
}
