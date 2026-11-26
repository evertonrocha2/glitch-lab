// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, LOOK_OPTIONS, isLook, normalizeLook, randomLook } from '../../shared/game/look.js'
import { createRng } from '../../shared/game/rng.js'

const MAX = { skin: 4, hairStyle: 5, hairColor: 7, eyeStyle: 3, eyeColor: 3, outfit: 7 }

describe('isLook', () => {
  it('accepts the default and the max values, ignoring extra fields', () => {
    expect(isLook(DEFAULT_LOOK)).toBe(true)
    expect(isLook(MAX)).toBe(true)
    expect(isLook({ ...DEFAULT_LOOK, hood: 'x' })).toBe(true)
  })
  it('rejects out of range, missing, float and string values', () => {
    expect(isLook({ ...DEFAULT_LOOK, skin: 5 })).toBe(false)
    expect(isLook({ ...DEFAULT_LOOK, skin: -1 })).toBe(false)
    expect(isLook({ skin: 0, hairStyle: 0, hairColor: 0, eyeStyle: 0, eyeColor: 0 })).toBe(false)
    expect(isLook({ ...DEFAULT_LOOK, hairStyle: 1.5 })).toBe(false)
    expect(isLook({ ...DEFAULT_LOOK, outfit: '1' })).toBe(false)
    expect(isLook(null)).toBe(false)
    expect(isLook('look')).toBe(false)
  })
})

describe('normalizeLook', () => {
  it('maps the legacy look', () => {
    expect(normalizeLook({ hood: 3, outfit: 5, hair: 2 })).toEqual({ ...DEFAULT_LOOK, outfit: 5, hairColor: 2 })
  })
  it('falls back to the default for junk', () => {
    for (const junk of [null, undefined, 'x', 4, [], { outfit: 9, hair: -1 }]) expect(normalizeLook(junk)).toEqual(DEFAULT_LOOK)
  })
  it('keeps a valid look and fixes single bad fields', () => {
    expect(normalizeLook(MAX)).toEqual(MAX)
    expect(normalizeLook({ ...MAX, skin: 9 })).toEqual({ ...MAX, skin: 0 })
  })
})

describe('randomLook', () => {
  it('is valid, deterministic per seed, and varies', () => {
    expect(isLook(randomLook(createRng(1)))).toBe(true)
    expect(randomLook(createRng(5))).toEqual(randomLook(createRng(5)))
    const seen = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(randomLook(createRng(i)))))
    expect(seen.size).toBeGreaterThan(1)
    expect(Object.keys(LOOK_OPTIONS)).toEqual(Object.keys(DEFAULT_LOOK))
  })
})
