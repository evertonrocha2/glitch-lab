import { describe, expect, it } from 'vitest'
import { canEnter, reachableFrom, tileAt } from '../../shared/world/map.js'
import { TILES } from '../../shared/world/tiles.js'
import { topicById, topicsOfArea } from '../../shared/exams/catalog.js'
import { HUB_ID, WORLDS, worldById } from '../../shared/world/worlds.js'

const NONE = new Set()
const allZones = (world) => new Set(world.zones.map((zone) => zone.id))
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

  it('starts on a walkable tile outside any zone', () => {
    expect(canEnter(world, world.spawn.x, world.spawn.y, NONE)).toBe(true)
  })

  it('has a portal entry on every portal tile, landing on a walkable tile of another world', () => {
    const tiles = tilesOf(world, 'O')
    expect(world.portals.map(({ x, y }) => `${x},${y}`).sort()).toEqual(tiles.map(({ x, y }) => `${x},${y}`).sort())
    for (const portal of world.portals) {
      const target = worldById(portal.to)
      expect(target, portal.to).not.toBeNull()
      expect(portal.to).not.toBe(world.id)
      expect(canEnter(target, portal.at.x, portal.at.y, NONE)).toBe(true)
    }
  })

  it('reaches every walkable tile from the spawn with every zone open', () => {
    const reached = reachableFrom(world, world.spawn, allZones(world))
    for (const { x, y } of tilesOf(world)) {
      if (canEnter(world, x, y, allZones(world))) expect(reached.has(`${x},${y}`), `${x},${y}`).toBe(true)
    }
  })

  it('reaches zone 2 without going through zone 3', () => {
    const z2 = world.zones.find((zone) => zone.id === 'z2')
    if (!z2) return
    const reached = reachableFrom(world, world.spawn, new Set(['z2']))
    const inside = tilesOf(world).filter((tile) => inRect(z2.rect, tile) && canEnter(world, tile.x, tile.y, new Set(['z2'])))
    expect(inside.length).toBeGreaterThan(0)
    for (const { x, y } of inside) expect(reached.has(`${x},${y}`), `${x},${y}`).toBe(true)
  })

  it('has zones z2 and z3 only, each with a door, and no door outside a zone', () => {
    for (const zone of world.zones) expect(['z2', 'z3']).toContain(zone.id)
    for (const zone of world.zones) expect(tilesOf(world, 'D').some((door) => inRect(zone.rect, door))).toBe(true)
    for (const door of tilesOf(world, 'D')) expect(world.zones.some((zone) => inRect(zone.rect, door))).toBe(true)
  })

  it('has a terminal entry on every terminal tile, each next to a reachable tile', () => {
    const tiles = tilesOf(world, 'C')
    expect(world.terminals.map(({ x, y }) => `${x},${y}`).sort()).toEqual(tiles.map(({ x, y }) => `${x},${y}`).sort())
    const reached = reachableFrom(world, world.spawn, allZones(world))
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

it('sizes the hub at 15x10, to fit a desktop screen whole, and each world at 32x20', () => {
  for (const world of WORLDS) {
    const [width, height] = world.id === HUB_ID ? [15, 10] : [32, 20]
    expect([world.rows[0].length, world.rows.length], world.id).toEqual([width, height])
  }
})

const WORLD_IDS = ['floresta-js', 'caverna-sql', 'biblioteca-linguagens', 'cidade-humanas', 'jardim-natureza', 'torre-matematica']

it('lists the hub and the six worlds, in order', () => {
  expect(WORLDS.map((world) => world.id)).toEqual([HUB_ID, ...WORLD_IDS])
})

it('has one portal from the hub to each world, and one back from each world', () => {
  expect(hub().portals.map((portal) => portal.to).sort()).toEqual([...WORLD_IDS].sort())
  for (const world of WORLDS.filter((item) => item.id !== HUB_ID)) {
    expect(hub().portals.filter((portal) => portal.to === world.id), world.id).toHaveLength(1)
    expect(world.portals.filter((portal) => portal.to === HUB_ID), world.id).toHaveLength(1)
  }
})

it('keeps the hub free of zones, terminals and requirements', () => {
  expect(hub()).toMatchObject({ kind: 'hub', area: null, requirement: null, zones: [], terminals: [] })
})

it('opens the JavaScript Forest from the start, asking 8 and 20 solved challenges for its inner zones', () => {
  const forest = worldById('floresta-js')
  expect(forest).toMatchObject({ kind: 'tech', area: null, requirement: null })
  expect(forest.zones.map((zone) => [zone.id, zone.requirement])).toEqual([
    ['z2', { signal: 'codeSolved', count: 8 }],
    ['z3', { signal: 'codeSolved', count: 20 }],
  ])
})

it('opens the forest from the start and asks for study everywhere else', () => {
  expect(worldById('caverna-sql').requirement).toEqual({ signal: 'codeSolved', count: 3 })
  expect(worldById('biblioteca-linguagens').requirement).toEqual({ signal: 'enemCorrect', area: 'linguagens', count: 5 })
  expect(worldById('cidade-humanas').requirement).toEqual({ signal: 'enemCorrect', area: 'humanas', count: 5 })
  expect(worldById('jardim-natureza').requirement).toEqual({ signal: 'enemCorrect', area: 'natureza', count: 5 })
  expect(worldById('torre-matematica').requirement).toEqual({ signal: 'enemCorrect', area: 'matematica', count: 5 })
})

it('asks 15 and 40 right answers in the area for the inner zones of an ENEM world, and 8 and 20 solved in the cave', () => {
  for (const world of WORLDS.filter((item) => item.kind === 'enem')) {
    expect(world.zones.map((zone) => [zone.id, zone.requirement]), world.id).toEqual([
      ['z2', { signal: 'enemCorrect', area: world.area, count: 15 }],
      ['z3', { signal: 'enemCorrect', area: world.area, count: 40 }],
    ])
  }
  expect(worldById('caverna-sql').zones.map((zone) => zone.requirement)).toEqual([
    { signal: 'codeSolved', count: 8 },
    { signal: 'codeSolved', count: 20 },
  ])
})

it('has one terminal for each topic of the area in each ENEM world', () => {
  for (const world of WORLDS.filter((item) => item.kind === 'enem')) {
    const ids = world.terminals.map((terminal) => terminal.topicId).sort()
    expect(world.terminals.every((terminal) => terminal.kind === 'topic'), world.id).toBe(true)
    expect(ids, world.id).toEqual(topicsOfArea('enem', world.area).map((topic) => topic.id).sort())
    for (const id of ids) expect(topicById('enem', id).area).toBe(world.area)
  }
})

it('gives tech worlds only daily, glitchdle and hunt terminals, all three in zone 1', () => {
  for (const world of WORLDS.filter((item) => item.kind === 'tech')) {
    expect(new Set(world.terminals.map((terminal) => terminal.kind)), world.id).toEqual(new Set(['daily', 'glitchdle', 'hunt']))
    const zoneOne = world.terminals.filter((terminal) => !world.zones.some((zone) => inRect(zone.rect, terminal)))
    expect(new Set(zoneOne.map((terminal) => terminal.kind)), world.id).toEqual(new Set(['daily', 'glitchdle', 'hunt']))
  }
})

it('finds worlds by id only', () => {
  expect(worldById('floresta-js').id).toBe('floresta-js')
  expect(worldById('nope')).toBeNull()
  expect(worldById('constructor')).toBeNull()
  expect(tileAt(hub(), hub().spawn.x, hub().spawn.y)).not.toBeNull()
})
