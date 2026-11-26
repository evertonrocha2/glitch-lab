import { expect, it } from 'vitest'
import { canEnter, npcAt, npcNear, reachableFrom, terminalNear, tileAt, zoneAt } from '../../shared/world/map.js'
import { TILES } from '../../shared/world/tiles.js'
import { NPC_IDS, WORLDS, worldById } from '../../shared/world/worlds.js'

// 5x4: water at (2,1), hunt zone z2 in the bottom right corner behind a door at (3,2), a terminal at
// (0,3) and an NPC at (4,0).
const TINY = {
  id: 'tiny',
  rows: ['.....', '..~..', '...D.', 'C.##.'],
  spawn: { x: 0, y: 0 },
  roads: [],
  zones: [{ id: 'z2', rect: { x: 3, y: 2, w: 2, h: 2 } }],
  npcs: [{ id: 'merchant', x: 4, y: 0 }],
  terminals: [{ x: 0, y: 3, kind: 'daily' }],
}

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

it('finds the hunt zone a tile is in, and none on safe ground', () => {
  expect(zoneAt(TINY, 4, 3).id).toBe('z2')
  expect(zoneAt(TINY, 3, 2).id).toBe('z2')
  expect(zoneAt(TINY, 2, 2)).toBeNull()
  expect(zoneAt({ ...TINY, zones: undefined }, 4, 3)).toBeNull()
})

it('blocks solid tiles, the outside and NPCs, and never a zone', () => {
  expect(canEnter(TINY, 2, 1)).toBe(false)
  expect(canEnter(TINY, 0, 3)).toBe(false)
  expect(canEnter(TINY, -1, 0)).toBe(false)
  expect(canEnter(TINY, 4, 0)).toBe(false)
  expect(canEnter(TINY, 3, 2)).toBe(true)
  expect(canEnter(TINY, 4, 3)).toBe(true)
  expect(canEnter(TINY, 0, 0)).toBe(true)
})

it('finds a terminal next to the hero but not on a diagonal', () => {
  expect(terminalNear(TINY, 0, 2)).toEqual(TINY.terminals[0])
  expect(terminalNear(TINY, 1, 3)).toEqual(TINY.terminals[0])
  expect(terminalNear(TINY, 1, 2)).toBeNull()
})

it('finds the NPC on a tile and the one next to the hero, never on a diagonal', () => {
  expect(npcAt(TINY, 4, 0)).toEqual(TINY.npcs[0])
  expect(npcAt(TINY, 3, 0)).toBeNull()
  expect(npcNear(TINY, 3, 0)).toEqual(TINY.npcs[0])
  expect(npcNear(TINY, 4, 1)).toEqual(TINY.npcs[0])
  expect(npcNear(TINY, 3, 1)).toBeNull()
  expect(npcNear({ ...TINY, npcs: undefined }, 3, 0)).toBeNull()
})

it('lists every tile reachable from a start, zones included', () => {
  const seen = reachableFrom(TINY, { x: 0, y: 0 })
  expect(seen.has('4,1')).toBe(true)
  expect(seen.has('4,3')).toBe(true)
  expect(seen.has('2,1')).toBe(false)
  expect(seen.has('4,0')).toBe(false)
})

it('prefers the terminal (and the NPC) the hero faces when two are next to it', () => {
  const two = { ...TINY, rows: ['.....', '.....', 'C.C..'], zones: [], npcs: [], terminals: [{ x: 0, y: 2, kind: 'daily' }, { x: 2, y: 2, kind: 'hunt' }] }
  expect(terminalNear(two, 1, 2, 'right').kind).toBe('hunt')
  expect(terminalNear(two, 1, 2, 'left').kind).toBe('daily')
  expect(terminalNear(two, 1, 2, 'up').kind).toBe('daily')
  expect(terminalNear(two, 1, 2).kind).toBe('daily')
  const pair = { ...TINY, npcs: [{ id: 'smith', x: 0, y: 1 }, { id: 'jeweler', x: 2, y: 1 }] }
  expect(npcNear(pair, 1, 1, 'right').id).toBe('jeweler')
  expect(npcNear(pair, 1, 1, 'left').id).toBe('smith')
})

it('stands every town NPC on its own reachable floor tile, with the five ids and room to talk', () => {
  const town = worldById('laboratorio')
  expect(town.npcs.map((npc) => npc.id).sort()).toEqual([...NPC_IDS].sort())
  const seen = reachableFrom(town, town.spawn)
  for (const npc of town.npcs) {
    const char = tileAt(town, npc.x, npc.y)
    expect(TILES[char].solid, npc.id).toBe(false)
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => seen.has(`${npc.x + dx},${npc.y + dy}`))
    expect(sides.length, npc.id).toBeGreaterThan(0)
  }
})

it('reaches every terminal from its region spawn, the town spreading at least six', () => {
  expect(worldById('laboratorio').terminals.length).toBeGreaterThanOrEqual(6)
  for (const world of WORLDS) {
    const seen = reachableFrom(world, world.spawn)
    for (const terminal of world.terminals) {
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => seen.has(`${terminal.x + dx},${terminal.y + dy}`))
      expect(sides.length, `${world.id} ${terminal.x},${terminal.y}`).toBeGreaterThan(0)
      expect(tileAt(world, terminal.x, terminal.y)).toBe('C')
    }
  }
})
