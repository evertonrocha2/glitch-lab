import { useEffect, useRef, useState } from 'react'
import { isSolid } from '../../../../shared/world/tiles.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { drawEnemy, drawHero, enemyLight, heroLight } from './actors.js'
import { paintLight } from './light.js'
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
//   on stage (optional). playback: { fights, loop } (Task 16 plays it). zoneName: overrides the label.
export default function GameScene({ world, zoneRect, lockedRects = [], look, playback, enemy, zoneName, onReady }) {
  const t = useT()
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const cols = world.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const rows = world.rows.length

  // Props read each frame, so a new look or foe never rebuilds the static layers.
  const live = useRef({})
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

    const draw = (time) => {
      const te = reduced ? 0 : time
      const { look: heroLook, enemy: foe } = live.current
      ctx.imageSmoothingEnabled = false
      if (base) ctx.drawImage(base, 0, 0)
      else paintBase(ctx, world)
      paintAnimated(ctx, world, te)
      drawHero(ctx, hx, hy, { look: heroLook, anim: 'idle', t: te })
      if (foe?.sprite) drawEnemy(ctx, ex, ey, { sprite: foe.sprite, elite: foe.elite, anim: 'idle', t: te })
      if (fog) ctx.drawImage(fog, 0, 0)
      else if (locked.length) paintFog(ctx, world, locked)
      const lights = [...mapLights(world, te), heroLight(hx, hy)]
      if (foe?.sprite) lights.push(enemyLight(ex, ey, foe))
      paintLight(ctx, te, { lights, reduced, motes, tint })
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
