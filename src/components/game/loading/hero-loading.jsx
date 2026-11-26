import { useEffect, useId, useRef, useState } from 'react'
import { DEFAULT_LOOK, LOOK_OPTIONS } from '../../../../shared/game/look.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'
import { Chip } from '../ui/frame.jsx'
import { useReducedMotion } from '../use-reduced-motion.js'
import { knownHero } from './hero-memory.js'
import { buildLayers, heroFrames, paintScene, sceneSize } from './loading-scene.js'

export const SEGMENTS = 14
export const TIP_COUNT = 10
export const TIP_MS = 4500
// About 30 frames a second: plenty for pixel art, half the work.
const FRAME_MS = 33
const FILL_MS = 120

// Segments lit after `ms`: the first at once, then fast and slower, never the last one (the load ends
// the screen, not the bar).
export const filledAt = (ms) => Math.min(SEGMENTS - 1, 1 + Math.floor((SEGMENTS - 1) * (1 - Math.exp(-ms / 1800))))

// The keyframes the band uses, scoped by their hl- names. Each runs only under motion-safe classes.
const KEYFRAMES = `
@keyframes hl-sheen { from { transform: translateX(-150%) skewX(-24deg) } to { transform: translateX(900%) skewX(-24deg) } }
@keyframes hl-dots { from { width: 0 } to { width: 3ch } }
@keyframes hl-tip { from { opacity: 0; transform: translateY(3px) } to { opacity: 1; transform: none } }
@keyframes hl-wait { 50% { opacity: 0.2 } }
@keyframes hl-lit { from { filter: brightness(2.2) } to { filter: none } }
`

// The hero to draw: the one given, else the last one this browser saw, else a newcomer with a random
// hair color.
function pickHero(look, gear) {
  if (look) return { look, gear: gear ?? {} }
  const known = knownHero()
  if (known) return known
  return { look: { ...DEFAULT_LOOK, hairColor: Math.floor(Math.random() * LOOK_OPTIONS.hairColor) }, gear: {} }
}

// The loading screen of the game: the hero walks a night forest path while an arcane rift opens in
// the sky, a pixel bar fills in segments and short tips rotate. It fills the box className gives it
// (an aspect ratio or a size), so nothing jumps when the real stage arrives.
// Props: label (the status line, "Carregando seu herói" by default), look and gear (else the
// remembered hero), className (size and border).
// Reduced motion: one still frame, no loop; the tips still change, without the fade.
export default function HeroLoading({ label, look, gear, className = 'border-2 border-[#120c22]' }) {
  const t = useT()
  const id = useId()
  const reduced = useReducedMotion()
  const title = label ?? t('game.view.loading')
  const [fallback] = useState(() => pickHero(look, gear))
  const hero = look ? { look, gear: gear ?? {} } : fallback
  const lookKey = JSON.stringify(hero.look)
  const gearKey = JSON.stringify(hero.gear)
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIP_COUNT))
  const [filled, setFilled] = useState(1)
  const root = useRef(null)
  const canvas = useRef(null)
  const band = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setTip((current) => (current + 1) % TIP_COUNT), TIP_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      const next = filledAt(Date.now() - start)
      setFilled(next)
      if (next >= SEGMENTS - 1) clearInterval(timer)
    }, FILL_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!ctx) return undefined
    const frames = heroFrames(JSON.parse(lookKey), JSON.parse(gearKey))
    let size = null
    let layers = null
    let t0 = null
    let last = -Infinity
    let frame = 0

    const measure = () => {
      const box = root.current?.getBoundingClientRect?.()
      const cssW = box?.width > 0 ? box.width : 320
      const cssH = box?.height > 0 ? box.height : 200
      const next = sceneSize(cssW, cssH, band.current?.offsetHeight ?? 0)
      if (size && next.w === size.w && next.h === size.h && next.s === size.s && next.feet === size.feet) return false
      size = next
      el.width = size.w
      el.height = size.h
      el.style.width = `${size.w * size.s}px`
      el.style.height = `${size.h * size.s}px`
      layers = buildLayers(size)
      return true
    }
    const draw = (sec) => paintScene(ctx, size, layers, frames, sec, { still: reduced })

    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure() && reduced && draw(0)) : null
    observer?.observe(root.current)
    if (reduced) {
      draw(0)
      return () => observer?.disconnect()
    }
    const loop = (ms) => {
      t0 ??= ms
      if (ms - last >= FRAME_MS) {
        last = ms
        draw((ms - t0) / 1000)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [lookKey, gearKey, reduced])

  return (
    <div ref={root} role="status" aria-busy="true" aria-labelledby={id} className={`@container relative overflow-hidden bg-[#05031a] ${className}`}>
      <span id={id} className="sr-only">
        {title}
      </span>
      <style>{KEYFRAMES}</style>
      <div aria-hidden="true" className="absolute inset-0">
        <canvas ref={canvas} className="absolute top-0 left-0 h-full w-full" style={{ imageRendering: 'pixelated' }} />
        <div className="absolute top-2.5 left-3 flex items-center gap-2 font-pixel text-sm font-bold text-[#e9e4ff] [text-shadow:2px_2px_0_#120c22] @2xl:top-4 @2xl:left-5 @2xl:gap-2.5 @2xl:text-lg">
          <PixelLogo className="size-6 drop-shadow-[2px_2px_0_#120c22] @2xl:size-8" />
          <span>StudyQuest</span>
        </div>
        <div
          ref={band}
          className="absolute inset-x-0 bottom-0 border-t-2 border-[#3e3170] bg-[linear-gradient(to_bottom,rgba(16,11,38,0.82),rgba(6,4,18,0.95))] px-2.5 pt-2 pb-2 shadow-[0_-2px_0_#0a0818] @2xl:px-5 @2xl:pt-3 @2xl:pb-3.5"
        >
          <div className="flex items-center gap-3 @2xl:gap-4">
            <p className="m-0 shrink-0 font-pixel text-[10px] font-bold uppercase tracking-[0.1em] @md:text-[11px] @md:tracking-[0.12em] text-[#f2c14e] [text-shadow:1px_1px_0_#120c22] @2xl:text-[13px]">
              {title}
              <span className="inline-block w-[3ch] overflow-hidden align-bottom whitespace-nowrap motion-safe:animate-[hl-dots_1.2s_steps(4,end)_infinite]">...</span>
            </p>
            <Bar filled={filled} />
          </div>
          <p className="m-0 mt-1.5 flex min-h-[2.7em] items-start gap-2 text-[11px] leading-[1.35] @2xl:mt-2.5 text-[#cfc6f5] @2xl:text-[13px]">
            <Chip tone="gold" className="mt-px shrink-0 uppercase">
              {t('gameLoading.tipLabel')}
            </Chip>
            <span key={tip} data-tip={tip} className="motion-safe:animate-[hl-tip_360ms_steps(4,end)_both]">
              {t(`gameLoading.tip.${tip}`)}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

// The pixel bar: SEGMENTS gold cells in a sunk frame, a sheen sweeping over the lit ones, the next one
// blinking while it waits.
function Bar({ filled }) {
  return (
    <div className="relative flex h-4 min-w-0 flex-1 gap-0.5 overflow-hidden border-2 border-[#0a0818] bg-[#100c20] p-0.5 shadow-[inset_2px_2px_0_#0a0818,inset_-2px_-2px_0_#2a2250] @2xl:h-5">
      {Array.from({ length: SEGMENTS }, (_, index) => {
        const lit = index < filled
        const next = index === filled
        return (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative cells
            key={index}
            data-lit={lit || undefined}
            className={`block h-full flex-1 ${
              lit
                ? 'bg-[linear-gradient(to_bottom,#fff1b0_0_25%,#f2c14e_25%_70%,#9a6a1c_70%)] motion-safe:animate-[hl-lit_420ms_steps(3,end)_both]'
                : next
                  ? 'bg-[#3e3170] motion-safe:animate-[hl-wait_900ms_steps(2,jump-none)_infinite]'
                  : 'bg-[#1b1433]'
            }`}
          />
        )
      })}
      <span className="pointer-events-none absolute inset-y-0.5 left-0.5 hidden overflow-hidden motion-safe:block" style={{ width: `calc(${(filled / SEGMENTS) * 100}% - 4px)` }}>
        <i className="absolute inset-y-0 left-0 block w-6 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.6),transparent)] motion-safe:animate-[hl-sheen_1.6s_steps(16,end)_infinite]" />
      </span>
    </div>
  )
}
