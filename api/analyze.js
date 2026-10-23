import { generateJson } from '../server/infra/ai/index.js'
import { parseAnalysis, validateInput } from '../server/modules/cases/analysis.js'
import { fail, ok, readJson, requireUser } from '../server/core/http.js'
import { localeOf } from '../server/core/locale.js'
import { analyzeSystem, buildPrompt, RESPONSE_SCHEMA } from '../server/modules/cases/analyze.prompt.js'
import { aiFailure, dailyLimitReached } from '../server/infra/ai/failure.js'
import { getStore } from '../server/infra/database/index.js'
import { takeAiCall } from '../server/infra/ai/quota.js'

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
