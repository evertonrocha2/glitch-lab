import { AppError, badRequest } from '../../core/errors.js'
import { withAi } from '../../infra/ai/failure.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { seedDemo } from '../demo/demo.seed.js'
import { parseAnalysis, validateInput } from './analysis.js'
import { analyzeSystem, buildPrompt, RESPONSE_SCHEMA } from './analyze.prompt.js'

export async function listCases(store, user, locale) {
  // A demo visitor lands on a ready-made board (their own copy), so every column has something to click.
  if (user.isDemo) await seedDemo(store, user.id, undefined, locale)
  return store.listCases(user.id)
}

// The AI reads an error (and the code around it) and the result becomes a new case on the board.
export async function analyzeError({ store, ai }, user, body, locale) {
  if (!body) throw badRequest()
  const input = validateInput(body)
  if (!input.ok) throw new AppError(input.status, input.message)

  await spendAiCall(store, user)
  // Explanation, clues and exercise come back in the reader's language; the error stays as printed.
  const parsed = await withAi(async () => {
    const answer = await ai.generateJson({ system: analyzeSystem(locale), prompt: buildPrompt(input.value, locale), schema: RESPONSE_SCHEMA })
    return parseAnalysis(answer)
  })
  return store.createCase(user.id, { ...input.value, ...parsed })
}
