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
import { datasetSet, poolPayload, revealOrder } from './schedule.js'

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

// The prompt lists this many known clues to stay away from: enough to steer, short enough to send.
const MAX_EXAMPLES = 12
const sameText = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase()

// Every clue a language already has in a mode: the dataset's, then the AI's from past days (the
// store keeps every riddle). The pool grows each day the AI writes a good one, so prompts can
// steer away from all of them and a day the AI fails still has more than the dataset to pick from.
export function knownClues(history, languageId, mode) {
  const samples = mode === 'error' ? SAMPLES[languageId].errors : SAMPLES[languageId].snippets
  const past = history
    .filter((item) => item.mode === mode && item.answer === languageId && item.source === 'ai')
    .map((item) => (mode === 'error' ? item.payload?.text : item.payload?.lines?.join('\n')))
    .filter((text) => typeof text === 'string' && text.trim())
  const seen = new Set()
  return [...samples, ...past].filter((text) => {
    const key = sameText(text)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// One fresh error message for Error mode, or it throws when the AI fails, gives the answer away
// or repeats a clue the language already has.
export async function freshError(languageId, known = SAMPLES[languageId].errors) {
  const language = languageById(languageId)
  const answer = await generateJson({
    system: RIDDLE_ERROR_SYSTEM,
    prompt: buildRiddleErrorPrompt({ languageName: language.name, examples: known.slice(-MAX_EXAMPLES) }),
    schema: RIDDLE_ERROR_SCHEMA,
    timeoutMs: AI_TIMEOUT_MS,
  })
  // The app never shows em dashes.
  const text = typeof answer?.error === 'string' ? answer.error.replace(/\s*\u2014\s*/g, ' - ').trim() : ''
  const problem = errorProblem(text, language)
  if (problem) throw new Error(`AI error clue ${problem}`)
  if (known.some((item) => sameText(item) === sameText(text))) throw new Error('AI error clue repeats a known one')
  return text
}

// One fresh snippet for Snippet mode ({ lines, order }), or it throws when the AI fails, gives the
// answer away or repeats a known snippet. The answer repeats every few weeks; the code shown is new each time.
export async function freshSnippet(languageId, day, known = SAMPLES[languageId].snippets) {
  const language = languageById(languageId)
  const answer = await generateJson({
    system: RIDDLE_SNIPPET_SYSTEM,
    prompt: buildRiddleSnippetPrompt({ languageName: language.name, examples: known.slice(-MAX_EXAMPLES / 2) }),
    schema: RIDDLE_SNIPPET_SCHEMA,
    timeoutMs: AI_TIMEOUT_MS,
  })
  // The app never shows em dashes.
  const code = typeof answer?.code === 'string' ? answer.code.replace(/\s*\u2014\s*/g, ' - ').replace(/\s+$/, '') : ''
  const problem = snippetProblem(code, language)
  if (problem) throw new Error(`AI snippet clue ${problem}`)
  if (known.some((item) => sameText(item) === sameText(code))) throw new Error('AI snippet clue repeats a known one')
  const lines = code.split('\n')
  return { lines, order: revealOrder(lines, `${day}:snippet:order`) }
}

// Error and Snippet clues are written fresh by the AI each day; classic boards need none.
const FRESH = {
  error: async (item, known) => ({ text: await freshError(item.answer, known) }),
  snippet: (item, known) => freshSnippet(item.answer, item.day, known),
}

// When the AI can't write a clue: one from everything the language has, the same pick for the
// day. With no past AI clues the pool is the dataset and this is exactly datasetPayload.
function fallbackClue(item, known) {
  const payload = poolPayload(item.day, item.mode, known)
  const picked = sameText(item.mode === 'error' ? payload.text : payload.lines.join('\n'))
  const samples = item.mode === 'error' ? SAMPLES[item.answer].errors : SAMPLES[item.answer].snippets
  return { ...item, payload, source: samples.some((text) => sameText(text) === picked) ? 'dataset' : 'ai' }
}

// The daily cron: today's and tomorrow's riddles, so the next game is ready the moment the day
// turns. Only missing modes are written, so running it twice changes nothing. Error and Snippet
// ask the AI for a fresh clue and fall back to a known one when it fails. Reports no answers.
export async function runRiddleCron(store, now = new Date()) {
  const today = challengeDay(now)
  const history = await store.listRiddles()
  const perDay = await Promise.all(
    [today, addDays(today, 1)].map(async (day) => {
      const existing = byMode(history.filter((item) => item.day === day))
      const created = []
      for (const item of datasetSet(day)) {
        if (existing[item.mode]) continue
        let made = item
        if (FRESH[item.mode]) {
          const known = knownClues(history, item.answer, item.mode)
          try {
            made = { ...item, payload: await FRESH[item.mode](item, known), source: 'ai' }
          } catch (err) {
            console.error(`Glitchdle ${item.mode} clue for ${day} failed, using a known one:`, err.message)
            made = fallbackClue(item, known)
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
