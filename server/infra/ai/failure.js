import { AppError } from '../../core/errors.js'
import { AiError } from './errors.js'

// Rate limited (429) or overloaded (503): both mean "try again soon".
const BUSY_STATUSES = [429, 503]

// The error every endpoint answers with when an AI call fails.
export function aiFailure(err) {
  if (err instanceof AiError && BUSY_STATUSES.includes(err.status)) {
    return new AppError(err.status, 'The AI is busy right now. Try again in a minute.', 'AI_BUSY')
  }
  if (err instanceof AiError && err.status === 504) return new AppError(504, 'The AI took too long. Try again.', 'AI_TIMEOUT')
  if (err instanceof AiError && err.status === 500) {
    console.error(err.message)
    return new AppError(500, 'Server is not configured.', 'AI_CONFIG')
  }
  console.error('AI call failed:', err)
  return new AppError(502, 'Something went wrong talking to the AI. Please try again.', 'AI_FAILED')
}

// Runs one AI step; any failure becomes the matching AppError.
export async function withAi(run) {
  try {
    return await run()
  } catch (err) {
    throw aiFailure(err)
  }
}
