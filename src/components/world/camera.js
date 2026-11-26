// How much of a Glitch World map fits on screen, and which part of it to show.

export const TILE_SCREEN_PX = 48

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// Up to 15x10 tiles of 48px on a wide screen, at least 7x7 on a phone.
export function viewportFor(widthPx) {
  const cols = clamp(Math.floor(widthPx / TILE_SCREEN_PX), 7, 15)
  return { cols, rows: clamp(Math.round((cols * 2) / 3), 7, 10) }
}

// The top-left tile in view: the hero in the middle, never past the map's edges.
export function cameraFor(world, hero, { cols, rows }) {
  const width = world.rows[0].length
  const height = world.rows.length
  return {
    x: clamp(hero.x - Math.floor(cols / 2), 0, Math.max(0, width - cols)),
    y: clamp(hero.y - Math.floor(rows / 2), 0, Math.max(0, height - rows)),
  }
}
