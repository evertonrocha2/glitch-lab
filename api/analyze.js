import { parseAnalysis, validateInput } from './_lib/analysis.js'
import { callGemini, GeminiError } from './_lib/gemini.js'
import { buildPrompt } from './_lib/prompt.js'

// gemini-2.5-flash is closed to new API keys; Google points to this one instead.
const DEFAULT_MODEL = 'gemini-3.8-flash'
// Rate limited (429) or overloaded (503): both mean "try again soon".
const BUSY_STATUSES = [429, 503]

const fail = (status, message) => Response.json({ message }, { status })

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return fail(400, 'Invalid request.')
  }

  const input = validateInput(body)
  if (!input.ok) return fail(input.status, input.message)

  // Read env per request (not at import) so config changes apply without a cold start.
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return fail(500, 'Server is not configured.')
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  try {
    const text = await callGemini({ prompt: buildPrompt(input.value), apiKey, model })
    return Response.json(parseAnalysis(text))
  } catch (err) {
    if (err instanceof GeminiError && BUSY_STATUSES.includes(err.status)) {
      return fail(err.status, 'The AI is busy right now. Try again in a minute.')
    }
    console.error('analyze failed:', err)
    return fail(502, 'Something went wrong talking to the AI. Please try again.')
  }
}
