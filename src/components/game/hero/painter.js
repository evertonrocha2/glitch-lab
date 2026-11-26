import { INK, MAT } from './palette.js'

// The hero is painted as materials into a grid, then shaded (light from the top left, dithered)
// and outlined in one pass, like the item icons. Parts use local coordinates where the body box is
// 0..31; the grid adds room around it for weapons, the relic and effects.
const OX = 10
const OY = 12
const GW = 56
const GH = 46

// w, h: the grid (and canvas) size. ox, oy: where the 32x32 body box starts, so callers can anchor the feet.
export const SPRITE = { w: GW, h: GH, ox: OX, oy: OY }

// A blank grid with drawing helpers. `part` tags each cell so shading treats parts as separate
// shapes; dx, dy shift what is drawn next (lean, bob); fx are loose pixels drawn on top, unshaded.
export function painter() {
  const g = Array.from({ length: GH }, () => Array(GW).fill(null))
  const d = { g, fx: [], part: 'x', dx: 0, dy: 0, mats: {} }
  const gx = (x) => Math.round(x + d.dx) + OX
  const gy = (y) => Math.round(y + d.dy) + OY
  d.set = (x, y, m, o) => {
    const X = gx(x)
    const Y = gy(y)
    if (X >= 0 && Y >= 0 && X < GW && Y < GH) g[Y][X] = { m, p: d.part, ...o }
  }
  d.get = (x, y) => g[gy(y)]?.[gx(x)] ?? null
  d.del = (x, y) => {
    if (g[gy(y)]?.[gx(x)] !== undefined) g[gy(y)][gx(x)] = null
  }
  // A fixed color, or a fixed tone of the material, on a cell already painted.
  d.paint = (x, y, c) => {
    const cell = d.get(x, y)
    if (cell) cell.c = c
  }
  d.shade = (x, y, t) => {
    const cell = d.get(x, y)
    if (cell && !cell.c) cell.t = t
  }
  d.rect = (x, y, w, h, m, f, o) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!f || f(i, j)) d.set(i, j, m, o)
  }
  d.circ = (cx, cy, rx, ry, m, f, o) => {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const a = (x + 0.5 - cx) / rx
        const b = (y + 0.5 - cy) / ry
        if (a * a + b * b <= 1 && (!f || f(x, y))) d.set(x, y, m, o)
      }
    }
  }
  d.poly = (pts, m, f, o) => {
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.max(...ys) + 1; y++) {
      for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.max(...xs) + 1; x++) {
        const px = x + 0.5
        const py = y + 0.5
        let ins = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]
          const [xj, yj] = pts[j]
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins
        }
        if (ins && (!f || f(x, y))) d.set(x, y, m, o)
      }
    }
  }
  d.line = (x0, y0, x1, y1, m, t = 1, o) => {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) || 1
    const off = Math.floor((t - 1) / 2)
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n)
      const y = Math.round(y0 + ((y1 - y0) * i) / n)
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) d.set(x + a - off, y + b - off, m, o)
    }
  }
  d.fxp = (x, y, c, a = 1) => d.fx.push({ x: gx(x), y: gy(y), c, a })
  return d
}

// Parts that cast a shadow on whatever sits right under them (the chin on the chest, the hat brim on the face).
const CASTS = new Set(['head', 'hair', 'helm', 'pauld'])

// Shade, outline and draw the grid on a new canvas. With no 2D context (tests, odd browsers) the
// canvas comes back blank but sized.
export function render(d, { outline = INK, aura = null } = {}) {
  const c = document.createElement('canvas')
  c.width = GW
  c.height = GH
  const ctx = c.getContext('2d')
  if (!ctx) return c
  const g = d.g
  const at = (x, y) => (x >= 0 && y >= 0 && x < GW && y < GH ? g[y][x] : null)
  const same = (a, b) => b && a.m === b.m && a.p === b.p
  // Each material's bounding box per part, for the diagonal light falloff.
  const box = {}
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const cell = g[y][x]
      if (!cell) continue
      const k = `${cell.m}|${cell.p}`
      box[k] ??= [x, y, x, y]
      const b = box[k]
      b[0] = Math.min(b[0], x)
      b[1] = Math.min(b[1], y)
      b[2] = Math.max(b[2], x)
      b[3] = Math.max(b[3], y)
    }
  }
  // A dotted glow two pixels out from the silhouette.
  if (aura) {
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (at(x, y)) continue
        let dm = 9
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (at(x + i, y + j)) dm = Math.min(dm, Math.max(Math.abs(i), Math.abs(j)))
        if (dm === 2 && (x + y) % 2 === 0) {
          ctx.globalAlpha = 0.32
          ctx.fillStyle = aura
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
    ctx.globalAlpha = 1
  }
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const cell = at(x, y)
      if (!cell) {
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
          ctx.fillStyle = outline
          ctx.fillRect(x, y, 1, 1)
        }
        continue
      }
      ctx.fillStyle = cell.c || toneOf(d, cell, x, y, at, same, box)
      ctx.fillRect(x, y, 1, 1)
    }
  }
  for (const f of d.fx) {
    ctx.globalAlpha = f.a
    ctx.fillStyle = f.c
    ctx.fillRect(f.x, f.y, 1, 1)
  }
  ctx.globalAlpha = 1
  return c
}

// Edges facing the light get lighter tones, edges facing away darker; flat insides fade along the
// part's diagonal, dithered; a part under a casting part (chin, brim) gets its shadow.
function toneOf(d, cell, x, y, at, same, box) {
  const T = d.mats[cell.m] || MAT[cell.m]
  let tone = cell.t
  if (tone == null) {
    const lit = !same(cell, at(x - 1, y)) + !same(cell, at(x, y - 1))
    const sh = !same(cell, at(x + 1, y)) + !same(cell, at(x, y + 1))
    tone = lit > sh ? 2 : sh > lit ? 0 : 1
    if (lit === 2 && sh === 0) tone = 3
    if (tone === 1 && cell.m !== 'skin') {
      const b = box[`${cell.m}|${cell.p}`]
      const t = (x - b[0] + y - b[1]) / (b[2] - b[0] + b[3] - b[1] || 1)
      if (t > 0.72 || (t > 0.6 && (x + y) % 2)) tone = 0
      else if (t < 0.18) tone = 2
    }
    const up = at(x, y - 1)
    if (up && up.p !== cell.p && CASTS.has(up.p) && !CASTS.has(cell.p)) tone = 0
  }
  return T[Math.max(0, Math.min(3, tone))]
}
