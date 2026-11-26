import { blob, ellipse, hash, line, P, rect, SHADOW, sprite } from './pixels.js'

// The enemies, drawn in the scene's shaded 16px style. Each actor paints into a pixel buffer
// first, then lands on the canvas with its anim's transform (lunge, squash, white flash, fade).
//
// API (Task 16 drives these each frame):
//   drawEnemy(ctx, x, y, { sprite, anim, t, p, elite, hp, facing })
// (The hero is a paper doll: see ../hero/.) x, y: the top left of the actor's 16x16 tile in canvas pixels; feet stand on its bottom row. Bosses are
//   bigger and spill out of the tile upward and sideways.
// anim: one of ANIMS. t: seconds, for idle loops. p: the anim's progress, 0 to 1 (attack, hurt, death).
// facing: 1 looks right, -1 left. Enemies default to -1 (they face the hero on their left).
// hp: an optional 0..1 fraction for a small health bar over the enemy.
export const ANIMS = ['idle', 'walk', 'attack', 'hurt', 'death']

const clamp01 = (v) => Math.max(0, Math.min(1, v))

// ---------- pixel buffer + blit ----------

function buffer() {
  const px = new Map()
  const b = {
    px,
    fillStyle: '#000',
    fillRect(x, y, w, h) {
      const x0 = Math.round(x)
      const y0 = Math.round(y)
      for (let yy = y0; yy < y0 + Math.round(h); yy++) {
        for (let xx = x0; xx < x0 + Math.round(w); xx++) px.set(`${xx},${yy}`, { x: xx, y: yy, c: b.fillStyle })
      }
    },
  }
  return b
}

// Lands a buffer on ctx at (ox, oy), anchored at local (ax, ay) (the feet). sx/sy squash around the anchor,
// flip mirrors, flash paints every pixel one color, rim draws a 1px outline around the silhouette.
function blit(ctx, b, { ox, oy, ax = 8, ay = 15, sx = 1, sy = 1, flip = false, flash = null, alpha = 1, rim = null }) {
  if (alpha <= 0) return
  const prev = ctx.globalAlpha ?? 1
  ctx.globalAlpha = prev * alpha
  const w = Math.max(1, Math.ceil(sx))
  const h = Math.max(1, Math.ceil(sy))
  const put = (lx, ly, c) => {
    const fx = flip ? 2 * ax - lx : lx
    ctx.fillStyle = c
    ctx.fillRect(ox + ax + Math.round((fx - ax) * sx), oy + ay - Math.round((ay - ly) * sy), w, h)
  }
  if (rim) {
    const ring = new Map()
    for (const { x, y } of b.px.values()) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const key = `${x + dx},${y + dy}`
        if (!b.px.has(key)) ring.set(key, [x + dx, y + dy])
      }
    }
    for (const [x, y] of ring.values()) put(x, y, rim)
  }
  for (const { x, y, c } of b.px.values()) put(x, y, flash ?? c)
  ctx.globalAlpha = prev
}

// Little bits flying out of a dying actor.
function burst(ctx, cx, cy, q, colors, seed) {
  if (q <= 0 || q >= 1) return
  const prev = ctx.globalAlpha ?? 1
  ctx.globalAlpha = prev * (1 - q)
  for (let i = 0; i < 10; i++) {
    const a = hash(i, seed, 81) * Math.PI * 2
    const d = 3 + q * (6 + hash(i, seed, 83) * 6)
    P(ctx, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d - q * 4), colors[i % colors.length])
  }
  ctx.globalAlpha = prev
}

// The transform for an anim: lunge toward the foe, knockback, squash, flash, fade.
function motion(anim, p, facing) {
  const s = { dx: 0, dy: 0, sx: 1, sy: 1, flash: null, alpha: 1, q: 0 }
  if (anim === 'attack') {
    const wind = p < 0.25 ? p / 0.25 : 0
    s.sy = 1 - 0.15 * wind
    s.sx = 1 + 0.1 * wind
    s.dx = facing * Math.round(Math.sin(clamp01((p - 0.2) / 0.6) * Math.PI) * 5)
  } else if (anim === 'hurt') {
    s.dx = -facing * Math.round(Math.sin(p * Math.PI) * 2)
    if (p < 0.5 && Math.floor(p * 10) % 2 === 0) s.flash = '#ffffff'
  } else if (anim === 'death') {
    if (p < 0.2) s.flash = Math.floor(p * 20) % 2 ? null : '#ffffff'
    const q = clamp01((p - 0.2) / 0.8)
    s.q = q
    s.sy = 1 - 0.75 * q
    s.sx = 1 + 0.35 * q
    s.alpha = 1 - q * q
  }
  return s
}

// A warm glow around the hero doll's middle, for the light pass.
export const heroLight = (x, y) => ({ x: x + 8, y: y + 4, r: 40, rgb: '255,190,100', a: 0.4 })

// ---------- enemies ----------
// Each art draws into a buffer in tile-local coordinates (feet on y = 15, centered on x = 8), facing left.
// o: { t, bob } where bob is the idle bounce. Returns nothing.

const PAL = {
  slime: ['#0f5d57', '#16807a', '#24a597', '#5bd6c1', '#c4fff1'],
  king: ['#1d5a2a', '#2a7d3a', '#3fa34c', '#74cf6a', '#d2ffb8'],
  cap: ['#6e1520', '#9c2230', '#c83a3a', '#e86a5a', '#ffb0a0'],
  bat: ['#22163a', '#33224f', '#4a3470', '#6a4f96', '#9a83c4'],
  wolf: ['#2c3040', '#454b60', '#5f6780', '#8a93ad', '#c3cadb'],
  goblin: ['#2a5a1e', '#3d7a2a', '#579c3a', '#7fc457', '#b9e88a'],
  tunic: ['#4a2c17', '#6b4022', '#8a5a34', '#a8703f', '#c99260'],
  fly: ['#12303a', '#1c4a56', '#2a6a78', '#3f92a0', '#7fd0d8'],
  bone: ['#8a8678', '#b3ae9c', '#d6d1bd', '#f0ecdc', '#ffffff'],
  stone: ['#3f4250', '#575b6b', '#727788', '#9196a8', '#c0c5d4'],
  spider: ['#1e1424', '#2e1f36', '#45304f', '#62476e', '#8d6f9a'],
  ghost: ['#3a4f8a', '#5a78c0', '#8fb0e8', '#c4dcff', '#f0f8ff'],
  queen: ['#2a0f3a', '#41175a', '#5e2384', '#8436b0', '#b46ee0'],
  hydra: ['#4a0f18', '#6e1824', '#982634', '#c4404a', '#f07a70'],
}

function eyes(b, x1, x2, y, iris = '#0b1f1e', shine = '#ffffff', tall = 2) {
  for (const x of [x1, x2]) {
    rect(b, x, y, 1, tall, iris)
    P(b, x, y, shine)
  }
}

function slime(b, { bob }) {
  blob(b, 8, 10 - bob, 7 + bob * 0.5, 6 - bob * 0.5, PAL.slime, '#083330', 15 - 2)
  eyes(b, 6, 10, 9 - bob)
  P(b, 4, 7 - bob, '#ffffff')
  P(b, 8, 12 - bob, '#0b1f1e')
}

function cogumelo(b, { bob }) {
  rect(b, 5, 9, 6, 6, '#3a2a1a')
  rect(b, 6, 9, 4, 5, '#e8d6b0')
  rect(b, 6, 9, 1, 5, '#f8ecd0')
  rect(b, 9, 9, 1, 5, '#c9b085')
  rect(b, 5, 14, 6, 1, '#3a2a1a')
  eyes(b, 6, 9, 10, '#1c1d26', '#ffffff')
  P(b, 7, 12, '#1c1d26')
  P(b, 8, 12, '#1c1d26')
  blob(b, 8, 7 - bob, 7.5, 5, PAL.cap, '#3a0c12', 9 - bob)
  for (const [x, y] of [
    [5, 5],
    [9, 4],
    [11, 7],
    [7, 7],
  ]) {
    P(b, x, y - bob, '#fff4e8')
    P(b, x + 1, y - bob, '#f0d8d0')
  }
}

function wing(b, rootX, rootY, tipX, tipY, lowY, color, ink) {
  const minY = Math.min(rootY, tipY)
  const maxY = Math.max(rootY, lowY)
  for (let y = minY; y <= maxY; y++) {
    const k = (y - minY) / Math.max(1, maxY - minY)
    const from = Math.round(rootX + (tipX - rootX) * (1 - k))
    const [a, c] = from < rootX ? [from, rootX] : [rootX, from]
    rect(b, a, y, c - a + 1, 1, color)
  }
  line(b, rootX, rootY, tipX, tipY, ink)
}

function morcego(b, { t, bob }) {
  const up = Math.floor(t * 10) % 2 === 0
  const hy = 7 + bob
  wing(b, 6, hy, 0, up ? hy - 5 : hy + 3, hy + 3, '#3d2a5c', '#140c22')
  wing(b, 10, hy, 16, up ? hy - 5 : hy + 3, hy + 3, '#3d2a5c', '#140c22')
  blob(b, 8, hy + 1, 3.5, 3.5, PAL.bat, '#140c22')
  P(b, 6, hy - 3, '#140c22')
  P(b, 10, hy - 3, '#140c22')
  P(b, 6, hy - 2, PAL.bat[3])
  P(b, 10, hy - 2, PAL.bat[3])
  P(b, 7, hy, '#ff4d6d')
  P(b, 9, hy, '#ff4d6d')
  P(b, 8, hy + 2, '#ffffff')
}

function lobo(b, { t, bob }) {
  const run = Math.floor(t * 6) % 2
  for (const [x, k] of [
    [5, 0],
    [7, 1],
    [11, 0],
    [13, 1],
  ]) {
    rect(b, x, 12, 1, 3 - (k === run ? 1 : 0), '#151722')
    P(b, x, 14 - (k === run ? 1 : 0), PAL.wolf[1])
  }
  line(b, 13, 9 - bob, 15, 6 - bob, '#151722')
  P(b, 15, 5 - bob, PAL.wolf[4])
  blob(b, 9.5, 10 - bob, 5, 3, PAL.wolf, '#151722')
  blob(b, 4.5, 7 - bob, 3.2, 2.8, PAL.wolf, '#151722')
  rect(b, 0, 7 - bob, 2, 2, '#151722')
  P(b, 1, 7 - bob, PAL.wolf[3])
  P(b, 0, 8 - bob, '#1c1d26')
  for (const x of [3, 6]) {
    P(b, x, 3 - bob, '#151722')
    P(b, x, 4 - bob, PAL.wolf[2])
  }
  P(b, 3, 6 - bob, '#ffd76a')
  P(b, 1, 9 - bob, '#ffffff')
}

function goblin(b, { t, bob }) {
  rect(b, 5, 13, 2, 2, '#1c1d26')
  rect(b, 9, 13, 2, 2, '#1c1d26')
  blob(b, 8, 11, 4, 3, PAL.tunic, '#24160c')
  blob(b, 8, 6 - bob, 4.5, 3.8, PAL.goblin, '#163010')
  for (const [x, y] of [
    [2, 4],
    [3, 5],
    [13, 4],
    [12, 5],
  ]) P(b, x, y - bob, PAL.goblin[3])
  P(b, 1, 3 - bob, '#163010')
  P(b, 14, 3 - bob, '#163010')
  P(b, 6, 6 - bob, '#ffd76a')
  P(b, 9, 6 - bob, '#ffd76a')
  rect(b, 6, 8 - bob, 4, 1, '#163010')
  P(b, 7, 8 - bob, '#ffffff')
  // A torch: the loop of fire.
  line(b, 2, 14, 3, 8, '#6b4022')
  const f = Math.floor(t * 8) % 3
  P(b, 3, 7, '#ffd76a')
  P(b, 2 + (f === 1 ? 1 : 0), 6, '#ff9a1f')
  P(b, 3, 5 - (f === 2 ? 1 : 0), '#ff5a3a')
  P(b, 4, 7, '#ff9a1f')
}

function mosca(b, { t, bob }) {
  const up = Math.floor(t * 20) % 2 === 0
  const hy = 7 + bob
  ellipse(b, 5, hy - (up ? 4 : 1), 3, 2, '#cfe6ff')
  ellipse(b, 11, hy - (up ? 4 : 1), 3, 2, '#cfe6ff')
  P(b, 5, hy - (up ? 4 : 1), '#ffffff')
  for (const x of [6, 8, 10]) line(b, x, hy + 3, x + (x === 8 ? 0 : x < 8 ? -1 : 1), hy + 6, '#0a1418')
  blob(b, 8, hy + 1, 3.5, 3, PAL.fly, '#0a1418')
  blob(b, 4.5, hy, 1.8, 1.8, ['#7e1822', '#c22a35', '#ff5a5a', '#ff9a9a'], '#0a1418')
  P(b, 4, hy - 1, '#ffffff')
  if (Math.floor(t * 4) % 3 === 0) P(b, 13, hy - 2, '#ffe066')
}

function esqueleto(b, { bob }) {
  rect(b, 6, 12, 1, 3, '#d6d1bd')
  rect(b, 9, 12, 1, 3, '#d6d1bd')
  rect(b, 5, 14, 2, 1, '#2a2822')
  rect(b, 9, 14, 2, 1, '#2a2822')
  rect(b, 8, 7 - bob, 1, 5 + bob, '#b3ae9c')
  for (const y of [8, 10]) rect(b, 6, y - bob, 5, 1, '#f0ecdc')
  // The ribs as array brackets.
  for (const [x, dir] of [
    [4, 1],
    [12, -1],
  ]) {
    rect(b, x, 7 - bob, 1, 5, '#7fe9ff')
    P(b, x + dir, 7 - bob, '#7fe9ff')
    P(b, x + dir, 11 - bob, '#7fe9ff')
  }
  blob(b, 8, 4 - bob, 3.6, 3.2, PAL.bone, '#2a2822')
  rect(b, 6, 4 - bob, 2, 2, '#1c1d26')
  rect(b, 9, 4 - bob, 2, 2, '#1c1d26')
  P(b, 6, 4 - bob, '#7fe9ff')
  P(b, 9, 4 - bob, '#7fe9ff')
  rect(b, 7, 7 - bob, 3, 1, '#8a8678')
}

function golem(b, { bob }) {
  rect(b, 4, 12, 3, 3, PAL.stone[1])
  rect(b, 10, 12, 3, 3, PAL.stone[1])
  rect(b, 4, 14, 3, 1, '#1e1f28')
  rect(b, 10, 14, 3, 1, '#1e1f28')
  blob(b, 8, 9 - bob, 6.5, 4.5, PAL.stone, '#1e1f28')
  blob(b, 1.5, 9 - bob, 2.3, 3, PAL.stone, '#1e1f28')
  blob(b, 14.5, 9 - bob, 2.3, 3, PAL.stone, '#1e1f28')
  blob(b, 8, 3 - bob, 3.5, 2.8, PAL.stone, '#1e1f28')
  P(b, 7, 3 - bob, '#7fe9ff')
  P(b, 9, 3 - bob, '#7fe9ff')
  // A glowing "?" rune: the if.
  for (const [x, y] of [
    [7, 7],
    [8, 7],
    [9, 8],
    [8, 9],
    [8, 11],
  ]) P(b, x, y - bob, '#7fe9ff')
  for (const x of [4, 5, 11]) P(b, x, 5 - bob, '#6aa843')
}

function aranha(b, { t, bob }) {
  const step = Math.floor(t * 8) % 2
  line(b, 9, -8, 9, 7 - bob, '#e8e6f0')
  for (let i = 0; i < 4; i++) {
    const kx = 4 + i * 3
    const lift = (i + step) % 2
    line(b, 8, 10 - bob, kx - 2, 7 - bob, '#1e1424')
    line(b, kx - 2, 7 - bob, kx - 3 + i, 14 - lift, '#1e1424')
  }
  blob(b, 10, 10 - bob, 3.8, 3, PAL.spider, '#0e0812')
  blob(b, 5.5, 10 - bob, 2.6, 2.2, PAL.spider, '#0e0812')
  P(b, 4, 9 - bob, '#ff4d6d')
  P(b, 5, 9 - bob, '#ff4d6d')
  P(b, 4, 10 - bob, '#ff8aa0')
  P(b, 11, 9 - bob, '#e0a030')
  P(b, 11, 10 - bob, '#e0a030')
}

function espectro(b, { t, bob }) {
  const hy = 7 + bob
  blob(b, 8, hy, 5.5, 5.5, PAL.ghost, '#1a2448', hy + 4)
  const wave = Math.floor(t * 6)
  for (let x = 3; x <= 13; x++) {
    const down = (x + wave) % 3 === 0 ? 2 : 1
    rect(b, x, hy + 4, 1, down, x % 2 ? PAL.ghost[2] : PAL.ghost[1])
    P(b, x, hy + 4 + down, '#1a2448')
  }
  rect(b, 5, hy - 1, 2, 3, '#1a2448')
  rect(b, 9, hy - 1, 2, 3, '#1a2448')
  P(b, 5, hy - 1, '#ffe066')
  P(b, 9, hy - 1, '#ffe066')
  rect(b, 7, hy + 2, 2, 1, '#1a2448')
}

function reiSlime(b, { t, bob }) {
  blob(b, 8, 6 - bob, 13 + bob * 0.5, 10 - bob * 0.5, PAL.king, '#0f2e14', 15 - 2)
  eyes(b, 3, 12, 4 - bob, '#0b1f0e', '#ffffff', 3)
  P(b, 4, 4 - bob, '#0b1f0e')
  P(b, 13, 4 - bob, '#0b1f0e')
  rect(b, 5, 9 - bob, 7, 1, '#0b1f0e')
  P(b, 6, 10 - bob, '#ffffff')
  P(b, 10, 10 - bob, '#ffffff')
  P(b, -1, 0 - bob, '#ffffff')
  P(b, 0, -1 - bob, '#ffffff')
  const CROWN = ['k.k.k.k', 'kykykyk', 'kyyRyyk', 'kyyyyyk', 'kkkkkkk']
  sprite(b, CROWN, { k: '#3a2a0a', y: '#f2c14e', R: '#e5484d' }, 5, -8 - bob)
  if (Math.floor(t * 3) % 4 === 0) P(b, 7, -9 - bob, '#ffffff')
  P(b, 14, 12 - bob, PAL.king[3])
  P(b, 14, 13 - bob, PAL.king[2])
}

function aranhaAssincrona(b, { t, bob }) {
  const step = Math.floor(t * 6) % 2
  for (let i = 0; i < 4; i++) {
    const lift = (i + step) % 2
    const kx = -4 + i * 6
    line(b, 4, 7 - bob, kx, 0 - bob, '#140a1c')
    line(b, kx, 0 - bob, kx - 2 + i, 15 - lift, '#140a1c')
    line(b, kx + 1, 0 - bob, kx - 1 + i, 15 - lift, PAL.queen[1])
  }
  blob(b, 13, 4 - bob, 8, 6.5, PAL.queen, '#0e0614')
  blob(b, 2, 7 - bob, 5, 4, PAL.queen, '#0e0614')
  // The hourglass mark: async.
  const HOUR = ['yyyyy', '.yyy.', '..y..', '.yyy.', 'yyyyy']
  sprite(b, HOUR, { y: '#f2c14e' }, 11, 2 - bob)
  for (const [x, y] of [
    [-1, 6],
    [0, 5],
    [1, 6],
    [0, 7],
  ]) P(b, x, y - bob, Math.floor(t * 4) % 2 ? '#ff6bd6' : '#ff3fb0')
  P(b, -2, 9 - bob, '#e8e6f0')
  P(b, 1, 9 - bob, '#e8e6f0')
}

function hidra(b, { t, bob }) {
  const heads = [
    [-2, -3, 0],
    [7, -9, 1.7],
    [17, -2, 3.4],
  ]
  for (const [hx, hy, ph] of heads) {
    const sway = Math.round(Math.sin(t * 2 + ph) * 1.5)
    const x = hx + sway
    const y = hy - bob
    line(b, 8, 6 - bob, x, y + 2, '#3a0a10')
    line(b, 9, 6 - bob, x + 1, y + 2, PAL.hydra[2])
    line(b, 10, 6 - bob, x + 2, y + 2, '#3a0a10')
  }
  blob(b, 9, 9 - bob, 8, 5.5, PAL.hydra, '#2a060c', 15 - 1)
  for (const x of [3, 15]) rect(b, x, 13, 3, 2, '#2a060c')
  for (const [i, [hx, hy, ph]] of heads.entries()) {
    const sway = Math.round(Math.sin(t * 2 + ph) * 1.5)
    const x = hx + sway
    const y = hy - bob
    blob(b, x, y, 3.4, 2.6, PAL.hydra, '#2a060c')
    rect(b, x - 4, y + 1, 2, 1, PAL.hydra[3])
    P(b, x - 1, y - 1, '#ffd76a')
    P(b, x - 3, y + 2, '#ffffff')
    if (i === 1) {
      // The undefined head glitches: shifted color bits.
      P(b, x + 2, y - 2, '#ff3fb0')
      P(b, x + 3, y - 1, '#4fe3ff')
      P(b, x - 2, y - 3, '#4fe3ff')
    }
    if (Math.floor(t * 5 + i) % 3 === 0) P(b, x - 5, y + 1, '#ff9a1f')
  }
  for (const x of [5, 8, 11, 14]) P(b, x, 6 - bob, PAL.hydra[4])
}

// art, shadow [rx, ry], whether it flies, top (local y of its head, for the hp bar), bar width, colors.
const ENEMY_ART = {
  slime: { draw: slime, shadow: [7, 2], top: 2, colors: PAL.slime },
  cogumelo: { draw: cogumelo, shadow: [6, 2], top: 1, colors: PAL.cap },
  'morcego-bug': { draw: morcego, shadow: [4, 1], fly: true, top: 1, colors: PAL.bat },
  'lobo-syntax': { draw: lobo, shadow: [7, 2], top: 2, colors: PAL.wolf },
  'goblin-loop': { draw: goblin, shadow: [6, 2], top: 1, colors: PAL.goblin },
  'mosca-null': { draw: mosca, shadow: [3, 1], fly: true, top: 2, colors: PAL.fly },
  'esqueleto-array': { draw: esqueleto, shadow: [5, 2], top: 0, colors: PAL.bone },
  'golem-if': { draw: golem, shadow: [8, 2], top: 0, colors: PAL.stone },
  'aranha-fio': { draw: aranha, shadow: [7, 2], top: 5, colors: PAL.spider },
  'espectro-callback': { draw: espectro, shadow: [5, 1], fly: true, top: 1, colors: PAL.ghost },
  'rei-slime': { draw: reiSlime, shadow: [13, 3], top: -9, boss: true, colors: PAL.king },
  'aranha-assincrona': { draw: aranhaAssincrona, shadow: [13, 3], top: -3, boss: true, colors: PAL.queen },
  'hidra-undefined': { draw: hidra, shadow: [12, 3], top: -13, boss: true, colors: PAL.hydra },
}
export const ENEMY_SPRITES = Object.keys(ENEMY_ART)
export const isBossSprite = (id) => Boolean(ENEMY_ART[id]?.boss)

export function drawHealthBar(ctx, x, y, w, frac) {
  const f = clamp01(frac)
  rect(ctx, x, y, w, 3, '#1c1d26')
  rect(ctx, x + 1, y + 1, w - 2, 1, '#5a2328')
  const fill = Math.round((w - 2) * f)
  if (fill > 0) rect(ctx, x + 1, y + 1, fill, 1, '#e5484d')
}

export function drawEnemy(ctx, x, y, { sprite: id, anim = 'idle', t = 0, p = 0, elite = false, hp, facing = -1 } = {}) {
  const art = ENEMY_ART[id] ?? ENEMY_ART.slime
  const s = motion(anim, p, facing)
  const fast = anim === 'walk' ? 2 : 1
  const bob = Math.round(Math.sin(t * 4 * fast + (art.fly ? 1 : 0)) * (art.fly ? 1.5 : 1.2))
  const b = buffer()
  art.draw(b, { t, bob: anim === 'death' ? 0 : bob })

  const [rx, ry] = art.shadow
  if (elite) {
    // A gold ring on the ground and a rim of light around the elite.
    const pulse = 0.5 + 0.5 * Math.sin(t * 4)
    ellipse(ctx, x + 8 + s.dx, y + 15, rx + 2, ry + 1, `rgba(255,190,60,${(0.25 + pulse * 0.2).toFixed(2)})`)
  }
  ellipse(ctx, x + 8 + s.dx, y + 15, Math.max(2, Math.round(rx * s.sx)), ry, SHADOW)
  blit(ctx, b, {
    ox: x + s.dx,
    oy: y + s.dy,
    sx: s.sx,
    sy: s.sy,
    flip: facing > 0,
    flash: s.flash,
    alpha: s.alpha,
    rim: elite ? '#ffcf4a' : null,
  })
  if (anim === 'death') burst(ctx, x + 8, y + 8, s.q, art.colors.slice(2), ENEMY_SPRITES.indexOf(id) + 2)
  if (typeof hp === 'number' && anim !== 'death') {
    const w = art.boss ? 26 : 14
    drawHealthBar(ctx, x + 8 - w / 2 + s.dx, y + art.top - 5, w, hp)
  }
}

// Where an enemy glows, for the light pass: a faint glow in its own color, gold for elites.
export function enemyLight(x, y, { sprite: id, elite = false } = {}) {
  const art = ENEMY_ART[id] ?? ENEMY_ART.slime
  const [r, g, bl] = [1, 3, 5].map((i) => parseInt(art.colors[3].slice(i, i + 2), 16))
  return elite
    ? { x: x + 8, y: y + 8, r: art.boss ? 34 : 24, rgb: '255,190,80', a: 0.35 }
    : { x: x + 8, y: y + 8, r: art.boss ? 30 : 18, rgb: `${r},${g},${bl}`, a: 0.25 }
}

// ---------- packs: enemies at 2x from cached frames ----------
// The pack scene draws up to a dozen enemies a frame, twice the size of their 16px art so they stand
// as tall as the 32px hero. Painting the pixel buffers each frame would cost thousands of fillRects,
// so each frame of each sprite is painted once to a small canvas and scaled up with nearest neighbor.
// Frames are cached by sprite, time step (20 a second over a 6 s loop) and whether it walks or lies
// dead; the white flash, the elite rim and the frost tint are cached copies of the same frame.

export const FOE_SCALE = 2
const FRAME_RATE = 20
const LOOP_FRAMES = FRAME_RATE * 6
const frames = new Map()

function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  let c = null
  try {
    c = canvas.getContext?.('2d') ?? null
  } catch {
    c = null
  }
  return c ? { canvas, ctx: c } : null
}

// One frame painted to a canvas: { canvas, minX, minY } (local art coordinates of its top left,
// with a 1px margin for the rim), or null without canvas support.
function paintFrame(id, step, walking, dead, variant) {
  const art = ENEMY_ART[id] ?? ENEMY_ART.slime
  const t = step / FRAME_RATE
  const bob = dead ? 0 : Math.round(Math.sin(t * 4 * (walking ? 2 : 1) + (art.fly ? 1 : 0)) * (art.fly ? 1.5 : 1.2))
  const b = buffer()
  art.draw(b, { t, bob })
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { x, y } of b.px.values()) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (minX === Infinity) return null
  minX -= 1
  minY -= 1
  const made = makeCanvas(maxX - minX + 2, maxY - minY + 2)
  if (!made) return null
  const { ctx } = made
  const color = variant === 'white' ? '#ffffff' : variant === 'frost' ? '#8fe3ff' : null
  if (variant === 'rim') {
    ctx.fillStyle = '#ffcf4a'
    for (const { x, y } of b.px.values()) {
      for (const [dx, dy] of RIM_STEPS) {
        if (!b.px.has(`${x + dx},${y + dy}`)) ctx.fillRect(x + dx - minX, y + dy - minY, 1, 1)
      }
    }
  }
  for (const { x, y, c } of b.px.values()) {
    ctx.fillStyle = color ?? c
    ctx.fillRect(x - minX, y - minY, 1, 1)
  }
  return { canvas: made.canvas, minX, minY }
}
const RIM_STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function foeFrame(id, t, { walking = false, dead = false, variant = 'plain' } = {}) {
  const step = dead ? 0 : Math.floor(Math.max(0, t) * FRAME_RATE) % LOOP_FRAMES
  const key = `${id}|${step}|${walking ? 1 : 0}|${dead ? 1 : 0}|${variant}`
  if (!frames.has(key)) frames.set(key, paintFrame(id, step, walking, dead, variant))
  return frames.get(key)
}
export const clearFoeFrames = () => frames.clear()

const shadows = new Map()
// A cached ground ellipse.
function shadowOf(rx, ry, color) {
  const key = `${rx}|${ry}|${color}`
  if (!shadows.has(key)) {
    const made = makeCanvas(rx * 2 + 1, ry * 2 + 1)
    if (made) ellipse(made.ctx, rx, ry, rx, ry, color)
    shadows.set(key, made?.canvas ?? null)
  }
  return shadows.get(key)
}

// The colors an enemy breaks into, and how tall it stands in px at pack scale (for its hp bar).
export const foeColors = (id) => (ENEMY_ART[id] ?? ENEMY_ART.slime).colors
export const foeHeight = (id) => (16 - (ENEMY_ART[id] ?? ENEMY_ART.slime).top) * FOE_SCALE

// Draws a pack enemy with its feet at (gx, gy) canvas px. o: { sprite, anim, p, t, elite, facing,
// slowed, scale }. Falls back to the 16px painter when canvases can't be made (tests without one).
export function drawFoe(ctx, gx, gy, { sprite: id, anim = 'idle', p = 0, t = 0, elite = false, facing = -1, slowed = false, scale = FOE_SCALE } = {}) {
  const art = ENEMY_ART[id] ?? ENEMY_ART.slime
  const s = motion(anim, p, facing)
  const dead = anim === 'death'
  const walking = anim === 'walk'
  const base = foeFrame(id, t, { walking, dead })
  if (!base) {
    drawEnemy(ctx, Math.round(gx - 8), Math.round(gy - 15), { sprite: id, anim, p, t, elite, facing })
    return
  }
  const [rx, ry] = art.shadow
  const x = Math.round(gx + s.dx * scale)
  const y = Math.round(gy)
  if (elite && !dead) {
    const ring = shadowOf((rx + 2) * scale, (ry + 1) * scale, 'rgb(255,190,60)')
    if (ring) {
      const prev = ctx.globalAlpha
      ctx.globalAlpha = prev * (0.3 + 0.2 * Math.sin(t * 4))
      ctx.drawImage(ring, x - (rx + 2) * scale, y - (ry + 1) * scale)
      ctx.globalAlpha = prev
    }
  }
  const shadow = shadowOf(Math.max(2, Math.round(rx * s.sx)) * scale, ry * scale, SHADOW)
  if (shadow) ctx.drawImage(shadow, x - Math.max(2, Math.round(rx * s.sx)) * scale, y - ry * scale)
  const pick = s.flash ? foeFrame(id, t, { walking, dead, variant: 'white' }) : elite && !dead ? foeFrame(id, t, { walking, dead, variant: 'rim' }) : base
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * s.alpha
  ctx.save()
  ctx.translate(x, y)
  ctx.scale((facing > 0 ? -1 : 1) * s.sx * scale, s.sy * scale)
  ctx.drawImage(pick.canvas, pick.minX - 8, pick.minY - 15)
  if (slowed && !s.flash) {
    const frost = foeFrame(id, t, { walking, dead, variant: 'frost' })
    ctx.globalAlpha = prev * s.alpha * 0.45
    ctx.drawImage(frost.canvas, frost.minX - 8, frost.minY - 15)
  }
  ctx.restore()
  ctx.globalAlpha = prev
}
