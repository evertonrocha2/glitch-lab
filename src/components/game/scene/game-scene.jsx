import { useEffect, useRef } from 'react'
import { isSolid } from '../../../../shared/world/tiles.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { SPRITE } from '../hero/draw-hero.js'
import { heroSprite } from '../hero/hero-cache.js'
import { useReducedMotion } from '../use-reduced-motion.js'
import { drawEnemy, enemyLight, heroLight, isBossSprite } from './actors.js'
import { floaterAnchor, paintFloaters } from './floaters.js'
import { paintLight } from './light.js'
import { BOSS_SPEED, duration, HUNT_SPEED, sample, timeline, WALK_MS } from './playback.js'
import { ellipse, SHADOW } from './pixels.js'
import { mapLights, paintAnimated, paintBase, paintFog, readMap, TS } from './tiles.js'

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
    const run = { start: at + (playback.walk === false ? 0 : WALK_MS), frames: timeline(fight, { speed }), len: duration(fight, { speed }), foe: fight.enemy?.sprite ? fight.enemy : null }
    at = run.start + run.len
    return run
  })
  return { runs, total: at }
}

// The scene `ms` into the playback: the hero walking in, or a fight sampled at its local time.
function stateAt(plan, ms, loop) {
  const t = loop ? ms % plan.total : Math.min(ms, plan.total)
  const run = plan.runs.find((r, i) => t < r.start + r.len || i === plan.runs.length - 1)
  if (t < run.start) return { walking: true, p: (t - (run.start - WALK_MS)) / WALK_MS, foe: run.foe }
  return { walking: false, foe: run.foe, ...sample(run.frames, t - run.start) }
}

// The hero doll's pose for an anim: idle swaps frames every 500 ms, walking steps faster with a 1px bob,
// attacks run wind up, slash, follow through. dx: pixels toward the foe (an attack lunges up to 3px,
// peaking mid swing; a hit knocks the hero 2px back). Reduced motion holds idle0, no bob, no dx. t: seconds.
const LUNGE = 3
const KNOCKBACK = 2
export function heroFrame(anim, p, t, reduced) {
  const q = Math.min(Math.max(Number(p) || 0, 0), 1)
  if (anim === 'death') return { pose: 'dead', bob: 0, dx: 0 }
  if (anim === 'hurt') return { pose: 'hurt', bob: 0, dx: reduced ? 0 : q < 0.6 ? -KNOCKBACK : q < 0.85 ? -1 : 0 }
  if (anim === 'attack') {
    const dx = reduced ? 0 : Math.round(LUNGE * Math.sin(Math.PI * q))
    return { pose: q < 0.33 ? 'atk1' : q < 0.66 ? 'atk2' : 'atk3', bob: 0, dx }
  }
  if (reduced) return { pose: 'idle0', bob: 0, dx: 0 }
  const step = Math.floor(t * (anim === 'walk' ? 5 : 2)) % 2 === 1
  return { pose: step ? 'idle1' : 'idle0', bob: anim === 'walk' && step ? 1 : 0, dx: 0 }
}

// Where the doll's top left lands for a hero standing on the tile at (x, y): the feet on the tile's
// last row, the 32x32 body box centered on the tile (as the old 16px hero was).
const dollAt = (x, y) => ({ x: x + 8 - (SPRITE.ox + 16), y: y + 16 - (SPRITE.oy + 32) })

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
//   lockedRects: rects to cover in fog. look: the hero's six field look. gear: { slot: { b, r } } from gearOf. enemy: { sprite, elite } for the foe
//   on stage (optional); a fight in the playback carrying its own `enemy` ({ sprite, elite }) wins over it. playback: { fights, loop, speed? } plays fight logs (see playback.js); a loop walks 1.5 s between fights. zoneName: overrides the label.
export default function GameScene({ world, zoneRect, lockedRects = [], look, gear, playback, enemy, zoneName, onReady }) {
  const t = useT()
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const cols = world.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const rows = world.rows.length

  // Props read each frame, so a new look or foe never rebuilds the static layers.
  const live = useRef({})
  const tr = useRef(t)
  tr.current = t
  live.current = { look, gear, enemy, playback, onReady }
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
      const { look: heroLook, gear: heroGear } = live.current
      const now = play(time)
      // A fight that names its own foe ({ sprite, elite }) draws it; otherwise the enemy prop.
      const foe = now?.foe ?? live.current.enemy
      const heroAnim = now ? (now.walking ? { anim: 'walk', p: now.p } : now.hero) : { anim: 'idle', p: 0 }
      const foeAnim = now && !now.walking ? now.enemy : { anim: 'idle', p: 0 }
      const showFoe = foe?.sprite && !(now?.walking)
      // enrage and phase are a flash over the foe: the foe itself keeps idling.
      const flash = foeAnim.anim === 'enrage' || foeAnim.anim === 'phase' ? foeAnim : null
      ctx.imageSmoothingEnabled = false
      if (base) ctx.drawImage(base, 0, 0)
      else paintBase(ctx, world)
      paintAnimated(ctx, world, te)
      const { pose, bob, dx } = heroFrame(heroAnim.anim, heroAnim.p, te, reduced)
      // The lunge goes the way the hero faces (toward the foe), the knockback the other way.
      const shift = dx * (heroAnim.facing === -1 ? -1 : 1)
      const doll = dollAt(hx, hy)
      ellipse(ctx, hx + 8 + shift, hy + 15, 8, 2, SHADOW)
      const img = heroSprite(heroLook, heroGear, pose)
      if (heroAnim.facing === -1) {
        ctx.save()
        ctx.translate(hx + 8 + shift, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(img, doll.x - (hx + 8), doll.y + bob)
        ctx.restore()
      } else ctx.drawImage(img, doll.x + shift, doll.y + bob)
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
          const a = actor === 'hero' ? floaterAnchor(hx, hy, { boss: true }) : floaterAnchor(ex, ey, { boss })
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
