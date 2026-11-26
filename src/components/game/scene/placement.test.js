import { describe, expect, it } from 'vitest'
import { canStand, nudge, orient, ROTATIONS, rotate, unrotate } from './placement.js'

// 8x5 room: walls around, water at (2,2) and (6,2), a town NPC at (1,3).
const world = {
  rows: ['TTTTTTTT', 'T......T', 'T.~...~T', 'T......T', 'TTTTTTTT'],
  npcs: [{ id: 'merchant', x: 1, y: 3 }],
}
const rect = { x: 0, y: 0, w: 8, h: 5 }

describe('canStand', () => {
  it('takes floor inside the rect, not walls, water, an NPC or the outside', () => {
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

describe('unrotate', () => {
  it('undoes rotate for every turn', () => {
    const out = { x: 0, y: 0 }
    for (const rot of ROTATIONS) {
      const turned = rotate(rot, { x: 2.5, y: -1 }, { x: 0, y: 0 })
      const back = unrotate(rot, turned, out)
      expect(back.x).toBeCloseTo(2.5)
      expect(back.y).toBeCloseTo(-1)
    }
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

describe('orient toward claimed monsters', () => {
  const open = { rows: Array.from({ length: 20 }, () => '.'.repeat(20)), npcs: [] }
  const all = { x: 0, y: 0, w: 20, h: 20 }
  const pack = [
    { to: { x: 1.3, y: 0 }, near: { x: -6, y: 0 } },
    { to: { x: 1.1, y: 0.7 }, near: { x: -5, y: -1 } },
  ]
  it('on open ground, turns the pack so each foe stops on the side its monster stands', () => {
    const rot = orient(open, all, { x: 10, y: 10 }, pack)
    expect(rot).toBe(ROTATIONS[1])
    const down = orient(open, all, { x: 10, y: 10 }, pack.map((s) => ({ ...s, near: { x: 0, y: 6 } })))
    expect(rotate(down, { x: 1, y: 0 }, { x: 0, y: 0 }).y).toBeCloseTo(1)
  })
  it('still puts floor first', () => {
    // The hero by the left wall: the monsters' side is wall, so the foes still stop on floor.
    const rot = orient(world, rect, { x: 1, y: 1 }, [pack[0]])
    expect(rot).not.toBe(ROTATIONS[1])
    const to = rotate(rot, pack[0].to, { x: 0, y: 0 })
    expect(canStand(world, rect, Math.round(1 + to.x), Math.round(1 + to.y))).toBe(true)
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
    const solid = { rows: ['TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT'], npcs: [] }
    expect(nudge(solid, rect, 3, 2, { x: 0, y: 0 })).toEqual({ x: 3, y: 2 })
  })
})
