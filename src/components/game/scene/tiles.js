import { blob, ellipse, hash, P, rect, SHADOW, sprite } from './pixels.js'

// The hunting maps in detailed 16px pixel art, ported from the approved mockup (game-depth.html):
// shaded grass, a sandy path with ragged edges, animated water with banks, outlined trees, rocks and bushes
// lit from the top left, a swirling portal. Indoor maps (floor and walls) get stone, planks or tiles.
// Each map char of shared/world/tiles.js has art here:
//   . grass   : path   _ floor   O portal   D door   ~ water   T tree   ^ rock   # wall
//   B bush outdoors, bookshelf indoors   C chest outdoors, terminal indoors
// Everything here paints with fillStyle + fillRect, so it can draw to an offscreen canvas once.
export const TS = 16

const GR = { base: '#5d9f3f', dark: '#4b8834', light: '#79b94f', blade: '#94d063', patch: '#548f39' }
const SAND = { base: '#dcb57d', dark: '#c49a62', light: '#ebcb95', pebble: '#a9804e', edge: '#9d7a48' }
const WATER = ['#3a78d4', '#2c5fb3', '#5a98ee', '#d4ecff']
const BANK = '#7a5a34'

const TREE_PALS = [
  ['#1f4826', '#2d6633', '#3c853b', '#56a347', '#86cc62'],
  ['#1b3f2a', '#275a3a', '#347548', '#4b9459', '#77bd78'],
  ['#24481f', '#36662a', '#4a8534', '#6aa843', '#a2d46a'],
]

// Indoor floors by world: tiles in the lab, planks in the library, cobbles in the city, stone elsewhere.
const FLOORS = {
  tile: { base: '#cfd3e4', dark: '#bcc0d3', light: '#e6e9f4', grout: '#9a9eb6' },
  plank: { base: '#9a6a3e', dark: '#85582f', light: '#b07c4a', grout: '#5e3a1e' },
  cobble: { base: '#b0a48c', dark: '#978b74', light: '#c6bba3', grout: '#6f6656' },
  stone: { base: '#8d879f', dark: '#78728c', light: '#a39db6', grout: '#5c5770' },
  cave: { base: '#6e687f', dark: '#5d5870', light: '#857f97', grout: '#45405a' },
}
const FLOOR_OF = {
  laboratorio: ['tile', FLOORS.tile],
  'biblioteca-linguagens': ['plank', FLOORS.plank],
  'cidade-humanas': ['cobble', FLOORS.cobble],
  'caverna-sql': ['stone', FLOORS.cave],
}
const WALL = { base: '#3a3c4a', dark: '#30313d', light: '#4d5064', cap: '#5a5d78', mortar: '#22232c', ink: '#16161e' }

// The ground under each char. null: the char sits on whatever its neighbors stand on.
const BASE_GROUND = { '.': 'grass', T: 'grass', '^': 'grass', ':': 'path', '~': 'water', _: 'floor', '#': 'wall' }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Reads a world's rows: chars clamped to the edge (so borders look like their neighbors), ground per tile.
// Memoized per world object, since the animated layers read it every frame.
const maps = new WeakMap()
export function readMap(world) {
  if (world && typeof world === 'object' && maps.has(world)) return maps.get(world)
  const m = buildMap(world)
  if (world && typeof world === 'object') maps.set(world, m)
  return m
}

function buildMap(world) {
  const rows = world?.rows ?? []
  const H = rows.length
  const W = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const outdoor = rows.some((row) => row.includes('.'))
  const charAt = (x, y) => {
    if (!H || !W) return '.'
    const row = rows[clamp(y, 0, H - 1)]
    return row[clamp(x, 0, row.length - 1)] ?? '.'
  }
  const cache = new Map()
  const ground = (x, y) => {
    const cx = clamp(x, 0, W - 1)
    const cy = clamp(y, 0, H - 1)
    const key = cy * 4096 + cx
    if (cache.has(key)) return cache.get(key)
    let g = BASE_GROUND[charAt(cx, cy)] ?? null
    if (!g) {
      const near = [charAt(cx - 1, cy), charAt(cx + 1, cy), charAt(cx, cy - 1), charAt(cx, cy + 1)].map((c) => BASE_GROUND[c])
      g = near.includes('path') ? 'path' : near.includes('floor') ? 'floor' : near.includes('grass') ? 'grass' : outdoor ? 'grass' : 'floor'
    }
    cache.set(key, g)
    return g
  }
  return { W, H, charAt, ground, outdoor, floor: FLOOR_OF[world?.id] ?? ['stone', FLOORS.stone] }
}

// ---------- ground ----------

function grassPx(gx, gy) {
  const n = hash(gx, gy)
  let c = hash(Math.floor(gx / 7), Math.floor(gy / 5), 7) < 0.3 ? GR.patch : GR.base
  if (n < 0.1) c = GR.dark
  else if (n > 0.93) c = GR.light
  if (hash(gx, gy + 1, 3) > 0.95) c = GR.blade
  return c
}

function pathPx(m, tx, ty, x, y, gx, gy) {
  const n = hash(gx, gy, 5)
  let c = n < 0.15 ? SAND.dark : n > 0.9 ? SAND.light : SAND.base
  if (hash(Math.floor(gx / 2), Math.floor(gy / 2), 9) > 0.96) c = SAND.pebble
  // Ragged grass edge where the path meets grass.
  const soft = (g) => g === 'grass' || g === 'water'
  const edges = [
    [x < 3, soft(m.ground(tx - 1, ty)), x],
    [x > TS - 4, soft(m.ground(tx + 1, ty)), TS - 1 - x],
    [y < 3, soft(m.ground(tx, ty - 1)), y],
    [y > TS - 4, soft(m.ground(tx, ty + 1)), TS - 1 - y],
  ]
  for (const [near, open, d] of edges) {
    if (near && open) {
      if (d === 0 || (d === 1 && hash(gx, gy, 11) < 0.5)) c = grassPx(gx, gy)
      else if (d <= 2) c = SAND.edge
    }
  }
  return c
}

function floorPx(m, tx, ty, x, y, gx, gy) {
  const [style, F] = m.floor
  const n = hash(gx, gy, 13)
  let c = n < 0.12 ? F.dark : n > 0.94 ? F.light : F.base
  if (style === 'tile') {
    const lx = gx % 8
    const ly = gy % 8
    if (lx === 7 || ly === 7) c = F.grout
    else if (lx === 0 || ly === 0) c = F.light
    else if (hash(Math.floor(gx / 8), Math.floor(gy / 8), 17) < 0.25) c = n < 0.5 ? F.dark : F.base
  } else if (style === 'plank') {
    const row = Math.floor(gy / 4)
    const seam = Math.floor(hash(row, 0, 19) * 16)
    if (gy % 4 === 3) c = F.grout
    else if ((gx + seam) % 16 === 0) c = F.grout
    else if (gy % 4 === 0) c = F.light
    else if (hash(Math.floor(gx / 3), gy, 23) < 0.18) c = F.dark
  } else {
    // Stone and cobble: offset blocks with rounded corners.
    const bw = style === 'cobble' ? 6 : 8
    const bh = style === 'cobble' ? 5 : 8
    const row = Math.floor(gy / bh)
    const off = row % 2 ? bw / 2 : 0
    const lx = (gx + off) % bw
    const ly = gy % bh
    const corner = (lx === 0 || lx === bw - 1) && (ly === 0 || ly === bh - 1)
    if (lx === bw - 1 || ly === bh - 1 || corner) c = F.grout
    else if (lx === 0 || ly === 0) c = F.light
    else if (hash(Math.floor((gx + off) / bw), row, 29) < 0.3 && n < 0.5) c = F.dark
  }
  // A wall casts a short shadow on the floor below it.
  if (y < 3 && m.ground(tx, ty - 1) === 'wall') c = y === 0 ? '#2e2b3c' : y === 1 ? F.grout : c === F.light ? F.base : F.dark
  return c
}

function wallPx(m, tx, ty, x, y, gx, gy) {
  const row = Math.floor(y / 4)
  const off = (ty * 4 + row) % 2 ? 4 : 0
  const lx = (gx + off) % 8
  const ly = y % 4
  let c
  if (ly === 3 || lx === 7) c = WALL.mortar
  else if (ly === 0) c = WALL.light
  else c = hash(Math.floor((gx + off) / 8), ty * 4 + row, 31) < 0.3 || hash(gx, gy, 37) < 0.1 ? WALL.dark : WALL.base
  if (y < 2 && m.ground(tx, ty - 1) !== 'wall') c = y === 0 ? WALL.ink : WALL.cap
  if (y === TS - 1 && m.ground(tx, ty + 1) !== 'wall') c = WALL.ink
  return c
}

function flowers(ctx, tx, ty) {
  for (let i = 0; i < 4; i++) {
    const fx = tx * TS + 2 + Math.floor(hash(tx, ty, i) * 11)
    const fy = ty * TS + 2 + Math.floor(hash(ty, tx, i + 9) * 11)
    const col = ['#ff8fc7', '#ffe066', '#ffffff', '#b99bff'][i]
    P(ctx, fx, fy - 1, col)
    P(ctx, fx - 1, fy, col)
    P(ctx, fx + 1, fy, col)
    P(ctx, fx, fy + 1, col)
    P(ctx, fx, fy, '#ffcf4a')
    P(ctx, fx, fy + 2, GR.dark)
  }
}

function tuft(ctx, tx, ty) {
  const x = tx * TS + 3 + Math.floor(hash(tx, ty, 41) * 9)
  const y = ty * TS + 5 + Math.floor(hash(tx, ty, 43) * 8)
  P(ctx, x, y, GR.blade)
  P(ctx, x - 1, y + 1, GR.light)
  P(ctx, x + 1, y + 1, GR.light)
  P(ctx, x, y + 1, GR.dark)
  P(ctx, x - 2, y, GR.light)
  P(ctx, x + 2, y - 1, GR.blade)
}

function pebbles(ctx, tx, ty) {
  for (let i = 0; i < 3; i++) {
    const x = tx * TS + 3 + Math.floor(hash(tx, ty, 91 + i) * 10)
    const y = ty * TS + 3 + Math.floor(hash(ty, tx, 95 + i) * 10)
    P(ctx, x, y, '#a9afbe')
    P(ctx, x + 1, y, '#868c9c')
    P(ctx, x, y + 1, '#4b8834')
  }
}

function paintGround(ctx, m) {
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) {
      const g = m.ground(tx, ty)
      for (let y = 0; y < TS; y++) {
        for (let x = 0; x < TS; x++) {
          const gx = tx * TS + x
          const gy = ty * TS + y
          let c
          if (g === 'path') c = pathPx(m, tx, ty, x, y, gx, gy)
          else if (g === 'floor') c = floorPx(m, tx, ty, x, y, gx, gy)
          else if (g === 'wall') c = wallPx(m, tx, ty, x, y, gx, gy)
          else c = grassPx(gx, gy)
          P(ctx, gx, gy, c)
        }
      }
      if (m.charAt(tx, ty) === '.') {
        const n = hash(tx, ty, 47)
        if (n < 0.08) flowers(ctx, tx, ty)
        else if (n < 0.12) pebbles(ctx, tx, ty)
        else if (n < 0.4) tuft(ctx, tx, ty)
      }
    }
  }
}

// ---------- things on the ground ----------

const CHEST = ['..oooooooooo..', '.obbbbbbbbbbo.', 'obBBBBBBBBBBbo', 'oyyyyyyyyyyyyo', 'obbbbbgybbbbbo', 'obbbbbyybbbbbo', 'oBBBBBBBBBBBBo', 'obbbbbbbbbbbbo', '.oooooooooooo.']
const CHEST_PAL = { o: '#2a1a12', b: '#9a5b2c', B: '#6e3d1c', y: '#f2c14e', g: '#b9862a' }
const BOOKS = ['#c22a35', '#1a4fe0', '#2f9a52', '#e0a030', '#6a3df0', '#22a89a', '#e0559a', '#d9d3c0']

function tree(ctx, x, y, tx, ty) {
  const pal = TREE_PALS[Math.floor(hash(tx, ty, 51) * TREE_PALS.length)]
  const dx = Math.round(hash(tx, ty, 53) * 2) - 1
  ellipse(ctx, x + 8, y + 15, 8, 2, SHADOW)
  rect(ctx, x + 6, y + 8, 4, 8, '#4a2c17')
  rect(ctx, x + 7, y + 8, 2, 7, '#6b4022')
  P(ctx, x + 5, y + 15, '#4a2c17')
  P(ctx, x + 10, y + 15, '#4a2c17')
  blob(ctx, x + 8 + dx, y + 3, 10, 9, pal, '#14301a')
  // A few sunlit leaves and, now and then, fruit.
  if (hash(tx, ty, 55) < 0.2) {
    P(ctx, x + 4 + dx, y + 2, '#e5484d')
    P(ctx, x + 11 + dx, y + 5, '#e5484d')
  }
}

function rock(ctx, x, y) {
  ellipse(ctx, x + 8, y + 14, 7, 2, SHADOW)
  blob(ctx, x + 8, y + 10, 7, 5, ['#4b4f5c', '#666b7b', '#868c9c', '#a9afbe', '#d3d7e0'], '#2a2c35')
  P(ctx, x + 10, y + 11, '#4b4f5c')
  P(ctx, x + 11, y + 12, '#4b4f5c')
  P(ctx, x + 5, y + 8, '#6aa843')
  P(ctx, x + 6, y + 8, '#56a347')
}

function bush(ctx, x, y) {
  ellipse(ctx, x + 8, y + 14, 7, 2, SHADOW)
  blob(ctx, x + 8, y + 9, 7, 6, ['#24552b', '#33743a', '#479447', '#69b356', '#9bd977'], '#17331b')
  P(ctx, x + 6, y + 7, '#ff6b8a')
  P(ctx, x + 10, y + 9, '#ff6b8a')
  P(ctx, x + 8, y + 11, '#ff6b8a')
}

function bookshelf(ctx, x, y, tx, ty) {
  rect(ctx, x, y, TS, TS, '#2a1a12')
  rect(ctx, x + 1, y + 1, TS - 2, TS - 2, '#8a5a34')
  rect(ctx, x + 1, y + 1, TS - 2, 1, '#b07c4a')
  rect(ctx, x + 1, y + 1, 1, TS - 2, '#a8703f')
  for (const [top, shelf] of [
    [2, 8],
    [9, 14],
  ]) {
    rect(ctx, x + 2, y + top, TS - 4, shelf - top, '#3a2414')
    let bx = x + 2
    let i = 0
    while (bx < x + TS - 2) {
      const w = 1 + Math.floor(hash(tx * 7 + i, ty * 3 + top, 61) * 2)
      const h = shelf - top - Math.floor(hash(tx + i, ty + top, 63) * 2)
      const col = BOOKS[Math.floor(hash(tx * 13 + i, ty + top, 67) * BOOKS.length)]
      const ww = Math.min(w, x + TS - 2 - bx)
      if (hash(tx + i * 5, ty * 11 + top, 69) > 0.12) {
        rect(ctx, bx, y + shelf - h, ww, h, col)
        P(ctx, bx, y + shelf - h, '#ffffff55')
      }
      bx += ww
      i++
    }
    rect(ctx, x + 1, y + shelf, TS - 2, 1, '#5e3a1e')
  }
}

function terminal(ctx, x, y) {
  ellipse(ctx, x + 8, y + 14, 7, 2, 'rgba(10,8,30,.35)')
  rect(ctx, x + 6, y + 11, 4, 2, '#2b2d3a')
  rect(ctx, x + 3, y + 13, 10, 2, '#1c1d26')
  rect(ctx, x + 4, y + 13, 8, 1, '#3d4052')
  rect(ctx, x + 1, y + 1, 14, 11, '#0d0e14')
  rect(ctx, x + 2, y + 2, 12, 9, '#2b2d3a')
  rect(ctx, x + 2, y + 2, 12, 1, '#4a4d62')
  rect(ctx, x + 3, y + 3, 10, 7, '#0f2a6a')
  rect(ctx, x + 3, y + 3, 10, 1, '#1a3f8f')
  const code = [
    [4, 4, 4, '#9be7ff'],
    [5, 6, 5, '#6fe39a'],
    [5, 8, 3, '#9be7ff'],
    [4, 8, 1, '#f2c14e'],
  ]
  for (const [cx, cy, w, c] of code) rect(ctx, x + cx, y + cy, w, 1, c)
  P(ctx, x + 11, y + 8, '#ffffff')
}

function door(ctx, x, y) {
  const inFrame = (lx, ly) => lx >= 1 && lx <= 14 && !(ly === 0 && (lx < 4 || lx > 11)) && !(ly === 1 && (lx < 2 || lx > 13))
  const inDoor = (lx, ly) => lx >= 4 && lx <= 11 && ly >= 3 && !(ly === 3 && (lx === 4 || lx === 11))
  for (let ly = 0; ly < TS; ly++) {
    for (let lx = 0; lx < TS; lx++) {
      if (!inFrame(lx, ly)) continue
      let c
      if (!inFrame(lx - 1, ly) || !inFrame(lx + 1, ly) || !inFrame(lx, ly - 1)) c = '#2a2c35'
      else if (inDoor(lx, ly)) {
        if (!inDoor(lx - 1, ly) || !inDoor(lx + 1, ly) || !inDoor(lx, ly - 1)) c = '#2a1a12'
        else if (ly === 7 || ly === 12) c = ly === 7 ? '#4b4f5c' : '#3a3c4a'
        else if ((lx - 4) % 3 === 2) c = '#6e3d1c'
        else c = (lx - 4) % 3 === 0 ? '#b9763a' : '#9a5b2c'
      } else {
        const block = (lx + (Math.floor(ly / 3) % 2 ? 1 : 0)) % 3 === 0 || ly % 3 === 2
        c = block ? '#666b7b' : lx < 8 ? '#a9afbe' : '#868c9c'
      }
      P(ctx, x + lx, y + ly, c)
    }
  }
  P(ctx, x + 10, y + 10, '#f2c14e')
  P(ctx, x + 10, y + 11, '#b9862a')
}

function paintThings(ctx, m) {
  const things = []
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) {
      const c = m.charAt(tx, ty)
      const x = tx * TS
      const y = ty * TS
      const inside = m.ground(tx, ty) === 'floor'
      if (c === 'T') things.push([y + 14, () => tree(ctx, x, y, tx, ty)])
      else if (c === '^') things.push([y + 12, () => rock(ctx, x, y)])
      else if (c === 'B') things.push([y + 12, () => (inside ? bookshelf(ctx, x, y, tx, ty) : bush(ctx, x, y))])
      else if (c === 'C')
        things.push([
          y + 12,
          () => {
            if (inside) terminal(ctx, x, y)
            else {
              ellipse(ctx, x + 8, y + 14, 7, 2, SHADOW)
              sprite(ctx, CHEST, CHEST_PAL, x + 1, y + 5)
            }
          },
        ])
      else if (c === 'D') things.push([y + 15, () => door(ctx, x, y)])
    }
  }
  things.sort((a, b) => a[0] - b[0]).forEach(([, draw]) => draw())
}

// The static layer: ground and everything standing on it. Water and portals move, see paintAnimated.
export function paintBase(ctx, world) {
  const m = readMap(world)
  paintGround(ctx, m)
  paintThings(ctx, m)
}

// ---------- animated: water and portals ----------

function paintWater(ctx, m, t) {
  const land = (x, y) => m.ground(x, y) !== 'water'
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) {
      if (m.ground(tx, ty) !== 'water') continue
      for (let y = 0; y < TS; y++) {
        for (let x = 0; x < TS; x++) {
          const gx = tx * TS + x
          const gy = ty * TS + y
          const dl = x < 2 && land(tx - 1, ty) ? x : x > TS - 3 && land(tx + 1, ty) ? TS - 1 - x : 9
          const du = y < 3 && land(tx, ty - 1) ? y : y > TS - 3 && land(tx, ty + 1) ? TS - 1 - y : 9
          const d = Math.min(dl, du)
          // Round the outer corners: grass, then a bank, where land is on two sides.
          const corner = dl < 9 && du < 9 ? dl + du : 9
          let c = hash(gx, gy, 2) < 0.2 ? WATER[1] : WATER[0]
          if (corner < 2) c = m.ground(tx, ty) === 'water' && m.outdoor ? grassPx(gx, gy) : BANK
          else if (d === 0 || corner === 2) c = BANK
          else if (corner === 3) c = WATER[2]
          else if (d === 1) c = hash(gx, gy + Math.floor(t * 3)) < 0.6 ? WATER[3] : WATER[2]
          else if (d <= 3) c = WATER[2]
          else if ((gx * 2 + gy * 5 + Math.floor(t * 8)) % 23 < 3 && gy % 5 === 2) c = WATER[3]
          P(ctx, gx, gy, c)
        }
      }
    }
  }
}

function portal(ctx, cx, cy, t) {
  for (let y = -10; y <= 10; y++) {
    for (let x = -10; x <= 10; x++) {
      const r = Math.sqrt(x * x + y * y)
      if (r > 9.6) continue
      let c
      if (r > 8.4) c = '#2a2c35'
      else if (r > 6.8) c = (((Math.atan2(y, x) + t) % 1.2) + 1.2) % 1.2 < 0.3 ? '#c3b2ff' : '#6a3df0'
      else {
        const s = Math.sin(Math.atan2(y, x) * 3 + r * 0.9 - t * 5)
        c = s > 0.55 ? '#b49cff' : s > -0.2 ? '#4a22c4' : '#2a1470'
      }
      P(ctx, cx + x, cy + y, c)
    }
  }
}

// Water and portals at time t (seconds). t = 0 is the still frame.
export function paintAnimated(ctx, world, t = 0) {
  const m = readMap(world)
  paintWater(ctx, m, t)
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) if (m.charAt(tx, ty) === 'O') portal(ctx, tx * TS + 8, ty * TS + 8, t)
  }
}

// ---------- fog over locked zones ----------

const LOCK = ['..ggg..', '.g...g.', '.g...g.', 'kkkkkkk', 'kYyyyyk', 'kyykyyk', 'kyykyyk', 'kkkkkkk']
const LOCK_PAL = { g: '#c9ccd4', k: '#1c1d26', y: '#f2c14e', Y: '#ffe08a' }

// Smooth noise in [0, 1): bilinear over a coarse hash grid.
function smooth(x, y, cell, s) {
  const fx = x / cell
  const fy = y / cell
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const u = fx - x0
  const v = fy - y0
  const a = hash(x0, y0, s)
  const b = hash(x0 + 1, y0, s)
  const c = hash(x0, y0 + 1, s)
  const d = hash(x0 + 1, y0 + 1, s)
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

// The padlock on a locked door (or a portal to a locked world), centered on the tile at (tx, ty).
export function paintPadlock(ctx, tx, ty) {
  sprite(ctx, LOCK, LOCK_PAL, tx * TS + 4, ty * TS + 5)
}

// A dark, cloudy fog over each locked rect (in tiles), with a padlock on its doors.
export function paintFog(ctx, world, lockedRects = []) {
  if (!lockedRects.length) return
  const m = readMap(world)
  const locked = (tx, ty) => lockedRects.some((r) => inRect(r, tx, ty))
  for (const r of lockedRects) {
    const x0 = clamp(r.x, 0, m.W) * TS
    const y0 = clamp(r.y, 0, m.H) * TS
    const x1 = clamp(r.x + r.w, 0, m.W) * TS
    const y1 = clamp(r.y + r.h, 0, m.H) * TS
    for (let gy = y0; gy < y1; gy += 2) {
      for (let gx = x0; gx < x1; gx += 2) {
        const tx = Math.floor(gx / TS)
        const ty = Math.floor(gy / TS)
        // Thinner near an open neighbor, so the fog has a soft edge.
        const edgeX = (gx - x0 < 6 && !locked(tx - 1, ty)) || (x1 - gx <= 6 && !locked(tx + 1, ty))
        const edgeY = (gy - y0 < 6 && !locked(tx, ty - 1)) || (y1 - gy <= 6 && !locked(tx, ty + 1))
        const n = smooth(gx, gy, 24, 71) * 0.6 + smooth(gx, gy, 9, 73) * 0.4
        let a = 0.5 + n * 0.25
        if (edgeX || edgeY) a *= gx - x0 < 2 || x1 - gx <= 2 || gy - y0 < 2 || y1 - gy <= 2 ? 0.45 : 0.75
        ctx.fillStyle = `rgba(12,8,30,${a.toFixed(2)})`
        ctx.fillRect(gx, gy, 2, 2)
      }
    }
  }
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) {
      if (m.charAt(tx, ty) === 'D' && locked(tx, ty)) paintPadlock(ctx, tx, ty)
    }
  }
}

// The whole map at time t: ground, things, water, portals and the fog over locked rects.
export function paintMap(ctx, world, { lockedRects = [], t = 0 } = {}) {
  paintBase(ctx, world)
  paintAnimated(ctx, world, t)
  paintFog(ctx, world, lockedRects)
}

// The map's own lights for the light pass: portals glow violet, terminals cyan, chests a warm glint.
export function mapLights(world, t = 0) {
  const m = readMap(world)
  const lights = []
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) {
      const c = m.charAt(tx, ty)
      const x = tx * TS + 8
      const y = ty * TS + 8
      if (c === 'O') lights.push({ x, y, r: 44 + Math.sin(t * 3) * 3, rgb: '140,95,255', a: 0.55 })
      else if (c === 'C' && m.ground(tx, ty) === 'floor') lights.push({ x, y: y - 2, r: 20, rgb: '120,200,255', a: 0.3 })
      else if (c === 'C') lights.push({ x, y: y + 2, r: 12, rgb: '255,200,90', a: 0.18 })
    }
  }
  return lights
}
