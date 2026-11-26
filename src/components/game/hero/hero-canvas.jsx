import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../use-reduced-motion.js'
import { SPRITE } from './draw-hero.js'
import { heroSprite } from './hero-cache.js'

// The part of the sprite grid each crop shows. 'head' is a square portrait around the head (hair
// and helm tops included, down to the shoulders), for unit frames and the creator's chips.
const FULL = { x: 0, y: 0, w: SPRITE.w, h: SPRITE.h }
export const HEAD_CROP = { x: SPRITE.ox + 4, y: SPRITE.oy - 4, w: 24, h: 24 }

// Idle frames swap this often while animating.
const IDLE_MS = 500

// The hero drawn at a whole number scale. With `animate` it breathes (idle0, idle1) until unmount;
// with prefers-reduced-motion it holds idle0 and starts no loop. Without `animate` it shows `pose`.
export function HeroCanvas({ look, gear, pose = 'idle0', scale = 4, animate = false, crop, label, className }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const src = crop === 'head' ? HEAD_CROP : FULL
  // Plain keys, so a new but equal look or gear object does not restart the drawing.
  const lookKey = JSON.stringify(look ?? null)
  const gearKey = JSON.stringify(gear ?? null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return undefined
    const lookNow = JSON.parse(lookKey)
    const gearNow = JSON.parse(gearKey)
    const box = crop === 'head' ? HEAD_CROP : FULL
    const draw = (p) => {
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, box.w * scale, box.h * scale)
      ctx.drawImage(heroSprite(lookNow, gearNow, p), box.x, box.y, box.w, box.h, 0, 0, box.w * scale, box.h * scale)
    }
    if (!animate || reduced) {
      draw(animate ? 'idle0' : pose)
      return undefined
    }
    let shown = 'idle0'
    draw(shown)
    let frame = 0
    const loop = (ms) => {
      const next = Math.floor(ms / IDLE_MS) % 2 ? 'idle1' : 'idle0'
      if (next !== shown) {
        shown = next
        draw(shown)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [lookKey, gearKey, pose, scale, animate, reduced, crop])

  return (
    <canvas
      ref={ref}
      width={src.w * scale}
      height={src.h * scale}
      role="img"
      aria-label={label}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
