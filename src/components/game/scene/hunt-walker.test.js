import { describe, expect, it } from 'vitest'
import { createWalker, IDLE_MS, pathWithin, ROAM_STEP_MS, roamTarget } from './hunt-walker.js'
import { STEP_MS } from './walk.js'

// 10x7 room with a wall pillar at (4,2)..(4,4).
const world = {
  rows: ['TTTTTTTTTT', 'T........T', 'T...T....T', 'T...T....T', 'T...T....T', 'T........T', 'TTTTTTTTTT'],
  npcs: [],
}
const rect = { x: 0, y: 0, w: 10, h: 7 }

describe('pathWithin', () => {
  it('walks around the pillar, one tile per step', () => {
    const path = pathWithin(world, rect, { x: 3, y: 3 }, { x: 5, y: 3 })
    expect(path.at(-1)).toEqual({ x: 5, y: 3 })
    expect(path.length).toBe(6)
    expect(path.every((p) => world.rows[p.y][p.x] === '.')).toBe(true)
  })
  it('is [] when already there and null when the target is a wall', () => {
    expect(pathWithin(world, rect, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([])
    expect(pathWithin(world, rect, { x: 1, y: 1 }, { x: 4, y: 3 })).toBe(null)
  })
  it('stays inside the rect', () => {
    expect(pathWithin(world, { x: 0, y: 0, w: 4, h: 7 }, { x: 1, y: 1 }, { x: 6, y: 1 })).toBe(null)
  })
})

describe('roamTarget', () => {
  it('picks a reachable floor tile a few steps away, from the random number', () => {
    const a = roamTarget(world, rect, { x: 1, y: 1 }, () => 0)
    const b = roamTarget(world, rect, { x: 1, y: 1 }, () => 0.99)
    for (const t of [a, b]) {
      const d = Math.abs(t.x - 1) + Math.abs(t.y - 1)
      expect(d).toBeGreaterThanOrEqual(3)
      expect(world.rows[t.y][t.x]).toBe('.')
    }
    expect(a).not.toEqual(b)
  })
  it('is null in a closet with nowhere to go', () => {
    const closet = { rows: ['TTT', 'T.T', 'TTT'], npcs: [] }
    expect(roamTarget(closet, { x: 0, y: 0, w: 3, h: 3 }, { x: 1, y: 1 }, () => 0.5)).toBe(null)
  })
})

describe('createWalker', () => {
  const make = (extra = {}) => createWalker({ world, rect, start: { x: 2, y: 3 }, random: () => 0.3, ...extra })

  it('steps while a direction is held and stops on release', () => {
    const w = make()
    w.update(0)
    w.press('right', 0)
    expect(w.tile).toEqual({ x: 3, y: 3 })
    w.update(STEP_MS)
    // The pillar at (4,3) stops it.
    expect(w.tile).toEqual({ x: 3, y: 3 })
    w.release('right')
    w.press('up', STEP_MS * 2)
    w.update(STEP_MS * 3)
    expect(w.tile).toEqual({ x: 3, y: 1 })
    w.release()
    w.update(STEP_MS * 10)
    expect(w.tile).toEqual({ x: 3, y: 1 })
  })

  it('faces the way it walks: -1 left, 1 right', () => {
    const w = make()
    w.update(0)
    w.tap('left', 0)
    expect(w.side).toBe(-1)
    w.tap('right', 10)
    expect(w.side).toBe(1)
  })

  it('slides the drawn position between tiles, and snaps with reduced motion', () => {
    const w = make()
    w.update(0)
    w.tap('down', 0)
    w.update(STEP_MS / 2)
    expect(w.pos.y).toBeGreaterThan(3)
    expect(w.pos.y).toBeLessThan(4)
    const r = make({ reduced: true })
    r.update(0)
    r.tap('down', 0)
    r.update(1)
    expect(r.pos).toEqual({ x: 2, y: 4 })
  })

  it('walks a clicked path to the tile', () => {
    const w = make()
    w.update(0)
    w.walkTo(6, 3, 0)
    for (let t = 0; t <= STEP_MS * 12; t += 16) w.update(t)
    expect(w.tile).toEqual({ x: 6, y: 3 })
  })

  it('roams by itself only after a few idle seconds and only when allowed', () => {
    const w = make()
    w.update(0, { roam: true })
    w.update(IDLE_MS - 10, { roam: true })
    expect(w.tile).toEqual({ x: 2, y: 3 })
    w.update(IDLE_MS + 10, { roam: false })
    expect(w.tile).toEqual({ x: 2, y: 3 })
    for (let t = IDLE_MS; t < IDLE_MS + ROAM_STEP_MS * 3; t += 16) w.update(t, { roam: true })
    expect(w.tile).not.toEqual({ x: 2, y: 3 })
    expect(w.roaming).toBe(true)
  })

  it('stops roaming the moment the player steers, and waits again', () => {
    const w = make()
    w.update(0, { roam: true })
    for (let t = IDLE_MS; t < IDLE_MS + ROAM_STEP_MS * 2; t += 16) w.update(t, { roam: true })
    const at = IDLE_MS + ROAM_STEP_MS * 2
    w.tap('down', at)
    expect(w.roaming).toBe(false)
    const here = { ...w.tile }
    for (let t = at; t < at + IDLE_MS - 100; t += 50) w.update(t, { roam: true })
    expect(w.tile).toEqual(here)
  })

  it('tells onStep each tile it steps onto, with the way it walked, and never a blocked step', () => {
    const steps = []
    const w = make({ onStep: (tile, dir) => steps.push([tile.x, tile.y, dir]) })
    w.update(0)
    w.press('right', 0)
    w.update(STEP_MS)
    w.release()
    w.tap('down', STEP_MS * 2)
    expect(steps).toEqual([
      [3, 3, 'right'],
      [3, 4, 'down'],
    ])
  })

  it('faces the last way it tried to walk, for the terminal or NPC in front of it', () => {
    const w = make({ facing: 'left' })
    expect(w.facing).toBe('left')
    w.update(0)
    w.tap('up', 0)
    expect(w.facing).toBe('up')
    // The pillar at (4,3) stops a step right from (3,3), but the hero still turns to it.
    w.tap('right', 10)
    w.tap('right', 20)
    expect(w.tile).toEqual({ x: 3, y: 2 })
    expect(w.facing).toBe('right')
  })

  it('walks on to a clicked tile it cannot stand on and turns to face it', () => {
    const w = make()
    w.update(0)
    w.walkTo(4, 3, 0)
    for (let t = 0; t <= STEP_MS * 6; t += 16) w.update(t)
    expect(w.tile).toEqual({ x: 3, y: 3 })
    expect(w.facing).toBe('right')
  })

  it('roams only inside roamIn when it is set', () => {
    const w = make()
    w.roamIn = { x: 1, y: 3, w: 3, h: 2 }
    w.update(0, { roam: true })
    for (let t = IDLE_MS; t < IDLE_MS * 6; t += 16) {
      w.update(t, { roam: true })
      expect(w.tile.x, `${t}`).toBeLessThan(4)
      expect(w.tile.y, `${t}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('holds a direction without stepping, stepping on only if it is still held a step later', () => {
    const w = make()
    w.update(0)
    w.hold('down', 0)
    expect(w.tile).toEqual({ x: 2, y: 3 })
    w.update(STEP_MS)
    expect(w.tile).toEqual({ x: 2, y: 4 })
    const quick = make()
    quick.update(0)
    quick.hold('down', 0)
    quick.release('down')
    quick.update(STEP_MS * 3)
    expect(quick.tile).toEqual({ x: 2, y: 3 })
  })
})
