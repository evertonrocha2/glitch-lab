// The pack fight's visual effects, one drawing per kind (pack.js says which events make which), in
// the scene's pixel style: fillRect only, no gradients, nothing allocated per pixel.
// Each skill has its own color and shape so a player tells them apart at a glance:
//   golpe: a steel arc sweeping around the hero. raio: jagged yellow bolts jumping target to target,
//   forking, a star flash on each. chama: a fireball lobbed onto the pack, a blast ring, a burning
//   patch. veneno: a green glob flying through the line, bubbles behind it. nevasca: snow falling in a
//   frost ring. barreira: a shield bubble. cura: green sparkles rising. furia: a red flame aura.
// Reduced motion: every flash is drawn once at its full shape, still, for the first part of its
// time (no sweeps, no travel, no flicker); lingering effects stay still.
//
// drawFx(ctx, fx, ms, env): fx from pack.js ({ kind, at, ms, ... }), ms: the fight's clock.
// env: { hero: { x, y } ground px of the hero, foe(i, out) -> out { x, y } ground px or null,
//   spot(at, out) -> out { x, y } ground px of a hero relative tile offset, t (s), reduced, colors(i) }.
import { hash } from './pixels.js'

const TS = 16
const BODY = 14 // px from the ground point up to the middle of a body

const rect = (ctx, x, y, w, h, c) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

// A 1px-ish line, pixel by pixel. size: square size.
function line(ctx, x0, y0, x1, y1, c, size = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  ctx.fillStyle = c
  const half = (size - 1) / 2
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n - half), Math.round(y0 + ((y1 - y0) * i) / n - half), size, size)
}

// Points on a ground ellipse (y squashed) from angle a0 to a1, every ~1.5px. fade(k 0..1 along).
function arc(ctx, cx, cy, r, a0, a1, c, size = 1, squash = 0.55) {
  const steps = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / 1.5))
  ctx.fillStyle = c
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    ctx.fillRect(Math.round(cx + Math.cos(a) * r - size / 2), Math.round(cy + Math.sin(a) * r * squash - size / 2), size, size)
  }
}

function withAlpha(ctx, a, paint) {
  if (a <= 0) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * Math.min(1, a)
  paint()
  ctx.globalAlpha = prev
}

// A 4 point star.
function star(ctx, x, y, r, c, core = '#ffffff') {
  rect(ctx, x - r, y, r * 2 + 1, 1, c)
  rect(ctx, x, y - r, 1, r * 2 + 1, c)
  rect(ctx, x - 1, y - 1, 3, 3, core)
}

// A jagged bolt between two points: segments shifted sideways by hash noise. seed changes the shape.
function bolt(ctx, x0, y0, x1, y1, seed, glow, core) {
  const segs = 6
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  let px = x0
  let py = y0
  for (let i = 1; i <= segs; i++) {
    const k = i / segs
    const off = i === segs ? 0 : (hash(i, seed, 7) - 0.5) * Math.min(14, len * 0.35)
    const x = x0 + dx * k + nx * off
    const y = y0 + dy * k + ny * off
    line(ctx, px, py, x, y, glow, 5)
    line(ctx, px, py, x, y, core, 2)
    // A fork off the middle joints.
    if (i === 2 || i === 4) {
      const fl = 5 + hash(i, seed, 9) * 6
      const side = hash(i, seed, 11) > 0.5 ? 1 : -1
      line(ctx, x, y, x + (dx / len) * fl * 0.6 + nx * fl * side, y + (dy / len) * fl * 0.6 + ny * fl * side, core, 1)
    }
    px = x
    py = y
  }
}

const DIAGONALS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]
const tmpA = { x: 0, y: 0 }
const tmpB = { x: 0, y: 0 }
const fade = (p, from = 0.6) => (p < from ? 1 : Math.max(0, 1 - (p - from) / (1 - from)))
const ELEMENT = { physical: '#f3efe0', fire: '#ff8a3d', ice: '#7fd8ff', lightning: '#ffe45e', poison: '#8bdc5a' }

// How far into its life an effect is (0..1), or null when it is not showing at ms. Reduced motion
// shows a flash for its first 40% only (lingering kinds keep their whole life).
const LINGER = new Set(['fireball', 'bubble', 'fury', 'levelUp'])
export function fxProgress(fx, ms, reduced) {
  const p = (ms - fx.at) / fx.ms
  if (p < 0 || p >= 1) return null
  if (reduced && !LINGER.has(fx.kind) && p >= 0.4) return null
  return p
}

const PAINT = {
  slash(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    const cx = at.x
    const cy = at.y - BODY
    const r = fx.crit ? 18 : 13
    // A crescent cut from top right to bottom left, whole by a third of its life, then fading.
    const head = env.reduced ? 1 : Math.min(1, p * 3)
    const a0 = -1.1
    const a1 = a0 + 2.9 * head
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.4), () => {
      arc(ctx, cx - 4, cy - 2, r + 2, a0, a1, fx.crit ? '#c8501a' : '#5a5578', 4, 1)
      arc(ctx, cx - 4, cy - 2, r, a0 + 0.2, a1, fx.crit ? '#ffd23f' : '#ffffff', 3, 1)
      star(ctx, cx - 4 + Math.cos(a1) * r, cy - 2 + Math.sin(a1) * r, fx.crit ? 5 : 3, fx.crit ? '#fff4b0' : '#ffffff')
    })
  },
  critBurst(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    const cx = at.x
    const cy = at.y - BODY
    const d = env.reduced ? 14 : 6 + p * 18
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.35), () => {
      // Gold rays and sparks bursting out of the hit, a ring around them.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.15
        const inner = d * 0.45
        line(ctx, cx + Math.cos(a) * inner, cy + Math.sin(a) * inner, cx + Math.cos(a) * d, cy + Math.sin(a) * d, i % 2 ? '#ffd23f' : '#fff4b0', i % 3 ? 1 : 2)
      }
      arc(ctx, cx, cy, d * 0.8, 0, Math.PI * 2, '#ffae3a', 1, 1)
      star(ctx, cx, cy, 9, '#ffd23f')
    })
  },
  echo(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    // The ring's extra swing: two cyan cuts crossing in an X, a ring of code dots around them.
    const k = env.reduced ? 1 : Math.min(1, p * 3)
    const cx = at.x
    const cy = at.y - BODY
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.45), () => {
      line(ctx, cx - 12, cy - 12, cx - 12 + 24 * k, cy - 12 + 24 * k, '#7fe9ff', 3)
      line(ctx, cx + 12, cy - 12, cx + 12 - 24 * k, cy - 12 + 24 * k, '#c4fbff', 2)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        rect(ctx, cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 2, 2, '#4fd1c5')
      }
    })
  },
  cleave(ctx, fx, p, env) {
    const { x, y } = env.hero
    const r = (fx.radius ?? 1.8) * TS * (env.spread ?? 1)
    const head = env.reduced ? Math.PI * 2 : p * Math.PI * 2.4
    withAlpha(ctx, env.reduced ? 0.9 : fade(p, 0.55), () => {
      // A fading trail behind the blade: three bands, dimmer further back.
      for (let k = 0; k < 3; k++) {
        const from = Math.max(0, head - 1.2 - k * 0.9)
        const to = Math.max(0, head - k * 0.9)
        if (to > from) arc(ctx, x, y - 4, r - k * 3, from - 1.2, to - 1.2, k === 0 ? '#ffffff' : k === 1 ? '#c9d2f0' : '#7d86a8', k === 0 ? 4 : 3)
      }
      if (!env.reduced) {
        const a = head - 1.2
        star(ctx, x + Math.cos(a) * r, y - 4 + Math.sin(a) * r * 0.55, 3, '#e8ecff')
      }
    })
  },
  chain(ctx, fx, p, env) {
    const list = fx.targets?.length ? fx.targets : [fx.target]
    const n = list.length
    const shown = env.reduced ? n : Math.min(n, Math.floor(p * (n + 1.5)) + 1)
    // The bolts jump hand to first target, then target to target. They flicker to new shapes.
    const seed = env.reduced ? 3 : Math.floor((env.ms - fx.at) / 45)
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.55), () => {
      let fromX = env.hero.x + 4
      let fromY = env.hero.y - BODY - 4
      for (let i = 0; i < shown; i++) {
        const at = env.foe(list[i], tmpA)
        if (!at) continue
        const tx = at.x
        const ty = at.y - BODY
        bolt(ctx, fromX, fromY, tx, ty, seed * 13 + i, 'rgba(255,214,40,0.5)', '#fffbe0')
        rect(ctx, tx - 6, ty - 6, 13, 13, 'rgba(255,240,120,0.35)')
        star(ctx, tx, ty, 10, '#ffe45e')
        fromX = tx
        fromY = ty
      }
    })
  },
  fireball(ctx, fx, _p, env) {
    const to = env.spot(fx.spot ?? { x: 2, y: 0 }, tmpB)
    const r = (fx.radius ?? 1.6) * TS * (env.spread ?? 1)
    const life = fx.ms
    const elapsed = env.ms - fx.at
    const flyMs = 260
    const blastMs = 360
    if (!env.reduced && elapsed < flyMs) {
      // The lob: an arc from the hero's hand to the spot.
      const k = elapsed / flyMs
      const x = env.hero.x + (to.x - env.hero.x) * k
      const y = env.hero.y - BODY + (to.y - (env.hero.y - BODY)) * k - Math.sin(k * Math.PI) * 18
      for (let i = 1; i <= 4; i++) {
        const q = Math.max(0, k - i * 0.06)
        const tx = env.hero.x + (to.x - env.hero.x) * q
        const ty = env.hero.y - BODY + (to.y - (env.hero.y - BODY)) * q - Math.sin(q * Math.PI) * 18
        rect(ctx, tx, ty, 2, 2, i < 2 ? '#ff9a1f' : '#c83a1a')
      }
      rect(ctx, x - 2, y - 2, 5, 5, '#ff5a1a')
      rect(ctx, x - 1, y - 1, 3, 3, '#ffd76a')
      return
    }
    const since = elapsed - flyMs
    if (!env.reduced && since < blastMs) {
      const k = since / blastMs
      withAlpha(ctx, 1 - k, () => {
        arc(ctx, to.x, to.y, r * (0.3 + 0.8 * k), 0, Math.PI * 2, '#ffd76a', 2)
        arc(ctx, to.x, to.y, r * (0.2 + 0.6 * k), 0, Math.PI * 2, '#ff5a1a', 2)
      })
    }
    // The burning patch on the ground, for the dot's life.
    const end = 1 - (elapsed / life > 0.85 ? (elapsed / life - 0.85) / 0.15 : 0)
    withAlpha(ctx, env.reduced ? 0.8 : 0.85 * end, () => {
      // A scorched, glowing disc under the flames.
      withAlpha(ctx, 0.28, () => {
        for (let yy = -Math.round(r * 0.55); yy <= Math.round(r * 0.55); yy += 1) {
          const w = Math.round(r * Math.sqrt(Math.max(0, 1 - (yy / (r * 0.55)) ** 2)))
          rect(ctx, to.x - w, to.y + yy, w * 2 + 1, 1, '#ff5a1a')
        }
      })
      arc(ctx, to.x, to.y, r, 0, Math.PI * 2, '#ff8a3d', 1)
      const tick = env.reduced ? 0 : Math.floor(env.ms / 90)
      for (let i = 0; i < 26; i++) {
        const a = hash(i, 5, 31) * Math.PI * 2
        const d = Math.sqrt(hash(i, 5, 37)) * r * 0.95
        const x = to.x + Math.cos(a) * d
        const y = to.y + Math.sin(a) * d * 0.55
        const h = 1 + Math.floor(hash(i, tick, 41) * 4)
        rect(ctx, x, y - h, 1, h, hash(i, tick, 43) > 0.5 ? '#ff8a3d' : '#ffd76a')
        rect(ctx, x, y, 1, 1, '#c8321a')
      }
    })
  },
  venom(ctx, fx, p, env) {
    const end = env.spot(fx.spot ?? { x: 6, y: 0 }, tmpB)
    const sx = env.hero.x + 4
    const sy = env.hero.y - BODY
    const ex = end.x
    const ey = end.y - BODY
    const k = env.reduced ? 1 : Math.min(1, p * 2.2)
    const hx = sx + (ex - sx) * k
    const hy = sy + (ey - sy) * k
    withAlpha(ctx, env.reduced ? 0.9 : fade(p, 0.5), () => {
      // The trail: a green band, then bubbles along it.
      line(ctx, sx, sy, hx, hy, 'rgba(90,200,60,0.45)', 5)
      line(ctx, sx, sy, hx, hy, '#8bdc5a', 1)
      const dist = Math.hypot(hx - sx, hy - sy)
      for (let i = 0; i < 9; i++) {
        const q = hash(i, 3, 51)
        if (q * Math.hypot(ex - sx, ey - sy) > dist) continue
        const rise = env.reduced ? 0 : p * 10 * hash(i, 3, 53)
        const bx = sx + (ex - sx) * q + (hash(i, 3, 57) - 0.5) * 8
        const by = sy + (ey - sy) * q - rise
        rect(ctx, bx - 1, by - 1, 3, 3, '#3f8a2a')
        rect(ctx, bx, by - 1, 1, 1, '#d2ffb8')
      }
      if (!env.reduced && k < 1) {
        rect(ctx, hx - 3, hy - 3, 6, 6, '#2f7a22')
        rect(ctx, hx - 2, hy - 2, 4, 4, '#8bdc5a')
        rect(ctx, hx - 1, hy - 2, 2, 1, '#d2ffb8')
      }
    })
  },
  frost(ctx, fx, p, env) {
    const { x, y } = env.hero
    const r = (fx.radius ?? 3) * TS * (env.spread ?? 1)
    const k = env.reduced ? 1 : Math.min(1, p * 1.6)
    withAlpha(ctx, env.reduced ? 0.9 : fade(p, 0.55), () => {
      arc(ctx, x, y - 2, r * k, 0, Math.PI * 2, 'rgba(127,216,255,0.9)', 2)
      arc(ctx, x, y - 2, r * k * 0.8, 0, Math.PI * 2, 'rgba(200,240,255,0.5)', 1)
      // Snow falling inside the ring.
      for (let i = 0; i < 22; i++) {
        const a = hash(i, 9, 61) * Math.PI * 2
        const d = Math.sqrt(hash(i, 9, 63)) * r * k
        const fall = env.reduced ? 0 : (1 - p) * (18 + hash(i, 9, 65) * 14)
        const fx0 = x + Math.cos(a) * d
        const fy0 = y - 2 + Math.sin(a) * d * 0.55 - fall
        rect(ctx, fx0, fy0, 1, 1, '#ffffff')
        if (i % 3 === 0) {
          rect(ctx, fx0 - 1, fy0, 3, 1, '#c4ecff')
          rect(ctx, fx0, fy0 - 1, 1, 3, '#c4ecff')
        }
      }
    })
  },
  splash(ctx, fx, p, env) {
    const at = env.spot(fx.spot ?? { x: 1.5, y: 0 }, tmpB)
    const r = (fx.radius ?? 1.5) * TS * (env.spread ?? 1)
    const k = env.reduced ? 1 : p
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.4), () => {
      arc(ctx, at.x, at.y, r * (0.4 + 0.6 * k), 0, Math.PI * 2, '#b8e04a', 1)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const d = r * 0.7 * k
        rect(ctx, at.x + Math.cos(a) * d, at.y - 6 + Math.sin(a) * d * 0.55 - Math.sin(k * Math.PI) * 6, 2, 2, '#8bdc5a')
      }
    })
  },
  bubble(ctx, fx, _p, env) {
    const cx = env.hero.x
    const cy = env.hero.y - BODY + 1
    const elapsed = env.ms - fx.at
    const grow = env.reduced ? 1 : Math.min(1, elapsed / 180)
    const r = Math.round(17 * grow)
    const left = fx.ms - elapsed
    const a = left < 250 ? left / 250 : 1
    const shimmer = env.reduced ? 0 : env.t * 2
    withAlpha(ctx, a, () => {
      withAlpha(ctx, 0.16, () => {
        for (let yy = -r; yy <= r; yy += 2) {
          const w = Math.round(Math.sqrt(Math.max(0, r * r - yy * yy)))
          rect(ctx, cx - w, cy + yy, w * 2 + 1, 2, '#9ad7ff')
        }
      })
      arc(ctx, cx, cy, r, 0, Math.PI * 2, '#9ad7ff', 1, 1)
      arc(ctx, cx, cy, r - 3, -2.6, -1.6, '#ffffff', 1, 1)
      for (let i = 0; i < 6; i++) {
        const ang = shimmer + (i / 6) * Math.PI * 2
        rect(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 2, 2, '#e8f8ff')
      }
    })
  },
  mend(ctx, _fx, p, env) {
    const { x, y } = env.hero
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.55), () => {
      // A green glow ring at the feet and fat plus signs rising around the hero.
      arc(ctx, x, y, 14, 0, Math.PI * 2, '#5fe08a', 2)
      arc(ctx, x, y, 10, 0, Math.PI * 2, '#b8ffcf', 1)
      for (let i = 0; i < 10; i++) {
        const ox = (hash(i, 2, 71) - 0.5) * 30
        const rise = env.reduced ? 8 + i * 3 : p * (26 + hash(i, 2, 73) * 16) + hash(i, 2, 75) * 8
        const px0 = Math.round(x + ox)
        const py0 = Math.round(y - 6 - rise)
        const c = i % 3 ? '#5fe08a' : '#e0ffe8'
        const big = i % 2 === 0
        rect(ctx, px0 - (big ? 2 : 1), py0, big ? 5 : 3, big ? 2 : 1, c)
        rect(ctx, px0, py0 - (big ? 2 : 1), big ? 2 : 1, big ? 5 : 3, c)
      }
    })
  },
  fury(ctx, fx, _p, env) {
    const { x, y } = env.hero
    const elapsed = env.ms - fx.at
    const left = fx.ms - elapsed
    const a = left < 300 ? left / 300 : 1
    // The cast: a red ring bursting out; then red flames licking up around the hero while it lasts,
    // and red streaks trailing behind it.
    if (!env.reduced && elapsed < 360) {
      withAlpha(ctx, 1 - elapsed / 360, () => {
        arc(ctx, x, y - 4, 8 + elapsed / 10, 0, Math.PI * 2, '#ff4a3a', 3)
        arc(ctx, x, y - 4, 4 + elapsed / 16, 0, Math.PI * 2, '#ffd0c0', 1)
      })
    }
    const tick = env.reduced ? 0 : Math.floor(env.ms / 70)
    withAlpha(ctx, 0.9 * a, () => {
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2
        const fx0 = x + Math.cos(ang) * 13
        const base = y - 13 + Math.sin(ang) * 16
        const h = 3 + Math.floor(hash(i, tick, 81) * 7)
        rect(ctx, fx0, base - h, 2, h, hash(i, tick, 83) > 0.4 ? '#ff3a2a' : '#ffae5a')
        rect(ctx, fx0, base - h, 1, 1, '#fff0c0')
      }
      withAlpha(ctx, 0.35, () => {
        rect(ctx, x - 16, y - 30, 2, 26, '#ff3a2a')
        rect(ctx, x - 20, y - 26, 2, 18, '#ff3a2a')
      })
    })
  },
  zap(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    const c = ELEMENT[fx.element] ?? '#ffffff'
    const d = env.reduced ? 10 : 4 + p * 10
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.3), () => {
      star(ctx, at.x, at.y - BODY, 8, c)
      for (const [sx, sy] of DIAGONALS) rect(ctx, at.x + sx * d, at.y - BODY + sy * d, 2, 2, c)
    })
  },
  dodge(ctx, _fx, p, env) {
    const { x, y } = env.hero
    withAlpha(ctx, env.reduced ? 0.8 : fade(p, 0.2), () => {
      // Speed lines where the hero was, and dust kicked up at its feet.
      const back = env.reduced ? 0 : p * 8
      for (let i = 0; i < 4; i++) rect(ctx, x - 16 - back - (i % 2) * 3, y - 26 + i * 6, 10 - (i % 2) * 4, 1, '#d9d4ff')
      for (let i = 0; i < 3; i++) rect(ctx, x - 6 - i * 4 - back, y - 1 - (i % 2), 2, 2, 'rgba(220,214,255,0.6)')
    })
  },
  potion(ctx, fx, p, env) {
    const { x, y } = env.hero
    const c = fx.mp ? '#6fa8ff' : '#ff5a6e'
    const dark = fx.mp ? '#2a4a9a' : '#8a1a2a'
    const lift = env.reduced ? 8 : Math.min(1, p * 2.5) * 12
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.6), () => {
      // The bottle over the head, its cork popping off, bubbles of its color rising around the hero.
      const bx = x + 10
      const by = y - 44 - lift
      rect(ctx, bx - 1, by + 3, 9, 9, dark)
      rect(ctx, bx, by + 4, 7, 7, c)
      rect(ctx, bx + 2, by, 3, 4, '#d6d1bd')
      rect(ctx, bx + 1, by + 5, 2, 3, '#ffffff')
      rect(ctx, bx + 2, by - 4 - (env.reduced ? 3 : p * 12), 3, 3, '#8a5a34')
      arc(ctx, x, y, 12, 0, Math.PI * 2, c, 1)
      for (let i = 0; i < 9; i++) rect(ctx, x + (hash(i, 4, 91) - 0.5) * 26, y - 6 - (env.reduced ? 6 + i * 3 : p * (18 + hash(i, 4, 93) * 16)), 3, 3, c)
    })
  },
  impact(ctx, _fx, p, env) {
    const { x, y } = env.hero
    const cy = y - BODY
    const d = env.reduced ? 9 : 5 + p * 7
    withAlpha(ctx, env.reduced ? 1 : 1 - p, () => {
      // A red hit spark on the hero: an X, sparks and a white core.
      line(ctx, x - d, cy - d, x + d, cy + d, '#ff4d4d', 2)
      line(ctx, x - d, cy + d, x + d, cy - d, '#ff4d4d', 2)
      for (const [sx, sy] of DIAGONALS) rect(ctx, x + sx * (d + 3), cy + sy * (d + 3), 2, 2, '#ffb0a0')
      rect(ctx, x - 2, cy - 2, 5, 5, '#ffffff')
    })
  },
  thorns(ctx, fx, p, env) {
    const from = env.foe(fx.src, tmpA)
    const { x, y } = env.hero
    withAlpha(ctx, env.reduced ? 1 : 1 - p, () => {
      if (from) line(ctx, from.x, from.y - BODY, x, y - BODY, '#ffcf4a', 1)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        line(ctx, x, y - BODY, x + Math.cos(a) * 6, y - BODY + Math.sin(a) * 6, '#ff9a1f', 1)
      }
    })
  },
  bossBlast(ctx, fx, p, env) {
    const { x, y } = env.hero
    const c = ELEMENT[fx.element] ?? '#ff6b6b'
    const k = env.reduced ? 1 : p
    withAlpha(ctx, env.reduced ? 0.9 : 1 - p, () => {
      arc(ctx, x, y - 4, 6 + 34 * k, 0, Math.PI * 2, c, 3)
      arc(ctx, x, y - 4, 4 + 22 * k, 0, Math.PI * 2, '#ffffff', 1)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        line(ctx, x + Math.cos(a) * 8, y - BODY + Math.sin(a) * 8, x + Math.cos(a) * (12 + 20 * k), y - BODY + Math.sin(a) * (12 + 20 * k), c, 1)
      }
    })
  },
  roar(ctx, fx, p, env) {
    const at = env.foe(fx.src, tmpA)
    if (!at) return
    withAlpha(ctx, env.reduced ? 0.8 : 1 - p, () => {
      for (let k = 0; k < 3; k++) {
        const r = env.reduced ? 14 + k * 10 : ((p * 60 + k * 14) % 60) + 6
        arc(ctx, at.x, at.y - BODY * 2, r, 0, Math.PI * 2, k % 2 ? '#ffffff' : '#ffb84a', 2, 0.8)
      }
    })
  },
  enrage(ctx, fx, p, env) {
    const at = env.foe(fx.src, tmpA)
    if (!at) return
    withAlpha(ctx, env.reduced ? 0.8 : 1 - p, () => {
      for (let k = 0; k < 2; k++) arc(ctx, at.x, at.y - BODY * 2, (env.reduced ? 20 : p * 50) + k * 8, 0, Math.PI * 2, '#ff2a2a', 2, 0.8)
    })
  },
  spawn(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    const open = env.reduced ? 1 : Math.sin(p * Math.PI)
    withAlpha(ctx, env.reduced ? 0.8 : open, () => {
      // A glitch portal opening on the ground, dust kicked up as the enemy steps out.
      arc(ctx, at.x, at.y, 18 * open + 2, 0, Math.PI * 2, '#9a6cff', 3)
      arc(ctx, at.x, at.y, 12 * open + 1, 0, Math.PI * 2, '#3a1f7a', 3)
      arc(ctx, at.x, at.y, 6 * open, 0, Math.PI * 2, '#ff3fb0', 1)
      for (let i = 0; i < 10; i++) rect(ctx, at.x + (hash(i, 6, 101) - 0.5) * 34, at.y - 2 - (env.reduced ? 6 : p * 18) * hash(i, 6, 103), 3, 3, '#b8a3e6')
    })
  },
  summon(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    withAlpha(ctx, env.reduced ? 0.9 : 1 - p, () => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const d = env.reduced ? 12 : 4 + p * 20
        rect(ctx, at.x + Math.cos(a) * d, at.y - 10 + Math.sin(a) * d * 0.7, 3, 3, i % 2 ? '#5e2384' : '#1a0f2a')
      }
      arc(ctx, at.x, at.y, env.reduced ? 12 : 6 + p * 12, 0, Math.PI * 2, '#ff3fb0', 1)
    })
  },
  poof(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    const colors = env.colors(fx.target)
    withAlpha(ctx, env.reduced ? 1 : 1 - p * p, () => {
      // Smoke puffs swelling, then bits of the enemy flying out in its own colors.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4
        const d = env.reduced ? 10 : 4 + p * 14
        const r = env.reduced ? 5 : 3 + Math.round(p * 6)
        rect(ctx, at.x + Math.cos(a) * d - r, at.y - 12 + Math.sin(a) * d * 0.6 - r - (env.reduced ? 0 : p * 8), r * 2, r * 2, 'rgba(214,208,236,0.6)')
      }
      for (let i = 0; i < 16; i++) {
        const a = hash(i, fx.target, 111) * Math.PI * 2
        const d = env.reduced ? 14 : 5 + p * (16 + hash(i, fx.target, 113) * 18)
        rect(ctx, at.x + Math.cos(a) * d, at.y - 14 + Math.sin(a) * d - (env.reduced ? 0 : p * 10), 3, 3, colors[(i % (colors.length - 1)) + 1] ?? '#ffffff')
      }
    })
  },
  loot(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    const elite = env.elite?.(fx.target)
    const count = elite ? 6 : 3
    withAlpha(ctx, env.reduced ? 1 : fade(p, 0.75), () => {
      // Gold coins hop out of the fallen enemy and land around it; an elite drops a gem too.
      for (let i = 0; i < count; i++) {
        const dir = (i - (count - 1) / 2) * 8
        const k = env.reduced ? 1 : Math.min(1, p * 1.6)
        const x = Math.round(at.x + dir * k)
        const y = Math.round(at.y - 4 - Math.sin(k * Math.PI) * (16 + i * 3))
        rect(ctx, x - 3, y - 3, 6, 6, '#8a6410')
        rect(ctx, x - 2, y - 3, 4, 5, '#ffd23f')
        rect(ctx, x - 1, y - 2, 1, 2, '#fff8c0')
      }
      if (elite) {
        const gy = at.y - 34 * (env.reduced ? 1 : Math.min(1, p * 2))
        rect(ctx, at.x - 3, gy - 3, 7, 7, '#2a8a9a')
        rect(ctx, at.x - 2, gy - 2, 5, 5, '#7fe9ff')
        star(ctx, at.x, gy, 6, '#c4fbff')
      }
    })
  },
  heroDeath(ctx, _fx, p, env) {
    const { x, y } = env.hero
    withAlpha(ctx, env.reduced ? 0.9 : 1 - p, () => {
      // The hero falls: a dark red ring on the ground and grey shards drifting down.
      arc(ctx, x, y, 16, 0, Math.PI * 2, '#8a1a2a', 2)
      for (let i = 0; i < 16; i++) rect(ctx, x + (hash(i, 8, 121) - 0.5) * 34, y - 40 + (env.reduced ? 14 : p * 38) * hash(i, 8, 123), 3, 3, i % 2 ? '#8a8678' : '#ff6b6b')
    })
  },
  regen(ctx, fx, p, env) {
    const at = env.foe(fx.target, tmpA)
    if (!at) return
    withAlpha(ctx, env.reduced ? 1 : 1 - p, () => {
      // An elite knitting back: green pluses rising over it.
      for (let i = 0; i < 3; i++) {
        const px0 = at.x - 10 + i * 10
        const py0 = at.y - 30 - (env.reduced ? 4 : p * 14) - i * 3
        rect(ctx, px0 - 2, py0, 5, 2, '#5fe08a')
        rect(ctx, px0, py0 - 2, 2, 5, '#5fe08a')
      }
    })
  },
  levelUp(ctx, _fx, p, env) {
    const { x, y } = env.hero
    const a = p > 0.8 ? (1 - p) / 0.2 : 1
    const k = env.reduced ? 1 : Math.min(1, p * 3)
    withAlpha(ctx, a, () => {
      withAlpha(ctx, 0.35, () => rect(ctx, x - 9, y - 70 * k, 18, 70 * k, '#ffd23f'))
      withAlpha(ctx, 0.6, () => rect(ctx, x - 4, y - 70 * k, 8, 70 * k, '#fff4b0'))
      arc(ctx, x, y, 14, 0, Math.PI * 2, '#ffd23f', 2)
      for (let i = 0; i < 10; i++) rect(ctx, x + (hash(i, 12, 131) - 0.5) * 30, y - (env.reduced ? 20 + i * 4 : ((p * 90 + hash(i, 12, 133) * 60) % 70)), 2, 2, '#fff4b0')
    })
  },
}

export const FX_PAINTERS = PAINT

// Paints one effect `ms` into the fight. Answers false when it is not showing.
export function drawFx(ctx, fx, ms, env) {
  const p = fxProgress(fx, ms, env.reduced)
  if (p === null) return false
  const paint = PAINT[fx.kind]
  if (!paint) return false
  env.ms = ms
  paint(ctx, fx, p, env)
  return true
}

// The light an effect casts (for the light pass), written into out, or null.
const LIGHTS = {
  chain: ['255,240,140', 34, 0.55],
  fireball: ['255,140,60', 40, 0.45],
  frost: ['140,210,255', 46, 0.35],
  fury: ['255,70,50', 30, 0.4],
  bubble: ['150,210,255', 26, 0.3],
  mend: ['90,230,140', 28, 0.35],
  levelUp: ['255,210,80', 48, 0.55],
  bossBlast: ['255,120,90', 50, 0.45],
  critBurst: ['255,210,80', 24, 0.5],
}
export function fxLight(fx, p, env, out) {
  const spec = LIGHTS[fx.kind]
  if (!spec) return null
  let x = env.hero.x
  let y = env.hero.y - BODY
  if (fx.kind === 'fireball') {
    const at = env.spot(fx.spot ?? { x: 2, y: 0 }, tmpB)
    x = at.x
    y = at.y
  } else if (fx.kind === 'critBurst' || fx.kind === 'chain') {
    const at = env.foe(fx.kind === 'chain' ? (fx.targets?.[0] ?? fx.target) : fx.target, tmpA)
    if (at) {
      x = at.x
      y = at.y - BODY
    }
  }
  out.x = x
  out.y = y
  out.rgb = spec[0]
  out.r = spec[1]
  out.a = spec[2] * (env.reduced ? 1 : 1 - p * 0.6)
  return out
}

// Flames over a burning enemy, or green bubbles over a poisoned one, at its ground point.
export function drawAilment(ctx, x, y, element, t, reduced, seed) {
  const tick = reduced ? 0 : Math.floor(t * 12)
  if (element === 'poison') {
    for (let i = 0; i < 4; i++) {
      const rise = reduced ? i * 4 : ((t * 14 + hash(i, seed, 141) * 20) % 20)
      const bx = x - 7 + hash(i, seed, 143) * 14
      const by = y - 18 - rise
      rect(ctx, bx - 1, by - 1, 3, 3, '#3f8a2a')
      rect(ctx, bx, by - 1, 1, 1, '#d2ffb8')
    }
    return
  }
  const hot = element === 'fire'
  for (let i = 0; i < 5; i++) {
    const fx0 = x - 8 + i * 4
    const h = 3 + Math.floor(hash(i, tick + seed, 151) * 6)
    rect(ctx, fx0, y - 10 - h, 2, h, hot ? (hash(i, tick, 153) > 0.5 ? '#ff8a3d' : '#ff5a1a') : (ELEMENT[element] ?? '#ffffff'))
    rect(ctx, fx0, y - 10 - h, 1, 1, '#ffd76a')
  }
}
