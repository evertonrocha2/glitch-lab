// @vitest-environment node
import { expect, it } from 'vitest'
import { answersFor, datasetPayload, datasetSet, hash, NO_REPEAT_DAYS, revealOrder } from '../../api/_lib/riddle/schedule.js'
import { addDays } from '../../shared/daily.js'
import { LAUNCH_DAY, MODES } from '../../shared/riddle/game.js'
import { languageById } from '../../shared/riddle/languages.js'
import { SAMPLES } from '../../shared/riddle/samples.js'

it('hashes text the same way every time', () => {
  expect(hash('2026-10-22:classic')).toBe(hash('2026-10-22:classic'))
  expect(hash('2026-10-22:classic')).not.toBe(hash('2026-10-22:error'))
})

it('picks the same answers for a day every time, three different languages', () => {
  const set = answersFor('2026-10-22')
  expect(answersFor('2026-10-22')).toEqual(set)
  expect(Object.keys(set)).toEqual(MODES)
  for (const id of Object.values(set)) expect(languageById(id)).not.toBeNull()
  expect(new Set(Object.values(set)).size).toBe(3)
  expect(answersFor('2026-10-23')).not.toEqual(set)
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
  expect(new Set(Object.values(set)).size).toBe(3)
})

it('builds Error and Snippet payloads from the dataset', () => {
  const day = '2026-10-22'
  const set = datasetSet(day)
  expect(set.map((item) => item.mode)).toEqual(MODES)
  const byMode = Object.fromEntries(set.map((item) => [item.mode, item]))
  expect(byMode.classic).toMatchObject({ day, payload: {}, source: 'dataset' })
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
