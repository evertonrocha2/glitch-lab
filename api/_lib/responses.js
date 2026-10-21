import { AiError } from './ai/index.js'
import { fail } from './http.js'

// Rate limited (429) or overloaded (503): both mean "try again soon".
const BUSY_STATUSES = [429, 503]

// The answer every endpoint gives when an AI call fails.
export function aiFailure(err) {
  if (err instanceof AiError && BUSY_STATUSES.includes(err.status)) {
    return fail(err.status, 'The AI is busy right now. Try again in a minute.')
  }
  if (err instanceof AiError && err.status === 504) return fail(504, 'The AI took too long. Try again.')
  if (err instanceof AiError && err.status === 500) {
    console.error(err.message)
    return fail(500, 'Server is not configured.')
  }
  console.error('AI call failed:', err)
  return fail(502, 'Something went wrong talking to the AI. Please try again.')
}

export const dailyLimitReached = () => fail(429, 'Daily limit reached. Come back tomorrow.')
