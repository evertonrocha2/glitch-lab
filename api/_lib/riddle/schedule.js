import { LAUNCH_DAY, MODES } from '../../../shared/riddle/game.js'
import { LANGUAGES } from '../../../shared/riddle/languages.js'
import { SAMPLES } from '../../../shared/riddle/samples.js'

// Which language is each day's answer, worked out from the date alone, so a day the cron missed
// still gets the same answers for everyone. Server only: the browser must never be able to run this.

// A language doesn't come back in the same mode for this many days.
export const NO_REPEAT_DAYS = 20

const DAY_MS = 24 * 3_600_000
const dayNumber = (day) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
const dayString = (number) => new Date(number * DAY_MS).toISOString().slice(0, 10)

// FNV-1a: a small, stable string hash (the same on every machine and every run).
export function hash(text) {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value
}

const IDS = LANGUAGES.map((item) => item.id)
const LAUNCH = dayNumber(LAUNCH_DAY)
// Answers from the launch day on, worked out once and kept: day number - LAUNCH -> { mode: id }.
const walked = []

function pick(day, mode, taken) {
  const candidates = IDS.filter((id) => !taken.has(id))
  return candidates[hash(`${day}:${mode}`) % candidates.length]
}

// Walks forward from the launch day so each day can skip what the days before it used.
function walkTo(index) {
  while (walked.length <= index) {
    const today = walked.length
    const day = dayString(LAUNCH + today)
    const set = {}
    for (const mode of MODES) {
      // Not in this mode for NO_REPEAT_DAYS days, and never twice on the same day.
      const taken = new Set(Object.values(set))
      for (let back = Math.max(0, today - NO_REPEAT_DAYS); back < today; back++) taken.add(walked[back][mode])
      set[mode] = pick(day, mode, taken)
    }
    walked.push(set)
  }
  return walked[index]
}

// { classic, error, snippet }: the answer ids for a day. Days before the launch only keep the
// three modes apart.
export function answersFor(day) {
  const index = dayNumber(day) - LAUNCH
  if (index >= 0) return { ...walkTo(index) }
  const set = {}
  for (const mode of MODES) set[mode] = pick(day, mode, new Set(Object.values(set)))
  return set
}

// Lines that say nothing on their own ("}", "end", ");") are shown last.
const TRIVIAL = /^[\s{}()[\];,.]*(end|@end|end\.|fi|done|esac)?[\s{}()[\];,.]*$/

// The order Snippet mode reveals lines in: a fixed shuffle per day, blank lines left out.
export function revealOrder(lines, seed) {
  const useful = []
  const trivial = []
  lines.forEach((line, index) => {
    if (line.trim() === '') return
    ;(TRIVIAL.test(line) ? trivial : useful).push(index)
  })
  let state = hash(seed) || 1
  const next = () => {
    // xorshift32
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state
  }
  for (let index = useful.length - 1; index > 0; index--) {
    const other = next() % (index + 1)
    ;[useful[index], useful[other]] = [useful[other], useful[index]]
  }
  return [...useful, ...trivial]
}

// What a mode shows besides the board, built from the dataset: an error message for Error mode,
// a snippet and its reveal order for Snippet mode. Classic needs nothing.
export function datasetPayload(day, mode, answer) {
  const samples = SAMPLES[answer]
  if (mode === 'error') return { text: samples.errors[hash(`${day}:error:sample`) % samples.errors.length] }
  if (mode === 'snippet') {
    const lines = samples.snippets[hash(`${day}:snippet:sample`) % samples.snippets.length].split('\n')
    return { lines, order: revealOrder(lines, `${day}:snippet:order`) }
  }
  return {}
}

// The full set for a day, as the store saves it, from the dataset only.
export const datasetSet = (day) => {
  const answers = answersFor(day)
  return MODES.map((mode) => ({ day, mode, answer: answers[mode], payload: datasetPayload(day, mode, answers[mode]), source: 'dataset' }))
}
