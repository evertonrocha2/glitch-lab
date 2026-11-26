import { describe, expect, it } from 'vitest'
import { canEnter, reachableFrom, tileAt, zoneAt } from '../../shared/world/map.js'
import { ROAD_WIDTH, arrival, roadAt, roadTiles, tiersFrom } from '../../shared/world/roads.js'
import { HUB_ID, WORLDS, worldById } from '../../shared/world/worlds.js'

const key = ({ x, y }) => `${x},${y}`
const isEnem = (id) => worldById(id).kind === 'enem'

describe('the region graph', () => {
  it('links the town to the Forest, the Library and the City of Humanities, and the rest by distance', () => {
    const roadsOf = (id) => worldById(id).roads.map((road) => `${road.side}:${road.to}`).sort()
    expect(roadsOf('laboratorio')).toEqual(['east:biblioteca-linguagens', 'south:cidade-humanas', 'west:floresta-js'])
    expect(roadsOf('floresta-js')).toEqual(['east:laboratorio', 'north:caverna-sql'])
    expect(roadsOf('caverna-sql')).toEqual(['east:torre-matematica', 'south:floresta-js'])
    expect(roadsOf('biblioteca-linguagens')).toEqual(['north:jardim-natureza', 'west:laboratorio'])
    expect(roadsOf('jardim-natureza')).toEqual(['south:biblioteca-linguagens', 'west:torre-matematica'])
    expect(roadsOf('torre-matematica')).toEqual(['east:jardim-natureza', 'west:caverna-sql'])
    expect(roadsOf('cidade-humanas')).toEqual(['north:laboratorio'])
  })

  it('gives every road a road back on the opposite side', () => {
    const opposite = { west: 'east', east: 'west', north: 'south', south: 'north' }
    for (const world of WORLDS) {
      for (const road of world.roads) {
        const back = worldById(road.to).roads.filter((each) => each.to === world.id)
        expect(back, `${world.id} -> ${road.to}`).toHaveLength(1)
        expect(back[0].side, `${world.id} -> ${road.to}`).toBe(opposite[road.side])
      }
    }
  })

  it("sets each region's tier to its road distance from the town", () => {
    const tiers = tiersFrom(HUB_ID, WORLDS)
    for (const world of WORLDS) expect(tiers[world.id], world.id).toBe(world.tier)
    expect(tiers).toMatchObject({ laboratorio: 0, 'floresta-js': 1, 'caverna-sql': 2, 'torre-matematica': 3 })
  })

  it('keeps the tech regions at the same distance with the ENEM roads closed (English)', () => {
    const tiers = tiersFrom(HUB_ID, WORLDS, { skip: isEnem })
    expect(tiers).toEqual({ laboratorio: 0, 'floresta-js': 1, 'caverna-sql': 2 })
  })

  it('keeps the town safe and gives every other region three hunt zones covering its floor', () => {
    expect(worldById(HUB_ID).zones).toEqual([])
    for (const world of WORLDS.filter((each) => each.id !== HUB_ID)) {
      expect(world.zones.map((zone) => zone.id), world.id).toEqual(['z1', 'z2', 'z3'])
      for (const tile of reachableFrom(world, world.spawn)) {
        const [x, y] = tile.split(',').map(Number)
        expect(zoneAt(world, x, y), `${world.id} ${tile}`).not.toBeNull()
      }
    }
  })

  it('puts the road from the town into each region inside z1', () => {
    for (const world of WORLDS.filter((each) => each.tier === 1)) {
      const road = world.roads.find((each) => each.to === HUB_ID)
      for (const tile of roadTiles(world, road)) expect(zoneAt(world, tile.x, tile.y)?.id, world.id).toBe('z1')
    }
  })
})

describe('roads on the maps', () => {
  it('opens every road as walkable edge tiles, all reachable from the spawn', () => {
    for (const world of WORLDS) {
      const seen = reachableFrom(world, world.spawn)
      expect(canEnter(world, world.spawn.x, world.spawn.y), world.id).toBe(true)
      for (const road of world.roads) {
        const tiles = roadTiles(world, road)
        expect(tiles).toHaveLength(ROAD_WIDTH)
        for (const tile of tiles) {
          expect(canEnter(world, tile.x, tile.y), `${world.id} ${road.side} ${key(tile)}`).toBe(true)
          expect(seen.has(key(tile)), `${world.id} ${road.side} ${key(tile)}`).toBe(true)
        }
      }
    }
  })

  it('leaves no other way out: every other edge tile is solid', () => {
    for (const world of WORLDS) {
      const rows = world.rows.length
      const cols = world.rows[0].length
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (x !== 0 && y !== 0 && x !== cols - 1 && y !== rows - 1) continue
          if (roadAt(world, x, y)) continue
          expect(canEnter(world, x, y), `${world.id} ${x},${y}`).toBe(false)
        }
      }
    }
  })

  it('finds the road under an edge tile with its offset, and nothing elsewhere', () => {
    const town = worldById(HUB_ID)
    expect(roadAt(town, 0, 12)).toMatchObject({ road: { side: 'west', to: 'floresta-js' }, offset: 1 })
    expect(roadAt(town, 18, 23)).toMatchObject({ road: { side: 'south', to: 'cidade-humanas' }, offset: 2 })
    expect(roadAt(town, 1, 12)).toBeNull()
    expect(roadAt(town, 0, 5)).toBeNull()
  })
})

describe('arrival', () => {
  it('enters the Forest from the town west gate one tile in, at the matching road tile, facing on', () => {
    const town = worldById(HUB_ID)
    expect(arrival(town, 0, 11)).toEqual({ world: 'floresta-js', x: 46, y: 14, facing: 'left' })
    expect(arrival(town, 0, 13)).toEqual({ world: 'floresta-js', x: 46, y: 16, facing: 'left' })
  })

  it('goes back to the town gate it came from', () => {
    const forest = worldById('floresta-js')
    expect(arrival(forest, 47, 15)).toEqual({ world: HUB_ID, x: 1, y: 12, facing: 'right' })
  })

  it('climbs from the Forest north road into the Cave south road', () => {
    expect(arrival(worldById('floresta-js'), 7, 0)).toEqual({ world: 'caverna-sql', x: 5, y: 18, facing: 'up' })
    expect(arrival(worldById('caverna-sql'), 6, 19)).toEqual({ world: 'floresta-js', x: 8, y: 1, facing: 'down' })
  })

  it('lands on a walkable tile that is not itself a road, for every road and offset', () => {
    for (const world of WORLDS) {
      for (const road of world.roads) {
        for (const tile of roadTiles(world, road)) {
          const at = arrival(world, tile.x, tile.y)
          const next = worldById(at.world)
          expect(at.world).toBe(road.to)
          expect(canEnter(next, at.x, at.y), `${world.id} -> ${key(at)}`).toBe(true)
          expect(roadAt(next, at.x, at.y), `${world.id} -> ${key(at)}`).toBeNull()
          // One step back the way it came is the road home.
          const back = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] }[at.facing]
          expect(roadAt(next, at.x + back[0], at.y + back[1])?.road.to).toBe(world.id)
        }
      }
    }
  })

  it('is null off a road, and when the road leads to a region the caller does not know', () => {
    expect(arrival(worldById(HUB_ID), 5, 5)).toBeNull()
    expect(arrival(worldById(HUB_ID), 0, 11, () => null)).toBeNull()
  })

  it('reads the road tiles as walkable path', () => {
    for (const world of WORLDS) for (const road of world.roads) for (const tile of roadTiles(world, road)) expect(tileAt(world, tile.x, tile.y)).toBe(':')
  })
})
