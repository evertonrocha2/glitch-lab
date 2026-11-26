import { useEffect, useRef } from 'react'
import { heroSprite } from '../../game/hero/hero-cache.js'
import { heroLight } from '../../game/scene/actors.js'
import { dollAt } from '../../game/scene/game-scene.jsx'
import { paintLight } from '../../game/scene/light.js'
import { ellipse, SHADOW } from '../../game/scene/pixels.js'
import { mapLights, paintAnimated, paintBase, paintPadlock, readMap, TS } from '../../game/scene/tiles.js'
import { useReducedMotion } from '../../game/use-reduced-motion.js'
import { approach, cameraOn, heroPose, STEP_MS, sideOf, tileAtPoint } from './hub-view.js'

// A hero that stepped this recently is still walking (a held key steps every STEP_MS).
const WALKING_MS = STEP_MS * 2
const VOID = '#05040c'

function layer(width, height, paint) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  let ctx = null
  try {
    ctx = canvas.getContext?.('2d') ?? null
  } catch {
    ctx = null
  }
  if (!ctx) return null
  paint(ctx)
  return canvas
}

function contextOf(canvas) {
  try {
    return canvas?.getContext?.('2d') ?? null
  } catch {
    return null
  }
}

// A Glitch World map in the hunt's lit 16px pixel art, seen through a camera that follows the hero:
// the ground and everything on it go to an offscreen layer once per world; water, portals, the hero
// and the light pass are drawn each frame. The hero is the paper doll (look + gear), walking from tile
// to tile with its idle frames and a 1px bob, mirrored when it faces left. Zones inside a world are
// open with it, so nothing is fogged; a portal to a locked world wears a padlock.
// With prefers-reduced-motion nothing loops: one still frame each time something changes.
// The picture is hidden from screen readers; the game around it says what happens.
//   world: the map as this locale sees it. hero: { world, x, y, facing, frame } (frame flips each step).
//   look, gear: the hero's look and gearOf(items). crop: { w, h } tiles in view (see cropFor).
//   lockedPortals: [{ x, y }]. onTileClick(x, y): a tile was clicked.
// data-portals lists where the drawn map's portals lead (the ENEM ones are gone outside pt-BR).
export default function HubScene({ world, hero, look, gear, crop, lockedPortals = [], onTileClick }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const live = useRef({})
  live.current = { world, hero, look, gear, crop, onTileClick }
  // Where the hero is drawn, in tiles (between two tiles mid-step), and whether a loop moves it.
  const pos = useRef({ x: hero.x, y: hero.y })
  const looping = useRef(false)
  const redraw = useRef(null)
  const lockedKey = JSON.stringify(lockedPortals)

  useEffect(() => {
    const canvas = ref.current
    const ctx = contextOf(canvas)
    looping.current = false
    redraw.current = null
    if (!ctx) return undefined
    const portals = JSON.parse(lockedKey)
    const map = readMap(world)
    const width = map.W * TS
    const height = map.H * TS
    const paintOver = (c) => {
      for (const portal of portals) paintPadlock(c, portal.x, portal.y)
    }
    const base = layer(width, height, (c) => paintBase(c, world))
    const over = portals.length ? layer(width, height, paintOver) : null
    const motes = map.outdoor ? 'fireflies' : 'dust'
    const tint = world.id === 'caverna-sql' ? '#8a80c4' : '#9d93cf'

    const start = live.current.hero
    pos.current = { x: start.x, y: start.y }
    const walk = { target: { x: start.x, y: start.y }, stepAt: Number.NEGATIVE_INFINITY, side: sideOf(start.facing), first: null, last: null }

    // ms: the frame's clock (requestAnimationFrame), or undefined for a still frame.
    const draw = (ms) => {
      const { hero: now, look: heroLook, gear: heroGear, crop: view } = live.current
      // Through a portal the next world's map comes with the next effect: nothing to draw here.
      if (now.world !== world.id) return
      const clock = ms ?? walk.last ?? 0
      if (ms !== undefined && walk.first === null) walk.first = ms
      const t = reduced || walk.first === null ? 0 : (clock - walk.first) / 1000
      if (now.x !== walk.target.x || now.y !== walk.target.y) {
        walk.target = { x: now.x, y: now.y }
        walk.stepAt = clock
      }
      walk.side = sideOf(now.facing, walk.side)
      if (reduced || ms === undefined) pos.current = { ...walk.target }
      else pos.current = approach(pos.current, walk.target, walk.last === null ? 1 : (ms - walk.last) / STEP_MS)
      if (ms !== undefined) walk.last = ms
      const moving = pos.current.x !== walk.target.x || pos.current.y !== walk.target.y || clock - walk.stepAt < WALKING_MS

      const w = view.w * TS
      const h = view.h * TS
      const camera = cameraOn(world, pos.current, view)
      const ox = Math.round(camera.x * TS)
      const oy = Math.round(camera.y * TS)
      ctx.setTransform?.(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = VOID
      ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.translate(-ox, -oy)
      if (base) ctx.drawImage(base, 0, 0)
      else paintBase(ctx, world)
      paintAnimated(ctx, world, t)

      const hx = Math.round(pos.current.x * TS)
      const hy = Math.round(pos.current.y * TS)
      const { pose, bob } = heroPose({ walking: moving, frame: now.frame, t, reduced })
      const img = heroSprite(heroLook, heroGear, pose)
      const doll = dollAt(hx, hy)
      ellipse(ctx, hx + 8, hy + 15, 8, 2, SHADOW)
      if (walk.side === -1) {
        ctx.save()
        ctx.translate(hx + 8, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(img, doll.x - (hx + 8), doll.y + bob)
        ctx.restore()
      } else ctx.drawImage(img, doll.x, doll.y + bob)
      if (over) ctx.drawImage(over, 0, 0)
      else if (portals.length) paintOver(ctx)
      ctx.restore()

      const lights = [...mapLights(world, t), heroLight(hx, hy)].map((light) => ({ ...light, x: light.x - ox, y: light.y - oy }))
      paintLight(ctx, t, { lights, reduced, motes, tint })
    }

    draw()
    // Without an offscreen layer every frame would repaint the whole map: keep still frames instead.
    if (reduced || !base) {
      redraw.current = () => draw()
      return () => {
        redraw.current = null
      }
    }
    looping.current = true
    let frame = 0
    const loop = (ms) => {
      draw(ms)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      looping.current = false
      cancelAnimationFrame(frame)
    }
  }, [world, lockedKey, reduced])

  // No loop running: draw again whenever what shows changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each listed value changes the still frame.
  useEffect(() => {
    redraw.current?.()
  }, [hero.x, hero.y, hero.facing, hero.frame, look, gear, crop.w, crop.h])

  function onClick(event) {
    const { world: map, hero: now, crop: view, onTileClick: report } = live.current
    const at = looping.current ? pos.current : now
    const tile = tileAtPoint(event, event.currentTarget.getBoundingClientRect(), cameraOn(map, at, view), view)
    if (tile) report?.(tile.x, tile.y)
  }

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: never focused (no tabIndex); the clicks only pick a tile, the map around it takes the keyboard.
    <canvas
      ref={ref}
      width={crop.w * TS}
      height={crop.h * TS}
      aria-hidden="true"
      data-portals={world.portals.map((portal) => portal.to).join(' ')}
      onClick={onClick}
      className="block h-auto w-full cursor-pointer touch-manipulation select-none"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
