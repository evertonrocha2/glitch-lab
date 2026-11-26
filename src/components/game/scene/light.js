import { hash } from './pixels.js'

// The light pass over a painted frame, ported from the mockup's drawLight: a dusk tint (multiply), additive
// radial glows for each light, fireflies (or dust indoors), and a vignette.
// lights: [{ x, y, r, rgb: 'r,g,b', a }] in canvas pixels. reduced (prefers-reduced-motion): no motes.
// motes: 'fireflies' | 'dust' | 'none'.
export function paintLight(ctx, t, { lights = [], reduced = false, tint = '#9d93cf', motes = 'fireflies' } = {}) {
  const w = ctx.canvas?.width ?? 0
  const h = ctx.canvas?.height ?? 0
  if (!w || !h) return
  const prevOp = ctx.globalCompositeOperation

  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'lighter'
  for (const { x, y, r, rgb, a } of lights) {
    if (!(r > 0)) continue
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb},${a})`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  if (!reduced && motes !== 'none') {
    const dust = motes === 'dust'
    const count = Math.round((w * h) / (dust ? 7000 : 4400))
    for (let i = 0; i < count; i++) {
      const speed = dust ? 0.3 : 1
      const fx = (hash(i, 1) * w + Math.sin(t * 0.7 * speed + i) * 12 + w) % w
      const fy = dust ? (hash(i, 2) * h - t * 4 + h * 10) % h : (hash(i, 2) * h + Math.cos(t * 0.9 + i * 2) * 8 + h) % h
      const a = 0.5 + 0.5 * Math.sin(t * (dust ? 1 : 3) + i * 1.7)
      const x = Math.round(fx)
      const y = Math.round(fy)
      if (dust) {
        ctx.fillStyle = `rgba(220,210,255,${(a * 0.35).toFixed(3)})`
        ctx.fillRect(x, y, 1, 1)
        continue
      }
      ctx.fillStyle = `rgba(255,240,150,${a.toFixed(3)})`
      ctx.fillRect(x, y, 1, 1)
      ctx.fillStyle = `rgba(255,230,120,${(a * 0.25).toFixed(3)})`
      ctx.fillRect(x - 1, y, 3, 1)
      ctx.fillRect(x, y - 1, 1, 3)
    }
  }

  ctx.globalCompositeOperation = 'source-over'
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.65)
  v.addColorStop(0, 'rgba(10,6,30,0)')
  v.addColorStop(1, 'rgba(10,6,30,.45)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = prevOp ?? 'source-over'
}
