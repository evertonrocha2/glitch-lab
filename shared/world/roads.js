import { worldById as known } from './worlds.js'

// Roads link the regions (fase 3): a road is a gap of ROAD_WIDTH tiles in a map's edge. Walking onto
// one of its edge tiles leaves the region and enters the neighbor at its road back, on the opposite
// side, at the same tile of the gap, one step in (so the next step on doesn't walk straight back out).
// Pure: the browser walks with it and the tests check every road against it.

export const ROAD_WIDTH = 3

const OPPOSITE = { west: 'east', east: 'west', north: 'south', south: 'north' }
// The way the hero faces walking out through a side.
const FACING = { west: 'left', east: 'right', north: 'up', south: 'down' }
// One step from the edge into the map, per side.
const INWARD = { west: [1, 0], east: [-1, 0], north: [0, 1], south: [0, -1] }

const sizeOf = (world) => ({ cols: world.rows[0]?.length ?? 0, rows: world.rows.length })

// The road's edge tiles, in order along the edge (offset 0 first).
export function roadTiles(world, road) {
  const { cols, rows } = sizeOf(world)
  return Array.from({ length: ROAD_WIDTH }, (_, k) => {
    const along = road.start + k
    if (road.side === 'west') return { x: 0, y: along }
    if (road.side === 'east') return { x: cols - 1, y: along }
    if (road.side === 'north') return { x: along, y: 0 }
    return { x: along, y: rows - 1 }
  })
}

// { road, offset } when (x, y) is one of a road's edge tiles, else null.
export function roadAt(world, x, y) {
  for (const road of world.roads ?? []) {
    const offset = roadTiles(world, road).findIndex((tile) => tile.x === x && tile.y === y)
    if (offset >= 0) return { road, offset }
  }
  return null
}

// Where a hero stepping onto (x, y) of `from` comes out: { world, x, y, facing } in the neighbor, or
// null when (x, y) is no road (or worldById doesn't know where it leads, or that region has no road back).
export function arrival(from, x, y, worldById = known) {
  const found = roadAt(from, x, y)
  if (!found) return null
  const next = worldById(found.road.to)
  const back = next?.roads?.find((road) => road.to === from.id && road.side === OPPOSITE[found.road.side])
  if (!back) return null
  const edge = roadTiles(next, back)[Math.min(found.offset, ROAD_WIDTH - 1)]
  const [dx, dy] = INWARD[back.side]
  return { world: next.id, x: edge.x + dx, y: edge.y + dy, facing: FACING[found.road.side] }
}

// Road distance from `fromId` to every region reachable by roads: { [id]: steps }. skip(id): regions
// left out (the ENEM ones outside pt-BR).
export function tiersFrom(fromId, worlds, { skip = () => false } = {}) {
  const byId = new Map(worlds.map((world) => [world.id, world]))
  const tiers = { [fromId]: 0 }
  const queue = [fromId]
  for (let index = 0; index < queue.length; index++) {
    const current = byId.get(queue[index])
    for (const road of current?.roads ?? []) {
      if (road.to in tiers || skip(road.to) || !byId.has(road.to)) continue
      tiers[road.to] = tiers[current.id] + 1
      queue.push(road.to)
    }
  }
  return tiers
}
