import { isSolid } from '../../../../shared/world/tiles.js'

// Where a pack stands on the map. The fight log places enemies relative to the hero (+x is where packs
// come from); the scene turns the whole pack so it fits the ground around the hero's tile, and pushes
// a spot that still lands in a wall or the water onto the nearest floor. Pure, no DOM.
// Positions are in tiles: a hero on tile (x, y) stands at { x, y }.

// The turns tried, in order: as logged, mirrored, then down, up and the diagonals.
const turn = (deg) => {
  const a = (deg * Math.PI) / 180
  return { cos: Math.round(Math.cos(a) * 1e6) / 1e6, sin: Math.round(Math.sin(a) * 1e6) / 1e6 }
}
export const ROTATIONS = [0, 180, 90, -90, 45, -45, 135, -135].map(turn)

const inside = (rect, x, y) => !rect || (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h)

// Whether an actor can stand on tile (x, y): floor inside the hunted rect, never a portal.
export function canStand(world, rect, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inside(rect, x, y)) return false
  const row = world.rows[y]
  if (row === undefined || x < 0 || x >= row.length || isSolid(row[x])) return false
  return !world.portals?.some((portal) => portal.x === x && portal.y === y)
}

// p turned by rot, written into out (no allocation).
export function rotate(rot, p, out) {
  const x = p.x * rot.cos - p.y * rot.sin
  const y = p.x * rot.sin + p.y * rot.cos
  out.x = x
  out.y = y
  return out
}

const spot = { x: 0, y: 0 }
const standsAt = (world, rect, tile, rot, p) => {
  rotate(rot, p, spot)
  return canStand(world, rect, Math.round(tile.x + spot.x), Math.round(tile.y + spot.y))
}

// The turn that puts the most of the pack on floor around `tile`: where each enemy stops (to) counts
// twice, where it appears (from) once. Ties keep the earlier turn. spots: [{ from, to }].
export function orient(world, rect, tile, spots) {
  let best = ROTATIONS[0]
  let bestScore = -1
  for (const rot of ROTATIONS) {
    let score = 0
    for (const s of spots) {
      if (s.to && standsAt(world, rect, tile, rot, s.to)) score += 2
      if (s.from && standsAt(world, rect, tile, rot, s.from)) score += 1
    }
    if (score > bestScore) {
      best = rot
      bestScore = score
    }
  }
  return best
}

const REACH = 3

// The point (x, y) itself when its tile is floor; else the nearest floor tile within 3 tiles; else the
// point unchanged. Written into out.
export function nudge(world, rect, x, y, out) {
  const tx = Math.round(x)
  const ty = Math.round(y)
  out.x = x
  out.y = y
  if (canStand(world, rect, tx, ty)) return out
  let bestD = Infinity
  for (let dy = -REACH; dy <= REACH; dy++) {
    for (let dx = -REACH; dx <= REACH; dx++) {
      const cx = tx + dx
      const cy = ty + dy
      const d = (cx - x) ** 2 + (cy - y) ** 2
      if (d < bestD && canStand(world, rect, cx, cy)) {
        bestD = d
        out.x = cx
        out.y = cy
      }
    }
  }
  return out
}
