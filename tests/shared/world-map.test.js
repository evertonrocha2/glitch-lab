import { expect, it } from 'vitest'
import { canEnter, findPath, pathTo, portalAt, reachableFrom, terminalNear, tileAt, zoneAt } from '../../shared/world/map.js'
import { TILES } from '../../shared/world/tiles.js'

// 5x4: water at (2,1), a closed zone z2 in the bottom right corner behind a door at (3,2),
// a terminal at (0,3) and a portal at (4,0).
const TINY = {
  id: 'tiny',
  rows: ['....O', '..~..', '...D.', 'C.##.'],
  spawn: { x: 0, y: 0 },
  portals: [{ x: 4, y: 0, to: 'laboratorio', at: { x: 1, y: 1 } }],
  zones: [{ id: 'z2', rect: { x: 3, y: 2, w: 2, h: 2 }, requirement: { signal: 'codeSolved', count: 8 } }],
  terminals: [{ x: 0, y: 3, kind: 'daily' }],
}
const NONE = new Set()
const isNeighbor = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1

it('draws every tile as an 8x8 sprite in its own palette', () => {
  for (const tile of Object.values(TILES)) {
    expect(tile.sprite).toHaveLength(8)
    for (const line of tile.sprite) {
      expect(line).toHaveLength(8)
      for (const pixel of line) expect(tile.palette).toHaveProperty(pixel)
    }
  }
})

it('reads tiles and treats the outside as nothing', () => {
  expect(tileAt(TINY, 0, 0)).toBe('.')
  expect(tileAt(TINY, 2, 1)).toBe('~')
  expect(tileAt(TINY, -1, 0)).toBeNull()
  expect(tileAt(TINY, 5, 0)).toBeNull()
  expect(tileAt(TINY, 0, 4)).toBeNull()
})

it('finds the zone a tile is in, and none outside every zone', () => {
  expect(zoneAt(TINY, 4, 3).id).toBe('z2')
  expect(zoneAt(TINY, 3, 2).id).toBe('z2')
  expect(zoneAt(TINY, 2, 2)).toBeNull()
})

it('blocks solid tiles, the outside and closed zones', () => {
  expect(canEnter(TINY, 2, 1, NONE)).toBe(false)
  expect(canEnter(TINY, 0, 3, NONE)).toBe(false)
  expect(canEnter(TINY, -1, 0, NONE)).toBe(false)
  expect(canEnter(TINY, 4, 3, NONE)).toBe(false)
  expect(canEnter(TINY, 3, 2, NONE)).toBe(false)
  expect(canEnter(TINY, 4, 3, new Set(['z2']))).toBe(true)
  expect(canEnter(TINY, 0, 0, NONE)).toBe(true)
})

it('finds the shortest path around water', () => {
  const path = findPath(TINY, { x: 0, y: 1 }, { x: 4, y: 1 }, NONE)
  expect(path).toHaveLength(6)
  expect(path.at(-1)).toEqual({ x: 4, y: 1 })
  let previous = { x: 0, y: 1 }
  for (const step of path) {
    expect(isNeighbor(previous, step)).toBe(true)
    expect(canEnter(TINY, step.x, step.y, NONE)).toBe(true)
    previous = step
  }
})

it('gives no path into a closed zone, and an empty one in place', () => {
  expect(findPath(TINY, { x: 0, y: 0 }, { x: 4, y: 3 }, NONE)).toBeNull()
  expect(findPath(TINY, { x: 0, y: 0 }, { x: 4, y: 3 }, new Set(['z2']))).not.toBeNull()
  expect(findPath(TINY, { x: 1, y: 1 }, { x: 1, y: 1 }, NONE)).toEqual([])
})

it('walks next to a solid target, and nowhere when nothing next to it can be reached', () => {
  const path = pathTo(TINY, { x: 4, y: 0 }, { x: 0, y: 3 }, NONE)
  expect(isNeighbor(path.at(-1), { x: 0, y: 3 })).toBe(true)
  expect(path).toHaveLength(Math.min(...[{ x: 0, y: 2 }, { x: 1, y: 3 }].map((to) => findPath(TINY, { x: 4, y: 0 }, to, NONE).length)))
  expect(pathTo(TINY, { x: 0, y: 0 }, { x: 4, y: 1 }, NONE)).toEqual(findPath(TINY, { x: 0, y: 0 }, { x: 4, y: 1 }, NONE))
  // (3,3) is a wall whose neighbors are a wall, the closed zone and the outside.
  expect(pathTo(TINY, { x: 0, y: 0 }, { x: 3, y: 3 }, NONE)).toBeNull()
  expect(isNeighbor(pathTo(TINY, { x: 0, y: 0 }, { x: 3, y: 3 }, new Set(['z2'])).at(-1), { x: 3, y: 3 })).toBe(true)
})

it('finds a terminal next to the hero but not on a diagonal', () => {
  expect(terminalNear(TINY, 0, 2)).toEqual(TINY.terminals[0])
  expect(terminalNear(TINY, 1, 3)).toEqual(TINY.terminals[0])
  expect(terminalNear(TINY, 1, 2)).toBeNull()
})

it('finds the portal on a tile', () => {
  expect(portalAt(TINY, 4, 0)).toEqual(TINY.portals[0])
  expect(portalAt(TINY, 3, 0)).toBeNull()
})

it('lists every tile reachable from a start', () => {
  const closed = reachableFrom(TINY, { x: 0, y: 0 }, NONE)
  expect(closed.has('4,1')).toBe(true)
  expect(closed.has('4,3')).toBe(false)
  expect(closed.has('2,1')).toBe(false)
  expect(reachableFrom(TINY, { x: 0, y: 0 }, new Set(['z2'])).has('4,3')).toBe(true)
})
