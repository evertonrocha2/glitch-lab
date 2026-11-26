import { blob, ellipse, hash, line, P, rect, SHADOW, sprite } from './pixels.js'

// The hunting maps in detailed 16px pixel art, ported from the approved mockup (game-depth.html):
// shaded grass, a sandy path with ragged edges, animated water with banks, outlined trees, rocks and bushes
// lit from the top left, a swirling portal. Indoor maps (floor and walls) get stone, planks or tiles.
// Each map char of shared/world/tiles.js has art here:
//   . grass   : path   _ floor   O portal   D door   ~ water   T tree   ^ rock   # wall
//   B bush outdoors, bookshelf indoors   C chest outdoors, terminal indoors
// and the fase 4 decorations that give each hunt zone its own look (calm colors, lit from the top left):
//   grounds: , dark ground   = moss stone   + carpet   S stairs   o mosaic   w marsh water
//   on the ground: * flowers   " tall grass   m mushrooms   x bones   r rubble
//   standing: s stump   l log   K crystal   R ruin wall   I column   G glassware   F cabinet
//             M market stall   b barrel   P planter   Q telescope   E chalkboard
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

// Floors by region: cobbles in the town and the City of Humanities, planks in the library, cave stone
// under the SQL Cave, stone elsewhere.
const FLOORS = {
  tile: { base: '#cfd3e4', dark: '#bcc0d3', light: '#e6e9f4', grout: '#9a9eb6' },
  plank: { base: '#9a6a3e', dark: '#85582f', light: '#b07c4a', grout: '#5e3a1e' },
  cobble: { base: '#b0a48c', dark: '#978b74', light: '#c6bba3', grout: '#6f6656' },
  stone: { base: '#8d879f', dark: '#78728c', light: '#a39db6', grout: '#5c5770' },
  cave: { base: '#6e687f', dark: '#5d5870', light: '#857f97', grout: '#45405a' },
}
const FLOOR_OF = {
  laboratorio: ['cobble', FLOORS.cobble],
  'biblioteca-linguagens': ['plank', FLOORS.plank],
  'cidade-humanas': ['cobble', FLOORS.cobble],
  'caverna-sql': ['stone', FLOORS.cave],
}
const WALL = { base: '#3a3c4a', dark: '#30313d', light: '#4d5064', cap: '#5a5d78', mortar: '#22232c', ink: '#16161e' }

// The ground under each char. null: the char sits on whatever its neighbors stand on.
const BASE_GROUND = {
  '.': 'grass',
  T: 'grass',
  '^': 'grass',
  ':': 'path',
  '~': 'water',
  _: 'floor',
  '#': 'wall',
  '*': 'grass',
  '"': 'grass',
  ',': 'dark',
  '=': 'moss',
  '+': 'carpet',
  S: 'stairs',
  o: 'mosaic',
  w: 'marsh',
}
// Fase 4 things that stand on the ground most of their neighbors (two tiles around) stand on.
const ON_GROUND = new Set(['m', 'x', 'r', 's', 'l', 'K', 'R', 'I', 'G', 'F', 'M', 'b', 'P', 'Q', 'E'])
// Ties go to the first; walls and water never carry a thing.
const GROUND_ORDER = ['path', 'floor', 'carpet', 'mosaic', 'moss', 'stairs', 'dark', 'grass']
// Grounds that read as indoors: a terminal there is a computer and a B a bookshelf, not a chest and a bush.
const INDOOR = new Set(['floor', 'carpet', 'mosaic', 'stairs'])

// Dark ground: earthy under the trees, slate gravel in the cave.
const DARK = { base: '#4f463b', dark: '#433b32', light: '#5d5345', speck: '#6b604f', root: '#3a3129' }
const DARK_OF = { 'caverna-sql': { base: '#4a4858', dark: '#3f3d4c', light: '#575566', speck: '#6a6879', root: '#34323f' } }
const MOSS = { base: '#868b99', dark: '#747987', light: '#9da2ae', grout: '#555a68', moss: '#6d8656', moss2: '#5b7348' }
const CARPET = { base: '#6e3a44', dark: '#5f323b', pattern: '#7f4650', gold: '#b8995a', edge: '#3e2228' }
const STAIRS = { top: '#aaa5b8', base: '#8d879f', dark: '#6b6680', shadow: '#4b4760' }
const MOSAIC = { a: '#36415c', b: '#303a53', grout: '#262d40', gold: '#c9a85a', steel: '#7d93b8' }
const MARSH = { base: '#3f5a55', dark: '#344b47', light: '#4d6a63', glint: '#7f9a93', mud: '#4a4238', bank: '#55604a' }

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
    const char = charAt(cx, cy)
    let g = BASE_GROUND[char] ?? null
    if (!g && ON_GROUND.has(char)) g = groundVote(cx, cy)
    if (!g) {
      const near = [charAt(cx - 1, cy), charAt(cx + 1, cy), charAt(cx, cy - 1), charAt(cx, cy + 1)].map((c) => BASE_GROUND[c])
      g = near.includes('path') ? 'path' : near.includes('floor') ? 'floor' : near.includes('grass') ? 'grass' : (GROUND_ORDER.find((each) => near.includes(each)) ?? (outdoor ? 'grass' : 'floor'))
    }
    cache.set(key, g)
    return g
  }
  // The ground most tiles within two of (cx, cy) stand on, the nearest ones counting double.
  function groundVote(cx, cy) {
    const votes = {}
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const g = BASE_GROUND[charAt(cx + dx, cy + dy)]
        if (!g || g === 'wall' || g === 'water' || g === 'marsh' || (!dx && !dy)) continue
        votes[g] = (votes[g] ?? 0) + (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 2 : 1)
      }
    }
    let best = null
    for (const g of GROUND_ORDER) if (votes[g] && (!best || votes[g] > votes[best])) best = g
    return best
  }
  const indoor = (tx, ty) => {
    const g = ground(tx, ty)
    return INDOOR.has(g) || (!outdoor && g !== 'grass')
  }
  return { W, H, charAt, ground, indoor, outdoor, floor: FLOOR_OF[world?.id] ?? ['stone', FLOORS.stone], dark: DARK_OF[world?.id] ?? DARK }
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

// How far (0, 1, 2...) pixel (x, y) of a tile is from a side whose neighbor is not on ground g, or 9.
function edgeDistance(m, tx, ty, x, y, g) {
  let d = 9
  if (m.ground(tx - 1, ty) !== g) d = Math.min(d, x)
  if (m.ground(tx + 1, ty) !== g) d = Math.min(d, TS - 1 - x)
  if (m.ground(tx, ty - 1) !== g) d = Math.min(d, y)
  if (m.ground(tx, ty + 1) !== g) d = Math.min(d, TS - 1 - y)
  return d
}

// Bare earth (or cave gravel), with specks and thin roots, frayed where it meets grass.
function darkPx(m, tx, ty, x, y, gx, gy) {
  const D = m.dark
  const n = hash(gx, gy, 71)
  let c = hash(Math.floor(gx / 5), Math.floor(gy / 4), 73) < 0.3 ? D.dark : D.base
  if (n < 0.08) c = D.dark
  else if (n > 0.95) c = D.speck
  else if (n > 0.9) c = D.light
  // A root now and then, a short dark line across the tile.
  if (hash(tx, ty, 75) < 0.25 && Math.abs(y - 6 - Math.round(Math.sin((gx + tx * 3) * 0.6) * 1.5)) < 1 && x > 2 && x < 13) c = D.root
  const near = (dx, dy) => m.ground(tx + dx, ty + dy) === 'grass'
  const d = Math.min(x < 3 && near(-1, 0) ? x : 9, x > TS - 4 && near(1, 0) ? TS - 1 - x : 9, y < 3 && near(0, -1) ? y : 9, y > TS - 4 && near(0, 1) ? TS - 1 - y : 9)
  if (d === 0 || (d === 1 && hash(gx, gy, 77) < 0.5) || (d === 2 && hash(gx, gy, 79) < 0.2)) c = grassPx(gx, gy)
  return c
}

// Old flagstones with moss in the cracks and on some stones.
function mossPx(m, tx, ty, x, y, gx, gy) {
  const row = Math.floor(gy / 8)
  const off = row % 2 ? 4 : 0
  const lx = (gx + off) % 8
  const ly = gy % 8
  const n = hash(gx, gy, 81)
  let c = n < 0.12 ? MOSS.dark : n > 0.93 ? MOSS.light : MOSS.base
  const corner = (lx === 0 || lx === 7) && (ly === 0 || ly === 7)
  if (lx === 7 || ly === 7 || corner) c = hash(gx, gy, 83) < 0.45 ? MOSS.moss2 : MOSS.grout
  else if (lx === 0 || ly === 0) c = MOSS.light
  if (hash(Math.floor(gx / 3), Math.floor(gy / 3), 85) < 0.18 && n < 0.8) c = n < 0.4 ? MOSS.moss2 : MOSS.moss
  if (y < 3 && m.ground(tx, ty - 1) === 'wall') c = y === 0 ? '#2e2b3c' : MOSS.grout
  return c
}

// A runner with a gold border along its edges and a quiet diamond pattern.
function carpetPx(m, tx, ty, x, y, gx, gy) {
  const d = edgeDistance(m, tx, ty, x, y, 'carpet')
  if (d === 0) return CARPET.edge
  if (d === 1) return CARPET.gold
  if (d === 2) return CARPET.dark
  const a = (gx + gy) % 8
  const b = (gx - gy + 8000) % 8
  let c = a === 0 || b === 0 ? CARPET.pattern : CARPET.base
  if ((a === 4 && b === 4) || hash(gx, gy, 87) < 0.05) c = CARPET.dark
  return c
}

// Stone steps going up the map: four to a tile, each lit on its nose and shaded under it.
function stairsPx(m, tx, ty, x, y, gx, gy) {
  const ly = y % 4
  let c = ly === 0 ? STAIRS.top : ly === 3 ? STAIRS.shadow : hash(gx, gy, 89) < 0.15 ? STAIRS.dark : STAIRS.base
  const side = (x === 0 && m.ground(tx - 1, ty) !== 'stairs') || (x === TS - 1 && m.ground(tx + 1, ty) !== 'stairs')
  if (side) c = STAIRS.shadow
  return c
}

// Night blue tiles; some carry a small gold star, the rest a steel dot.
function mosaicPx(m, tx, ty, x, y, gx, gy) {
  const lx = gx % 4
  const ly = gy % 4
  if (lx === 3 || ly === 3) return MOSAIC.grout
  let c = (Math.floor(gx / 4) + Math.floor(gy / 4)) % 2 ? MOSAIC.a : MOSAIC.b
  const cx = Math.abs(x - 7.5)
  const cy = Math.abs(y - 7.5)
  if (hash(tx, ty, 91) < 0.4) {
    if ((cx < 1 && cy < 3) || (cy < 1 && cx < 3)) c = MOSAIC.gold
  } else if (cx < 1 && cy < 1) c = MOSAIC.steel
  return c
}

// Still, murky water with a muddy bank; lily pads are added on top (lilies).
function marshPx(m, tx, ty, x, y, gx, gy) {
  const land = (dx, dy) => m.ground(tx + dx, ty + dy) !== 'marsh'
  const dl = x < 3 && land(-1, 0) ? x : x > TS - 4 && land(1, 0) ? TS - 1 - x : 9
  const du = y < 3 && land(0, -1) ? y : y > TS - 4 && land(0, 1) ? TS - 1 - y : 9
  const d = Math.min(dl, du)
  const corner = dl < 9 && du < 9 ? dl + du : 9
  if (corner < 2 || d === 0) return MARSH.mud
  if (d === 1 || corner === 2) return MARSH.bank
  let c = hash(Math.floor(gx / 4), Math.floor(gy / 3), 93) < 0.35 ? MARSH.dark : MARSH.base
  if (d === 2) c = MARSH.light
  else if (gy % 6 === 2 && (gx * 3 + gy) % 13 < 2) c = MARSH.glint
  return c
}

function lilies(ctx, tx, ty) {
  if (hash(tx, ty, 95) > 0.45) return
  const x = tx * TS + 4 + Math.floor(hash(tx, ty, 97) * 6)
  const y = ty * TS + 5 + Math.floor(hash(ty, tx, 99) * 5)
  ellipse(ctx, x + 2, y + 1, 2, 1, '#5e7d4c')
  P(ctx, x + 3, y + 1, MARSH.base)
  P(ctx, x + 1, y, '#759563')
  if (hash(tx, ty, 101) < 0.5) P(ctx, x + 1, y + 1, '#d4a0b0')
}

// A dense bed of small flowers in calm colors.
function flowerBed(ctx, tx, ty) {
  const cols = ['#e893ab', '#f2d36b', '#f4f4f6', '#b59be0', '#eaa97a']
  // One main color per bed, so a patch of beds reads as a color from far away.
  const main = cols[Math.floor(hash(Math.floor(tx / 3), Math.floor(ty / 3), 121) * cols.length)]
  for (let i = 0; i < 10; i++) {
    const fx = tx * TS + 1 + (i % 4) * 4 + Math.floor(hash(tx, ty, 103 + i) * 3)
    const fy = ty * TS + 2 + Math.floor(i / 4) * 5 + Math.floor(hash(ty, tx, 113 + i) * 3)
    const col = hash(tx + i, ty, 123) < 0.7 ? main : cols[Math.floor(hash(tx, ty + i, 125) * cols.length)]
    P(ctx, fx, fy + 2, GR.dark)
    P(ctx, fx + 1, fy + 2, '#3f7330')
    P(ctx, fx, fy - 1, col)
    P(ctx, fx - 1, fy, col)
    P(ctx, fx + 1, fy, col)
    P(ctx, fx, fy + 1, col)
    P(ctx, fx, fy, '#c9a85a')
  }
}

// Clumps of long blades, darker at the root and lit at the tip.
function tallGrass(ctx, tx, ty) {
  for (let i = 0; i < 40; i++) {
    const px = tx * TS + Math.floor(hash(tx, ty, 125 + i) * TS)
    const py = ty * TS + Math.floor(hash(ty, tx, 127 + i) * TS)
    P(ctx, px, py, '#457d30')
  }
  for (let i = 0; i < 8; i++) {
    const bx = tx * TS + Math.floor(hash(tx, ty, 131 + i) * 14)
    const by = ty * TS + 6 + Math.floor(hash(ty, tx, 141 + i) * 9)
    for (const [dx, h, lean] of [
      [0, 6, -1],
      [1, 8, 0],
      [2, 5, 1],
    ]) {
      for (let k = 0; k < h; k++) {
        const px = bx + dx + (k > h / 2 ? lean : 0)
        P(ctx, px, by - k, k < 2 ? '#2f5a28' : k < h - 3 ? '#3f7330' : k === h - 1 ? '#a8d47a' : GR.blade)
      }
    }
  }
}

// A small ring of mushrooms with muted caps.
function mushrooms(ctx, tx, ty) {
  const caps = [
    ['#a5615a', '#7e4640'],
    ['#b8946a', '#8c6c48'],
    ['#a99bc8', '#7d70a0'],
  ]
  const [cap, capDark] = caps[Math.floor(hash(tx, ty, 151) * caps.length)]
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + hash(tx, ty, 153) * 2
    const x = tx * TS + 7 + Math.round(Math.cos(a) * 4.5)
    const y = ty * TS + 8 + Math.round(Math.sin(a) * 3.5)
    const big = hash(tx + i, ty, 155) < 0.4
    P(ctx, x, y + 1, '#d9cfbc')
    P(ctx, x, y + 2, '#b5aa94')
    rect(ctx, x - 1, y, 3, 1, cap)
    P(ctx, x + 1, y, capDark)
    if (big) {
      rect(ctx, x - 1, y - 1, 3, 1, cap)
      P(ctx, x - 2, y, capDark)
      P(ctx, x + 2, y, capDark)
      P(ctx, x, y - 1, '#e8dfd0')
    } else P(ctx, x, y - 1, cap)
  }
}

// A skull and a couple of old bones.
const SKULL = ['.www.', 'wwwww', 'wkwkw', 'wwwww', '.wdw.']
function bones(ctx, tx, ty) {
  const x = tx * TS + 3 + Math.floor(hash(tx, ty, 161) * 6)
  const y = ty * TS + 3 + Math.floor(hash(ty, tx, 163) * 5)
  ellipse(ctx, x + 2, y + 5, 3, 1, 'rgba(20,16,30,.3)')
  sprite(ctx, SKULL, { w: '#d6cfbd', k: '#2a2730', d: '#9f9785' }, x, y)
  const bx = tx * TS + 4 + Math.floor(hash(tx, ty, 165) * 4)
  const by = ty * TS + 11 + Math.floor(hash(tx, ty, 167) * 3)
  line(ctx, bx, by, bx + 6, by - 2, '#cfc7b4')
  P(ctx, bx, by + 1, '#cfc7b4')
  P(ctx, bx + 6, by - 3, '#cfc7b4')
  P(ctx, bx + 1, by + 1, '#9f9785')
  line(ctx, bx + 2, by + 3, bx + 7, by + 3, '#b8b09c')
}

// Broken stones scattered on the ground, lit from the top left.
function rubble(ctx, tx, ty) {
  for (let i = 0; i < 6; i++) {
    const x = tx * TS + 2 + Math.floor(hash(tx, ty, 171 + i) * 11)
    const y = ty * TS + 2 + Math.floor(hash(ty, tx, 181 + i) * 11)
    const w = 2 + Math.floor(hash(tx + i, ty, 191) * 2)
    rect(ctx, x, y + 1, w, 1, 'rgba(20,16,30,.35)')
    rect(ctx, x, y - 1, w, 2, '#8d879f')
    P(ctx, x, y - 1, '#b3aec2')
    P(ctx, x + w - 1, y, '#5c5770')
  }
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
          else if (g === 'dark') c = darkPx(m, tx, ty, x, y, gx, gy)
          else if (g === 'moss') c = mossPx(m, tx, ty, x, y, gx, gy)
          else if (g === 'carpet') c = carpetPx(m, tx, ty, x, y, gx, gy)
          else if (g === 'stairs') c = stairsPx(m, tx, ty, x, y, gx, gy)
          else if (g === 'mosaic') c = mosaicPx(m, tx, ty, x, y, gx, gy)
          else if (g === 'marsh') c = marshPx(m, tx, ty, x, y, gx, gy)
          else c = grassPx(gx, gy)
          P(ctx, gx, gy, c)
        }
      }
      const char = m.charAt(tx, ty)
      if (char === '.') {
        const n = hash(tx, ty, 47)
        if (n < 0.08) flowers(ctx, tx, ty)
        else if (n < 0.12) pebbles(ctx, tx, ty)
        else if (n < 0.4) tuft(ctx, tx, ty)
      } else if (char === '*') flowerBed(ctx, tx, ty)
      else if (char === '"') tallGrass(ctx, tx, ty)
      else if (char === 'm') mushrooms(ctx, tx, ty)
      else if (char === 'x') bones(ctx, tx, ty)
      else if (char === 'r') rubble(ctx, tx, ty)
      else if (char === 'w') lilies(ctx, tx, ty)
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

// ---------- fase 4 things ----------

const OUTLINE = '#2e2622'
const SOFT_SHADOW = 'rgba(20,16,30,.35)'
const WOOD = { light: '#a5835c', base: '#8a6a48', dark: '#6b4f36', deep: '#4a3527', face: '#b8936a', ring: '#8f6c48' }
const STONE = { light: '#cfcabb', base: '#b3ae9f', dark: '#8f8b7d', deep: '#6e6a5e', ink: '#45424d' }

function stump(ctx, x, y, tx, ty) {
  ellipse(ctx, x + 8, y + 14, 7, 2, SOFT_SHADOW)
  // Roots flaring out at the foot, then the trunk, then the cut face on top.
  rect(ctx, x + 1, y + 12, 15, 3, OUTLINE)
  rect(ctx, x + 2, y + 12, 13, 2, WOOD.dark)
  rect(ctx, x + 2, y + 8, 13, 6, OUTLINE)
  rect(ctx, x + 3, y + 8, 11, 5, WOOD.base)
  rect(ctx, x + 3, y + 8, 3, 5, WOOD.light)
  rect(ctx, x + 11, y + 8, 3, 5, WOOD.dark)
  rect(ctx, x + 2, y + 13, 13, 1, WOOD.deep)
  for (let i = 0; i < 3; i++) rect(ctx, x + 6 + i * 2, y + 9 + (i % 2), 1, 3, WOOD.dark)
  ellipse(ctx, x + 8, y + 7, 6, 3, OUTLINE)
  ellipse(ctx, x + 8, y + 7, 5, 2, '#c9a57a')
  ellipse(ctx, x + 8, y + 7, 3, 1, '#9a7650')
  rect(ctx, x + 6, y + 7, 5, 1, '#c9a57a')
  P(ctx, x + 8, y + 7, '#9a7650')
  P(ctx, x + 5, y + 6, '#e0c49a')
  if (hash(tx, ty, 201) < 0.6) {
    P(ctx, x + 3, y + 9, '#6d8656')
    P(ctx, x + 4, y + 10, '#5b7348')
    P(ctx, x + 3, y + 11, '#6d8656')
  }
}

function log(ctx, x, y, tx, ty) {
  ellipse(ctx, x + 8, y + 14, 8, 2, SOFT_SHADOW)
  rect(ctx, x, y + 6, 13, 8, OUTLINE)
  rect(ctx, x + 1, y + 7, 12, 6, WOOD.base)
  rect(ctx, x + 1, y + 7, 12, 1, WOOD.light)
  rect(ctx, x + 1, y + 11, 12, 2, WOOD.dark)
  for (let i = 0; i < 4; i++) P(ctx, x + 2 + Math.floor(hash(tx, ty, 203 + i) * 10), y + 9 + (i % 2), WOOD.deep)
  ellipse(ctx, x + 13, y + 10, 3, 4, OUTLINE)
  ellipse(ctx, x + 13, y + 10, 2, 3, WOOD.face)
  rect(ctx, x + 13, y + 9, 1, 2, WOOD.ring)
  for (let i = 0; i < 5; i++) P(ctx, x + 2 + i * 2 + (hash(tx, ty, 211) < 0.5 ? 1 : 0), y + 6 + (i % 2), i % 2 ? '#5b7348' : '#6d8656')
}

// A cluster of three steel blue prisms, lit on the left.
function prism(ctx, cx, top, h, half) {
  for (let py = 0; py < h; py++) {
    const w = Math.min(half, Math.floor(py / 1.5))
    for (let px = -w; px <= w; px++) {
      let c
      if (px === -w || px === w || py === h - 1) c = '#26314a'
      else if (px < 0) c = py < 3 ? '#e2eefa' : '#a9c6e3'
      else if (px === 0) c = '#8fb3d9'
      else c = '#5a7aa8'
      P(ctx, cx + px, top + py, c)
    }
  }
  P(ctx, cx, top, '#26314a')
}

function crystal(ctx, x, y) {
  ellipse(ctx, x + 8, y + 14, 7, 2, SOFT_SHADOW)
  prism(ctx, x + 4, y + 6, 9, 2)
  prism(ctx, x + 12, y + 4, 11, 2)
  prism(ctx, x + 8, y, 15, 3)
  P(ctx, x + 7, y + 4, '#ffffff')
}

// A broken stretch of old wall: stone blocks under a ragged top, with moss.
function ruinWall(ctx, m, x, y, tx, ty) {
  const left = m.charAt(tx - 1, ty) === 'R'
  const right = m.charAt(tx + 1, ty) === 'R'
  for (let lx = 0; lx < TS; lx++) {
    const top = 1 + Math.floor(hash(Math.floor((tx * TS + lx) / 3), ty, 221) * 5)
    for (let ly = top; ly < TS; ly++) {
      const row = Math.floor(ly / 4)
      const off = row % 2 ? 2 : 0
      const bx = (lx + off) % 5
      let c
      if (ly === top) c = '#34313f'
      else if (ly === top + 1) c = '#a6a1b8'
      else if (ly % 4 === 3 || bx === 4) c = '#4b4860'
      else c = hash(Math.floor((tx * TS + lx + off) / 5), ty * 4 + row, 223) < 0.3 ? '#67637a' : '#7f7a92'
      if (ly > TS - 3) c = ly === TS - 1 ? '#34313f' : c === '#4b4860' ? c : '#67637a'
      if ((lx === 0 && !left) || (lx === TS - 1 && !right)) c = '#34313f'
      if (c !== '#34313f' && c !== '#4b4860' && hash(Math.floor((tx * TS + lx) / 2), Math.floor(ly / 2) + ty * 9, 225) < 0.12) c = '#6d8656'
      P(ctx, x + lx, y + ly, c)
    }
  }
}

function column(ctx, x, y) {
  ellipse(ctx, x + 8, y + 15, 7, 2, SOFT_SHADOW)
  rect(ctx, x + 1, y + 12, 14, 4, STONE.ink)
  rect(ctx, x + 2, y + 12, 12, 3, STONE.base)
  rect(ctx, x + 2, y + 12, 12, 1, STONE.light)
  rect(ctx, x + 3, y - 4, 10, 16, STONE.ink)
  for (let lx = 4; lx < 12; lx++) {
    const c = lx < 6 ? STONE.light : lx % 2 ? STONE.dark : lx < 9 ? STONE.base : STONE.deep
    rect(ctx, x + lx, y - 4, 1, 16, c)
  }
  rect(ctx, x + 1, y - 8, 14, 5, STONE.ink)
  rect(ctx, x + 2, y - 7, 12, 3, STONE.base)
  rect(ctx, x + 2, y - 7, 12, 1, STONE.light)
  rect(ctx, x + 2, y - 5, 12, 1, STONE.dark)
}

function glassware(ctx, x, y, tx) {
  ellipse(ctx, x + 8, y + 15, 7, 1, SOFT_SHADOW)
  rect(ctx, x + 2, y + 10, 1, 5, WOOD.deep)
  rect(ctx, x + 13, y + 10, 1, 5, WOOD.deep)
  rect(ctx, x, y + 8, 16, 3, OUTLINE)
  rect(ctx, x + 1, y + 8, 14, 1, WOOD.light)
  rect(ctx, x + 1, y + 9, 14, 1, WOOD.base)
  const liquids = ['#7fa88a', '#c9a85a', '#9a8fc0']
  const pick = (i) => liquids[(tx + i) % liquids.length]
  // A round flask.
  ellipse(ctx, x + 4, y + 6, 2, 2, '#6f8f96')
  ellipse(ctx, x + 4, y + 6, 1, 1, '#b9d3d8')
  rect(ctx, x + 3, y + 6, 3, 2, pick(0))
  rect(ctx, x + 4, y + 2, 1, 3, '#b9d3d8')
  P(ctx, x + 3, y + 5, '#ffffff')
  // A tall tube.
  rect(ctx, x + 7, y + 1, 3, 7, '#6f8f96')
  rect(ctx, x + 8, y + 2, 1, 5, '#b9d3d8')
  rect(ctx, x + 8, y + 4, 1, 3, pick(1))
  // A cone flask.
  for (let i = 0; i < 4; i++) rect(ctx, x + 12 - Math.floor(i / 2), y + 4 + i, 1 + Math.floor(i / 2) * 2, 1, i > 1 ? pick(2) : '#b9d3d8')
  rect(ctx, x + 12, y + 2, 1, 2, '#b9d3d8')
}

function cabinet(ctx, x, y, tx, ty) {
  ellipse(ctx, x + 8, y + 15, 7, 1, SOFT_SHADOW)
  rect(ctx, x + 1, y - 4, 14, 19, '#2e241c')
  rect(ctx, x + 2, y - 3, 12, 17, '#6e5a48')
  rect(ctx, x + 2, y - 3, 2, 17, '#82705c')
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const dx = x + 3 + col * 6
      const dy = y - 2 + row * 5
      rect(ctx, dx, dy, 5, 4, '#5a4838')
      rect(ctx, dx, dy, 5, 1, '#7d6a56')
      rect(ctx, dx + 1, dy + 1, 3, 1, hash(tx + col, ty + row, 231) < 0.5 ? '#d8d0bc' : '#c4bba6')
      P(ctx, dx + 2, dy + 2, '#c9a85a')
    }
  }
}

const AWNINGS = ['#a8645a', '#5f7896', '#6f8a5a']
function stall(ctx, x, y, tx, ty) {
  ellipse(ctx, x + 8, y + 15, 8, 1, SOFT_SHADOW)
  rect(ctx, x + 1, y + 2, 1, 12, WOOD.deep)
  rect(ctx, x + 14, y + 2, 1, 12, WOOD.deep)
  rect(ctx, x, y + 9, 16, 6, OUTLINE)
  rect(ctx, x + 1, y + 9, 14, 1, WOOD.light)
  rect(ctx, x + 1, y + 10, 14, 4, WOOD.base)
  for (let i = 1; i < 15; i += 4) rect(ctx, x + i, y + 10, 1, 4, WOOD.dark)
  const goods = ['#c98a5a', '#7fa070', '#d9c27a', '#a5615a']
  for (let i = 0; i < 5; i++) {
    const gx = x + 2 + i * 3
    const col = goods[Math.floor(hash(tx + i, ty, 241) * goods.length)]
    rect(ctx, gx, y + 7, 2, 2, col)
    P(ctx, gx, y + 7, '#e8dfd0')
  }
  const color = AWNINGS[Math.floor(hash(tx, ty, 243) * AWNINGS.length)]
  rect(ctx, x, y - 4, 16, 7, OUTLINE)
  for (let lx = 1; lx < 15; lx++) {
    const c = Math.floor((lx - 1) / 2) % 2 ? '#e2dacb' : color
    rect(ctx, x + lx, y - 3, 1, 5, c)
    if (lx % 2) P(ctx, x + lx, y + 2, c)
  }
  rect(ctx, x + 1, y - 3, 14, 1, 'rgba(255,255,255,.25)')
}

function barrel(ctx, x, y) {
  ellipse(ctx, x + 8, y + 15, 6, 1, SOFT_SHADOW)
  for (let ly = 3; ly < 15; ly++) {
    const half = ly > 5 && ly < 12 ? 6 : 5
    for (let lx = -half; lx < half; lx++) {
      let c = lx < -half + 3 ? WOOD.light : lx > half - 3 ? WOOD.dark : WOOD.base
      if (lx === -half || lx === half - 1 || ly === 14) c = OUTLINE
      else if (ly === 5 || ly === 12) c = '#5e6270'
      else if ((lx + 8) % 3 === 0) c = WOOD.dark
      P(ctx, x + 8 + lx, y + ly, c)
    }
  }
  ellipse(ctx, x + 8, y + 3, 4, 1, WOOD.face)
  rect(ctx, x + 4, y + 2, 8, 1, OUTLINE)
}

function planter(ctx, x, y, tx, ty) {
  ellipse(ctx, x + 8, y + 15, 7, 1, SOFT_SHADOW)
  blob(ctx, x + 5, y + 6, 4, 3, ['#33553a', '#3f6b45', '#4f8251', '#6a9c62', '#8dba7c'], '#1f3324')
  blob(ctx, x + 11, y + 6, 4, 3, ['#33553a', '#3f6b45', '#4f8251', '#6a9c62', '#8dba7c'], '#1f3324')
  const petals = ['#d4a0b0', '#e3d08a', '#e8eaf0', '#a99bc8']
  for (let i = 0; i < 4; i++) P(ctx, x + 3 + i * 3, y + 4 + (i % 2) * 2, petals[Math.floor(hash(tx + i, ty, 251) * petals.length)])
  rect(ctx, x + 1, y + 8, 14, 7, OUTLINE)
  rect(ctx, x + 2, y + 9, 12, 5, WOOD.base)
  rect(ctx, x + 2, y + 9, 12, 1, WOOD.light)
  rect(ctx, x + 2, y + 11, 12, 1, WOOD.dark)
  rect(ctx, x + 2, y + 8, 12, 1, '#4a3a2c')
}

function telescope(ctx, x, y) {
  ellipse(ctx, x + 8, y + 15, 6, 1, SOFT_SHADOW)
  line(ctx, x + 8, y + 9, x + 3, y + 15, '#3d3a45')
  line(ctx, x + 8, y + 9, x + 13, y + 15, '#3d3a45')
  line(ctx, x + 8, y + 9, x + 8, y + 15, '#55515f')
  line(ctx, x + 3, y + 11, x + 13, y + 1, '#9a7c40')
  line(ctx, x + 3, y + 10, x + 13, y + 0, '#c9a85a')
  line(ctx, x + 4, y + 10, x + 14, y + 0, '#c9a85a')
  line(ctx, x + 4, y + 9, x + 13, y - 1, '#e0c88a')
  rect(ctx, x + 2, y + 10, 2, 2, '#3d3a45')
  rect(ctx, x + 13, y - 1, 2, 2, '#8d9ab3')
  P(ctx, x + 14, y - 1, '#e2eefa')
}

const CHALK = [
  ['ww.w.....', '.w..w.ww.', 'ww.w...w.', '.......ww'],
  ['www.w.w..', '.w...w...', '.w..w.w.y', '.......yy'],
  ['w..w.www.', '.ww...w..', 'w..w..w..', '.....yyy.'],
]
function chalkboard(ctx, x, y, tx, ty) {
  ellipse(ctx, x + 8, y + 15, 6, 1, SOFT_SHADOW)
  line(ctx, x + 3, y + 10, x + 2, y + 15, WOOD.deep)
  line(ctx, x + 12, y + 10, x + 13, y + 15, WOOD.deep)
  rect(ctx, x, y, 16, 11, OUTLINE)
  rect(ctx, x + 1, y + 1, 14, 9, WOOD.base)
  rect(ctx, x + 2, y + 2, 12, 7, '#2f3a36')
  sprite(ctx, CHALK[Math.floor(hash(tx, ty, 261) * CHALK.length)], { w: '#d8dcd6', y: '#c9a85a' }, x + 3, y + 3)
  rect(ctx, x + 2, y + 10, 12, 1, WOOD.light)
  P(ctx, x + 10, y + 9, '#e8eaf0')
}

function paintThings(ctx, m) {
  const things = []
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) {
      const c = m.charAt(tx, ty)
      const x = tx * TS
      const y = ty * TS
      const inside = m.indoor(tx, ty)
      if (c === 'T') things.push([y + 14, () => tree(ctx, x, y, tx, ty)])
      else if (c === 's') things.push([y + 13, () => stump(ctx, x, y, tx, ty)])
      else if (c === 'l') things.push([y + 13, () => log(ctx, x, y, tx, ty)])
      else if (c === 'K') things.push([y + 14, () => crystal(ctx, x, y)])
      else if (c === 'R') things.push([y + 15, () => ruinWall(ctx, m, x, y, tx, ty)])
      else if (c === 'I') things.push([y + 15, () => column(ctx, x, y)])
      else if (c === 'G') things.push([y + 14, () => glassware(ctx, x, y, tx)])
      else if (c === 'F') things.push([y + 15, () => cabinet(ctx, x, y, tx, ty)])
      else if (c === 'M') things.push([y + 15, () => stall(ctx, x, y, tx, ty)])
      else if (c === 'b') things.push([y + 14, () => barrel(ctx, x, y)])
      else if (c === 'P') things.push([y + 14, () => planter(ctx, x, y, tx, ty)])
      else if (c === 'Q') things.push([y + 14, () => telescope(ctx, x, y)])
      else if (c === 'E') things.push([y + 14, () => chalkboard(ctx, x, y, tx, ty)])
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

// ---------- padlocks on locked portals ----------

const LOCK = ['..ggg..', '.g...g.', '.g...g.', 'kkkkkkk', 'kYyyyyk', 'kyykyyk', 'kyykyyk', 'kkkkkkk']
const LOCK_PAL = { g: '#c9ccd4', k: '#1c1d26', y: '#f2c14e', Y: '#ffe08a' }

// The padlock on a portal to a locked world, centered on the tile at (tx, ty). Zones inside a world
// are always open, so nothing else is locked or fogged.
export function paintPadlock(ctx, tx, ty) {
  sprite(ctx, LOCK, LOCK_PAL, tx * TS + 4, ty * TS + 5)
}

// The whole map at time t: ground, things, water and portals.
export function paintMap(ctx, world, { t = 0 } = {}) {
  paintBase(ctx, world)
  paintAnimated(ctx, world, t)
}

// The map's own lights for the light pass: portals glow violet, terminals cyan, chests a warm glint,
// crystals a soft steel blue.
export function mapLights(world, t = 0) {
  const m = readMap(world)
  const lights = []
  for (let ty = 0; ty < m.H; ty++) {
    for (let tx = 0; tx < m.W; tx++) {
      const c = m.charAt(tx, ty)
      const x = tx * TS + 8
      const y = ty * TS + 8
      if (c === 'O') lights.push({ x, y, r: 44 + Math.sin(t * 3) * 3, rgb: '140,95,255', a: 0.55 })
      else if (c === 'C' && m.indoor(tx, ty)) lights.push({ x, y: y - 2, r: 20, rgb: '120,200,255', a: 0.3 })
      else if (c === 'K') lights.push({ x, y: y - 1, r: 18, rgb: '150,190,230', a: 0.22 })
      else if (c === 'C') lights.push({ x, y: y + 2, r: 12, rgb: '255,200,90', a: 0.18 })
    }
  }
  return lights
}
