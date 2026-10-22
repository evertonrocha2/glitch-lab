import { addDays, challengeDay } from '../../../shared/daily.js'
import { languageById } from '../../../shared/riddle/languages.js'
import { SAMPLES } from '../../../shared/riddle/samples.js'
import { generateJson } from '../ai/index.js'
import { buildRiddleErrorPrompt, RIDDLE_ERROR_SCHEMA, RIDDLE_ERROR_SYSTEM } from '../prompts/riddle.js'
import { errorProblem } from './clues.js'
import { datasetSet } from './schedule.js'

// A quick side call: the cron also writes the daily puzzles inside the same function budget.
const AI_TIMEOUT_MS = 60_000

const byMode = (list) => Object.fromEntries(list.map((item) => [item.mode, item]))

// The day's riddles by mode, filling any missing mode from the dataset first (the cron didn't
// run). The dataset pick depends only on the date, so two requests racing save the same riddle,
// and the (day, mode) slot keeps just one.
export async function ensureRiddleSet(store, day) {
  const set = byMode(await store.listRiddles({ day }))
  const missing = datasetSet(day).filter((item) => !set[item.mode])
  if (missing.length === 0) return set
  for (const item of missing) await store.createRiddle(item)
  return byMode(await store.listRiddles({ day }))
}

// One fresh error message for Error mode, or it throws when the AI fails or gives the answer away.
export async function freshError(languageId) {
  const language = languageById(languageId)
  const answer = await generateJson({
    system: RIDDLE_ERROR_SYSTEM,
    prompt: buildRiddleErrorPrompt({ languageName: language.name, examples: SAMPLES[language.id].errors }),
    schema: RIDDLE_ERROR_SCHEMA,
    timeoutMs: AI_TIMEOUT_MS,
  })
  // The app never shows em dashes.
  const text = typeof answer?.error === 'string' ? answer.error.replace(/\s*—\s*/g, ' - ').trim() : ''
  const problem = errorProblem(text, language)
  if (problem) throw new Error(`AI error clue ${problem}`)
  return text
}

// The daily cron: today's and tomorrow's riddles, so the next game is ready the moment the day
// turns. Only missing modes are written, so running it twice changes nothing. Error mode asks
// the AI for a fresh message and keeps the dataset's when the AI fails. Reports no answers.
export async function runRiddleCron(store, now = new Date()) {
  const today = challengeDay(now)
  const perDay = await Promise.all(
    [today, addDays(today, 1)].map(async (day) => {
      const existing = byMode(await store.listRiddles({ day }))
      const created = []
      for (const item of datasetSet(day)) {
        if (existing[item.mode]) continue
        let made = item
        if (item.mode === 'error') {
          try {
            made = { ...item, payload: { text: await freshError(item.answer) }, source: 'ai' }
          } catch (err) {
            console.error(`Glitchdle error clue for ${day} failed, using the dataset:`, err.message)
          }
        }
        const saved = await store.createRiddle(made)
        if (saved) created.push({ day, mode: saved.mode, source: saved.source })
      }
      return created
    }),
  )
  return { today, created: perDay.flat() }
}
