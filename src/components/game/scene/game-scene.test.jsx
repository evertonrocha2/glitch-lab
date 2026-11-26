import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SPRITES } from '../../../../shared/game/enemies.js'
import { ZONES } from '../../../../shared/game/zones.js'
import { FLORESTA_JS } from '../../../../shared/world/maps/floresta-js.js'
import { TILES } from '../../../../shared/world/tiles.js'
import { WORLDS } from '../../../../shared/world/worlds.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { ANIMS, drawEnemy, drawHero, LOOK_COLORS } from './actors.js'
import GameScene from './game-scene.jsx'
import { paintLight } from './light.js'
import { paintMap, TS } from './tiles.js'

// A 2D context that records every fillRect and takes anything else silently.
function recorder() {
  const rects = []
  const target = {
    rects,
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    canvas: { width: 64, height: 64 },
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, style: target.fillStyle, op: target.globalCompositeOperation })
    },
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    clearRect() {},
  }
  return target
}

const look = { hood: 0, outfit: 0, hair: 0 }
const z1 = ZONES['floresta-js'].z1.rect

let reduce
beforeEach(() => {
  reduce = false
  vi.stubGlobal('matchMedia', (query) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener() {},
    removeEventListener() {},
  }))
  // jsdom has no canvas: the scene must cope with a null context (tests that need one mock it below).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('paints every tile of a 2x2 map of each tile char without throwing', () => {
  for (const char of Object.keys(TILES)) {
    const ctx = recorder()
    const world = { id: 'test', rows: [char + char, char + char], zones: [], portals: [] }
    expect(() => paintMap(ctx, world, { lockedRects: [] }), char).not.toThrow()
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const hit = ctx.rects.some((r) => r.x >= tx * TS && r.x < (tx + 1) * TS && r.y >= ty * TS && r.y < (ty + 1) * TS)
        expect(hit, `${char} at ${tx},${ty}`).toBe(true)
      }
    }
  }
})

it('paints every real map, fog included, without throwing', () => {
  for (const world of Object.values(WORLDS)) {
    const ctx = recorder()
    const lockedRects = world.zones.map((zone) => zone.rect)
    expect(() => paintMap(ctx, world, { lockedRects }), world.id).not.toThrow()
    expect(ctx.rects.length).toBeGreaterThan(world.rows.length * world.rows[0].length)
  }
})

it('fogs the locked rects and only those', () => {
  const world = { id: 'test', rows: ['....', '....'], zones: [], portals: [] }
  const open = recorder()
  paintMap(open, world, { lockedRects: [] })
  const fogged = recorder()
  paintMap(fogged, world, { lockedRects: [{ x: 2, y: 0, w: 2, h: 2 }] })
  const extra = fogged.rects.slice(open.rects.length)
  expect(extra.length).toBeGreaterThan(0)
  expect(extra.every((r) => r.x >= 2 * TS)).toBe(true)
})

it('draws the hero in every look and anim, and the look changes the colors', () => {
  for (const anim of ANIMS) {
    for (let i = 0; i < LOOK_COLORS.hood.length; i++) {
      const ctx = recorder()
      drawHero(ctx, 16, 16, { look: { hood: i, outfit: i, hair: i }, anim, t: 0.3, p: 0.5 })
      expect(ctx.rects.length, `${anim} ${i}`).toBeGreaterThan(40)
    }
  }
  const styles = (l) => {
    const ctx = recorder()
    drawHero(ctx, 0, 0, { look: l })
    return new Set(ctx.rects.map((r) => r.style))
  }
  expect(styles(look)).not.toEqual(styles({ hood: 3, outfit: 5, hair: 2 }))
  expect(() => drawHero(recorder(), 0, 0, { look: { hood: 99, outfit: -1 } })).not.toThrow()
})

it('draws every enemy sprite in every anim, elite or not', () => {
  for (const sprite of SPRITES) {
    for (const anim of ANIMS) {
      for (const elite of [false, true]) {
        const ctx = recorder()
        drawEnemy(ctx, 32, 32, { sprite, anim, t: 0.5, p: 0.4, elite })
        expect(ctx.rects.length, `${sprite} ${anim}`).toBeGreaterThan(30)
      }
    }
  }
  expect(() => drawEnemy(recorder(), 0, 0, { sprite: 'nope' })).not.toThrow()
})

it('gives each enemy sprite its own drawing', () => {
  const prints = SPRITES.map((sprite) => {
    const ctx = recorder()
    drawEnemy(ctx, 32, 32, { sprite, t: 0 })
    return ctx.rects.map((r) => `${r.x},${r.y},${r.style}`).join('|')
  })
  expect(new Set(prints).size).toBe(SPRITES.length)
})

it('the light pass leaves out the fireflies with reduced motion', () => {
  const pixels = (reduced) => {
    const ctx = recorder()
    ctx.canvas = { width: 512, height: 320 }
    paintLight(ctx, 2, { lights: [{ x: 10, y: 10, r: 30, rgb: '255,190,100', a: 0.4 }], reduced })
    return ctx.rects.filter((r) => r.w <= 3 && r.h <= 3).length
  }
  expect(pixels(false)).toBeGreaterThan(0)
  expect(pixels(true)).toBe(0)
})

it('names the zone in its label', () => {
  render(
    <I18nProvider locale="en">
      <GameScene world={FLORESTA_JS} zoneRect={z1} lockedRects={[]} look={look} />
    </I18nProvider>,
  )
  const scene = screen.getByRole('img')
  expect(scene).toHaveAccessibleName(/JavaScript Forest, area 1/)
  expect(scene.tagName).toBe('CANVAS')
  expect(scene).toHaveAttribute('width', String(32 * TS))
  expect(scene).toHaveAttribute('height', String(20 * TS))
})

it('names the second zone from its rect, in Portuguese too', () => {
  render(
    <I18nProvider locale="pt-BR">
      <GameScene world={FLORESTA_JS} zoneRect={ZONES['floresta-js'].z2.rect} lockedRects={[]} look={look} />
    </I18nProvider>,
  )
  expect(screen.getByRole('img')).toHaveAccessibleName(/Floresta do JavaScript, área 2/)
})

it('does not throw when the canvas has no 2D context', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const onReady = vi.fn()
  const { unmount } = render(<GameScene world={FLORESTA_JS} zoneRect={z1} lockedRects={[z1]} look={look} onReady={onReady} />)
  expect(screen.getByRole('img')).toBeInTheDocument()
  expect(onReady).toHaveBeenCalledTimes(1)
  unmount()
})

// A context that takes every call, so the scene runs its full path in jsdom.
function anyContext(canvas) {
  const store = { canvas, createRadialGradient: () => ({ addColorStop() {} }) }
  return new Proxy(store, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: (target, key, value) => {
      target[key] = value
      return true
    },
  })
}

it('animates with requestAnimationFrame and stops on unmount', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return anyContext(this)
  })
  const raf = vi.fn(() => 7)
  const caf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  const { unmount } = render(<GameScene world={FLORESTA_JS} zoneRect={z1} lockedRects={[]} look={look} enemy={{ sprite: 'slime' }} />)
  expect(raf).toHaveBeenCalled()
  unmount()
  expect(caf).toHaveBeenCalledWith(7)
})

it('draws one still frame and no loop with reduced motion', () => {
  reduce = true
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return anyContext(this)
  })
  const raf = vi.fn(() => 1)
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  render(<GameScene world={FLORESTA_JS} zoneRect={z1} lockedRects={[]} look={look} />)
  expect(getContext).toHaveBeenCalled()
  expect(raf).not.toHaveBeenCalled()
})

it('plays a fight back: a loop runs under reduced motion and draws floating text', () => {
  reduce = true
  const texts = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const ctx = anyContext(this)
    ctx.fillText = (text) => texts.push(text)
    return ctx
  })
  let tick = null
  const raf = vi.fn((cb) => {
    tick = cb
    return 3
  })
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const log = [
    { t: 100, who: 'hero', type: 'hit', amount: 42, element: 'physical' },
    { t: 600, who: 'hero', type: 'dodge' },
  ]
  const fights = [{ won: true, reason: 'killed', ms: 2000, heroHpLeft: 5, potionsUsed: { hp: 0, mp: 0 }, log }]
  render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} enemy={{ sprite: 'slime' }} playback={{ fights, loop: true, speed: 1 }} />)
  expect(raf).toHaveBeenCalled()
  const start = performance.now()
  tick(start + 1500 + 400)
  tick(start + 1500 + 800)
  expect(texts).toContain('42')
  expect(texts).toContain('Dodge')
})
