import { expect, it } from 'vitest'
import { FX_KINDS, FX_MS } from './pack.js'
import { drawAilment, drawFx, FX_PAINTERS, fxLight, fxProgress } from './vfx.js'

function recorder() {
  const rects = []
  const ctx = {
    rects,
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, style: ctx.fillStyle })
    },
  }
  return ctx
}

const env = (reduced = false) => ({
  hero: { x: 100, y: 100 },
  foe: (i, out) => {
    out.x = 130 + i * 10
    out.y = 100
    return out
  },
  spot: (at, out) => {
    out.x = 100 + at.x * 16
    out.y = 100 + at.y * 16
    return out
  },
  colors: () => ['#000000', '#111111', '#222222', '#333333', '#444444'],
  elite: () => false,
  t: 1,
  reduced,
})

const fxOf = (kind) => ({ kind, at: 0, ms: FX_MS[kind], target: 0, targets: [0, 1, 2], src: 0, spot: { x: 2, y: 0 }, radius: 1.8, element: 'fire', crit: true, mp: false })

it('has a painter for every effect kind and each paints something of its own', () => {
  const prints = new Set()
  for (const kind of FX_KINDS) {
    expect(FX_PAINTERS[kind], kind).toBeTypeOf('function')
    const ctx = recorder()
    expect(drawFx(ctx, fxOf(kind), FX_MS[kind] * 0.3, env()), kind).toBe(true)
    expect(ctx.rects.length, kind).toBeGreaterThan(3)
    prints.add(ctx.rects.map((r) => `${Math.round(r.x)},${Math.round(r.y)},${r.style}`).join('|'))
  }
  expect(prints.size).toBe(FX_KINDS.length)
})

it('shows reduced motion flashes still and short, and keeps lingering ones', () => {
  const slash = { kind: 'slash', at: 0, ms: 200 }
  expect(fxProgress(slash, 50, true)).not.toBe(null)
  expect(fxProgress(slash, 120, true)).toBe(null)
  expect(fxProgress(slash, 120, false)).not.toBe(null)
  const patch = { kind: 'fireball', at: 0, ms: 6000 }
  expect(fxProgress(patch, 5000, true)).not.toBe(null)
  // Still: the same picture at two times.
  const a = recorder()
  const b = recorder()
  drawFx(a, fxOf('cleave'), 20, env(true))
  drawFx(b, fxOf('cleave'), 120, env(true))
  expect(a.rects).toEqual(b.rects)
})

it('is not drawn before it starts or after it ends', () => {
  expect(drawFx(recorder(), { ...fxOf('chain'), at: 500 }, 100, env())).toBe(false)
  expect(drawFx(recorder(), fxOf('chain'), 5000, env())).toBe(false)
})

it('lights the chain at its first target and the fire patch at its spot', () => {
  const out = {}
  expect(fxLight({ kind: 'chain', targets: [2] }, 0.2, env(), out)).toMatchObject({ x: 150 })
  expect(fxLight({ kind: 'fireball', spot: { x: 2, y: 0 } }, 0.2, env(), out)).toMatchObject({ x: 132, y: 100 })
  expect(fxLight({ kind: 'slash' }, 0.2, env(), out)).toBe(null)
})

it('draws flames on a burning enemy and bubbles on a poisoned one', () => {
  const fire = recorder()
  const poison = recorder()
  drawAilment(fire, 50, 50, 'fire', 1, false, 1)
  drawAilment(poison, 50, 50, 'poison', 1, false, 1)
  expect(fire.rects.some((r) => r.style === '#ff8a3d' || r.style === '#ff5a1a')).toBe(true)
  expect(poison.rects.some((r) => r.style === '#3f8a2a')).toBe(true)
})
