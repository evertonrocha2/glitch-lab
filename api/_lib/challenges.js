export const HINTS_PER_CHALLENGE = 3

const filled = (value) => typeof value === 'string' && value.trim() !== ''

// What the browser may see: never the solution, and only the hints already asked for.
export function toPublicChallenge(record) {
  return {
    id: record.id,
    caseId: record.caseId,
    brokenCode: record.brokenCode,
    symptom: record.symptom,
    language: record.language,
    hints: record.hints.slice(0, record.hintsRevealed),
    hintsRevealed: record.hintsRevealed,
    hintsTotal: record.hints.length,
    status: record.status,
    attempts: record.attempts,
  }
}

// Splits the AI answer into the public part and the secret part; throws if anything is missing.
// Extra hints are trimmed rather than wasting a slow AI call on a 502.
export function parseChallenge(data) {
  const { brokenCode, symptom, solution, bugExplanation } = data ?? {}
  const hints = Array.isArray(data?.hints) ? data.hints.slice(0, HINTS_PER_CHALLENGE) : []
  const hintsOk = hints.length === HINTS_PER_CHALLENGE && hints.every(filled)
  if (!hintsOk || ![brokenCode, symptom, solution, bugExplanation].every(filled)) {
    throw new Error('AI challenge is incomplete')
  }
  return { challenge: { brokenCode, symptom, hints }, secret: { solution, bugExplanation } }
}
