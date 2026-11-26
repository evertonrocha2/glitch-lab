import { afterEach, describe, expect, it } from 'vitest'
import { clampRect, defaultRect, loadRect, MIN_SIZE, saveRect, STORE_KEY } from './geometry.js'

afterEach(() => localStorage.clear())

describe('clampRect', () => {
  it('keeps the whole window on screen, with an 8px margin', () => {
    expect(clampRect({ x: 5000, y: -40, w: 500, h: 600 }, 1440, 900)).toEqual({ x: 932, y: 8, w: 500, h: 600 })
    expect(clampRect({ x: -20, y: 800, w: 500, h: 600 }, 1440, 900)).toEqual({ x: 8, y: 292, w: 500, h: 600 })
  })

  it('never grows past the screen nor shrinks under the minimum', () => {
    expect(clampRect({ x: 0, y: 0, w: 4000, h: 4000 }, 1440, 900)).toEqual({ x: 8, y: 8, w: 1424, h: 884 })
    expect(clampRect({ x: 100, y: 100, w: 10, h: 10 }, 1440, 900)).toMatchObject({ w: MIN_SIZE.w, h: MIN_SIZE.h })
  })
})

describe('defaultRect', () => {
  it('sits at the right side of a desktop, as tall as most of the screen', () => {
    const rect = defaultRect(1440, 900)
    expect(rect.x + rect.w).toBe(1440 - 24)
    expect(rect.w).toBe(560)
    expect(rect.h).toBeGreaterThan(600)
    expect(rect.y + rect.h).toBeLessThanOrEqual(900 - 8)
  })
})

describe('loadRect and saveRect', () => {
  it('remembers the window per browser and clamps it to the screen it opens on', () => {
    saveRect({ x: 900, y: 300, w: 500, h: 500 })
    expect(JSON.parse(localStorage.getItem(STORE_KEY))).toEqual({ x: 900, y: 300, w: 500, h: 500 })
    expect(loadRect(1440, 900)).toEqual({ x: 900, y: 300, w: 500, h: 500 })
    // A smaller screen later: the same window, pulled back inside it.
    expect(loadRect(1200, 700)).toEqual({ x: 692, y: 192, w: 500, h: 500 })
  })

  it('falls back to the default when nothing or junk is stored', () => {
    expect(loadRect(1440, 900)).toEqual(defaultRect(1440, 900))
    localStorage.setItem(STORE_KEY, '{"x":"a"}')
    expect(loadRect(1440, 900)).toEqual(defaultRect(1440, 900))
    localStorage.setItem(STORE_KEY, 'not json')
    expect(loadRect(1440, 900)).toEqual(defaultRect(1440, 900))
  })
})
