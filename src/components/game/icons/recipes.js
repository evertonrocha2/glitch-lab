export const N = 16
export const MAT = {
  steel: ['#3b4257', '#7d88a3', '#c3cbe0', '#ffffff'],
  gold: ['#7a4a12', '#c98a1c', '#f2c14e', '#fff1b0'],
  wood: ['#4a2a16', '#7a4b2a', '#a8703f', '#d79b62'],
  leather: ['#3f2418', '#6e4026', '#9a6038', '#c48654'],
  red: ['#5c0f1c', '#b3243a', '#ff5a6e', '#ffc2c9'],
  blue: ['#10265e', '#1f55c8', '#4fa3ff', '#cfe6ff'],
  purple: ['#2a1066', '#5a2fd9', '#a98bff', '#e7dcff'],
  green: ['#0f4a2a', '#1f8a4c', '#5fd38a', '#d2ffe3'],
  teal: ['#0b3b3a', '#16807a', '#4fd1c5', '#c4fff1'],
  bone: ['#5b5346', '#a59a86', '#e8e0cc', '#ffffff'],
  glass: ['#3a4a66', '#8fa6c8', '#d6e4f5', '#ffffff'],
  paper: ['#7a6a4a', '#c9b78f', '#efe3c2', '#fffaf0'],
  dark: ['#120c22', '#2a2440', '#4a4266', '#7a72a0'],
  fire: ['#7a1e00', '#e0521a', '#ffb02e', '#fff3b0'],
}
export const FLAT = { ink: '#120c22', shine: '#ffffff', glow: '#7fffe9' }
export const grid = () => Array.from({ length: N }, () => Array(N).fill(null))
const set = (g, x, y, m) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = m }
const rect = (g, x, y, w, h, m) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, m) }
export const each = (fn) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fn(x, y) }
const circ = (g, cx, cy, r, m, ry = r) => each((x, y) => { const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) g[y][x] = m })
const ring = (g, cx, cy, r, w, m) => each((x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r && d >= r - w) g[y][x] = m })
const line = (g, x0, y0, x1, y1, m, t = 1) => {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) || 1
  const o = Math.floor((t - 1) / 2)
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n)
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) set(g, x + a - o, y + b - o, m)
  }
}
const poly = (g, pts, m) => each((x, y) => {
  const px = x + 0.5, py = y + 0.5
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  if (inside) g[y][x] = m
})
const clear = (g, x, y, w, h) => rect(g, x, y, w, h, null)

const ICONS = {
  sword: (g) => { line(g, 5, 10, 13, 2, 'steel', 2); set(g, 14, 1, 'steel'); line(g, 2, 8, 7, 13, 'gold', 2); line(g, 2, 13, 4, 11, 'wood', 2); circ(g, 1.5, 14.5, 1.4, 'red') },
  shield: (g) => { poly(g, [[2, 1], [14, 1], [14, 8], [8, 15], [2, 8]], 'blue'); line(g, 8, 2, 8, 13, 'gold'); line(g, 3, 6, 13, 6, 'gold'); circ(g, 8, 6, 1.6, 'gold') },
  staff: (g) => { line(g, 2, 14, 10, 6, 'wood', 2); circ(g, 11.5, 4.5, 3, 'purple'); set(g, 10, 3, 'shine') },
  ring: (g) => { ring(g, 8, 10.5, 5, 1.8, 'gold'); poly(g, [[8, 1], [11, 4], [8, 7], [5, 4]], 'teal') },
  boot: (g) => { rect(g, 4, 1, 6, 10, 'leather'); rect(g, 4, 9, 10, 4, 'leather'); rect(g, 3, 13, 12, 2, 'dark'); rect(g, 4, 1, 6, 2, 'wood'); rect(g, 6, 6, 3, 1, 'gold') },
  helm: (g) => { circ(g, 8, 8.5, 6.5, 'steel'); clear(g, 0, 12, 16, 4); rect(g, 2, 9, 3, 5, 'steel'); rect(g, 11, 9, 3, 5, 'steel'); rect(g, 4, 8, 8, 1, 'ink'); rect(g, 7, 8, 2, 4, 'steel'); line(g, 8, 0, 8, 2, 'red', 2) },
  armor: (g) => { poly(g, [[1, 3], [5, 1], [8, 3], [11, 1], [15, 3], [13, 8], [12.5, 15], [3.5, 15], [3, 8]], 'steel'); rect(g, 4, 11, 9, 1, 'leather'); line(g, 8, 4, 8, 10, 'gold'); set(g, 8, 11, 'gold') },
  amulet: (g) => { line(g, 2, 0, 8, 6, 'gold'); line(g, 14, 0, 8, 6, 'gold'); poly(g, [[8, 5], [13, 10], [8, 15], [3, 10]], 'purple'); set(g, 7, 8, 'shine') },
  hppot: (g) => { circ(g, 8, 10.5, 5, 'glass'); each((x, y) => { if (y >= 9 && g[y][x] === 'glass') g[y][x] = 'red' }); rect(g, 6, 3, 4, 4, 'glass'); rect(g, 6, 1, 4, 2, 'wood'); set(g, 6, 8, 'shine') },
  mppot: (g) => { circ(g, 8, 10.5, 5, 'glass'); each((x, y) => { if (y >= 9 && g[y][x] === 'glass') g[y][x] = 'blue' }); rect(g, 6, 3, 4, 4, 'glass'); rect(g, 6, 1, 4, 2, 'wood'); set(g, 6, 8, 'shine') },
  gem: (g) => { poly(g, [[5, 1], [11, 1], [15, 6], [8, 15], [1, 6]], 'teal'); line(g, 2, 6, 14, 6, 'teal'); set(g, 5, 3, 'shine'); set(g, 4, 4, 'shine') },
  coins: (g) => { circ(g, 6, 11, 4.5, 'gold', 3); circ(g, 10, 7.5, 5, 'gold'); ring(g, 10, 7.5, 3.3, 1, 'wood'); set(g, 8, 5, 'shine') },
  chest: (g) => { rect(g, 1, 7, 14, 7, 'wood'); circ(g, 8, 7, 7, 'wood', 4); clear(g, 0, 7, 16, 0); rect(g, 1, 7, 14, 1, 'gold'); rect(g, 3, 3, 1, 11, 'steel'); rect(g, 12, 3, 1, 11, 'steel'); rect(g, 7, 6, 2, 3, 'gold') },
  scroll: (g) => { rect(g, 4, 3, 8, 10, 'paper'); rect(g, 2, 1, 12, 2, 'wood'); rect(g, 2, 13, 12, 2, 'wood'); for (const y of [5, 7, 9, 11]) for (let x = 5; x < 11; x++) if ((x + y) % 4) set(g, x, y, 'ink') },
  book: (g) => { rect(g, 3, 1, 10, 12, 'purple'); rect(g, 4, 12, 10, 3, 'paper'); rect(g, 3, 1, 2, 14, 'dark'); circ(g, 9, 6, 2.5, 'gold'); set(g, 9, 6, 'glow') },
  keyboard: (g) => { rect(g, 0, 4, 16, 9, 'dark'); for (const y of [6, 8]) for (let x = 2; x < 14; x += 2) set(g, x, y, y === 6 ? 'purple' : 'teal'); rect(g, 4, 10, 8, 1, 'glow'); set(g, 13, 10, 'red') },
  bug: (g) => { for (const [a, b, c, d] of [[5, 7, 1, 5], [5, 10, 1, 10], [5, 12, 1, 15], [11, 7, 15, 5], [11, 10, 15, 10], [11, 12, 15, 15]]) line(g, a, b, c, d, 'dark'); circ(g, 8, 9.5, 4.2, 'green', 5); circ(g, 8, 3.5, 2.4, 'green'); line(g, 7, 2, 5, 0, 'dark'); line(g, 9, 2, 11, 0, 'dark'); line(g, 8, 6, 8, 14, 'ink'); set(g, 7, 3, 'red'); set(g, 9, 3, 'red') },
  flame: (g) => { poly(g, [[8, 0], [12, 5], [14, 10], [11.5, 15], [4.5, 15], [2, 10], [4, 6], [6, 8]], 'fire'); poly(g, [[8, 6], [10.5, 10], [10, 14], [6, 14], [5.5, 10.5]], 'gold'); set(g, 8, 12, 'shine') },
  bolt: (g) => { poly(g, [[10, 0], [3, 9], [7.5, 9], [5, 16], [13, 6], [8.5, 6], [12, 0]], 'gold') },
  barrier: (g) => { circ(g, 8, 8, 7.5, 'teal'); circ(g, 8, 8, 5, 'glass'); poly(g, [[8, 4], [11, 6], [11, 10], [8, 12], [5, 10], [5, 6]], 'teal'); set(g, 4, 4, 'shine') },
  skull: (g) => { circ(g, 8, 9, 5.5, 'bone'); rect(g, 5, 12, 6, 3, 'bone'); poly(g, [[2.5, 5], [2.5, 0.5], [5, 2.5], [8, 0], [11, 2.5], [13.5, 0.5], [13.5, 5]], 'gold'); rect(g, 5, 8, 2, 2, 'ink'); rect(g, 9, 8, 2, 2, 'ink'); set(g, 8, 11, 'ink'); set(g, 6, 14, 'ink'); set(g, 8, 14, 'ink'); set(g, 10, 14, 'ink'); set(g, 5, 2, 'red'); set(g, 11, 2, 'red') },
  clock: (g) => { circ(g, 8, 8, 7.5, 'gold'); circ(g, 8, 8, 5.5, 'paper'); line(g, 8, 8, 8, 4, 'ink'); line(g, 8, 8, 11, 8, 'ink'); set(g, 8, 3, 'red') },
  xp: (g) => { poly(g, [[8, 0], [13, 5], [10.5, 16], [5.5, 16], [3, 5]], 'purple'); line(g, 8, 1, 8, 15, 'purple'); set(g, 6, 4, 'shine'); set(g, 6, 5, 'shine') },
  heart: (g) => { circ(g, 5, 6, 3.6, 'red'); circ(g, 11, 6, 3.6, 'red'); poly(g, [[1.5, 7], [14.5, 7], [8, 14.5]], 'red'); set(g, 4, 4, 'shine') },
  target: (g) => { circ(g, 8, 8, 7.5, 'paper'); ring(g, 8, 8, 7.5, 1.6, 'red'); ring(g, 8, 8, 4.5, 1.6, 'red'); circ(g, 8, 8, 1.6, 'red') },
  feather: (g) => { poly(g, [[13, 1], [15, 3], [7, 12], [4, 12], [4, 9]], 'bone'); line(g, 2, 14, 13, 2, 'leather') },
  poison: (g) => { poly(g, [[8, 0], [12.5, 8], [8, 15], [3.5, 8]], 'green'); circ(g, 8, 10, 4.5, 'green'); set(g, 6, 8, 'shine'); set(g, 9, 11, 'ink'); set(g, 7, 11, 'ink') },
  bag: (g) => { circ(g, 8, 10.5, 5.5, 'leather'); rect(g, 6, 2, 4, 4, 'leather'); line(g, 4, 5, 12, 5, 'gold'); circ(g, 8, 11, 1.6, 'gold') },
  hammer: (g) => { line(g, 4, 15, 9, 6, 'wood', 2); poly(g, [[5, 1], [13, 4], [11, 9], [3, 6]], 'steel') },
  map: (g) => { poly(g, [[1, 3], [6, 1], [10, 3], [15, 1], [15, 13], [10, 15], [6, 13], [1, 15]], 'paper'); for (let i = 0; i < 6; i++) set(g, 3 + i, 11 - i % 2 * 2 - i, 'ink'); line(g, 10, 4, 13, 7, 'red'); line(g, 13, 4, 10, 7, 'red') },
  tree: (g) => { rect(g, 7, 9, 2, 6, 'wood'); rect(g, 4, 14, 8, 1, 'wood'); circ(g, 8, 6, 5.5, 'green'); circ(g, 4.5, 8.5, 3, 'green'); circ(g, 11.5, 8.5, 3, 'green'); set(g, 6, 4, 'gold'); set(g, 10, 7, 'gold'); set(g, 5, 9, 'gold') },
  snow: (g) => { line(g, 8, 0, 8, 15, 'glass', 2); line(g, 1, 4, 14, 11, 'glass', 2); line(g, 1, 11, 14, 4, 'glass', 2); circ(g, 8, 8, 2, 'blue'); set(g, 8, 1, 'shine'); set(g, 2, 5, 'shine') },
  scrap: (g) => { poly(g, [[1, 9], [5, 4], [9, 7], [8, 13], [2, 14]], 'steel'); poly(g, [[8, 3], [13, 2], [14, 8], [10, 9]], 'leather'); rect(g, 9, 11, 5, 3, 'dark'); set(g, 4, 7, 'shine') },
  key: (g) => { ring(g, 4.5, 4.5, 3.6, 1.8, 'gold'); line(g, 7, 7, 14, 14, 'gold', 2); rect(g, 11, 12, 3, 1, 'gold'); rect(g, 13, 10, 1, 3, 'gold'); set(g, 3, 2, 'shine') },
  honor: (g) => { poly(g, [[3, 0], [7, 0], [9, 6], [5, 6]], 'red'); poly(g, [[9, 0], [13, 0], [11, 6], [7, 6]], 'blue'); circ(g, 8, 10.5, 4.5, 'gold'); circ(g, 8, 10.5, 2.4, 'purple'); set(g, 6, 8, 'shine') },
  fragment: (g) => { poly(g, [[8, 0], [13, 6], [10, 15], [4, 11], [3, 5]], 'purple'); line(g, 8, 1, 7, 14, 'purple'); set(g, 6, 4, 'shine'); set(g, 6, 5, 'shine'); set(g, 9, 9, 'glow') },
}

export const RECIPE_NAMES = Object.keys(ICONS)

// gold reuses the coins drawing
const ALIASES = { gold: 'coins' }
RECIPE_NAMES.push(...Object.keys(ALIASES))

// Pure: a 16x16 grid of material keys (or null).
export function iconGrid(name) {
  const recipe = ICONS[ALIASES[name] ?? name]
  if (!recipe) throw new Error(`Unknown icon: ${name}`)
  const g = grid()
  recipe(g)
  return g
}
