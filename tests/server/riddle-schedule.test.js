// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { answersFor, CATEGORY_NO_REPEAT_DAYS, datasetPayload, datasetSet, hash, NO_REPEAT_DAYS, revealOrder } from '../../server/modules/glitchdle/schedule.js'
import { itemById, SLOTS } from '../../shared/riddle/categories.js'
import { addDays } from '../../shared/daily.js'
import { LAUNCH_DAY, MODES } from '../../shared/riddle/game.js'
import { languageById } from '../../shared/riddle/languages.js'
import { SAMPLES } from '../../shared/riddle/samples.js'

it('hashes text the same way every time', () => {
  expect(hash('2026-10-22:classic')).toBe(hash('2026-10-22:classic'))
  expect(hash('2026-10-22:classic')).not.toBe(hash('2026-10-22:error'))
})

it('picks the same answers for a day every time: three different languages, a framework and a database', () => {
  const set = answersFor('2026-10-22')
  expect(answersFor('2026-10-22')).toEqual(set)
  expect(Object.keys(set)).toEqual(SLOTS)
  for (const mode of MODES) expect(languageById(set[mode])).not.toBeNull()
  expect(new Set(MODES.map((mode) => set[mode])).size).toBe(3)
  expect(itemById('frameworks', set.frameworks)).not.toBeNull()
  expect(itemById('databases', set.databases)).not.toBeNull()
  expect(answersFor('2026-10-23')).not.toEqual(set)
})

it(`never repeats a framework or a database within ${CATEGORY_NO_REPEAT_DAYS} days, and uses most of each catalog`, () => {
  const days = Array.from({ length: 300 }, (_, index) => addDays(LAUNCH_DAY, index))
  const sets = days.map(answersFor)
  for (const slot of ['frameworks', 'databases']) {
    for (let index = 0; index < sets.length; index++) {
      const window = sets.slice(Math.max(0, index - CATEGORY_NO_REPEAT_DAYS), index).map((set) => set[slot])
      expect(window, `${slot} on ${days[index]}`).not.toContain(sets[index][slot])
    }
    expect(new Set(sets.map((set) => set[slot])).size).toBeGreaterThan(40)
  }
})

it('keeps the language answers it picked before the new categories existed', () => {
  // Recorded with the fallback secret before frameworks and databases were added: adding a
  // category must never move a language answer.
  expect(answersFor('2026-10-24')).toMatchObject({ classic: 'ocaml', error: 'fsharp', snippet: 'bash' })
  expect(answersFor('2026-10-10')).toMatchObject({ classic: 'ocaml', error: 'php', snippet: 'sql' })
})

it(`never repeats a language in the same mode within ${NO_REPEAT_DAYS} days`, () => {
  const days = Array.from({ length: 400 }, (_, index) => addDays(LAUNCH_DAY, index))
  const sets = days.map(answersFor)
  for (const mode of MODES) {
    for (let index = 0; index < sets.length; index++) {
      const window = sets.slice(Math.max(0, index - NO_REPEAT_DAYS), index).map((set) => set[mode])
      expect(window, `${mode} on ${days[index]}`).not.toContain(sets[index][mode])
    }
  }
  // Over a long run every language gets its turn.
  expect(new Set(sets.map((set) => set.classic)).size).toBeGreaterThan(30)
})

it('still keeps the modes apart before the launch day', () => {
  const set = answersFor('2026-01-01')
  expect(new Set(MODES.map((mode) => set[mode])).size).toBe(3)
})

it('builds Error and Snippet payloads from the dataset', () => {
  const day = '2026-10-22'
  const set = datasetSet(day)
  expect(set.map((item) => item.mode)).toEqual(SLOTS)
  const byMode = Object.fromEntries(set.map((item) => [item.mode, item]))
  expect(byMode.classic).toMatchObject({ day, payload: {}, source: 'dataset' })
  expect(byMode.frameworks).toMatchObject({ day, payload: {}, source: 'dataset' })
  expect(SAMPLES[byMode.error.answer].errors).toContain(byMode.error.payload.text)
  const { lines, order } = byMode.snippet.payload
  expect(SAMPLES[byMode.snippet.answer].snippets).toContain(lines.join('\n'))
  expect(new Set(order).size).toBe(order.length)
  expect(order.every((index) => lines[index].trim() !== '')).toBe(true)
  expect(datasetPayload(day, 'snippet', byMode.snippet.answer)).toEqual(byMode.snippet.payload)
})

it('reveals snippet lines in a fixed shuffle, closing braces last, blanks never', () => {
  const lines = ['fn main() {', '    let x = 1;', '', '    println!("{}", x);', '}']
  const order = revealOrder(lines, 'seed')
  expect(revealOrder(lines, 'seed')).toEqual(order)
  expect(order.slice().sort()).toEqual([0, 1, 3, 4])
  expect(order.at(-1)).toBe(4)
  expect(revealOrder(['end', 'puts 1', 'x = 2', '  end'], 'a').slice(2).sort()).toEqual([0, 3])
})

it('needs the server secret to work out the answers, so the public code alone gives nothing away', () => {
  const days = Array.from({ length: 30 }, (_, index) => `2026-11-${String(index + 1).padStart(2, '0')}`)
  vi.stubEnv('GLITCHDLE_SECRET', 'one-secret')
  const first = days.map((day) => answersFor(day).classic)
  vi.stubEnv('GLITCHDLE_SECRET', 'another-secret')
  const second = days.map((day) => answersFor(day).classic)
  vi.unstubAllEnvs()
  expect(first).not.toEqual(second)
})
