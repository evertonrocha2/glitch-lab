import { BY_R, RANK } from './palette.js'

// Body and gear parts. Local coordinates, body box 0..31. Each gear part takes `{ b, r }` (base id,
// rarity) already checked by draw-hero, so the branches here only cover the bases they know.

export function cape(d, r) {
  d.part = 'cape'
  d.poly([[11, 17], [21, 17], [25.5, 30], [22, 31.5], [18, 30.5], [14, 31.5], [10, 30.5], [6.5, 31.5]], `cloth.${r}`)
  d.part = 'capetrim'
  for (let x = 7; x <= 25; x++) {
    const y = 30 + (x % 4 < 2 ? 1 : 0)
    if (d.get(x, y - 1)) d.set(x, y, `trim.${r}`)
  }
}

// Legs and feet. `stance` spreads the feet while swinging.
export function legs(d, gear, stance = 0) {
  d.part = 'legs'
  d.rect(12 - stance, 25, 3, 5, 'pants')
  d.rect(17 + stance, 25, 3, 5, 'pants')
  const b = gear.boots
  if (!b) {
    d.part = 'shoeL'
    d.rect(12 - stance, 30, 4, 2, 'shoe')
    d.part = 'shoeR'
    d.rect(17 + stance, 30, 4, 2, 'shoe')
    return
  }
  const r = b.r
  const R = RANK[r]
  for (const [side, x0] of [['L', 11 - stance], ['R', 17 + stance]]) {
    if (b.b === 'botas') {
      const M = R >= 3 ? `metal.${r}` : 'leather'
      d.part = `boot${side}`
      d.rect(x0, 27, 4, 3, M)
      d.rect(x0, 30, 5, 2, M)
      d.part = `cuff${side}`
      d.rect(x0, 27, 4, 1, `trim.${r}`)
      if (R >= 2) {
        d.part = `toe${side}`
        d.rect(x0 + 3, 30, 2, 2, R >= 3 ? `trim.${r}` : `metal.${r}`)
      }
      if (R >= 3) {
        d.part = `knee${side}`
        d.rect(x0, 25, 4, 2, `metal.${r}`)
        d.set(x0 + 1, 25, `trim.${r}`)
      }
    } else {
      d.part = `sneak${side}`
      d.rect(x0, 29, 5, 2, 'white')
      d.part = `sole${side}`
      d.rect(x0, 31, 5, 1, 'dark')
      d.part = `stripe${side}`
      d.rect(x0 + 1, 30, 3, 1, `trim.${r}`)
      d.part = `sneak${side}`
      d.set(x0 + 3, 29, 'white', { t: 0 })
      if (R >= 2) {
        d.part = `wing${side}`
        d.poly([[x0 + 0.5, 29], [x0 - 2.5, 26.5], [x0 - 2, 28.5], [x0 - 3, 29.5], [x0 + 0.5, 30.5]], 'white')
      }
      if (R >= 4) {
        d.fxp(x0 - 4, 30, '#ffc04a', 0.8)
        d.fxp(x0 - 6, 31, '#ff9a1f', 0.5)
        d.fxp(x0 - 5, 29, '#fff1b0', 0.6)
      }
    }
  }
}

// The base outfit: a tunic in the look's color with a belt.
export function tunic(d) {
  d.part = 'torso'
  d.rect(12, 17, 8, 1, 'cloth')
  d.rect(11, 18, 10, 5, 'cloth')
  d.rect(11, 24, 10, 1, 'cloth')
  d.rect(10, 25, 12, 1, 'cloth')
  d.part = 'belt'
  d.rect(11, 23, 10, 1, 'leather')
  d.set(15, 23, 'gold')
  d.set(16, 23, 'gold')
  d.part = 'torso'
  d.shade(14, 24, 0)
  d.shade(18, 24, 0)
  d.shade(16, 25, 0)
}

export function chest(d, it) {
  const r = it.r
  const R = RANK[r]
  if (it.b === 'armadura') {
    const M = R === 0 ? 'leather' : `metal.${r}`
    d.part = 'plate'
    d.rect(11, 18, 10, 5, M)
    d.rect(12, 17, 8, 1, M)
    d.part = 'platetrim'
    d.rect(11, 23, 10, 1, `trim.${r}`)
    d.rect(13, 17, 6, 1, `trim.${r}`)
    d.part = 'plate'
    for (let y = 19; y <= 22; y++) d.shade(16, y, 3)
    for (let y = 19; y <= 22; y++) d.shade(17, y, 0)
    if (R === 0) for (const [x, y] of [[12, 19], [19, 19], [12, 21], [19, 21]]) d.paint(x, y, '#b4b8c4')
    if (R >= 3) {
      d.part = 'tasset'
      d.rect(11, 24, 4, 2, M)
      d.rect(17, 24, 4, 2, M)
      d.part = 'tassettrim'
      d.rect(11, 25, 4, 1, `trim.${r}`)
      d.rect(17, 25, 4, 1, `trim.${r}`)
      d.part = 'chestgem'
      d.rect(15, 19, 2, 2, `gem.${r}`)
    }
  }
  if (it.b === 'colete-de-dev') {
    d.part = 'vest'
    d.rect(11, 18, 10, 6, 'hoodie')
    d.rect(12, 17, 2, 1, 'hoodie')
    d.rect(18, 17, 2, 1, 'hoodie')
    for (const y of [20, 22]) for (let x = 11; x <= 20; x++) d.shade(x, y, 0)
    for (let y = 18; y <= 23; y++) d.paint(16, y, '#9a9eac')
    d.paint(16, 18, '#e3e5ec')
    d.part = 'vesttrim'
    d.rect(11, 24, 10, 1, `trim.${r}`)
    d.part = 'vest'
    d.paint(13, 19, BY_R.trim[r][2])
    d.paint(14, 19, BY_R.trim[r][1])
    d.paint(14, 18, '#eceef4')
    d.paint(18, 18, '#eceef4')
    if (R >= 4) {
      d.fxp(13, 19, '#fff1b0')
      d.fxp(12, 18, '#ffc04a', 0.6)
    }
  }
}

// Shoulder plates come with armor from rare up; spiked at epic, bigger at legendary.
export function pauldrons(d, it) {
  if (it?.b !== 'armadura' || RANK[it.r] < 2) return
  const r = it.r
  const R = RANK[r]
  const M = `metal.${r}`
  const big = R >= 4 ? 0.5 : 0
  d.part = 'pauld'
  d.circ(10.5, 18.6, 2.8 + big, 2.4 + big, M, (_x, y) => y <= 20)
  d.part = 'pauldR'
  d.circ(21.6, 18.6, 2.8 + big, 2.4 + big, M, (_x, y) => y <= 20)
  d.part = 'paulTrim'
  d.rect(8, 20, 5, 1, `trim.${r}`)
  d.rect(19, 20, 5, 1, `trim.${r}`)
  if (R === 3) {
    d.part = 'spike'
    d.poly([[8, 17], [5.5, 14], [10, 16]], 'bone')
    d.poly([[23, 16], [26.5, 13.5], [24, 17.5]], 'bone')
  }
}

// A gold chain with a gem pendant (amuleto) or a paper log tag (colar-de-logs).
export function amulet(d, it) {
  if (!it) return
  d.part = 'chain'
  for (const [x, y] of [[13, 18], [14, 19], [18, 19], [19, 18]]) d.set(x, y, 'chain', { c: '#c98a1c' })
  if (it.b === 'amuleto') {
    d.part = 'pend'
    d.rect(15, 19, 3, 2, `gem.${it.r}`, (x, y) => !(y === 20 && x !== 16))
    d.rect(16, 20, 1, 1, `gem.${it.r}`)
  } else {
    d.part = 'tag'
    d.rect(15, 19, 3, 3, 'paper')
    d.paint(15, 20, '#4a4266')
    d.paint(16, 20, '#4a4266')
    d.paint(15, 21, BY_R.trim[it.r][1])
    d.paint(16, 21, BY_R.trim[it.r][1])
  }
}

// An arm from the shoulder (sx, sy) toward the hand (hx, hy); the sleeve stops short of the hand.
export function arm(d, sx, sy, hx, hy, side) {
  d.part = `arm${side}`
  const mx = sx + (hx - sx) * 0.6
  const my = sy + (hy - sy) * 0.6
  d.line(sx - 0.5, sy - 0.5, mx - 0.5, my - 0.5, 'cloth', 2)
}

export function hand(d, hx, hy, side) {
  d.part = `hand${side}`
  d.rect(hx - 1, hy - 1, 2, 2, 'skin')
}

// A weapon held at (hx, hy), pointing along angle a (radians, 0 = right, negative = up).
export function weapon(d, it, hx, hy, a) {
  const r = it.r
  const R = RANK[r]
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const nx = -uy
  const ny = ux
  // s along the weapon, t across it.
  const p = (s, t = 0) => [hx - 0.5 + ux * s + nx * t, hy - 0.5 + uy * s + ny * t]
  if (it.b === 'espada') {
    const len = [10, 11, 11, 12, 14][R]
    d.part = 'grip'
    d.line(...p(-2), ...p(1), 'leather', 1)
    d.part = 'pommel'
    d.set(...p(-3).map(Math.round), R >= 3 ? `gem.${r}` : `trim.${r}`)
    d.part = 'blade'
    d.line(...p(3, -0.6), ...p(len, -0.6), `blade.${r}`, 1, { t: 3 })
    d.line(...p(3, 0.5), ...p(len - 1, 0.5), `blade.${r}`, 1, { t: 1 })
    if (R >= 3) d.line(...p(3, 1.5), ...p(len - 3, 1.5), `blade.${r}`, 1, { t: 0 })
    d.line(...p(len, 0), ...p(len + 1, 0), `blade.${r}`, 1, { t: 2 })
    d.part = 'guard'
    const gw = R >= 3 ? 3.5 : 2.5
    d.line(...p(2, -gw), ...p(2, gw), `trim.${r}`, 1)
    if (R >= 2) d.set(...p(2).map(Math.round), `gem.${r}`)
    if (R >= 4) {
      const [x, y] = p(len + 2)
      d.fxp(x, y, '#ffffff')
      d.fxp(x + 1, y, '#ffc04a', 0.8)
      d.fxp(x - 1, y, '#ffc04a', 0.8)
      d.fxp(x, y - 1, '#ffc04a', 0.8)
      d.fxp(x, y + 1, '#ffc04a', 0.8)
    }
  }
  if (it.b === 'cajado') {
    d.part = 'shaft'
    d.line(...p(-7), ...p(11), 'wood', 1)
    d.part = 'wrap'
    d.line(...p(-1), ...p(1), `cloth.${r}`, 1)
    const [ox, oy] = p(13.5)
    const rad = [1.8, 2, 2.2, 2.4, 2.8][R]
    d.part = 'prong'
    d.line(...p(11, -2.2), ...p(14.5, -2.6), `trim.${r}`, 1)
    d.line(...p(11, 2.2), ...p(14.5, 2.6), `trim.${r}`, 1)
    d.part = 'orb'
    d.circ(ox, oy, rad, rad, `gem.${r}`)
    d.shade(Math.round(ox - 1), Math.round(oy - 1), 3)
    if (R >= 3) {
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2
        d.fxp(ox + Math.cos(t) * (rad + 2.5), oy + Math.sin(t) * (rad + 2.5), BY_R.gem[r][3], i % 2 ? 0.9 : 0.45)
      }
    }
  }
  if (it.b === 'martelo') {
    d.part = 'shaft'
    d.line(...p(-3), ...p(9), 'wood', 1)
    d.part = 'wrap'
    d.line(...p(-2), ...p(1), 'leather', 1)
    const w = R >= 3 ? 5 : 4
    d.part = 'head'
    d.poly([p(8, -w), p(14, -w), p(14, w), p(8, w)], `metal.${r}`)
    d.part = 'band'
    d.line(...p(11, -w + 0.5), ...p(11, w - 0.5), `trim.${r}`, 1)
    if (R >= 3) {
      d.part = 'spikeH'
      d.line(...p(13.5), ...p(15), 'bone', 1)
    }
  }
}

// The offhand, held by the back hand at (hx, hy).
export function offhand(d, it, hx, hy) {
  const r = it.r
  const R = RANK[r]
  if (it.b === 'escudo') {
    const T = `trim.${r}`
    const F = R === 0 ? 'wood' : R >= 3 ? `metal.${r}` : `cloth.${r}`
    const cx = hx - 0.5
    d.part = 'shieldrim'
    d.poly([[cx - 4.6, hy - 6], [cx + 4.6, hy - 6], [cx + 4.6, hy - 1], [cx, hy + 4.5], [cx - 4.6, hy - 1]], T)
    d.part = 'shield'
    d.poly([[cx - 3.6, hy - 5], [cx + 3.6, hy - 5], [cx + 3.6, hy - 1.2], [cx, hy + 3.2], [cx - 3.6, hy - 1.2]], F)
    if (R === 0) for (let y = hy - 5; y <= hy + 2; y++) d.shade(Math.round(cx), y, 0)
    if (R >= 1 && R <= 2) {
      d.part = 'emblem'
      d.rect(Math.round(cx), hy - 5, 1, 7, T)
      d.rect(Math.round(cx) - 3, hy - 3, 7, 1, T)
    }
    if (R >= 3) {
      d.part = 'boss'
      d.circ(cx + 0.5, hy - 2, 1.6, 1.6, `gem.${r}`)
    }
    if (R >= 4) for (const [x, y] of [[-2, -4], [2, -4], [-2, 0], [2, 0]]) d.paint(Math.round(cx) + x, hy + y, '#fff1b0')
  }
  if (it.b === 'livro-de-regras') {
    const x0 = hx - 5
    const y0 = hy - 5
    d.part = 'bookpages'
    d.rect(x0 + 1, y0 + 1, 6, 7, 'paper')
    d.part = 'book'
    d.rect(x0, y0, 6, 7, `cloth.${r}`)
    d.part = 'bookspine'
    d.rect(x0, y0, 1, 7, 'dark')
    d.part = 'book'
    for (const [x, y] of [[x0 + 5, y0], [x0 + 5, y0 + 6]]) d.paint(x, y, BY_R.trim[r][2])
    // A glowing { } on the cover.
    const glow = R >= 3 ? '#7fffe9' : '#f2c14e'
    for (const [x, y] of [[2, 2], [2, 4], [1, 3], [4, 2], [4, 4], [5, 3]]) d.paint(x0 + x, y0 + y, glow)
    d.paint(x0 + 3, y0 + 3, BY_R.trim[r][2])
    if (R >= 2) {
      d.fxp(x0 + 3, y0 - 2, glow, 0.7)
      d.fxp(x0 + 1, y0 - 3, glow, 0.4)
      d.fxp(x0 + 5, y0 - 3, glow, 0.5)
    }
  }
}

// The relic floats beside the hero, left of the body, bobbing with the idle frames.
export function relic(d, it, bob) {
  const r = it.r
  d.dx = 0
  const y0 = 3 + bob
  if (it.b === 'teclado-runico') {
    d.part = 'kbd'
    d.rect(-8, y0, 9, 4, 'dark')
    d.part = 'kbdtop'
    d.rect(-8, y0, 9, 1, 'dark', null, { t: 3 })
    const keys = BY_R.trim[r]
    for (let x = -7; x <= 0; x += 2) d.paint(x, y0 + 1, keys[2])
    for (let x = -6; x <= -1; x += 2) d.paint(x, y0 + 2, keys[1])
    d.part = 'kbd'
    for (let x = -6; x <= -2; x++) d.paint(x, y0 + 3, '#7fffe9')
  } else {
    d.part = 'scroll'
    d.rect(-6, y0 + 1, 5, 5, 'paper')
    d.part = 'roll'
    d.rect(-7, y0, 7, 1, 'wood')
    d.rect(-7, y0 + 6, 7, 1, 'wood')
    d.part = 'scroll'
    for (const y of [y0 + 2, y0 + 4]) for (let x = -5; x <= -2; x++) if ((x + y) % 3) d.paint(x, y, '#4a4266')
    d.part = 'seal'
    d.set(-2, y0 + 5, `gem.${r}`)
  }
  const g = BY_R.trim[r]
  d.fxp(-4, y0 + 8 - bob, g[2], 0.7)
  d.fxp(-3, y0 + 10 - bob, g[1], 0.45)
  d.fxp(-5, y0 + 11 - bob, g[2], 0.3)
}

export function sparkle(d, x, y, big) {
  d.fxp(x, y, '#ffffff')
  for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) d.fxp(x + i, y + j, '#ffc04a', 0.9)
  if (big) for (const [i, j] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) d.fxp(x + i, y + j, '#ff9a1f', 0.5)
}

// The swing arc, in the weapon's rarity colors, from angle a0 to a1 around the shoulder.
export function slash(d, frac, r, a0, a1, alpha) {
  const cx = 18
  const cy = 18
  const R = 15
  const T = r === 'legendary' ? ['#fff3b0', '#ffc04a', '#ff9a1f'] : ['#ffffff', BY_R.trim[r][3], BY_R.trim[r][2]]
  for (let y = -2; y <= 36; y++) {
    for (let x = 14; x <= 40; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const rr = Math.hypot(dx, dy)
      const an = Math.atan2(dy, dx)
      if (an < a0 || an > a1) continue
      const k = (an - a0) / (a1 - a0)
      const w = 3.6 * Math.sin(Math.PI * Math.min(1, k * frac)) ** 0.8 * (0.35 + 0.65 * k)
      if (rr > R || rr < R - w) continue
      const depth = R - rr
      const col = depth < 1 ? T[0] : depth < 2 ? T[1] : T[2]
      d.fxp(x - d.dx, y - d.dy, col, alpha * (depth < 2 ? 1 : 0.75))
    }
  }
}
