import { heroFrame } from '../../game/scene/game-scene.jsx'

// What part of a Glitch World map the hub shows and how the hero stands in it. Pure helpers, so the
// canvas (hub-scene.jsx) and the game around it (world-game.jsx) agree on the same numbers.

// About 8 steps a second while a key, a pad button or a click path keeps the hero walking; the hero
// also takes this long to slide from one tile to the next on screen.
export const STEP_MS = 125

// The zoom levels, remembered with the hunt's own key: one setting for the whole game.
export const ZOOMS = ['far', 'mid', 'near']
export const ZOOM_KEY = 'gd:game-zoom'

// Far shows up to 24x15 tiles on a wide screen (12x15 on a phone), never more than the map; mid and
// near show a share of that, so even the 15x10 Lab gets closer at each step.
const FAR = { wide: { w: 24, h: 15 }, narrow: { w: 12, h: 15 } }
const SCALE = { far: 1, mid: 0.8, near: 0.62 }

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const sizeOf = (world) => ({ cols: world.rows.reduce((max, row) => Math.max(max, row.length), 0), rows: world.rows.length })

// The view in tiles ({ w, h }) for a world at a zoom level. wide: a desktop-sized stage.
export function cropFor(world, zoom, wide) {
  const { cols, rows } = sizeOf(world)
  const base = wide ? FAR.wide : FAR.narrow
  const far = { w: Math.min(base.w, cols), h: Math.min(base.h, rows) }
  const scale = SCALE[zoom] ?? 1
  return { w: Math.max(1, Math.round(far.w * scale)), h: Math.max(1, Math.round(far.h * scale)) }
}

// The view's top left, in tiles (fractions allowed): the hero (at, maybe between two tiles) in the
// middle, never past the map's edges.
export function cameraOn(world, at, crop) {
  const { cols, rows } = sizeOf(world)
  return {
    x: clamp(at.x + 0.5 - crop.w / 2, 0, Math.max(0, cols - crop.w)),
    y: clamp(at.y + 0.5 - crop.h / 2, 0, Math.max(0, rows - crop.h)),
  }
}

// The tile under a pointer ({ clientX, clientY }) on the picture's box (getBoundingClientRect), seen
// through the camera at this crop. null outside the picture.
export function tileAtPoint({ clientX, clientY }, box, camera, crop) {
  if (!(box?.width > 0) || !(box?.height > 0)) return null
  const px = clientX - box.left
  const py = clientY - box.top
  if (px < 0 || py < 0 || px >= box.width || py >= box.height) return null
  return { x: Math.floor((px / box.width) * crop.w + camera.x), y: Math.floor((py / box.height) * crop.h + camera.y) }
}

// The hero doll's pose: walking swaps the two idle frames once per step (frame flips with each step)
// and bobs 1px on the second; standing breathes like the hunt's idle; reduced motion holds idle0.
// t: seconds.
export function heroPose({ walking, frame, t = 0, reduced = false }) {
  if (reduced) return { pose: 'idle0', bob: 0 }
  if (walking) return frame % 2 === 1 ? { pose: 'idle1', bob: 1 } : { pose: 'idle0', bob: 0 }
  const { pose } = heroFrame('idle', 0, t, false)
  return { pose, bob: 0 }
}

// The doll is drawn from the side: 1 faces right, -1 left. Walking up or down keeps the last side.
export function sideOf(facing, previous = 1) {
  if (facing === 'left') return -1
  if (facing === 'right') return 1
  return previous
}

// A point moved toward a target by at most `step` tiles on each axis, landing on it when close.
export function approach(from, to, step) {
  const move = (a, b) => (Math.abs(b - a) <= step ? b : a + Math.sign(b - a) * step)
  return { x: move(from.x, to.x), y: move(from.y, to.y) }
}

// The rects (in tiles) of the world's zones that are not open yet. open: a Set of zone ids.
export const lockedRects = (world, open) => world.zones.filter((zone) => !open.has(zone.id)).map((zone) => ({ ...zone.rect }))

// The portals (x, y) leading to a world still locked. state: GET /api/world.
export function lockedPortals(world, state) {
  const shut = new Set(state.worlds.filter((item) => !item.unlocked).map((item) => item.id))
  return world.portals.filter((portal) => shut.has(portal.to)).map(({ x, y }) => ({ x, y }))
}

// A tile is drawn at most 3x its 16 art pixels far out (about the hunt's size on a wide screen), a bit
// more at each zoom step, so a small map (the Lab) sits in the dark stage instead of blowing up.
const TILE_MAX_PX = 48

// The crop fitted to the stage box ({ width, height } in CSS pixels, height being what the screen
// leaves): tiles as big as the box allows, then as many more columns of the map as fill its width.
// Returns { w, h, tile } with tile in CSS pixels, or the crop with tile null before it is measured.
export function fitCrop(world, zoom, crop, box) {
  if (!(box?.width > 0) || !(box?.height > 0)) return { ...crop, tile: null }
  const { cols } = sizeOf(world)
  const tile = Math.min(TILE_MAX_PX / (SCALE[zoom] ?? 1), box.width / crop.w, box.height / crop.h)
  return { w: clamp(Math.floor(box.width / tile + 1e-9), crop.w, Math.max(crop.w, cols)), h: crop.h, tile }
}
