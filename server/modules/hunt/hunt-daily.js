import { CONCEPTS, conceptLabel } from '../../../shared/concepts.js'
import { addDays, challengeDay } from '../../../shared/daily.js'
import { HUNT_LANGUAGES, HUNT_ROUNDS, MAX_LINES, MIN_LINES } from '../../../shared/hunt/game.js'
import { HUNT_POOL } from '../../../shared/hunt/snippets.js'
import { generateJson } from '../../infra/ai/index.js'
import { buildHuntPrompt, HUNT_SCHEMA, HUNT_SYSTEM } from './hunt.prompt.js'
import { hash } from '../glitchdle/schedule.js'

// Line hunt's daily set: 8 snippets, the same for everyone. The cron asks the AI for a few fresh
// ones and fills the rest from the pool; a day the cron missed (or the AI failed) is all pool. Which
// pool snippets a day gets depends on the date and a server secret, so two requests racing save the
// same set and nobody can work out tomorrow's from the public code.

// How many fresh AI snippets the cron asks for each day.
export const AI_PER_DAY = 3
// A quick side call: the cron also writes the puzzles and the Glitchdle inside the same budget.
const AI_TIMEOUT_MS = 60_000
const MAX_LINE_CHARS = 100
const MAX_SYMPTOM_CHARS = 200
const MAX_EXPLANATION_CHARS = 320

const secret = () => process.env.GLITCHDLE_SECRET || process.env.CRON_SECRET || process.env.AUTH_SECRET || 'glitchdle-local'
const seeded = (text) => hash(`${secret()}:hunt:${text}`)

// A fixed shuffle per seed (Fisher-Yates over xorshift32).
export function shuffle(list, seed) {
  const out = [...list]
  let state = seeded(seed) || 1
  const next = () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state
  }
  for (let index = out.length - 1; index > 0; index--) {
    const other = next() % (index + 1)
    ;[out[index], out[other]] = [out[other], out[index]]
  }
  return out
}

const CONCEPT_IDS = new Set(CONCEPTS.map((concept) => concept.id))
const TOPICS = CONCEPTS.map((concept) => concept.id).filter((id) => id !== 'other')

// What makes two snippets the same code: the lines with their indentation and blank lines gone.
export const codeKey = (lines) =>
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
export const POOL_KEYS = new Set(HUNT_POOL.map((item) => codeKey(item.code)))

// A real error message reads the same in both languages: the pool keeps it as one string.
export const symptomOf = (symptom) => (typeof symptom === 'string' ? { en: symptom, pt: symptom } : symptom)

const filled = (text, max) => typeof text === 'string' && text.trim() !== '' && text.length <= max && !text.includes('\n')
// The app never shows em dashes; the AI likes them in prose.
const prose = (text) => (typeof text === 'string' ? text.replace(/\s*—\s*/g, ', ').trim() : '')

// Why a snippet can't go in a run, or null when it can. The deterministic check every AI snippet
// passes (and every pool snippet, in the tests): known language and bug type, 6 to 15 plain lines,
// the bug line exists and isn't blank, both symptoms and explanations are there, and the code isn't
// one already used (`taken`: code keys of the pool and of the snippets accepted before it).
export function huntSnippetProblem(snippet, taken = POOL_KEYS) {
  const { language, concept, code, line } = snippet ?? {}
  if (!HUNT_LANGUAGES.includes(language)) return 'unknown language'
  if (!CONCEPT_IDS.has(concept)) return 'unknown concept'
  if (!Array.isArray(code) || !code.every((row) => typeof row === 'string')) return 'no code'
  if (code.length < MIN_LINES) return 'too short'
  if (code.length > MAX_LINES) return 'too long'
  if (code.some((row) => row.length > MAX_LINE_CHARS)) return 'lines too long'
  if (code.some((row) => row.includes('```'))) return 'not plain code'
  if (!Number.isInteger(line) || line < 1 || line > code.length) return 'bug line does not exist'
  if (code[line - 1].trim() === '') return 'bug line is blank'
  const symptom = symptomOf(snippet.symptom ?? {})
  if (!filled(symptom?.en, MAX_SYMPTOM_CHARS) || !filled(symptom?.pt, MAX_SYMPTOM_CHARS)) return 'no symptom'
  if (!filled(snippet.explanation?.en, MAX_EXPLANATION_CHARS) || !filled(snippet.explanation?.pt, MAX_EXPLANATION_CHARS)) return 'no explanation'
  if (taken.has(codeKey(code))) return 'same code as another snippet'
  return null
}

const toLines = (code) =>
  typeof code === 'string'
    ? code
        .replace(/\t/g, '    ')
        .replace(/\s+$/, '')
        .split('\n')
        .map((row) => row.replace(/\s+$/, ''))
    : null

// The AI answer's snippets that pass the check, at most AI_PER_DAY, as a run stores them.
export function parseAiSnippets(answer, day, taken = POOL_KEYS) {
  const list = Array.isArray(answer?.snippets) ? answer.snippets : []
  const keys = new Set(taken)
  const accepted = []
  for (const item of list) {
    if (accepted.length >= AI_PER_DAY) break
    const snippet = {
      id: `ai-${day}-${accepted.length + 1}`,
      language: item?.language,
      concept: item?.concept,
      line: item?.line,
      code: toLines(item?.code),
      symptom: { en: prose(item?.symptomEn), pt: prose(item?.symptomPt) },
      explanation: { en: prose(item?.explanationEn), pt: prose(item?.explanationPt) },
      source: 'ai',
    }
    const problem = huntSnippetProblem(snippet, keys)
    if (problem) {
      console.error(`Line hunt AI snippet for ${day} skipped: ${problem}`)
      continue
    }
    keys.add(codeKey(snippet.code))
    accepted.push(snippet)
  }
  return accepted
}

// The languages and bug types the AI is asked for on a day.
export const aiPicks = (day) =>
  Array.from({ length: AI_PER_DAY }, (_, index) => {
    const concept = TOPICS[seeded(`${day}:ai:${index}:concept`) % TOPICS.length]
    return { language: HUNT_LANGUAGES[seeded(`${day}:ai:${index}:language`) % HUNT_LANGUAGES.length], concept, conceptName: conceptLabel(concept) }
  })

// One AI call for a day's fresh snippets: the ones that pass the check (maybe none), or it throws.
export async function freshSnippets(day) {
  const answer = await generateJson({
    system: HUNT_SYSTEM,
    prompt: buildHuntPrompt({ picks: aiPicks(day), minLines: MIN_LINES, maxLines: MAX_LINES }),
    schema: HUNT_SCHEMA,
    timeoutMs: AI_TIMEOUT_MS,
  })
  return parseAiSnippets(answer, day)
}

const fromPool = (item) => ({ ...item, symptom: symptomOf(item.symptom), source: 'pool' })

// A day's set as the store saves it: the AI snippets plus pool picks up to HUNT_ROUNDS, in a fixed order.
export function buildSet(day, ai = []) {
  const picks = shuffle(HUNT_POOL, `${day}:pool`).slice(0, HUNT_ROUNDS - ai.length).map(fromPool)
  return { day, snippets: shuffle([...picks, ...ai], `${day}:order`), source: ai.length > 0 ? 'ai' : 'pool' }
}

// The day's set, written from the pool first when the cron didn't run.
export async function ensureHuntDay(store, day) {
  const existing = await store.getHuntDay(day)
  if (existing) return existing
  await store.createHuntDay(buildSet(day))
  return store.getHuntDay(day)
}

// The daily cron: today's and tomorrow's sets, so the next run is ready the moment the day turns.
// Only missing days are written, so running it twice changes nothing. AI snippets that fail the
// check are replaced from the pool. When the AI call itself fails, today falls back to the pool and
// tomorrow stays empty for the next run to try again. Reports no answers.
export async function runHuntCron(store, now = new Date()) {
  const today = challengeDay(now)
  const perDay = await Promise.all(
    [today, addDays(today, 1)].map(async (day) => {
      if (await store.getHuntDay(day)) return null
      let ai
      try {
        ai = await freshSnippets(day)
      } catch (err) {
        console.error(`Line hunt AI snippets for ${day} failed:`, err.message)
        // The AI is down: tomorrow waits for the next run, today can't wait.
        if (day !== today) return null
        ai = []
      }
      const saved = await store.createHuntDay(buildSet(day, ai))
      return saved ? { day, source: saved.source, fresh: ai.length } : null
    }),
  )
  return { today, created: perDay.filter(Boolean) }
}
