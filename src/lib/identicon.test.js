import { expect, it } from 'vitest'
import { IDENTICON_SIZE, identicon } from './identicon.js'

const filled = (grid) => grid.flat().filter(Boolean).length

it('draws an 8x8 grid', () => {
  const grid = identicon('ada')
  expect(IDENTICON_SIZE).toBe(8)
  expect(grid).toHaveLength(8)
  for (const row of grid) expect(row).toHaveLength(8)
})

it('gives the same picture for the same seed', () => {
  expect(identicon('ada')).toEqual(identicon('ada'))
})

it('gives different pictures for different seeds', () => {
  const pictures = new Set(['ada', 'grace', 'linus', 'alan', 'barbara'].map((seed) => JSON.stringify(identicon(seed))))
  expect(pictures.size).toBe(5)
})

it('mirrors the left half onto the right half', () => {
  for (const seed of ['ada', 'grace', '', 'a-much-longer-seed-1234567890']) {
    for (const row of identicon(seed)) expect(row).toEqual([...row].reverse())
  }
})

it('is never empty or a solid block', () => {
  for (let index = 0; index < 200; index++) {
    const count = filled(identicon(`seed-${index}`))
    expect(count).toBeGreaterThanOrEqual(12)
    expect(count).toBeLessThanOrEqual(52)
  }
})
