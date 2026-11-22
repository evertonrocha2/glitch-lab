import { isSolid } from './tiles.js'

// Reading and walking a Glitch World map (see shared/world/worlds.js for its shape). Shared by the
// server, which checks saved positions, and the browser, which moves the hero.

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

// The locked-able zone the tile is in. Tiles outside every zone are zone 1, always open.
export const zoneAt = (world, x, y) => world.zones.find((zone) => inside(zone.rect, x, y)) ?? null

// Whether the hero can stand on the tile: inside the map, not solid, and in an open zone.
export function canEnter(world, x, y, openZones) {
  const tile = tileAt(world, x, y)
  if (tile === null || isSolid(tile)) return false
  const zone = zoneAt(world, x, y)
  return zone === null || openZones.has(zone.id)
}

export const portalAt = (world, x, y) => world.portals.find((portal) => portal.x === x && portal.y === y) ?? null

// The terminal right next to the tile (up, down, left or right), if there is one. Terminals sit two
// tiles apart, so a tile can touch two: the one the hero faces wins.
export function terminalNear(world, x, y, facing) {
  const ahead = facing && STEPS[FACING[facing]]
  const faced = ahead && world.terminals.find((terminal) => terminal.x === x + ahead.x && terminal.y === y + ahead.y)
  return faced ?? world.terminals.find((terminal) => Math.abs(terminal.x - x) + Math.abs(terminal.y - y) === 1) ?? null
}

// Breadth-first search from `from`. Stops at the first tile `isGoal` accepts; returns the steps to it
// (without `from`), or null. A portal is only ever the end of a walk: walking over one would travel.
function search(world, from, openZones, isGoal) {
  if (isGoal(from)) return []
  const cameFrom = new Map([[keyOf(from.x, from.y), null]])
  const queue = [from]
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    for (const next of neighbors(current)) {
      const key = keyOf(next.x, next.y)
      if (cameFrom.has(key) || !canEnter(world, next.x, next.y, openZones)) continue
      cameFrom.set(key, current)
      if (isGoal(next)) {
        const path = [next]
        for (let back = current; back !== from; back = cameFrom.get(keyOf(back.x, back.y))) path.unshift(back)
        return path
      }
      if (portalAt(world, next.x, next.y)) continue
      queue.push(next)
    }
  }
  return null
}

// The shortest walk from `from` to `to`, one tile per step: [] when already there, null when `to`
// can't be reached.
export function findPath(world, from, to, openZones) {
  if (!canEnter(world, to.x, to.y, openZones)) return from.x === to.x && from.y === to.y ? [] : null
  return search(world, from, openZones, (tile) => tile.x === to.x && tile.y === to.y)
}

// Like findPath, but a tile the hero can't stand on (a terminal, a tree) is reached by walking next to it.
export function pathTo(world, from, target, openZones) {
  if (canEnter(world, target.x, target.y, openZones)) return findPath(world, from, target, openZones)
  return search(world, from, openZones, (tile) => Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y) === 1)
}

// Every tile reachable from `start`, as "x,y" keys (start included).
export function reachableFrom(world, start, openZones) {
  const seen = new Set([keyOf(start.x, start.y)])
  const queue = [start]
  for (let index = 0; index < queue.length; index++) {
    for (const next of neighbors(queue[index])) {
      const key = keyOf(next.x, next.y)
      if (seen.has(key) || !canEnter(world, next.x, next.y, openZones)) continue
      seen.add(key)
      queue.push(next)
    }
  }
  return seen
}
