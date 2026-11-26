import { expect, it } from 'vitest'
import { TILES } from '../../../../shared/world/tiles.js'
import { mapLights, paintMap, TS } from './tiles.js'

// A 2D context that records the color of every pixel painted inside one tile.
function tileColors(rows, tx, ty) {
  const colors = new Set()
  const ctx = {
    fillStyle: '',
    canvas: { width: 64, height: 64 },
    fillRect(x, y, w, h) {
      if (x + w > tx * TS && x < (tx + 1) * TS && y + h > ty * TS && y < (ty + 1) * TS) colors.add(ctx.fillStyle)
    },
    createRadialGradient: () => ({ addColorStop() {} }),
  }
  paintMap(ctx, { id: 'test', rows, zones: [] })
  return colors
}

const OLD = new Set(['.', ':', '_', 'O', 'D', '~', 'T', '^', '#', 'B', 'C'])
const NEW = Object.keys(TILES).filter((char) => !OLD.has(char))

it('has fase 4 decoration tiles to draw', () => {
  expect(NEW.length).toBeGreaterThanOrEqual(15)
})

it.each(NEW)('draws %s with its own art, not as the grass around it', (char) => {
  const plain = tileColors(['...', '...', '...'], 1, 1)
  const drawn = tileColors(['...', `.${char}.`, '...'], 1, 1)
  expect([...drawn].some((color) => !plain.has(color)), TILES[char].name).toBe(true)
})

it('draws the decorations on the cave floor too', () => {
  for (const char of NEW) {
    const plain = tileColors(['___', '___', '___'], 1, 1)
    const drawn = tileColors(['___', `_${char}_`, '___'], 1, 1)
    expect([...drawn].some((color) => !plain.has(color)), TILES[char].name).toBe(true)
  }
})

it('lets crystals glow softly, in steel blue', () => {
  const crystal = Object.keys(TILES).find((char) => TILES[char].name === 'crystal')
  const lights = mapLights({ id: 'test', rows: ['___', `_${crystal}_`, '___'], zones: [] })
  expect(lights).toHaveLength(1)
  expect(lights[0].a).toBeLessThanOrEqual(0.3)
})
