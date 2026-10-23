import { poolEntryFor } from './puzzle-pool.js'

// A daily or global puzzle's prose for one reader: { title, symptom, hints, bugExplanation }.
// Everyone gets the same puzzle, so it is saved in English with a Brazilian Portuguese copy (`pt` on
// the puzzle, and on its secret for the explanation). A puzzle saved before that copy existed
// borrows the pool's translation when it came from the pool; anything missing stays English.
// bugExplanation is null without the secret: only the review cards ever show it.
export function puzzleText(puzzle, locale, secret = null) {
  const english = { title: puzzle.title, symptom: puzzle.symptom, hints: puzzle.hints, bugExplanation: secret?.bugExplanation ?? null }
  if (locale !== 'pt-BR') return english
  const saved = { ...puzzle.pt, ...secret?.pt }
  const pool = poolEntryFor(puzzle.brokenCode)?.pt ?? {}
  const pick = (field) => saved[field] || pool[field] || english[field]
  const hints = pick('hints')
  return {
    title: pick('title'),
    symptom: pick('symptom'),
    // A gym challenge hands hints out by position, so a translation must line up one to one.
    hints: Array.isArray(hints) && hints.length === puzzle.hints.length ? hints : puzzle.hints,
    bugExplanation: secret ? pick('bugExplanation') : null,
  }
}
