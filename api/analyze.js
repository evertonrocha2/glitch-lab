import { AiError, generateJson } from './_lib/ai/index.js'
import { parseAnalysis, validateInput } from './_lib/analysis.js'
import { buildPrompt, RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from './_lib/prompt.js'

const fail = (status, message) => Response.json({ message }, { status })

// Rate limited (429) or overloaded (503): both mean "try again soon".
const BUSY_STATUSES = [429, 503]

function aiFailure(err) {
  if (err instanceof AiError && BUSY_STATUSES.includes(err.status)) {
    return fail(err.status, 'The AI is busy right now. Try again in a minute.')
  }
  if (err instanceof AiError && err.status === 504) return fail(504, 'The AI took too long. Try again.')
  if (err instanceof AiError && err.status === 500) {
    console.error(err.message)
    return fail(500, 'Server is not configured.')
  }
  console.error('analyze failed:', err)
  return fail(502, 'Something went wrong talking to the AI. Please try again.')
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return fail(400, 'Invalid request.')
  }

  const input = validateInput(body)
  if (!input.ok) return fail(input.status, input.message)

  try {
    const answer = await generateJson({
      system: SYSTEM_INSTRUCTION,
      prompt: buildPrompt(input.value),
      schema: RESPONSE_SCHEMA,
    })
    return Response.json(parseAnalysis(answer))
  } catch (err) {
    return aiFailure(err)
  }
}
