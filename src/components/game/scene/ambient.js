import { createRng } from '../../../../shared/game/rng.js'
import { canEnter, zoneAt } from '../../../../shared/world/map.js'

// Ambient monsters (fase 4): a few idle monsters in every hunt zone, so a zone never looks empty.
// Cosmetic and client only: not solid, never sent to the server, never part of a fight. Pure, no DOM,
// no timers: the scene calls update(now) each frame with the tiles to keep clear (the hero and the
// live pack). Nothing here knows the map's size: it reads the zones' rects and the tiles.
//   createAmbient({ world, zones, seed, reducedMotion }): world is a map (shared/world/maps/), zones the
//   region's zone defs (ZONES[world.id], an object or a list, each { id, rect, enemies }).
//   update(now, avoid): now in ms, avoid a list of { x, y } tiles.
//   monsters(): [{ id, enemy, x, y, facing, anim, fade }], x and y in tiles (a fraction mid step),
//   facing 1 right or -1 left (as drawFoe takes it), anim 'idle' or 'walk', fade 0..1 (fading in).

export const AMBIENT_PER_ZONE = [6, 10]
// Three zones of up to 10, plus a live pack of up to 9: under 40 enemies drawn on a phone.
export const AMBIENT_CAP = 30
// Tiles (Chebyshev) every monster keeps from the hero and the live pack.
export const KEEP_AWAY = 4

// A monster wanders one tile every 1.5 to 3 s, taking this long to cross it, and fades in when it
// comes back somewhere else.
const WAIT_MS = [1500, 3000]
const STEP_MS = 700
const FADE_MS = 400
// How often a monster with no free tile in its zone looks again.
const RETRY_MS = 500

const STEPS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

const keyOf = (x, y) => `${x},${y}`

// The walkable tiles of a zone that belong to it (not to an overlapping zone).
function floorOf(world, zone) {
  const out = []
  const { x: x0, y: y0, w, h } = zone.rect
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!canEnter(world, x, y)) continue
      const at = zoneAt(world, x, y)
      if (!at || at.id === zone.id) out.push({ x, y })
    }
  }
  return out
}

// Whether (x, y) is at least KEEP_AWAY tiles from every avoid tile.
function clear(avoid, x, y) {
  for (const a of avoid) if (Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) < KEEP_AWAY) return false
  return true
}

export function createAmbient({ world, zones, seed, reducedMotion = false }) {
  const rng = createRng(`ambient/${seed}`)
  const roll = rng.fork('wander')
  const defs = world?.kind === 'town' || !zones ? [] : Array.isArray(zones) ? zones : Object.values(zones)
  const areas = defs.map((zone) => {
    const floor = floorOf(world, zone)
    return { zone, floor, keys: new Set(floor.map((t) => keyOf(t.x, t.y))) }
  })

  // Tiles taken by a monster (where it stands or is stepping to).
  const taken = new Set()
  const list = []
  const views = []
  for (const area of areas) {
    const want = AMBIENT_PER_ZONE[0] + rng.int(AMBIENT_PER_ZONE[1] - AMBIENT_PER_ZONE[0] + 1)
    const pool = area.floor.slice()
    for (let i = 0; i < want && pool.length && list.length < AMBIENT_CAP; i++) {
      const j = rng.int(pool.length)
      const tile = pool[j]
      pool[j] = pool[pool.length - 1]
      pool.pop()
      if (taken.has(keyOf(tile.x, tile.y))) {
        i--
        continue
      }
      taken.add(keyOf(tile.x, tile.y))
      const enemies = area.zone.enemies?.length ? area.zone.enemies : ['slime']
      const m = {
        area,
        tx: tile.x,
        ty: tile.y,
        fx: tile.x,
        fy: tile.y,
        moveAt: -1,
        nextAt: null,
        bornAt: -Infinity,
        hidden: false,
      }
      const view = { id: `${area.zone.id}-${i}`, enemy: rng.pick(enemies), x: tile.x, y: tile.y, facing: rng.chance(0.5) ? 1 : -1, anim: 'idle', fade: 1 }
      m.view = view
      list.push(m)
      views.push(view)
    }
  }
  const shown = views.slice()

  const wait = () => WAIT_MS[0] + roll.int(WAIT_MS[1] - WAIT_MS[0] + 1)

  const moveTo = (m, x, y) => {
    taken.delete(keyOf(m.tx, m.ty))
    taken.add(keyOf(x, y))
    m.tx = x
    m.ty = y
  }

  // A free tile of the monster's zone, clear of every avoid tile: a few random tries, then a scan.
  function freeTile(m, avoid) {
    const floor = m.area.floor
    const ok = (t) => !taken.has(keyOf(t.x, t.y)) && clear(avoid, t.x, t.y)
    for (let i = 0; i < 12; i++) {
      const t = floor[roll.int(floor.length)]
      if (ok(t)) return t
    }
    const from = roll.int(floor.length)
    for (let i = 0; i < floor.length; i++) {
      const t = floor[(from + i) % floor.length]
      if (ok(t)) return t
    }
    return null
  }

  // Too close to the hero or the pack: it comes back elsewhere in its zone (fading in), or hides
  // until there is room.
  function relocate(m, now, avoid) {
    taken.delete(keyOf(m.tx, m.ty))
    const t = m.area.floor.length ? freeTile(m, avoid) : null
    m.moveAt = -1
    m.nextAt = now + (t ? wait() : RETRY_MS)
    if (!t) {
      m.hidden = true
      return
    }
    m.hidden = false
    taken.add(keyOf(t.x, t.y))
    m.tx = m.fx = t.x
    m.ty = m.fy = t.y
    m.bornAt = reducedMotion ? -Infinity : now
  }

  // One tile up, down, left or right, inside the zone, free and clear; or stay put.
  function wander(m, avoid) {
    const first = roll.int(4)
    for (let k = 0; k < 4; k++) {
      const step = STEPS[(first + k) % 4]
      const x = m.tx + step.x
      const y = m.ty + step.y
      if (!m.area.keys.has(keyOf(x, y)) || taken.has(keyOf(x, y)) || !clear(avoid, x, y)) continue
      m.fx = m.tx
      m.fy = m.ty
      moveTo(m, x, y)
      if (step.x) m.view.facing = step.x
      return true
    }
    return false
  }

  function update(now, avoid = []) {
    let changed = false
    for (const m of list) {
      const view = m.view
      if (m.nextAt === null) m.nextAt = now + wait()
      if (m.hidden) {
        if (now < m.nextAt) continue
        relocate(m, now, avoid)
        if (m.hidden) continue
        changed = true
        view.x = m.tx
        view.y = m.ty
        view.anim = 'idle'
        view.fade = m.bornAt === -Infinity ? 1 : 0
        continue
      }
      // Where it is drawn now, mid step or standing.
      let p = 1
      if (m.moveAt >= 0) {
        p = Math.min(1, (now - m.moveAt) / STEP_MS)
        if (p >= 1) m.moveAt = -1
      }
      const x = m.fx + (m.tx - m.fx) * p
      const y = m.fy + (m.ty - m.fy) * p
      if (!clear(avoid, x, y) || !clear(avoid, m.tx, m.ty)) {
        const was = m.hidden
        relocate(m, now, avoid)
        if (m.hidden !== was) changed = true
        view.x = m.tx
        view.y = m.ty
        view.anim = 'idle'
        view.fade = m.bornAt === -Infinity ? 1 : 0
        continue
      }
      if (!reducedMotion && m.moveAt < 0 && now >= m.nextAt) {
        if (wander(m, avoid)) m.moveAt = now
        m.nextAt = now + wait()
      }
      if (m.moveAt >= 0) {
        const q = Math.min(1, (now - m.moveAt) / STEP_MS)
        view.x = m.fx + (m.tx - m.fx) * q
        view.y = m.fy + (m.ty - m.fy) * q
        view.anim = 'walk'
      } else {
        view.x = m.tx
        view.y = m.ty
        view.anim = 'idle'
      }
      view.fade = m.bornAt === -Infinity ? 1 : Math.min(1, Math.max(0, (now - m.bornAt) / FADE_MS))
    }
    if (changed) {
      shown.length = 0
      for (const m of list) if (!m.hidden) shown.push(m.view)
    }
  }

  return { update, monsters: () => shown }
}
