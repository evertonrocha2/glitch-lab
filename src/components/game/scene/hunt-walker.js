import { canStand } from './placement.js'
import { DIRECTIONS, STEP_MS, sideOf } from './walk.js'

// The hero walking the hunted zone. Presentation only: the server never hears of it, and the fight
// logs are relative to the hero, so walking changes nothing but where the fights are drawn.
// The player steers with keys, the pad or a click; left alone for IDLE_MS the hero strolls to a spot a
// few tiles away by itself (only while the caller allows it: between packs of a hunt).
// A plain object with no timers: the scene's frame clock drives it through update(now).

export const IDLE_MS = 3000
export const ROAM_STEP_MS = 260
export const ROAM_PAUSE_MS = 900
const ROAM_MIN = 3
const ROAM_MAX = 7

const key = (x, y) => `${x},${y}`
const STEPS = Object.values(DIRECTIONS)

// Every floor tile reachable from `from` inside rect, with how it was reached (BFS).
function flood(world, rect, from, stopAt) {
  const came = new Map([[key(from.x, from.y), null]])
  const order = [from]
  for (let i = 0; i < order.length; i++) {
    const at = order[i]
    if (stopAt && at.x === stopAt.x && at.y === stopAt.y) break
    for (const s of STEPS) {
      const x = at.x + s.x
      const y = at.y + s.y
      const k = key(x, y)
      if (came.has(k) || !canStand(world, rect, x, y)) continue
      came.set(k, at)
      order.push({ x, y })
    }
  }
  return { came, order }
}

// The steps from `from` to `to` (without from) inside rect: [] when already there, null when `to`
// is not floor or can't be reached.
export function pathWithin(world, rect, from, to) {
  if (from.x === to.x && from.y === to.y) return []
  if (!canStand(world, rect, to.x, to.y)) return null
  const { came } = flood(world, rect, from, to)
  if (!came.has(key(to.x, to.y))) return null
  const path = []
  for (let at = to; at && !(at.x === from.x && at.y === from.y); at = came.get(key(at.x, at.y))) path.unshift({ x: at.x, y: at.y })
  return path
}

// Where a stroll goes: a reachable floor tile 3 to 7 steps (by grid distance) from `from`, picked with
// random() (0..1). Any other reachable tile when none is that far; null when there is nowhere to go.
export function roamTarget(world, rect, from, random = Math.random) {
  const { order } = flood(world, rect, from)
  const others = order.filter((t) => t.x !== from.x || t.y !== from.y)
  const far = others.filter((t) => {
    const d = Math.abs(t.x - from.x) + Math.abs(t.y - from.y)
    return d >= ROAM_MIN && d <= ROAM_MAX
  })
  const pool = far.length ? far : others
  if (!pool.length) return null
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

const slide = (a, b, max) => (Math.abs(b - a) <= max ? b : a + Math.sign(b - a) * max)
const directionTo = (from, to) => (to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up')

// world: the map. rect: the hunted zone (the hero never leaves it). start: { x, y } tile.
// reduced: no sliding between tiles. random: for the strolls.
export function createWalker({ world, rect, start, random = Math.random, reduced = false }) {
  const w = {
    tile: { x: start.x, y: start.y },
    pos: { x: start.x, y: start.y },
    side: 1,
    // Walking right now (sliding, or stepped in the last moments).
    moving: false,
    roaming: false,
    held: null,
    path: [],
    pace: STEP_MS,
    nextAt: 0,
    lastInput: null,
    pauseUntil: 0,
    stepAt: Number.NEGATIVE_INFINITY,
    last: null,
  }

  const step = (dir, now) => {
    const d = DIRECTIONS[dir]
    if (!d) return false
    w.side = sideOf(dir, w.side)
    const x = w.tile.x + d.x
    const y = w.tile.y + d.y
    if (!canStand(world, rect, x, y)) return false
    w.tile = { x, y }
    w.stepAt = now
    if (reduced) {
      w.pos.x = x
      w.pos.y = y
    }
    return true
  }
  const steer = (now) => {
    w.lastInput = now
    w.roaming = false
  }

  w.press = (dir, now) => {
    steer(now)
    w.path = []
    w.held = dir
    w.pace = STEP_MS
    step(dir, now)
    w.nextAt = now + STEP_MS
  }
  w.release = (dir) => {
    if (dir && w.held !== dir) return
    w.held = null
  }
  // One step (a pad button pressed from the keyboard).
  w.tap = (dir, now) => {
    steer(now)
    w.path = []
    w.held = null
    step(dir, now)
  }
  // Walks to a clicked tile. A tile the hero can't stand on is reached by its nearest floor neighbor.
  w.walkTo = (x, y, now) => {
    steer(now)
    w.held = null
    let path = pathWithin(world, rect, w.tile, { x, y })
    if (!path) {
      let best = null
      for (const s of STEPS) {
        const p = pathWithin(world, rect, w.tile, { x: x + s.x, y: y + s.y })
        if (p && (!best || p.length < best.length)) best = p
      }
      path = best
    }
    w.path = path ?? []
    w.pace = STEP_MS
    w.nextAt = now
  }

  // Advances to `now` (ms, the frame clock). roam: whether a stroll may start.
  w.update = (now, { roam = false } = {}) => {
    if (w.lastInput === null) w.lastInput = now
    if (w.last === null) w.last = now
    if (now - w.nextAt > 1000) w.nextAt = now
    while ((w.held || w.path.length) && now >= w.nextAt) {
      if (w.held) step(w.held, w.nextAt)
      else {
        const next = w.path.shift()
        if (!step(directionTo(w.tile, next), w.nextAt)) w.path = []
        if (!w.path.length && w.roaming) w.pauseUntil = now + ROAM_PAUSE_MS
      }
      w.nextAt += w.pace
    }
    if (!w.held && !w.path.length && roam && !reduced && now - w.lastInput >= IDLE_MS && now >= w.pauseUntil) {
      const target = roamTarget(world, rect, w.tile, random)
      const path = target && pathWithin(world, rect, w.tile, target)
      if (path?.length) {
        w.path = path
        w.pace = ROAM_STEP_MS
        w.nextAt = now
        w.roaming = true
      } else w.pauseUntil = now + ROAM_PAUSE_MS
    }
    const dt = Math.max(0, now - w.last)
    w.last = now
    // Mutated in place: this runs every frame.
    const max = reduced ? Infinity : dt / w.pace
    w.pos.x = slide(w.pos.x, w.tile.x, max)
    w.pos.y = slide(w.pos.y, w.tile.y, max)
    w.moving = w.pos.x !== w.tile.x || w.pos.y !== w.tile.y || now - w.stepAt < w.pace * 1.5
    return w
  }
  return w
}
