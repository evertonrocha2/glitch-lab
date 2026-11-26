// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRng } from '../../shared/game/rng.js'

describe('createRng', () => {
  it('repeats the same stream for the same seed', () => {
    const a = createRng('alice:1'), b = createRng('alice:1')
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()))
  })
  it('gives different streams for different seeds', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next())
  })
  it('keeps int, pick and chance in range', () => {
    const r = createRng(7)
    for (let i = 0; i < 500; i++) {
      const n = r.int(6); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(6)
    }
    expect(['x', 'y']).toContain(r.pick(['x', 'y']))
    expect(r.chance(0)).toBe(false); expect(r.chance(1)).toBe(true)
  })
  it('follows weights roughly', () => {
    const r = createRng('w'), hits = { a: 0, b: 0 }
    for (let i = 0; i < 4000; i++) hits[r.weighted({ a: 3, b: 1 })]++
    expect(hits.a / 4000).toBeGreaterThan(0.7); expect(hits.a / 4000).toBeLessThan(0.8)
  })
  it('forks without moving the parent', () => {
    const a = createRng('p'), b = createRng('p')
    a.fork('drops').next()
    expect(a.next()).toBe(b.next())
    expect(createRng('p').fork('x').next()).toBe(createRng('p').fork('x').next())
  })
})
