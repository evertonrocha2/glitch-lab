import { isSolid } from './tiles.js'

// Reading a Glitch World map (see shared/world/worlds.js for its shape). Shared by the server, which
// checks saved positions, and the browser, which walks the hero. Nothing on a map is locked (fase 3):
// solid tiles and NPCs are the only things in the way; roads (roads.js) lead to the next region.

const STEPS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

const FACING = { up: 0, right: 1, down: 2, left: 3 }

const keyOf = (x, y) => `${x},${y}`
const neighbors = ({ x, y }) => STEPS.map((step) => ({ x: x + step.x, y: y + step.y }))
const inside = (rect, x, y) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h

// The tile's character, or null outside the map.
export function tileAt(world, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || y < 0 || y >= world.rows.length) return null
  const row = world.rows[y]
  return x >= 0 && x < row.length ? row[x] : null
}

// The hunt zone ({ id, rect }) the tile is in, or null on safe ground (the town, a region's outskirts).
export const zoneAt = (world, x, y) => (world.zones ?? []).find((zone) => inside(zone.rect, x, y)) ?? null

// The NPC standing on the tile, or null.
export const npcAt = (world, x, y) => (world.npcs ?? []).find((npc) => npc.x === x && npc.y === y) ?? null

// Whether the hero can stand on the tile: inside the map, not solid, and no NPC on it.
export function canEnter(world, x, y) {
  const tile = tileAt(world, x, y)
  return tile !== null && !isSolid(tile) && !npcAt(world, x, y)
}

// The thing in `list` right next to (x, y) (up, down, left or right): the one the hero faces wins.
function nextTo(list, x, y, facing) {
  const ahead = facing && STEPS[FACING[facing]]
  const faced = ahead && list.find((thing) => thing.x === x + ahead.x && thing.y === y + ahead.y)
  return faced ?? list.find((thing) => Math.abs(thing.x - x) + Math.abs(thing.y - y) === 1) ?? null
}

// The terminal right next to the tile, if there is one. Terminals sit two tiles apart, so a tile can
// touch two: the one the hero faces wins.
export const terminalNear = (world, x, y, facing) => nextTo(world.terminals ?? [], x, y, facing)

// The NPC right next to the tile, if there is one (the faced one first).
export const npcNear = (world, x, y, facing) => nextTo(world.npcs ?? [], x, y, facing)

// Every tile reachable from `start`, as "x,y" keys (start included).
export function reachableFrom(world, start) {
  const seen = new Set([keyOf(start.x, start.y)])
  const queue = [start]
  for (let index = 0; index < queue.length; index++) {
    for (const next of neighbors(queue[index])) {
      const key = keyOf(next.x, next.y)
      if (seen.has(key) || !canEnter(world, next.x, next.y)) continue
      seen.add(key)
      queue.push(next)
    }
  }
  return seen
}
