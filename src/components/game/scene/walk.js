// Walking helpers shared by the hub (world/hub-scene) and the hunt (this scene): steps, the camera
// that follows the hero, and pointer to tile. Pure, no DOM.

// About 8 steps a second while a key, a pad button or a click path keeps the hero walking; the hero
// also takes this long to slide from one tile to the next on screen.
export const STEP_MS = 125

export const DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
// The direction a key walks (arrows and WASD), or null.
export const directionOf = (key) => (typeof key === 'string' ? (KEYS[key] ?? KEYS[key.toLowerCase()] ?? null) : null)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const sizeOf = (world) => ({ cols: world.rows.reduce((max, row) => Math.max(max, row.length), 0), rows: world.rows.length })

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
