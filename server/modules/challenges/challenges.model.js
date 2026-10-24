import { puzzleText, variantSource } from '../daily/puzzle-text.js'

export const HINTS_PER_CHALLENGE = 3

const filled = (value) => typeof value === 'string' && value.trim() !== ''

// What the browser may see: never the solution, and only the hints already asked for.
// `concept` comes from the case (or the puzzle), so the gym can say which kind of bug is being trained.
// A daily or global challenge has no case; `puzzle` names it instead, with the player's language
// switch: switchedFrom (the puzzle's own language once they switched, else null) and canSwitch.
export function toPublicChallenge(record, concept, puzzle = null) {
  return {
    id: record.id,
    caseId: record.caseId ?? null,
    puzzle: puzzle && {
      id: puzzle.id,
      kind: puzzle.kind,
      day: puzzle.day,
      difficulty: puzzle.difficulty,
      title: puzzle.title,
      switchedFrom: puzzle.switchedFrom ?? null,
      canSwitch: puzzle.canSwitch ?? false,
    },
    concept,
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

// A daily or global challenge in the reader's language. The challenge copied the puzzle's English
// symptom and hints when it started; the puzzle keeps the Portuguese copy, read here at view time,
// so the same challenge follows the reader when they switch languages. A player who switched the
// puzzle to another programming language plays its port (`variant`), which has its own copy.
export function toPublicPuzzleChallenge(record, puzzle, locale = 'en', { variant = null, switchedFrom = null, canSwitch = false } = {}) {
  if (!puzzle) return toPublicChallenge(record, 'other')
  const source = variantSource(puzzle, variant)
  const text = puzzleText(source, locale)
  const hints = text.hints.length === record.hints.length ? text.hints : record.hints
  const symptom = record.symptom === source.symptom ? text.symptom : record.symptom
  const { title } = puzzleText(puzzle, locale)
  return toPublicChallenge({ ...record, symptom, hints }, puzzle.concept, { ...puzzle, title, switchedFrom, canSwitch })
}

// The next hint of a challenge, in the reader's language for a daily or global one (from the port
// when the player switched languages).
export function hintAt(record, puzzle, index, locale = 'en', variant = null) {
  const hints = puzzle ? puzzleText(variantSource(puzzle, variant), locale).hints : record.hints
  return (hints.length === record.hints.length ? hints : record.hints)[index]
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
