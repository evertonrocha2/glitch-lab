import { ENEMIES } from '../../../../shared/game/enemies.js'
import { createRng } from '../../../../shared/game/rng.js'
import { canEnter, zoneAt } from '../../../../shared/world/map.js'

// Ambient monsters (fase 4): a few idle monsters in every hunt zone, so a zone never looks empty.
// Client only and never sent to the server, but what the player sees stays one world: when a pack
// fight starts, the scene claims the monsters nearest the hero (claimPack) and the pack walks in from
// their spots. A claimed slot comes back later on a tile outside the camera's view. Pure, no DOM, no
// timers: the scene calls update(now, avoid, view) each frame. Nothing here knows the map's size: it
// reads the zones' rects and the tiles.
//   createAmbient({ world, zones, seed, reducedMotion }): world is a map (shared/world/maps/), zones the
//   region's zone defs (ZONES[world.id], an object or a list, each { id, rect, enemies }).
//   update(now, avoid, view): now in ms, avoid a list of { x, y } tiles (the hero first, then the live
//   pack), view the camera's window in tiles { x, y, w, h } (null: refills may land anywhere, fading in).
//   claimPack(members, hero): members [{ enemy, sprite? }], hero a tile. Answers one entry per member:
//   { id, x, y, enemy, sprite } (the monster it takes, wearing the member's look) or null.
//   monsters(): [{ id, enemy, sprite, x, y, facing, anim, fade }], x and y in tiles (a fraction mid
//   step), facing 1 right or -1 left (as drawFoe takes it), anim 'idle' or 'walk', fade 0..1.

export const AMBIENT_PER_ZONE = [6, 10]
// Three zones of up to 10, plus a live pack of up to 9: under 40 enemies drawn on a phone.
export const AMBIENT_CAP = 30
// Tiles (Chebyshev) a wandering monster never steps into around the hero and the live pack. One
// already that close stands where it is, facing the hero: it never vanishes because the hero came.
export const KEEP_AWAY = 4
// How far (tiles) from the hero a pack fight looks for monsters to claim.
export const CLAIM_RANGE = 8
// How long a claimed slot stays empty before a new monster may appear.
export const REFILL_MS = 4000
// Tiles around the camera's view that also count as on screen (a sprite overhangs its tile).
export const VIEW_MARGIN = 2

// A monster wanders one tile every 1.5 to 3 s, taking this long to cross it.
const WAIT_MS = [1500, 3000]
const STEP_MS = 700
const FADE_MS = 400
// How often an empty slot with no tile to come back on looks again.
const RETRY_MS = 500

const STEPS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

const keyOf = (x, y) => `${x},${y}`
const SPRITES = new Map(ENEMIES.map((enemy) => [enemy.id, enemy.sprite]))
const spriteOf = (id) => SPRITES.get(id) ?? id

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

// Whether tile (x, y) is out of the view, VIEW_MARGIN included.
function offView(view, x, y) {
  const m = VIEW_MARGIN
  return x + 1 <= view.x - m || x >= view.x + view.w + m || y + 1 <= view.y - m || y >= view.y + view.h + m
}

export function createAmbient({ world, zones, seed, reducedMotion = false }) {
  const rng = createRng(`ambient/${seed}`)
  const roll = rng.fork('wander')
  const defs = world?.kind === 'town' || !zones ? [] : Array.isArray(zones) ? zones : Object.values(zones)
  const areas = defs.map((zone) => {
    const floor = floorOf(world, zone)
    const enemies = zone.enemies?.length ? zone.enemies : ['slime']
    return { zone, floor, enemies, keys: new Set(floor.map((t) => keyOf(t.x, t.y))) }
  })

  // Tiles taken by a monster (where it stands or is stepping to).
  const taken = new Set()
  const list = []
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
      const enemy = rng.pick(area.enemies)
      const view = { id: `${area.zone.id}-${i}`, enemy, sprite: spriteOf(enemy), x: tile.x, y: tile.y, facing: rng.chance(0.5) ? 1 : -1, anim: 'idle', fade: 1 }
      // hidden: claimed by a pack, coming back at refillAt.
      list.push({ area, view, tx: tile.x, ty: tile.y, fx: tile.x, fy: tile.y, moveAt: -1, nextAt: null, bornAt: -Infinity, hidden: false, refillAt: 0 })
    }
  }
  const shown = list.map((m) => m.view)
  const reshow = () => {
    shown.length = 0
    for (const m of list) if (!m.hidden) shown.push(m.view)
  }
  let lastNow = 0

  const wait = () => WAIT_MS[0] + roll.int(WAIT_MS[1] - WAIT_MS[0] + 1)

  // A free tile of the monster's zone, clear of every avoid tile and off the view: a few random
  // tries, then a scan.
  function refillTile(m, avoid, view) {
    const floor = m.area.floor
    if (!floor.length) return null
    const ok = (t) => !taken.has(keyOf(t.x, t.y)) && clear(avoid, t.x, t.y) && (!view || offView(view, t.x, t.y))
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

  // A claimed slot comes back as a new monster of its zone.
  function refill(m, now, avoid, view) {
    const t = refillTile(m, avoid, view)
    if (!t) {
      m.refillAt = now + RETRY_MS
      return false
    }
    taken.add(keyOf(t.x, t.y))
    m.hidden = false
    m.tx = m.fx = t.x
    m.ty = m.fy = t.y
    m.moveAt = -1
    m.nextAt = now + wait()
    // Off screen it simply is there; with no view to hide behind it fades in.
    m.bornAt = view || reducedMotion ? -Infinity : now
    const enemy = roll.pick(m.area.enemies)
    Object.assign(m.view, { enemy, sprite: spriteOf(enemy), x: t.x, y: t.y, anim: 'idle', fade: m.bornAt === -Infinity ? 1 : 0 })
    return true
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
      taken.delete(keyOf(m.tx, m.ty))
      taken.add(keyOf(x, y))
      m.tx = x
      m.ty = y
      if (step.x) m.view.facing = step.x
      return true
    }
    return false
  }

  function update(now, avoid = [], view = null) {
    lastNow = now
    let changed = false
    const hero = avoid[0]
    for (const m of list) {
      const v = m.view
      if (m.nextAt === null) m.nextAt = now + wait()
      if (m.hidden) {
        if (now >= m.refillAt && refill(m, now, avoid, view)) changed = true
        continue
      }
      // A step under way finishes; then a monster near the hero or the pack stands, facing the hero.
      if (m.moveAt >= 0 && now - m.moveAt >= STEP_MS) m.moveAt = -1
      const near = !clear(avoid, m.tx, m.ty)
      if (near && m.moveAt < 0) {
        if (hero && hero.x !== m.tx) v.facing = hero.x > m.tx ? 1 : -1
        m.nextAt = now + wait()
      } else if (!reducedMotion && m.moveAt < 0 && now >= m.nextAt) {
        if (wander(m, avoid)) m.moveAt = now
        m.nextAt = now + wait()
      }
      if (m.moveAt >= 0) {
        const q = Math.min(1, (now - m.moveAt) / STEP_MS)
        v.x = m.fx + (m.tx - m.fx) * q
        v.y = m.fy + (m.ty - m.fy) * q
        v.anim = 'walk'
      } else {
        v.x = m.tx
        v.y = m.ty
        v.anim = 'idle'
      }
      v.fade = m.bornAt === -Infinity ? 1 : Math.min(1, Math.max(0, (now - m.bornAt) / FADE_MS))
    }
    if (changed) reshow()
  }

  // The monsters a pack fight is made of: per member, the nearest unclaimed monster of the hero's
  // zone within CLAIM_RANGE, one showing the member's enemy first. Taken ones leave the set now and
  // their slots refill after REFILL_MS.
  function claimPack(members, hero) {
    const out = members.map(() => null)
    const zone = hero ? zoneAt(world, Math.round(hero.x), Math.round(hero.y)) : null
    if (!zone) return out
    const far = (m) => Math.hypot(m.view.x - hero.x, m.view.y - hero.y)
    const pool = list.filter((m) => !m.hidden && m.area.zone.id === zone.id && far(m) <= CLAIM_RANGE).sort((a, b) => far(a) - far(b))
    for (let i = 0; i < members.length && pool.length; i++) {
      const { enemy, sprite } = members[i]
      let j = pool.findIndex((m) => m.view.enemy === enemy)
      if (j < 0) j = 0
      const [m] = pool.splice(j, 1)
      out[i] = { id: m.view.id, x: m.view.x, y: m.view.y, enemy, sprite: sprite ?? spriteOf(enemy) }
      taken.delete(keyOf(m.tx, m.ty))
      m.hidden = true
      m.moveAt = -1
      m.refillAt = lastNow + REFILL_MS
    }
    if (out.some(Boolean)) reshow()
    return out
  }

  return { update, claimPack, monsters: () => shown }
}
