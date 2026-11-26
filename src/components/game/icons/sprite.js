import { each, FLAT, iconGrid, MAT, N } from './recipes.js'

const cache = new Map()

// 18x18 canvas: the 16x16 recipe, auto shaded, with a 1px ink outline.
// Returns null when there is no 2D context (tests, odd browsers).
export function iconCanvas(name) {
  if (cache.has(name)) return cache.get(name)
  const g = iconGrid(name)
  const box = {}
  each((x, y) => {
    const m = g[y][x]
    if (!m) return
    const b = box[m] ?? [x, y, x, y]
    box[m] = b
    b[0] = Math.min(b[0], x)
    b[1] = Math.min(b[1], y)
    b[2] = Math.max(b[2], x)
    b[3] = Math.max(b[3], y)
  })
  const c = document.createElement('canvas')
  c.width = c.height = N + 2
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null)
  for (let y = -1; y <= N; y++) {
    for (let x = -1; x <= N; x++) {
      const m = at(x, y)
      let col
      if (!m) {
        if (!(at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) continue
        col = '#120c22'
      } else if (FLAT[m]) col = FLAT[m]
      else {
        const lit = (at(x - 1, y) !== m) + (at(x, y - 1) !== m)
        const sh = (at(x + 1, y) !== m) + (at(x, y + 1) !== m)
        let tone = lit > sh ? 2 : sh > lit ? 0 : 1
        if (lit === 2 && sh === 0) tone = 3
        if (tone === 1) {
          const b = box[m]
          const t = (x - b[0] + y - b[1]) / (b[2] - b[0] + b[3] - b[1] || 1)
          if (t > 0.72 || (t > 0.6 && (x + y) % 2)) tone = 0
          else if (t < 0.18) tone = 2
        }
        col = MAT[m][tone]
      }
      ctx.fillStyle = col
      ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  cache.set(name, c)
  return c
}
