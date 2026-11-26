import { describe, expect, it } from 'vitest'
import { canEnter, reachableFrom, tileAt, zoneAt } from '../../shared/world/map.js'
import { roadAt } from '../../shared/world/roads.js'
import { TILES } from '../../shared/world/tiles.js'
import { topicById, topicsOfArea } from '../../shared/exams/catalog.js'
import { HUB_ID, WORLDS, worldById } from '../../shared/world/worlds.js'

const tilesOf = (world, char) =>
  world.rows.flatMap((row, y) => [...row].flatMap((tile, x) => (char === undefined || tile === char ? [{ x, y, tile }] : [])))
const inRect = (rect, { x, y }) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
const hub = () => worldById(HUB_ID)

describe.each(WORLDS.map((world) => [world.id, world]))('%s', (_, world) => {
  it('is a rectangle of known tiles', () => {
    const width = world.rows[0].length
    for (const row of world.rows) {
      expect(row).toHaveLength(width)
      for (const tile of row) expect(TILES).toHaveProperty(tile)
    }
  })

  it('starts on a walkable tile that is not a road, in z1 off the town', () => {
    expect(canEnter(world, world.spawn.x, world.spawn.y)).toBe(true)
    expect(roadAt(world, world.spawn.x, world.spawn.y)).toBeNull()
    expect(zoneAt(world, world.spawn.x, world.spawn.y)?.id ?? null).toBe(world.id === HUB_ID ? null : 'z1')
  })

  it('has no portals left: roads link the regions now', () => {
    expect(tilesOf(world, 'O')).toEqual([])
    expect(world.portals).toBeUndefined()
    expect(world.requirement).toBeUndefined()
  })

  it('reaches every walkable tile from the spawn', () => {
    const reached = reachableFrom(world, world.spawn)
    for (const { x, y } of tilesOf(world)) {
      if (canEnter(world, x, y)) expect(reached.has(`${x},${y}`), `${x},${y}`).toBe(true)
    }
  })

  it('keeps every door inside a hunt zone, and no zone rect outside the map', () => {
    for (const door of tilesOf(world, 'D')) {
      if (world.id !== HUB_ID) expect(world.zones.some((zone) => inRect(zone.rect, door))).toBe(true)
    }
    for (const zone of world.zones) {
      expect(zone.rect.x + zone.rect.w).toBeLessThanOrEqual(world.rows[0].length)
      expect(zone.rect.y + zone.rect.h).toBeLessThanOrEqual(world.rows.length)
    }
  })

  it('has a terminal entry on every terminal tile, each next to a reachable tile', () => {
    const tiles = tilesOf(world, 'C')
    expect(world.terminals.map(({ x, y }) => `${x},${y}`).sort()).toEqual(tiles.map(({ x, y }) => `${x},${y}`).sort())
    const reached = reachableFrom(world, world.spawn)
    for (const { x, y } of world.terminals) {
      const sides = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]
      expect(sides.some(([sx, sy]) => reached.has(`${sx},${sy}`)), `${x},${y}`).toBe(true)
    }
  })
})

it('makes the town bigger than the old 15x10 Lab, and each hunt region 48x32 (fase 4)', () => {
  for (const world of WORLDS) {
    const [width, height] = world.id === HUB_ID ? [36, 24] : [48, 32]
    expect([world.rows[0].length, world.rows.length], world.id).toEqual([width, height])
  }
})

// The tiles that were there before fase 4: ground, walls, doors, terminals and the old trees, rocks,
// water and bushes. Everything else is a fase 4 decoration.
const PLAIN = new Set(['.', ':', '_', 'O', 'D', '~', 'T', '^', '#', 'B', 'C'])
const decorIn = (world, rect) => tilesOf(world).filter((tile) => !PLAIN.has(tile.tile) && inRect(rect, tile))

it('gives each zone of a region its own decoration, with one kind no other zone there has', () => {
  for (const world of WORLDS.filter((item) => item.id !== HUB_ID)) {
    const kinds = world.zones.map((zone) => new Set(decorIn(world, zone.rect).map((tile) => tile.tile)))
    world.zones.forEach((zone, k) => {
      expect(decorIn(world, zone.rect).length, `${world.id} ${zone.id}`).toBeGreaterThanOrEqual(12)
      const others = kinds.filter((_, j) => j !== k)
      const own = [...kinds[k]].filter((char) => others.every((set) => !set.has(char)))
      expect(own.length, `${world.id} ${zone.id} has no decoration of its own`).toBeGreaterThan(0)
    })
  }
})

it('splits every hunt region into three zones that cover the whole map without overlapping', () => {
  for (const world of WORLDS.filter((item) => item.id !== HUB_ID)) {
    for (const { x, y } of tilesOf(world)) {
      const hits = world.zones.filter((zone) => inRect(zone.rect, { x, y }))
      expect(hits.length, `${world.id} ${x},${y}`).toBe(1)
    }
  }
})

it('leaves room for a pack of 9 around the fight spot of every zone', () => {
  for (const world of WORLDS.filter((item) => item.id !== HUB_ID)) {
    for (const zone of world.zones) {
      const open = tilesOf(world).filter((tile) => inRect(zone.rect, tile) && canEnter(world, tile.x, tile.y))
      // At least 60% of a zone is open ground, so packs and the hero have room to move.
      expect(open.length / (zone.rect.w * zone.rect.h), `${world.id} ${zone.id}`).toBeGreaterThanOrEqual(0.6)
    }
  }
})

const WORLD_IDS = ['floresta-js', 'caverna-sql', 'biblioteca-linguagens', 'cidade-humanas', 'jardim-natureza', 'torre-matematica']

it('lists the town and the six regions, in order', () => {
  expect(WORLDS.map((world) => world.id)).toEqual([HUB_ID, ...WORLD_IDS])
})

it('keeps the town safe: no hunt zones, NPCs and terminals instead', () => {
  expect(hub()).toMatchObject({ kind: 'town', area: null, tier: 0, zones: [] })
  expect(hub().npcs.length).toBe(5)
  expect(hub().terminals.length).toBeGreaterThanOrEqual(6)
  for (const world of WORLDS.filter((item) => item.id !== HUB_ID)) expect(world.npcs, world.id).toEqual([])
})

it('keeps the town terminals to the study that is not ENEM, so they work in every language', () => {
  expect(new Set(hub().terminals.map((terminal) => terminal.kind))).toEqual(new Set(['daily', 'glitchdle', 'hunt']))
})

it('has one terminal for each topic of the area in each ENEM region', () => {
  for (const world of WORLDS.filter((item) => item.kind === 'enem')) {
    const ids = world.terminals.map((terminal) => terminal.topicId).sort()
    expect(world.terminals.every((terminal) => terminal.kind === 'topic'), world.id).toBe(true)
    expect(ids, world.id).toEqual(topicsOfArea('enem', world.area).map((topic) => topic.id).sort())
    for (const id of ids) expect(topicById('enem', id).area).toBe(world.area)
  }
})

it('gives tech regions daily, glitchdle and hunt terminals in every zone', () => {
  for (const world of WORLDS.filter((item) => item.kind === 'tech')) {
    for (const zone of world.zones) {
      const inside = world.terminals.filter((terminal) => inRect(zone.rect, terminal))
      expect(new Set(inside.map((terminal) => terminal.kind)), `${world.id} ${zone.id}`).toEqual(new Set(['daily', 'glitchdle', 'hunt']))
    }
  }
})

it('finds worlds by id only', () => {
  expect(worldById('floresta-js').id).toBe('floresta-js')
  expect(worldById('nope')).toBeNull()
  expect(worldById('constructor')).toBeNull()
  expect(tileAt(hub(), hub().spawn.x, hub().spawn.y)).not.toBeNull()
})
