// Review cards, built without any AI from the student's own cases and challenges (and the
// hand-written puzzle pool when they have nothing better). Three kinds:
//   cause: an error message (theirs when possible), pick which kind of bug causes it.
//   line:  broken code, pick the line with the bug (found by comparing it with the fix).
//   fix:   the line with the bug, pick the change that fixes it (the wrong options are small
//          deterministic edits of the right one and of the broken line).
// A card keeps its answer; publicCard() is what the browser may see before answering.
import { REVIEW_CONCEPTS } from '../../../shared/review.js'
import { POOL } from '../puzzles/pool.js'

export const CARD_TYPES = ['cause', 'line', 'fix']
const MAX_LINES = 16
const MAX_ERROR = 600
const MAX_LINE_LENGTH = 160
const LETTERS = ['a', 'b', 'c', 'd']

// A small seeded random generator (mulberry32), so a session can be rebuilt the same way in tests.
export function seededRandom(seed) {
  let state = 0
  for (const char of String(seed)) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function shuffle(list, random) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

const splitLines = (code) => String(code ?? '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
const same = (a, b) => a.trim() === b.trim()

// The one line a fix changes: { index, broken, fixed }, or null when the fix adds or removes lines
// or touches more than one (then "which line?" has no single answer).
export function changedLine(brokenCode, solution) {
  const broken = splitLines(brokenCode)
  const fixed = splitLines(solution)
  let start = 0
  while (start < broken.length && start < fixed.length && same(broken[start], fixed[start])) start++
  let endBroken = broken.length - 1
  let endFixed = fixed.length - 1
  while (endBroken > start && endFixed > start && same(broken[endBroken], fixed[endFixed])) {
    endBroken--
    endFixed--
  }
  if (start >= broken.length || endBroken !== start || endFixed !== start) return null
  return { index: start, broken: broken[start], fixed: fixed[start] }
}

// Small edits that turn a line into a near miss: flipped comparisons, numbers one off, a dropped
// await or return, and so on. Each rule changes only its first match. Every edit must break the
// line: one that keeps it working (const to let, say) would make a second right answer.
const EDITS = [
  [/<=/, '<'],
  [/>=/, '>'],
  [/(?<![<>=!-])<(?![=<])/, '<='],
  [/(?<![<>=!-])>(?![=>])/, '>='],
  [/===/, '!=='],
  [/!==/, '==='],
  [/(?<![=!<>])==(?!=)/, '!='],
  [/!=(?!=)/, '=='],
  [/ - 1\b/, ' + 1'],
  [/ \+ 1\b/, ' - 1'],
  [/ - 1\b/, ''],
  [/\?\./, '.'],
  [/\.lower\(\)/, '.upper()'],
  [/\.upper\(\)/, '.lower()'],
  [/\[-1\]/, '[0]'],
  [/\btrue\b/, 'false'],
  [/\bfalse\b/, 'true'],
  [/\bTrue\b/, 'False'],
  [/\bFalse\b/, 'True'],
  [/&&/, '||'],
  [/\|\|/, '&&'],
  [/\band\b/, 'or'],
  [/\bor\b/, 'and'],
  [/\bawait /, ''],
  [/\breturn /, ''],
  [/\b(\d+)\b/, (number) => String(Number(number) + 1)],
  // Never down to 0: "- 0" or "[-0]" reads as a joke, not a near miss.
  [/\b([2-9]|[1-9]\d+)\b/, (number) => String(Number(number) - 1)],
]

export function nearMisses(line) {
  const results = []
  for (const [pattern, replacement] of EDITS) {
    const edited = line.replace(pattern, replacement)
    if (edited !== line && edited.trim()) results.push(edited)
  }
  return results
}

// Up to 3 wrong options for a fix: near misses of the right line and of the broken one, taken in
// turn. The broken line itself only fills in when there aren't 2 others. null when there still aren't.
export function fixDistractors(broken, fixed) {
  const fromFixed = nearMisses(fixed)
  const fromBroken = nearMisses(broken)
  const picked = []
  const take = (candidate) => {
    if (picked.length >= 3 || same(candidate, fixed) || same(candidate, broken) || picked.some((item) => same(item, candidate))) return
    picked.push(candidate)
  }
  for (let index = 0; index < Math.max(fromFixed.length, fromBroken.length); index++) {
    if (fromFixed[index] !== undefined) take(fromFixed[index])
    if (fromBroken[index] !== undefined) take(fromBroken[index])
  }
  if (picked.length < 2 && !same(broken, fixed)) picked.push(broken)
  return picked.length >= 2 ? picked : null
}

const codeLines = (code) => {
  const lines = splitLines(code)
  if (lines.length > MAX_LINES || lines.some((line) => line.length > MAX_LINE_LENGTH)) return null
  return lines.filter((line) => line.trim()).length >= 2 ? lines : null
}

// What kind of bug causes this error? Options are the concept ids; the browser names them.
function causeCard(concept, sample, random) {
  const error = (sample.error ?? sample.symptom ?? '').trim()
  if (!error) return null
  const others = shuffle(REVIEW_CONCEPTS.filter((id) => id !== concept), random).slice(0, 3)
  const options = shuffle([concept, ...others], random).map((value, index) => ({ id: LETTERS[index], value }))
  return {
    type: 'cause',
    concept,
    prompt: { error: error.slice(0, MAX_ERROR), lines: sample.code ? codeLines(sample.code) : null, language: sample.language },
    options,
    answer: options.find((option) => option.value === concept).id,
  }
}

// Which line has the bug? Options are the non-blank lines (0-based indexes).
function lineCard(concept, sample) {
  const lines = sample.solution && codeLines(sample.code)
  const change = lines && changedLine(sample.code, sample.solution)
  if (!change) return null
  const options = lines.flatMap((line, index) => (line.trim() ? [{ id: `l${index + 1}`, value: index }] : []))
  return {
    type: 'line',
    concept,
    prompt: { lines, language: sample.language, symptom: sample.symptom ?? null },
    options,
    answer: `l${change.index + 1}`,
    fixed: change.fixed,
  }
}

// Which change fixes the line? The right line among near misses.
function fixCard(concept, sample, random) {
  const lines = sample.solution && codeLines(sample.code)
  const change = lines && changedLine(sample.code, sample.solution)
  const wrong = change && change.fixed.length <= MAX_LINE_LENGTH && fixDistractors(change.broken, change.fixed)
  if (!wrong) return null
  const options = shuffle([change.fixed, ...wrong], random).map((value, index) => ({ id: LETTERS[index], value: value.trim() }))
  return {
    type: 'fix',
    concept,
    prompt: { lines, bugLine: change.index, language: sample.language, symptom: sample.symptom ?? null },
    options,
    answer: options.find((option) => option.value === change.fixed.trim()).id,
    fixed: change.fixed,
  }
}

const BUILDERS = { cause: causeCard, line: lineCard, fix: fixCard }

// The hand-written puzzles for a concept, as samples. Their prose is English, so the explanation
// only rides along for English readers.
export function poolSamples(concept, locale) {
  return POOL.filter((puzzle) => puzzle.concept === concept).map((puzzle) => ({
    symptom: puzzle.symptom,
    code: puzzle.brokenCode,
    solution: puzzle.solution,
    explanation: locale === 'en' ? puzzle.bugExplanation : null,
    language: puzzle.language,
  }))
}

// One card for a concept. `turn` (how many times it was reviewed) rotates the preferred kind, so
// the same concept comes back as a different question; the others are fallbacks. Samples are
// tried in order, the student's own first. null when nothing fits.
export function buildCard(concept, samples, { turn = 0, random = Math.random } = {}) {
  for (let step = 0; step < CARD_TYPES.length; step++) {
    const type = CARD_TYPES[(turn + step) % CARD_TYPES.length]
    for (const sample of samples) {
      const card = BUILDERS[type](concept, sample, random)
      if (card) return { ...card, explanation: sample.explanation ?? null }
    }
  }
  return null
}

// What the browser sees before answering: no answer, no explanation, and no concept on a
// "what causes this?" card (that's the question).
export function publicCard(card, index) {
  return { index, type: card.type, concept: card.type === 'cause' ? null : card.concept, prompt: card.prompt, options: card.options }
}
