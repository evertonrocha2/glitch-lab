import { describe, expect, it } from 'vitest'
import { canStand, nudge, orient, ROTATIONS, rotate } from './placement.js'

// 8x5 room: walls around, water at (5,2), a portal at (1,2).
const world = {
  rows: ['TTTTTTTT', 'T......T', 'T.~...~T', 'T......T', 'TTTTTTTT'],
  portals: [{ x: 1, y: 3 }],
}
const rect = { x: 0, y: 0, w: 8, h: 5 }

describe('canStand', () => {
  it('takes floor inside the rect, not walls, water, portals or the outside', () => {
    expect(canStand(world, rect, 3, 1)).toBe(true)
    expect(canStand(world, rect, 0, 1)).toBe(false)
    expect(canStand(world, rect, 2, 2)).toBe(false)
    expect(canStand(world, rect, 1, 3)).toBe(false)
    expect(canStand(world, rect, 3, 9)).toBe(false)
    expect(canStand(world, { x: 0, y: 0, w: 3, h: 5 }, 4, 1)).toBe(false)
  })
})

describe('rotate', () => {
  it('turns a hero relative offset by the rotation', () => {
    const out = { x: 0, y: 0 }
    expect(rotate(ROTATIONS[0], { x: 2, y: 1 }, out)).toEqual({ x: 2, y: 1 })
    const back = rotate(ROTATIONS[1], { x: 2, y: 1 }, out)
    expect(back.x).toBeCloseTo(-2)
    expect(back.y).toBeCloseTo(-1)
  })
})

describe('orient', () => {
  const pack = [
    { from: { x: 4, y: 0 }, to: { x: 1.3, y: 0 } },
    { from: { x: 3.5, y: 1 }, to: { x: 1.1, y: 0.7 } },
  ]
  it('keeps the packs coming from +x when there is room', () => {
    expect(orient(world, rect, { x: 1, y: 1 }, pack)).toBe(ROTATIONS[0])
  })
  it('turns the pack around near the right wall', () => {
    const rot = orient(world, rect, { x: 6, y: 1 }, pack)
    expect(rot).not.toBe(ROTATIONS[0])
    const to = rotate(rot, pack[0].to, { x: 0, y: 0 })
    expect(canStand(world, rect, Math.round(6 + to.x), Math.round(1 + to.y))).toBe(true)
  })
})

describe('nudge', () => {
  it('leaves a point on floor alone', () => {
    expect(nudge(world, rect, 3.2, 1.4, { x: 0, y: 0 })).toEqual({ x: 3.2, y: 1.4 })
  })
  it('moves a point in a wall or the water to the nearest floor tile', () => {
    expect(nudge(world, rect, 3, 0.2, { x: 0, y: 0 })).toEqual({ x: 3, y: 1 })
    const out = nudge(world, rect, 2.1, 2, { x: 0, y: 0 })
    expect(canStand(world, rect, out.x, out.y)).toBe(true)
    expect(Math.abs(out.x - 2.1) + Math.abs(out.y - 2)).toBeLessThanOrEqual(1.2)
  })
  it('keeps the point when nothing nearby is floor', () => {
    const solid = { rows: ['TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT'], portals: [] }
    expect(nudge(solid, rect, 3, 2, { x: 0, y: 0 })).toEqual({ x: 3, y: 2 })
  })
})
