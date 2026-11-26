import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SPRITES } from '../../../../shared/game/enemies.js'
import { ZONES } from '../../../../shared/game/zones.js'
import { FLORESTA_JS } from '../../../../shared/world/maps/floresta-js.js'
import { TILES } from '../../../../shared/world/tiles.js'
import { WORLDS } from '../../../../shared/world/worlds.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { DEFAULT_LOOK } from '../../../../shared/game/look.js'
import { clearHeroCache, heroSprite } from '../hero/hero-cache.js'
import { ANIMS, drawEnemy } from './actors.js'
import GameScene, { dollAt, fightSpot, heroFrame } from './game-scene.jsx'
import { paintLight } from './light.js'
import * as tiles from './tiles.js'
import { paintMap, paintPadlock, TS } from './tiles.js'

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

const look = DEFAULT_LOOK
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
    expect(() => paintMap(ctx, world), char).not.toThrow()
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const hit = ctx.rects.some((r) => r.x >= tx * TS && r.x < (tx + 1) * TS && r.y >= ty * TS && r.y < (ty + 1) * TS)
        expect(hit, `${char} at ${tx},${ty}`).toBe(true)
      }
    }
  }
})

it('paints every real map without throwing', () => {
  for (const world of Object.values(WORLDS)) {
    const ctx = recorder()
    expect(() => paintMap(ctx, world), world.id).not.toThrow()
    expect(ctx.rects.length).toBeGreaterThan(world.rows.length * world.rows[0].length)
  }
})

it('never fogs a zone: a map paints the same with its zones or without them', () => {
  // A small map with a door into zone 2, so the comparison stays quick.
  const world = { id: 'test', rows: ['..D...', '..D...'], zones: [{ id: 'z2', rect: { x: 3, y: 0, w: 3, h: 2 } }], portals: [] }
  const zoned = recorder()
  paintMap(zoned, world, { lockedRects: world.zones.map((zone) => zone.rect) })
  const bare = recorder()
  paintMap(bare, { ...world, zones: [] })
  expect(zoned.rects).toEqual(bare.rects)
  expect(tiles.paintFog).toBeUndefined()
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
      <GameScene world={FLORESTA_JS} zoneRect={z1} look={look} />
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
      <GameScene world={FLORESTA_JS} zoneRect={ZONES['floresta-js'].z2.rect} look={look} />
    </I18nProvider>,
  )
  expect(screen.getByRole('img')).toHaveAccessibleName(/Floresta do JavaScript, área 2/)
})

it('does not throw when the canvas has no 2D context', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const onReady = vi.fn()
  const { unmount } = render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} onReady={onReady} />)
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
  const { unmount } = render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} enemy={{ sprite: 'slime' }} />)
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
  render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} />)
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

// The hero doll: a recording context, and the sprite canvases the scene put on the map.
function drawing() {
  const images = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const ctx = anyContext(this)
    ctx.drawImage = (img, ...rest) => images.push({ img, rest })
    return ctx
  })
  return images
}

it('maps each anim to a hero pose, with a 1px bob only while walking', () => {
  expect(heroFrame('idle', 0, 0, false).pose).toBe('idle0')
  expect(heroFrame('idle', 0, 0.6, false).pose).toBe('idle1')
  expect(heroFrame('idle', 0, 1.1, false).pose).toBe('idle0')
  expect(heroFrame('walk', 0.5, 0, false)).toMatchObject({ pose: 'idle0', bob: 0 })
  expect(heroFrame('walk', 0.5, 0.6, false)).toMatchObject({ pose: 'idle1', bob: 1 })
  expect(heroFrame('attack', 0.1, 0, false).pose).toBe('atk1')
  expect(heroFrame('attack', 0.5, 0, false).pose).toBe('atk2')
  expect(heroFrame('attack', 0.9, 0, false).pose).toBe('atk3')
  expect(heroFrame('hurt', 0.3, 0, false).pose).toBe('hurt')
  expect(heroFrame('death', 0.5, 0, false).pose).toBe('dead')
})

it('holds idle0 with no bob under reduced motion', () => {
  for (const anim of ['idle', 'walk']) {
    for (const t of [0, 0.6, 1.2]) expect(heroFrame(anim, 0.5, t, true)).toMatchObject({ pose: 'idle0', bob: 0 })
  }
  expect(heroFrame('attack', 0.5, 0, true).pose).toBe('atk2')
  expect(heroFrame('hurt', 0.5, 0, true).pose).toBe('hurt')
})

it('lunges up to 3px toward the foe mid swing and knocks back 2px when hurt', () => {
  const at = (p) => heroFrame('attack', p, 0, false).dx
  expect(at(0)).toBe(0)
  expect(at(0.5)).toBe(3)
  expect(at(0.2)).toBeGreaterThan(0)
  expect(at(0.2)).toBeLessThan(3)
  expect(at(0.95)).toBeLessThan(3)
  for (let p = 0; p <= 1; p += 0.05) expect(Math.abs(at(p))).toBeLessThanOrEqual(3)
  expect(heroFrame('hurt', 0.1, 0, false).dx).toBe(-2)
  expect(heroFrame('idle', 0, 0.6, false).dx).toBe(0)
  expect(heroFrame('walk', 0.5, 0.6, false).dx).toBe(0)
  expect(heroFrame('death', 0.5, 0, false).dx).toBe(0)
})

it('holds still under reduced motion: no lunge, no knockback', () => {
  for (const p of [0.2, 0.5, 0.8]) {
    expect(heroFrame('attack', p, 0, true).dx).toBe(0)
    expect(heroFrame('hurt', p, 0, true).dx).toBe(0)
  }
})

it('draws the hero from heroSprite, not the 16px art', () => {
  clearHeroCache()
  const images = drawing()
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} gear={{}} />)
  expect(images.some((d) => d.img === heroSprite(look, {}, 'idle0'))).toBe(true)
  expect(images.some((d) => d.img instanceof HTMLCanvasElement)).toBe(true)
})

it('shows a different sprite for different gear', () => {
  clearHeroCache()
  const images = drawing()
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const gear = { weapon: { b: 'espada', r: 'rare' } }
  const bare = heroSprite(look, {}, 'idle0')
  const armed = heroSprite(look, gear, 'idle0')
  expect(armed).not.toBe(bare)
  render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} gear={gear} />)
  expect(images.some((d) => d.img === armed)).toBe(true)
  expect(images.some((d) => d.img === bare)).toBe(false)
})

it('draws only idle0 for the hero with reduced motion', () => {
  reduce = true
  clearHeroCache()
  const images = drawing()
  render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} gear={{}} />)
  expect(images.some((d) => d.img === heroSprite(look, {}, 'idle0'))).toBe(true)
  expect(images.some((d) => d.img === heroSprite(look, {}, 'idle1'))).toBe(false)
})

it('puts the doll feet on the ground line of the 16px hero, body box centered on its tile', () => {
  const images = drawing()
  render(<GameScene world={FLORESTA_JS} zoneRect={z1} look={look} gear={{}} />)
  const spot = fightSpot(FLORESTA_JS, z1)
  const hit = images.find((d) => d.img === heroSprite(look, {}, 'idle0'))
  expect(hit.rest[1] + 43).toBe(spot.hero.y * TS + 15)
  expect(hit.rest[0] + 10 + 16).toBe(spot.hero.x * TS + 8)
})

it('paints a gold padlock inside the tile it is given', () => {
  const ctx = recorder()
  paintPadlock(ctx, 3, 2)
  expect(ctx.rects.length).toBeGreaterThan(20)
  expect(ctx.rects.every((r) => r.x >= 3 * TS && r.x < 4 * TS && r.y >= 2 * TS && r.y < 3 * TS)).toBe(true)
  expect(ctx.rects.some((r) => r.style === '#f2c14e')).toBe(true)
})

it('places the doll so its feet stand on the tile it is given', () => {
  const at = dollAt(5 * TS, 4 * TS)
  expect(at.y + 43).toBe(4 * TS + 15)
  expect(at.x + 10 + 16).toBe(5 * TS + 8)
})
