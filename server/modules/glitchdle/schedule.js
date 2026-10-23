import { CATEGORIES } from '../../../shared/riddle/categories.js'
import { LAUNCH_DAY, MODES } from '../../../shared/riddle/game.js'
import { LANGUAGES } from '../../../shared/riddle/languages.js'
import { SAMPLES } from '../../../shared/riddle/samples.js'

// Which language is each day's answer, worked out from the date alone, so a day the cron missed
// still gets the same answers for everyone. Server only: the browser must never be able to run this.

// A language doesn't come back in the same mode for this many days (38 languages, 3 a day: 30
// leaves a handful to pick from). Raised from 20: the first 20 days pick the same either way.
export const NO_REPEAT_DAYS = 30
// Nor a framework or a database within 60 days; a catalog too small for that keeps 10 to pick from.
export const CATEGORY_NO_REPEAT_DAYS = 60
export const categoryWindow = (size) => Math.max(0, Math.min(CATEGORY_NO_REPEAT_DAYS, size - 10))

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

// The code is public, so the date alone would let anyone work out tomorrow's answers: every choice
// also mixes in a server secret. Production sets one of these; tests and local dev use the fallback.
const secret = () => process.env.GLITCHDLE_SECRET || process.env.CRON_SECRET || process.env.AUTH_SECRET || 'glitchdle-local'
const seeded = (text) => hash(`${secret()}:${text}`)

// LANGUAGES is append-only: reordering it would reshuffle every future answer.
const IDS = LANGUAGES.map((item) => item.id)
const LAUNCH = dayNumber(LAUNCH_DAY)
// Answers from the launch day on, worked out once per secret: day number - LAUNCH -> { mode: id }.
let walked = []
let walkedWith = null

function pick(day, mode, taken) {
  const candidates = IDS.filter((id) => !taken.has(id))
  return candidates[seeded(`${day}:${mode}`) % candidates.length]
}

// Walks forward from the launch day so each day can skip what the days before it used.
function walkTo(index) {
  if (walkedWith !== secret()) {
    walked = []
    walkedWith = secret()
  }
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

// The other categories walk the same way, each on its own, so adding one never moves the language
// answers. Their catalogs are sorted by id; a sync that adds items reshuffles days not yet saved,
// while saved days (the store's riddles) keep their answer.
const OTHER = CATEGORIES.filter((category) => category.id !== 'languages')
const categoryWalks = new Map()

function walkCategory(category, index) {
  const [slot] = category.modes
  const ids = category.items.map((item) => item.id)
  let walk = categoryWalks.get(slot)
  if (!walk || walk.secret !== secret() || walk.ids !== ids.join()) {
    walk = { secret: secret(), ids: ids.join(), picks: [] }
    categoryWalks.set(slot, walk)
  }
  while (walk.picks.length <= index) {
    const today = walk.picks.length
    const taken = new Set(walk.picks.slice(Math.max(0, today - categoryWindow(ids.length))))
    const candidates = ids.filter((id) => !taken.has(id))
    walk.picks.push(candidates[seeded(`${dayString(LAUNCH + today)}:${slot}`) % candidates.length])
  }
  return walk.picks[index]
}

// { classic, error, snippet, frameworks, databases }: the answer ids for a day. Days before the
// launch only keep the three language modes apart.
export function answersFor(day) {
  const index = dayNumber(day) - LAUNCH
  const set = {}
  if (index >= 0) Object.assign(set, walkTo(index))
  else for (const mode of MODES) set[mode] = pick(day, mode, new Set(Object.values(set)))
  for (const category of OTHER) {
    const [slot] = category.modes
    set[slot] = index >= 0 ? walkCategory(category, index) : category.items[seeded(`${day}:${slot}`) % category.items.length].id
  }
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
  let state = seeded(seed) || 1
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
// a snippet and its reveal order for Snippet mode. Classic boards need nothing.
export function datasetPayload(day, mode, answer) {
  const samples = SAMPLES[answer]
  if (mode === 'error') return poolPayload(day, mode, samples.errors)
  if (mode === 'snippet') return poolPayload(day, mode, samples.snippets)
  return {}
}

// The payload for a clue picked from `pool` (error texts, or snippets as one string each): the
// same pick for the same day and pool.
export function poolPayload(day, mode, pool) {
  if (mode === 'error') return { text: pool[seeded(`${day}:error:sample`) % pool.length] }
  const lines = pool[seeded(`${day}:snippet:sample`) % pool.length].split('\n')
  return { lines, order: revealOrder(lines, `${day}:snippet:order`) }
}

// The full set for a day, as the store saves it, from the dataset only.
export const datasetSet = (day) => {
  const answers = answersFor(day)
  return Object.entries(answers).map(([mode, answer]) => ({ day, mode, answer, payload: datasetPayload(day, mode, answer), source: 'dataset' }))
}
