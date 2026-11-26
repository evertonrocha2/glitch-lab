import { heroFrame } from '../../game/scene/game-scene.jsx'
import { approach, cameraOn, STEP_MS, sideOf, tileAtPoint } from '../../game/scene/walk.js'

// What part of a Glitch World map the hub shows and how the hero stands in it. Pure helpers, so the
// canvas (hub-scene.jsx) and the game around it (world-game.jsx) agree on the same numbers.

// The walking helpers live with the hunt's scene, which walks the hero too.
export { approach, cameraOn, STEP_MS, sideOf, tileAtPoint }

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

// The hero doll's pose: walking swaps the two idle frames once per step (frame flips with each step)
// and bobs 1px on the second; standing breathes like the hunt's idle; reduced motion holds idle0.
// t: seconds.
export function heroPose({ walking, frame, t = 0, reduced = false }) {
  if (reduced) return { pose: 'idle0', bob: 0 }
  if (walking) return frame % 2 === 1 ? { pose: 'idle1', bob: 1 } : { pose: 'idle0', bob: 0 }
  const { pose } = heroFrame('idle', 0, t, false)
  return { pose, bob: 0 }
}

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
