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
import GameScene, { fightSpot, heroFrame } from './game-scene.jsx'
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
