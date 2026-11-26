import { useEffect, useRef, useState } from 'react'
import { isSolid } from '../../../../shared/world/tiles.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { drawEnemy, drawHero, enemyLight, heroLight, isBossSprite } from './actors.js'
import { floaterAnchor, paintFloaters } from './floaters.js'
import { paintLight } from './light.js'
import { BOSS_SPEED, duration, HUNT_SPEED, sample, timeline, WALK_MS } from './playback.js'
import { mapLights, paintAnimated, paintBase, paintFog, readMap, TS } from './tiles.js'

const REDUCE = '(prefers-reduced-motion: reduce)'

function reducedNow() {
  try {
    return Boolean(window.matchMedia?.(REDUCE).matches)
  } catch {
    return false
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(reducedNow)
  useEffect(() => {
    let query = null
    try {
      query = window.matchMedia?.(REDUCE) ?? null
    } catch {
      query = null
    }
    if (!query?.addEventListener) return undefined
    const onChange = () => setReduced(Boolean(query.matches))
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

const sameRect = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

// Zone 1 is everything outside the world's lockable zones; z2, z3 follow in world.zones order.
function zoneNumber(world, rect) {
  const at = (world.zones ?? []).findIndex((zone) => sameRect(zone.rect, rect))
  return at < 0 ? 1 : at + 2
}

// Where the fight happens: the walkable tile nearest the zone's middle with room for the foe two tiles right.
export function fightSpot(world, rect) {
  const rows = world.rows ?? []
  const r = rect ?? { x: 0, y: 0, w: rows[0]?.length ?? 0, h: rows.length }
  const walk = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && rows[y]?.[x] !== undefined && !isSolid(rows[y][x])
  const cx = r.x + Math.floor(r.w / 2) - 1
  const cy = r.y + Math.floor(r.h / 2)
  let best = null
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!walk(x, y) || !walk(x + 1, y) || !walk(x + 2, y)) continue
      const d = (x - cx) ** 2 + (y - cy) ** 2
      if (!best || d < best.d) best = { d, x, y }
    }
  }
  const hero = best ?? world.spawn ?? { x: cx, y: cy }
  return { hero: { x: hero.x, y: hero.y }, enemy: { x: hero.x + 2, y: hero.y } }
}

// Lays the playback's fights end to end: [walk, fight], [walk, fight], ... Built once per `fights` array.
function schedule(playback) {
  const speed = playback.speed ?? (playback.loop ? HUNT_SPEED : BOSS_SPEED)
  let at = 0
  const runs = playback.fights.map((fight) => {
    const run = { start: at + (playback.walk === false ? 0 : WALK_MS), frames: timeline(fight, { speed }), len: duration(fight, { speed }) }
    at = run.start + run.len
    return run
  })
  return { runs, total: at }
}

// The scene `ms` into the playback: the hero walking in, or a fight sampled at its local time.
function stateAt(plan, ms, loop) {
  const t = loop ? ms % plan.total : Math.min(ms, plan.total)
  const run = plan.runs.find((r, i) => t < r.start + r.len || i === plan.runs.length - 1)
  if (t < run.start) return { walking: true, p: (t - (run.start - WALK_MS)) / WALK_MS }
  return { walking: false, ...sample(run.frames, t - run.start) }
}

function layer(width, height, paint) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext?.('2d') ?? null
  if (!ctx) return null
  paint(ctx)
  return canvas
}

// The hunting map in lit 16px pixel art, one canvas pixel per art pixel, scaled up by CSS to fit the width.
// Static art goes to an offscreen layer once (as the mockup's makePixel); water, portals, actors and the
// light pass are drawn each frame. With prefers-reduced-motion: one still frame, no fireflies, still water.
//   world: a map from shared/world/maps/. zoneRect: the zone being hunted, in tiles (actors stand in it).
//   lockedRects: rects to cover in fog. look: { hood, outfit, hair }. enemy: { sprite, elite } for the foe
//   on stage (optional). playback: { fights, loop, speed? } plays fight logs (see playback.js); a loop walks 1.5 s between fights. zoneName: overrides the label.
export default function GameScene({ world, zoneRect, lockedRects = [], look, playback, enemy, zoneName, onReady }) {
  const t = useT()
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const cols = world.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const rows = world.rows.length

  // Props read each frame, so a new look or foe never rebuilds the static layers.
  const live = useRef({})
  const tr = useRef(t)
  tr.current = t
  live.current = { look, enemy, playback, onReady }
  const ready = useRef(false)

  const lockedKey = JSON.stringify(lockedRects ?? [])
  const zoneKey = JSON.stringify(zoneRect ?? null)
  const playing = Boolean(playback?.fights?.length)

  useEffect(() => {
    const canvas = ref.current
    let ctx = null
    try {
      ctx = canvas?.getContext?.('2d') ?? null
    } catch {
      ctx = null
    }
    let frame = 0
    const markReady = () => {
      if (ready.current) return
      ready.current = true
      live.current.onReady?.()
    }
    if (!ctx) {
      markReady()
      return undefined
    }
    const locked = JSON.parse(lockedKey)
    const spot = fightSpot(world, JSON.parse(zoneKey))
    const base = layer(canvas.width, canvas.height, (c) => paintBase(c, world))
    const fog = locked.length ? layer(canvas.width, canvas.height, (c) => paintFog(c, world, locked)) : null
    const map = readMap(world)
    const motes = map.outdoor ? 'fireflies' : 'dust'
    const tint = world.id === 'caverna-sql' ? '#8a80c4' : '#9d93cf'
    const hx = spot.hero.x * TS
    const hy = spot.hero.y * TS
    const ex = spot.enemy.x * TS
    const ey = spot.enemy.y * TS

    // Playback keeps its own clock, so it still runs with reduced motion (the environment stays frozen).
    let plan = null
    let planKey = null
    let startedAt = 0
    const play = (time) => {
      const pb = live.current.playback
      if (!pb?.fights?.length) return null
      if (planKey !== pb.fights) {
        planKey = pb.fights
        plan = schedule(pb)
        startedAt = time
      }
      return stateAt(plan, (time - startedAt) * 1000, Boolean(pb.loop))
    }

    const draw = (time) => {
      const te = reduced ? 0 : time
      const { look: heroLook, enemy: foe } = live.current
      const now = play(time)
      const heroAnim = now ? (now.walking ? { anim: 'walk', p: now.p } : now.hero) : { anim: 'idle', p: 0 }
      const foeAnim = now && !now.walking ? now.enemy : { anim: 'idle', p: 0 }
      const showFoe = foe?.sprite && !(now?.walking)
      // enrage and phase are a flash over the foe: the foe itself keeps idling.
      const flash = foeAnim.anim === 'enrage' || foeAnim.anim === 'phase' ? foeAnim : null
      ctx.imageSmoothingEnabled = false
      if (base) ctx.drawImage(base, 0, 0)
      else paintBase(ctx, world)
      paintAnimated(ctx, world, te)
      drawHero(ctx, hx, hy, { look: heroLook, anim: heroAnim.anim, p: heroAnim.p, t: te })
      if (showFoe) drawEnemy(ctx, ex, ey, { sprite: foe.sprite, elite: foe.elite, anim: flash ? 'idle' : foeAnim.anim, p: foeAnim.p, t: te })
      if (fog) ctx.drawImage(fog, 0, 0)
      else if (locked.length) paintFog(ctx, world, locked)
      const lights = [...mapLights(world, te), heroLight(hx, hy)]
      if (foe?.sprite) lights.push(enemyLight(ex, ey, foe))
      paintLight(ctx, te, { lights, reduced, motes, tint })
      if (flash) {
        // Enrage: a red pulse. Phase: a white flash. Reduced motion: a steady, softer wash that just fades.
        const pulse = flash.anim === 'enrage' && !reduced ? 0.5 + 0.5 * Math.sin(flash.p * Math.PI * 4) : 1
        ctx.globalAlpha = (reduced ? 0.12 : 0.28) * (1 - flash.p) * pulse
        ctx.fillStyle = flash.anim === 'enrage' ? '#ff2a2a' : '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.globalAlpha = 1
      }
      if (now && !now.walking && now.floaters.length) {
        const boss = foe?.sprite ? isBossSprite(foe.sprite) : false
        const active = now.floaters.map(({ floater, actor, age }) => {
          const a = actor === 'hero' ? floaterAnchor(hx, hy) : floaterAnchor(ex, ey, { boss })
          return { floater, age, x: a.x, y: a.y }
        })
        paintFloaters(ctx, active, { reduced, translate: tr.current })
      }
    }

    draw(0)
    markReady()
    // Without an offscreen layer every frame would repaint the whole map: keep the still frame instead.
    if (base && (!reduced || playing)) {
      const start = typeof performance !== 'undefined' ? performance.now() : 0
      const loop = (ms) => {
        draw((ms - start) / 1000)
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [world, lockedKey, zoneKey, reduced, playing])

  const worldName = t(`world.name.${world.id}`)
  const zone = zoneName ?? t('world.zone', { world: worldName, n: zoneNumber(world, zoneRect) })

  return (
    <canvas
      ref={ref}
      width={cols * TS}
      height={rows * TS}
      role="img"
      aria-label={t('game.scene.label', { zone })}
      className="block h-auto w-full select-none"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
