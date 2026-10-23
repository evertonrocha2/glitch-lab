import { randomInt } from 'node:crypto'
import { CONCEPTS, conceptLabel } from '../../../shared/concepts.js'
import { DUEL_ROUNDS, ROUND_MS } from '../../../shared/duel.js'
import { LANGUAGES, languageById } from '../../../shared/riddle/languages.js'
import { SAMPLES } from '../../../shared/riddle/samples.js'
import { hash } from '../riddle/schedule.js'
import { DUEL_BUGS } from './bugs.js'

// Duel questions, built on the server. Server only: the error samples, the snippets and the
// duel's own bug set (bugs.js, never the daily challenge's pool) never ship to the browser, and
// neither does a round's answer until that round is over.

export const QUESTION_TYPES = ['error', 'snippet', 'bug']
// Every duel: two "which language printed this error?", two "which language is this snippet?"
// and one "what kind of bug is this?", in a shuffled order.
const MIX = ['error', 'error', 'snippet', 'snippet', 'bug']
export const OPTION_COUNT = 4

// A random whole number below `count`. Tests pass their own.
const cryptoRandom = (count) => randomInt(count)

const pickOne = (list, random) => list[random(list.length)]

function shuffle(list, random) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = random(index + 1)
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

// `count` distinct items from `list`, in a random order.
const sample = (list, count, random) => shuffle(list, random).slice(0, count)

const languageOption = (id) => ({ id, name: languageById(id).name })
const conceptOption = (id) => ({ id, name: conceptLabel(id) })

// Three wrong languages: one from the same syntax family when there is one (so the look alone
// doesn't give it away), the rest from anywhere.
function languageDistractors(answerId, random) {
  const answer = languageById(answerId)
  const others = LANGUAGES.filter((item) => item.id !== answerId)
  const cousins = others.filter((item) => item.syntax === answer.syntax)
  const first = cousins.length ? [pickOne(cousins, random).id] : []
  const rest = sample(
    others.filter((item) => !first.includes(item.id)),
    OPTION_COUNT - 1 - first.length,
    random,
  ).map((item) => item.id)
  return [...first, ...rest]
}

const BUG_CONCEPTS = CONCEPTS.filter((item) => item.id !== 'other').map((item) => item.id)

function languageQuestion(type, answerId, random) {
  const samples = SAMPLES[answerId]
  const prompt = type === 'error' ? { text: pickOne(samples.errors, random) } : { code: pickOne(samples.snippets, random) }
  const options = shuffle([answerId, ...languageDistractors(answerId, random)], random).map(languageOption)
  return { type, prompt, options, answer: answerId }
}

function bugQuestion(bug, random) {
  const wrong = sample(
    BUG_CONCEPTS.filter((id) => id !== bug.concept),
    OPTION_COUNT - 1,
    random,
  )
  return {
    type: 'bug',
    prompt: { code: bug.code, symptom: bug.symptom, language: languageById(bug.language)?.name ?? bug.language },
    options: shuffle([bug.concept, ...wrong], random).map(conceptOption),
    answer: bug.concept,
  }
}

// The rounds of a new duel: [{ type, prompt, options: [{ id, name }], answer }]. No language is the
// answer twice in one duel.
export function buildRounds(random = cryptoRandom) {
  const types = shuffle(MIX, random).slice(0, DUEL_ROUNDS)
  const languages = sample(
    LANGUAGES.map((item) => item.id),
    types.length,
    random,
  )
  const bugs = sample(DUEL_BUGS, types.length, random)
  return types.map((type, index) => (type === 'bug' ? bugQuestion(bugs[index], random) : languageQuestion(type, languages[index], random)))
}

// The Glitch Bot: right about 70% of the time, answering after 2.5 to 9.5 seconds, so a quick
// player can beat it and a slow one can't. Planned when the duel starts and kept on the server.
export const BOT_ACCURACY = 0.7
export const BOT_MIN_MS = 2_500
export const BOT_SPREAD_MS = 7_000
export function botPlan(rounds, random = cryptoRandom) {
  return rounds.map((round) => {
    const correct = random(100) < BOT_ACCURACY * 100
    const wrong = round.options.filter((option) => option.id !== round.answer)
    const delayMs = Math.min(ROUND_MS - 500, BOT_MIN_MS + random(BOT_SPREAD_MS))
    return { choice: correct ? round.answer : pickOne(wrong, random).id, delayMs }
  })
}

// The order one player sees a round's options in: a fixed shuffle per duel, player and round, so
// both players can't just agree on "press 2". The browser answers with the option's id, not its place.
export function optionsFor(round, duelId, userId, index) {
  let state = hash(`${duelId}:${userId}:${index}`) || 1
  const next = (count) => {
    // xorshift32
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state % count
  }
  return shuffle(round.options, next)
}
