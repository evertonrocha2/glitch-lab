// Pixel primitives for the scene, ported from the approved mockup (game-depth.html). Everything paints
// with fillStyle + fillRect only, so a static layer can go to any 2D context (or a test recorder).

// A stable noise value in [0, 1) for a pixel or a tile.
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// One pixel.
export function P(ctx, x, y, c) {
  ctx.fillStyle = c
  ctx.fillRect(x, y, 1, 1)
}

export function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c
  ctx.fillRect(x, y, w, h)
}

export function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1)
    }
  }
}

// A shaded, outlined blob: light from the top left, dithered between tones. pal goes dark to light.
// cutBelow flattens the bottom (a slime sitting on the ground).
export function blob(ctx, cx, cy, rx, ry, pal, outline, cutBelow = Infinity) {
  const inside = (x, y) => {
    const nx = (x - cx) / rx
    const ny = (y - cy) / ry
    return nx * nx + ny * ny <= 1 && y <= cutBelow
  }
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (!inside(x, y)) continue
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      if (edge) {
        P(ctx, x, y, outline)
        continue
      }
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      const l = -nx * 0.55 - ny * 0.65 + nz * 0.55 + ((x + y) % 2 ? 0.07 : -0.07)
      const i = Math.max(0, Math.min(pal.length - 1, Math.floor((l + 0.35) * pal.length * 0.8)))
      P(ctx, x, y, pal[i])
    }
  }
}

// A sprite from rows of palette keys; '.' is see-through. flip mirrors it left to right.
export function sprite(ctx, rows, pal, ox, oy, flip = false) {
  rows.forEach((row, y) => {
    const w = row.length
    for (let x = 0; x < w; x++) {
      const k = row[x]
      if (k !== '.' && pal[k]) P(ctx, ox + (flip ? w - 1 - x : x), oy + y, pal[k])
    }
  })
}

// A 1px line between two points.
export function line(ctx, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) P(ctx, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c)
}

export const SHADOW = 'rgba(16,40,12,.38)'
