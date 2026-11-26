import { SPRITE } from '../hero/draw-hero.js'
import { heroSprite } from '../hero/hero-cache.js'
import { blob, ellipse, hash, P, rect } from '../scene/pixels.js'

// The loading screen's night scene, painted in art pixels and scaled up whole: a dithered night sky
// with stars, an arcane rift forming over the forest, mountains and two tree lines scrolling at their
// own speed (parallax), a forest path, fireflies, and the hero walking in place on it.
// Static layers are painted once per size into strips that tile sideways; each frame only copies them
// at an offset and paints the moving bits (rift, stars, fireflies, dust, hero, lights).

// Art pixels per CSS pixel: about 165 art pixels across, never below 2 or above 7.
const ART_W = 165
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Scroll speeds in art pixels a second, far to near.
const SPEED = { clouds: 2, mountains: 3, far: 9, near: 18, ground: 36 }
// One step of the walk (the idle frames swap and the body bobs).
export const STEP_MS = 180

const SKY = ['#05031a', '#090624', '#0e0a2f', '#160f3b', '#201548', '#2d1b57', '#3c2266']
const MOUNTAIN = { fill: '#150f36', rim: '#2b2061', snow: '#3a2c78' }
const FAR = { pal: ['#0f0c2c', '#15113b', '#1c174b', '#251f5d', '#302870'], ink: '#090720' }
const NEAR = { pal: ['#08161c', '#0c2026', '#112c2e', '#173a37', '#214b43'], ink: '#040c0e' }
const GRASS = { base: '#27492f', dark: '#1d3a25', light: '#33603b', blade: '#4f8a4e', patch: '#234229' }
const PATH = { base: '#4e3f4c', dark: '#41343f', light: '#5f4f5b', pebble: '#2f2632', edge: '#3a2e38' }
const RIFT = { edge: '#c3a6ff', rim: '#1a1036', ring: '#7a4cf5', ringHi: '#e2d6ff', hi: '#b49cff', mid: '#5a2ee0', deep: '#341a9c', core: '#f4eeff' }

// The scene size for a box of cssW x cssH whose lower bandPx are covered by the text band.
// s: CSS pixels per art pixel; w, h: the art size; feet: the line the hero stands on.
export function sceneSize(cssW, cssH, bandPx = 0) {
  const s = clamp(Math.round(cssW / ART_W), 2, 7)
  const w = Math.max(80, Math.ceil(cssW / s))
  const h = Math.max(60, Math.ceil(cssH / s))
  const feet = clamp(Math.floor((cssH - bandPx) / s) - 4, Math.round(h * 0.5), h - 8)
  return { s, w, h, feet }
}

function canvasOf(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  return ctx ? { canvas, ctx } : null
}

// A 2x2 ordered dither threshold.
const BAYER = [0.2, 0.6, 0.8, 0.4]
const dither = (x, y) => BAYER[(y % 2) * 2 + (x % 2)]

function paintSky({ ctx }, w, h, feet) {
  for (let y = 0; y < h; y++) {
    const f = clamp(y / feet, 0, 1) * (SKY.length - 1)
    const i = Math.min(SKY.length - 2, Math.floor(f))
    const frac = f - i
    if (frac < 0.2 || frac >= 0.8) {
      rect(ctx, 0, y, w, 1, SKY[frac < 0.2 ? i : i + 1])
      continue
    }
    for (let x = 0; x < w; x++) P(ctx, x, y, frac > dither(x, y) ? SKY[i + 1] : SKY[i])
  }
  // Stars: most dim, a few bright with a cross.
  const count = Math.round((w * feet) / 90)
  for (let n = 0; n < count; n++) {
    const x = Math.floor(hash(n, 1) * w)
    const y = Math.floor(hash(n, 2) * feet * 0.8)
    const b = hash(n, 3)
    if (b > 0.94) {
      P(ctx, x, y, '#ffffff')
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P(ctx, x + dx, y + dy, '#8f86c2')
    } else P(ctx, x, y, b > 0.6 ? '#b8b0e6' : '#5a4f8a')
  }
}

// A strip that repeats every tw pixels: periodic sines only.
const wave = (x, tw, k, phase) => Math.sin((2 * Math.PI * k * x) / tw + phase)

function paintMountains({ ctx }, tw, feet) {
  for (let x = 0; x < tw; x++) {
    const peak = 1 - Math.abs(wave(x, tw, 2, 0.4))
    const top = Math.round(feet - 22 - peak * 24 - wave(x, tw, 5, 1.3) * 4 - wave(x, tw, 11, 2.1) * 1.5)
    rect(ctx, x, top, 1, feet - top, MOUNTAIN.fill)
    P(ctx, x, top, MOUNTAIN.rim)
    if (peak > 0.8) P(ctx, x, top + 1, MOUNTAIN.snow)
  }
}

// A tree line: round crowns like the hunt's trees, night colors, a dark floor under them.
function paintTrees({ ctx }, tw, base, { pal, ink }, size, seed) {
  rect(ctx, 0, base - 2, tw, 64, pal[0])
  let x = 0
  let n = 0
  const trees = []
  while (x < tw) {
    const r = size[0] + hash(n, seed) * (size[1] - size[0])
    trees.push({ x, r, n })
    x += Math.round(r * 1.3 + hash(n, seed + 1) * r)
    n++
  }
  for (const tree of trees) {
    for (const shift of [-tw, 0, tw]) {
      const cx = tree.x + shift
      if (cx < -tree.r * 2 || cx > tw + tree.r * 2) continue
      const lift = tree.r * (1.5 + hash(tree.n, seed + 3) * 0.6)
      rect(ctx, cx - 1, base - lift, 3, lift, ink)
      rect(ctx, cx, base - lift + 2, 1, lift - 3, pal[1])
      blob(ctx, cx, base - lift, tree.r, tree.r * 0.9, pal, ink)
      if (hash(tree.n, seed + 2) < 0.45) blob(ctx, cx + tree.r * 0.45, base - lift - tree.r * 0.7, tree.r * 0.62, tree.r * 0.58, pal, ink)
    }
  }
}

// A far line of pines: three stacked tiers each, lit from the left, on a dark floor.
function paintPines({ ctx }, tw, base, { pal, ink }, size, seed) {
  rect(ctx, 0, base - 2, tw, 64, pal[0])
  let x = 0
  let n = 0
  while (x < tw) {
    const h = Math.round(size[0] + hash(n, seed) * (size[1] - size[0]))
    for (const cx of [x - tw, x, x + tw]) {
      if (cx < -h || cx > tw + h) continue
      rect(ctx, cx, base - 3, 2, 4, ink)
      for (let k = 0; k < 3; k++) {
        const top = base - h + Math.round(k * h * 0.26)
        const tierH = Math.round(h * 0.42)
        for (let y = 0; y < tierH; y++) {
          const half = Math.round(1 + (y / tierH) * h * (0.2 + 0.07 * k))
          for (let dx = -half; dx <= half + 1; dx++) {
            const edge = dx === -half || dx === half + 1 || y === tierH - 1
            const f = (dx + half) / (2 * half + 2)
            const lit = f < 0.3 || (f < 0.4 && (dx + y) % 2 === 0)
            const tone = edge ? ink : lit ? pal[3] : f < 0.7 ? pal[2] : pal[1]
            P(ctx, cx + dx, top + y, tone)
          }
        }
      }
    }
    x += Math.round(h * 0.45 + hash(n, seed + 1) * h * 0.5)
    n++
  }
}

function grassAt(x, y) {
  const n = hash(x, y, 3)
  let c = hash(Math.floor(x / 7), Math.floor(y / 5), 7) < 0.3 ? GRASS.patch : GRASS.base
  if (n < 0.12) c = GRASS.dark
  else if (n > 0.93) c = GRASS.light
  return c
}

// The ground strip, from 4 pixels above the feet line down: a grass verge with blades, the path the
// hero walks on, the near verge.
function paintGround({ ctx }, tw, height) {
  const pathTop = 4
  const pathBottom = 13
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < tw; x++) {
      const ragged = hash(x, 0, 19) < 0.35 ? 1 : 0
      let c
      if (y < pathTop + ragged || y >= pathBottom - ragged) c = grassAt(x, y)
      else {
        const n = hash(x, y, 5)
        c = n < 0.15 ? PATH.dark : n > 0.9 ? PATH.light : PATH.base
        if (hash(Math.floor(x / 2), Math.floor(y / 2), 9) > 0.95) c = PATH.pebble
        if (y === pathTop + ragged || y === pathBottom - ragged - 1) c = PATH.edge
      }
      P(ctx, x, y, c)
    }
  }
  // Blades poking up out of the back verge, tufts and night flowers on both verges.
  for (let x = 0; x < tw; x++) {
    if (hash(x, 1, 23) > 0.72) P(ctx, x, 0, GRASS.blade)
    if (hash(x, 2, 29) > 0.9) {
      P(ctx, x, 1, GRASS.light)
      P(ctx, x, 0, GRASS.blade)
    }
  }
  for (let n = 0; n < tw / 10; n++) {
    const x = 2 + Math.floor(hash(n, 31) * (tw - 4))
    const y = hash(n, 33) < 0.5 ? 1 + Math.floor(hash(n, 35) * 2) : pathBottom + 1 + Math.floor(hash(n, 37) * Math.max(1, height - pathBottom - 3))
    if (hash(n, 39) < 0.3) {
      const col = ['#c58bd6', '#d8d27a', '#8fb7ff'][n % 3]
      P(ctx, x, y - 1, col)
      P(ctx, x - 1, y, col)
      P(ctx, x + 1, y, col)
      P(ctx, x, y, '#f2d36b')
    } else {
      P(ctx, x, y, GRASS.blade)
      P(ctx, x - 1, y + 1, GRASS.light)
      P(ctx, x + 1, y + 1, GRASS.light)
    }
  }
}

// Thin night clouds: flat stacked ovals, lit a little on top, on a see-through strip.
function paintClouds({ ctx }, tw, feet) {
  for (let n = 0; n < 5; n++) {
    const cx = Math.round(hash(n, 71) * tw)
    const cy = Math.round(feet * (0.18 + hash(n, 72) * 0.34))
    const len = 14 + Math.round(hash(n, 73) * 22)
    for (const shift of [-tw, 0, tw]) {
      ellipse(ctx, cx + shift, cy, len, 2, '#21184c')
      ellipse(ctx, cx + shift + Math.round(len * 0.25), cy - 2, Math.round(len * 0.5), 2, '#21184c')
      rect(ctx, cx + shift + Math.round(len * 0.25) - Math.round(len * 0.3), cy - 4, Math.round(len * 0.6), 1, '#2c2262')
    }
  }
}

function paintVignette({ ctx }, w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.75)
  g.addColorStop(0, 'rgba(4,2,14,0)')
  g.addColorStop(1, 'rgba(4,2,14,0.6)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// Every static layer for a size, or null where a canvas cannot draw.
export function buildLayers({ w, h, feet }) {
  const make = (lw, lh, paint) => {
    const layer = canvasOf(lw, lh)
    if (layer) paint(layer)
    return layer?.canvas ?? null
  }
  const groundH = h - feet + 4
  return {
    sky: make(w, h, (l) => paintSky(l, w, h, feet)),
    clouds: make(320, h, (l) => paintClouds(l, 320, feet)),
    mountains: make(256, h, (l) => paintMountains(l, 256, feet)),
    far: make(192, h, (l) => paintPines(l, 192, feet - 3, FAR, [16, 28], 41)),
    near: make(224, h, (l) => paintTrees(l, 224, feet, NEAR, [8, 13], 61)),
    ground: make(128, groundH, (l) => paintGround(l, 128, groundH)),
    vignette: make(w, h, (l) => paintVignette(l, w, h)),
  }
}

// Copies a tiling strip across the width, moved left by offset.
function strip(ctx, layer, offset, w, y = 0) {
  if (!layer) return
  const tw = layer.width
  for (let x = -(((Math.round(offset) % tw) + tw) % tw); x < w; x += tw) ctx.drawImage(layer, x, y)
}

// Where the rift sits and how big it gets.
export function riftOf({ w, h, feet }) {
  const r = Math.round(clamp(h * 0.21, 14, 30))
  return { x: Math.round(w * 0.7), y: Math.max(r + 4, feet - 14 - r), r }
}

const easeOutBack = (p) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2

// The rift: an upright oval gate with an outline, a light running round its ring and a swirl inside,
// standing beyond the forest (the tree lines hide its foot). form: 0..1 as it opens.
function paintRift(ctx, rift, t, form) {
  const R = rift.r * easeOutBack(clamp(form, 0, 1))
  if (R < 1) return
  const rx = R * 0.72
  const rim = 1.3 / rx
  for (let y = -Math.ceil(R) - 1; y <= Math.ceil(R) + 1; y++) {
    for (let x = -Math.ceil(rx) - 1; x <= Math.ceil(rx) + 1; x++) {
      const nx = x / rx
      const ny = y / R
      const d = Math.sqrt(nx * nx + ny * ny)
      if (d > 1) continue
      const a = Math.atan2(ny, nx)
      let c
      if (d > 1 - rim) c = RIFT.edge
      else if (d > 1 - rim * 2) c = RIFT.rim
      else if (d > 0.8) c = (((a + t * 1.4) % 1.3) + 1.3) % 1.3 < 0.28 ? RIFT.ringHi : RIFT.ring
      else if (d < 0.14) c = d < 0.07 ? RIFT.core : RIFT.ringHi
      else {
        const s = Math.sin(a * 3 + d * 8 - t * 3.2)
        c = s > 0.55 ? RIFT.hi : s > -0.2 ? RIFT.mid : RIFT.deep
      }
      P(ctx, rift.x + x, rift.y + y, c)
    }
  }
}

function glow(ctx, x, y, r, rgb, a) {
  if (!(r > 0) || !(a > 0)) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

// The hero's two walk sprites, painted once per look and gear.
export function heroFrames(look, gear) {
  return { idle0: heroSprite(look, gear, 'idle0'), idle1: heroSprite(look, gear, 'idle1') }
}

// One frame at t seconds. still: the reduced motion frame (nothing scrolls, blinks or drifts).
export function paintScene(ctx, size, layers, hero, t, { still = false } = {}) {
  const { w, h, feet } = size
  const scroll = still ? 0 : t
  const rift = riftOf(size)
  const form = still ? 1 : t / 1.6
  ctx.imageSmoothingEnabled = false
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  if (layers.sky) ctx.drawImage(layers.sky, 0, 0)
  else rect(ctx, 0, 0, w, h, SKY[2])

  // Twinkling stars over the painted ones.
  if (!still) {
    for (let n = 0; n < 24; n++) {
      const a = Math.max(0, Math.sin(t * (1.2 + hash(n, 7) * 2) + n * 2.3))
      if (a < 0.2) continue
      ctx.globalAlpha = a
      P(ctx, Math.floor(hash(n, 5) * w), Math.floor(hash(n, 6) * feet * 0.75), '#f4f0ff')
    }
    ctx.globalAlpha = 1
  }

  // Now and then a shooting star crosses the upper sky.
  if (!still) {
    const k = Math.floor(t / 4.5)
    const p = (t % 4.5) / 0.7
    if (p < 1) {
      const x0 = hash(k, 81) * w * 0.55
      const y0 = 4 + hash(k, 82) * feet * 0.25
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = (1 - i / 7) * (1 - p)
        P(ctx, Math.round(x0 + p * 40 - i), Math.round(y0 + (p * 40 - i) * 0.45), i ? '#c3b8ff' : '#ffffff')
      }
      ctx.globalAlpha = 1
    }
  }
  strip(ctx, layers.clouds, scroll * SPEED.clouds, w)

  // The rift and its light, with motes drawn into it.
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, rift.x, rift.y, rift.r * 3.2 * clamp(form, 0, 1), '138,92,255', 0.3 + (still ? 0 : Math.sin(t * 2) * 0.06))
  ctx.globalCompositeOperation = 'source-over'
  paintRift(ctx, rift, t, form)
  if (!still) {
    for (let n = 0; n < 18; n++) {
      const p = (t * 0.32 + hash(n, 21)) % 1
      const r = rift.r * (2.6 - 1.75 * p)
      const a = hash(n, 22) * Math.PI * 2 + p * 3.5
      ctx.globalAlpha = Math.min(1, p * 6) * (1 - p * 0.6) * clamp(form, 0, 1)
      P(ctx, Math.round(rift.x + Math.cos(a) * r * 0.8), Math.round(rift.y + Math.sin(a) * r), n % 3 ? '#c3a6ff' : '#fff1b0')
    }
    ctx.globalAlpha = 1
  }
  // Sparks orbiting the gate, a small cross each (held in place when still).
  for (let n = 0; n < 5; n++) {
    const a = (still ? 0.7 : t * 0.9) + (n * Math.PI * 2) / 5
    const x = Math.round(rift.x + Math.cos(a) * rift.r * 1.05)
    const y = Math.round(rift.y + Math.sin(a) * rift.r * 1.3)
    ctx.globalAlpha = still ? 0.85 : clamp(form - 0.6, 0, 1) * (0.55 + 0.45 * Math.sin(t * 4 + n))
    P(ctx, x, y, '#ffffff')
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P(ctx, x + dx, y + dy, '#c3a6ff')
  }
  ctx.globalAlpha = 1

  strip(ctx, layers.mountains, scroll * SPEED.mountains, w)
  strip(ctx, layers.far, scroll * SPEED.far, w)
  // The rift lights the far side of the forest.
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, rift.x, feet - 6, rift.r * 2.4, '120,80,230', 0.14 * clamp(form, 0, 1))
  ctx.globalCompositeOperation = 'source-over'
  strip(ctx, layers.near, scroll * SPEED.near, w)
  strip(ctx, layers.ground, scroll * SPEED.ground, w, feet - 4)

  // The hero, walking in place: a step every STEP_MS, bobbing on the second frame.
  const hx = Math.round(w * 0.34)
  const step = still ? 0 : Math.floor((t * 1000) / STEP_MS)
  const bob = step % 2
  const sprite = hero?.[bob ? 'idle1' : 'idle0']
  ellipse(ctx, hx, feet, 8, 1, 'rgba(0,0,0,0.45)')
  if (!still) {
    // Dust kicked up behind the boots, left behind at the ground's speed.
    const into = ((t * 1000) % STEP_MS) / 1000
    for (let k = 0; k < 3; k++) {
      const age = into + (k * STEP_MS) / 1000
      if (age > 0.45) continue
      ctx.globalAlpha = 0.55 * (1 - age / 0.45)
      P(ctx, Math.round(hx - 5 - age * SPEED.ground), Math.round(feet - 1 - age * 7), '#b9a7b4')
      P(ctx, Math.round(hx - 7 - age * SPEED.ground), Math.round(feet - age * 4), '#8d7c8c')
    }
    ctx.globalAlpha = 1
  }
  if (sprite) ctx.drawImage(sprite, hx - SPRITE.ox - 16, feet - SPRITE.oy - 32 + bob)

  // Fireflies and the hero's own light.
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, hx, feet - 16, 30, '255,206,140', 0.12)
  for (let n = 0; n < 14; n++) {
    const bx = hash(n, 11) * w
    const by = feet - 5 - hash(n, 12) * feet * 0.5
    const x = still ? bx : (((bx - scroll * 14 + Math.sin(t * 0.8 + n) * 6) % w) + w) % w
    const y = still ? by : by + Math.cos(t * 1.1 + n * 2) * 4
    const a = still ? 0.8 : 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.8 + n * 1.7))
    glow(ctx, x, y, 5, '210,255,130', 0.35 * a)
    ctx.globalAlpha = a
    P(ctx, Math.round(x), Math.round(y), '#f4ffb0')
    ctx.globalAlpha = 1
  }
  ctx.globalCompositeOperation = 'source-over'
  if (layers.vignette) ctx.drawImage(layers.vignette, 0, 0)
}
