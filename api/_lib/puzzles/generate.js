import { conceptLabel } from '../../../shared/concepts.js'
import { DIFFICULTIES } from '../../../shared/daily.js'
import { LIMITS } from '../../../shared/limits.js'
import { generateJson } from '../ai/index.js'
import { buildPuzzlePrompt, PUZZLE_SCHEMA, PUZZLE_SYSTEM } from '../prompts/puzzle.js'

export const HINTS_PER_PUZZLE = 3
const MAX_TITLE = 60
const MAX_LINES = { daily: 20, global: 40 }
const DAY_MS = 24 * 3_600_000

// Each bug type, with the languages where it shows up naturally. The order of the keys is the
// rotation order of the dailies.
export const LANGUAGES_BY_CONCEPT = {
  'undefined-access': ['javascript', 'typescript'],
  'index-out-of-range': ['python', 'java', 'javascript'],
  'not-defined': ['javascript', 'python'],
  'type-mismatch': ['python', 'typescript', 'javascript'],
  'off-by-one': ['python', 'java', 'javascript'],
  'indentation-syntax': ['python'],
  'missing-return': ['javascript', 'python', 'java'],
  'wrong-comparison': ['javascript', 'python', 'java'],
  'mutation-reference': ['python', 'javascript'],
  'async-await': ['javascript', 'typescript'],
  'key-error': ['python', 'javascript'],
}
const TOPICS = Object.keys(LANGUAGES_BY_CONCEPT)

// Which bug type and language a slot trains. Stepping 3 bug types a day keeps the three dailies
// of a day different and doesn't repeat a type for almost two weeks; the global steps by week.
export function planSlot({ kind, day, difficulty }) {
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
  const step = kind === 'global' ? Math.floor(days / 7) : days
  const offset = kind === 'global' ? 0 : DIFFICULTIES.indexOf(difficulty)
  const concept = TOPICS[(step * (kind === 'global' ? 4 : 3) + offset) % TOPICS.length]
  const languages = LANGUAGES_BY_CONCEPT[concept]
  return { concept, language: languages[(step + offset) % languages.length] }
}

const filled = (value) => typeof value === 'string' && value.trim() !== ''
// The app never shows em dashes; the AI likes them in prose.
const prose = (text) => text.replace(/\s*\u2014\s*/g, ', ')

// Splits the AI answer into the public puzzle and its secret, or throws when anything is off.
// Stricter than a gym challenge: everyone gets this puzzle, so a broken one can't slip through.
export function parsePuzzle(data, { kind, recentTitles }) {
  const { title, brokenCode, symptom, solution, bugExplanation } = data ?? {}
  const hints = Array.isArray(data?.hints) ? data.hints.slice(0, HINTS_PER_PUZZLE) : []
  if (hints.length !== HINTS_PER_PUZZLE || !hints.every(filled) || ![title, brokenCode, symptom, solution, bugExplanation].every(filled)) {
    throw new Error('AI puzzle is incomplete')
  }
  const name = prose(title.trim())
  if (name.length > MAX_TITLE || name.includes('\n')) throw new Error('AI puzzle title is not a short name')
  if (recentTitles.some((used) => used.trim().toLowerCase() === name.toLowerCase())) throw new Error('AI puzzle repeats a recent title')
  for (const code of [brokenCode, solution]) {
    if (code.includes('```') || code.length > LIMITS.code) throw new Error('AI puzzle code is not plain or too long')
  }
  if (brokenCode.split('\n').length > MAX_LINES[kind]) throw new Error('AI puzzle code is too long')
  if (solution.trim() === brokenCode.trim()) throw new Error('AI puzzle solution changes nothing')
  return {
    puzzle: { title: name, brokenCode, symptom: prose(symptom), hints: hints.map(prose) },
    secret: { solution, bugExplanation: prose(bugExplanation) },
  }
}

// One AI call for one slot: { puzzle, secret } ready for store.createPuzzle, or it throws.
export async function generatePuzzle(slot, recentTitles) {
  const { concept, language } = planSlot(slot)
  const answer = await generateJson({
    system: PUZZLE_SYSTEM,
    prompt: buildPuzzlePrompt({ ...slot, language, conceptName: conceptLabel(concept), avoidTitles: recentTitles }),
    schema: PUZZLE_SCHEMA,
  })
  const parsed = parsePuzzle(answer, { kind: slot.kind, recentTitles })
  return { puzzle: { ...slot, language, concept, ...parsed.puzzle }, secret: parsed.secret }
}
