import { addDays, challengeDay } from '../../../shared/daily.js'
import { MODES } from '../../../shared/riddle/game.js'
import { languageById } from '../../../shared/riddle/languages.js'
import { SAMPLES } from '../../../shared/riddle/samples.js'
import { generateJson } from '../../infra/ai/index.js'
import {
  buildRiddleErrorPrompt,
  buildRiddleSnippetPrompt,
  RIDDLE_ERROR_SCHEMA,
  RIDDLE_ERROR_SYSTEM,
  RIDDLE_SNIPPET_SCHEMA,
  RIDDLE_SNIPPET_SYSTEM,
} from './riddle.prompt.js'
import { errorProblem, snippetProblem } from './clues.js'
import { datasetSet, revealOrder } from './schedule.js'

// A quick side call: the cron also writes the daily puzzles inside the same function budget.
const AI_TIMEOUT_MS = 60_000

const byMode = (list) => Object.fromEntries(list.map((item) => [item.mode, item]))

// The day's riddles by slot, filling any missing slot from the dataset first (the cron didn't
// run). The dataset pick depends only on the date, so two requests racing save the same riddle,
// and the (day, mode) slot keeps just one. A framework or database board that can't be saved
// (a database not migrated yet, see supabase/schema.sql) is left out instead of breaking the
// language game.
export async function ensureRiddleSet(store, day) {
  const set = byMode(await store.listRiddles({ day }))
  const missing = datasetSet(day).filter((item) => !set[item.mode])
  if (missing.length === 0) return set
  for (const item of missing) {
    if (MODES.includes(item.mode)) await store.createRiddle(item)
    else await store.createRiddle(item).catch((err) => console.error(`Glitchdle ${item.mode} board for ${day} not saved:`, err.message))
  }
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
  const text = typeof answer?.error === 'string' ? answer.error.replace(/\s*\u2014\s*/g, ' - ').trim() : ''
  const problem = errorProblem(text, language)
  if (problem) throw new Error(`AI error clue ${problem}`)
  return text
}

// One fresh snippet for Snippet mode ({ lines, order }), or it throws when the AI fails or gives the
// answer away. The answer repeats every few weeks; the code shown is new each time.
export async function freshSnippet(languageId, day) {
  const language = languageById(languageId)
  const answer = await generateJson({
    system: RIDDLE_SNIPPET_SYSTEM,
    prompt: buildRiddleSnippetPrompt({ languageName: language.name, examples: SAMPLES[language.id].snippets }),
    schema: RIDDLE_SNIPPET_SCHEMA,
    timeoutMs: AI_TIMEOUT_MS,
  })
  // The app never shows em dashes.
  const code = typeof answer?.code === 'string' ? answer.code.replace(/\s*\u2014\s*/g, ' - ').replace(/\s+$/, '') : ''
  const problem = snippetProblem(code, language)
  if (problem) throw new Error(`AI snippet clue ${problem}`)
  const lines = code.split('\n')
  return { lines, order: revealOrder(lines, `${day}:snippet:order`) }
}

// Error and Snippet clues are written fresh by the AI each day; Classic needs none.
const FRESH = {
  error: async (item) => ({ text: await freshError(item.answer) }),
  snippet: (item) => freshSnippet(item.answer, item.day),
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
        if (FRESH[item.mode]) {
          try {
            made = { ...item, payload: await FRESH[item.mode](item), source: 'ai' }
          } catch (err) {
            console.error(`Glitchdle ${item.mode} clue for ${day} failed, using the dataset:`, err.message)
          }
        }
        // A category board that can't be saved never stops the language ones (see ensureRiddleSet).
        const saved = MODES.includes(made.mode)
          ? await store.createRiddle(made)
          : await store.createRiddle(made).catch((err) => {
              console.error(`Glitchdle ${made.mode} board for ${day} not saved:`, err.message)
              return null
            })
        if (saved) created.push({ day, mode: saved.mode, source: saved.source })
      }
      return created
    }),
  )
  return { today, created: perDay.flat() }
}
