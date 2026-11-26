import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BASES, RARITIES } from '../../../../shared/game/items.js'
import { DEFAULT_LOOK, LOOK_OPTIONS } from '../../../../shared/game/look.js'
import { POSES, paintHero, paintHeroDead, SPRITE } from './draw-hero.js'
import { gearOf } from './gear.js'
import { clearHeroCache, heroSprite } from './hero-cache.js'
import { HEAD_CROP, HeroCanvas } from './hero-canvas.jsx'

// A 2D context that records every pixel the painter puts down (with its color and alpha).
function recorder(canvas) {
  const rects = []
  const ctx = {
    canvas,
    rects,
    fillStyle: '',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillRect(x, y, w, h) {
      rects.push(`${x},${y},${w},${h},${ctx.fillStyle},${ctx.globalAlpha}`)
    },
    clearRect() {},
    drawImage() {},
  }
  return ctx
}

// What a painted sprite looks like, as one comparable string.
const pixels = (canvas) => canvas.getContext('2d').rects.join('|')

let reduce
beforeEach(() => {
  reduce = false
  vi.stubGlobal('matchMedia', (query) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    this.recorded ??= recorder(this)
    return this.recorded
  })
  clearHeroCache()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('names the six poses and the grid the 32x32 body box sits in', () => {
  expect(Object.keys(POSES)).toEqual(['idle0', 'idle1', 'atk1', 'atk2', 'atk3', 'hurt'])
  expect(SPRITE.w).toBeGreaterThanOrEqual(SPRITE.ox + 32)
  expect(SPRITE.h).toBeGreaterThanOrEqual(SPRITE.oy + 32)
})

// FNV-1a of the recorded pixels. The expected values were taken from the approved spike
// (scratchpad hero-spike/hero.js) with this same recorder, so they pin the art pixel for pixel.
const fingerprint = (canvas) => {
  const s = pixels(canvas)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

it('paints exactly what the approved spike painted', () => {
  const G = (b, r) => ({ b, r })
  const look = { ...DEFAULT_LOOK, hairStyle: 1 }
  const legendary = {
    helm: G('capacete-de-ferro', 'legendary'),
    chest: G('armadura', 'legendary'),
    boots: G('botas', 'legendary'),
    weapon: G('espada', 'legendary'),
    offhand: G('escudo', 'legendary'),
    amulet: G('amuleto', 'legendary'),
    relic: G('teclado-runico', 'legendary'),
    ring: G('anel-de-bits', 'legendary'),
  }
  const rare = {
    helm: G('capacete-de-ferro', 'rare'),
    chest: G('colete-de-dev', 'rare'),
    boots: G('tenis-veloz', 'rare'),
    weapon: G('cajado', 'rare'),
    offhand: G('livro-de-regras', 'rare'),
    amulet: G('colar-de-logs', 'rare'),
    relic: G('pergaminho-antigo', 'rare'),
  }
  const curly = { skin: 3, hairStyle: 4, hairColor: 1, eyeStyle: 3, eyeColor: 0, outfit: 2 }
  const ponytail = { skin: 2, hairStyle: 3, hairColor: 3, eyeStyle: 2, eyeColor: 2, outfit: 1 }
  expect(fingerprint(paintHero(look, {}))).toBe('369a41df')
  expect(fingerprint(paintHero(look, legendary, 'atk2'))).toBe('84e1d69c')
  expect(fingerprint(paintHero(curly, rare, 'hurt'))).toBe('c9600ade')
  expect(fingerprint(paintHero(ponytail, { helm: G('capuz', 'epic'), weapon: G('martelo', 'epic') }, 'idle1'))).toBe('eeddfed5')
  expect(fingerprint(paintHeroDead(look, { ...legendary, helm: G('capuz', 'rare') }))).toBe('553f13c5')
})

it('paints every pose with every base in every rarity without throwing', () => {
  for (const base of BASES) {
    for (const r of RARITIES) {
      const gear = { [base.slot]: { b: base.id, r } }
      for (const pose of Object.keys(POSES)) {
        const canvas = paintHero(DEFAULT_LOOK, gear, pose)
        expect(canvas.width).toBe(SPRITE.w)
        expect(canvas.height).toBe(SPRITE.h)
        expect(canvas.getContext('2d').rects.length, `${base.id} ${r} ${pose}`).toBeGreaterThan(300)
      }
      expect(() => paintHeroDead(DEFAULT_LOOK, gear), `${base.id} ${r} dead`).not.toThrow()
    }
  }
})

it('paints a full legendary set in every pose, aura and sparkles included', () => {
  const gear = Object.fromEntries(BASES.map((base) => [base.slot, { b: base.id, r: 'legendary' }]))
  for (const pose of Object.keys(POSES)) expect(() => paintHero(DEFAULT_LOOK, gear, pose)).not.toThrow()
  expect(pixels(paintHero(DEFAULT_LOOK, gear))).not.toBe(pixels(paintHero(DEFAULT_LOOK, { ...gear, relic: undefined })))
})

it('every look field changes the pixels', () => {
  const plain = pixels(paintHero(DEFAULT_LOOK, {}))
  for (const field of Object.keys(LOOK_OPTIONS)) {
    for (let i = 1; i < LOOK_OPTIONS[field]; i++) {
      expect(pixels(paintHero({ ...DEFAULT_LOOK, [field]: i }, {})), `${field} ${i}`).not.toBe(plain)
    }
  }
})

it('every base and every rarity changes the pixels', () => {
  const plain = pixels(paintHero(DEFAULT_LOOK, {}))
  for (const base of BASES) {
    const seen = new Set()
    for (const r of RARITIES) {
      const painted = pixels(paintHero(DEFAULT_LOOK, { [base.slot]: { b: base.id, r } }))
      expect(painted, `${base.id} ${r}`).not.toBe(plain)
      seen.add(painted)
    }
    expect(seen.size, base.id).toBeGreaterThan(1)
  }
})

it('the poses differ from each other, and death differs from all of them', () => {
  const gear = { weapon: { b: 'espada', r: 'rare' }, helm: { b: 'capuz', r: 'rare' } }
  const all = [...Object.keys(POSES).map((pose) => pixels(paintHero(DEFAULT_LOOK, gear, pose))), pixels(paintHeroDead(DEFAULT_LOOK, gear))]
  expect(new Set(all).size).toBe(all.length)
  expect(pixels(paintHero(DEFAULT_LOOK, gear, 'nope'))).toBe(all[0])
})

it('skips unknown base ids, wrong slots and missing gear without throwing', () => {
  const plain = pixels(paintHero(DEFAULT_LOOK, {}))
  const future = {
    helm: { b: 'tiara', r: 'epic' },
    amulet: { b: 'espada', r: 'rare' },
    ring: { b: 'anel-de-ouro', r: 'rare' },
    weapon: { b: 'arco', r: 'legendary' },
    chest: { b: 'manto', r: 'legendary' },
    offhand: { b: 'tocha', r: 'legendary' },
    boots: { b: 'sandalia', r: 'rare' },
    relic: { b: 'cristal', r: 'rare' },
  }
  for (const pose of Object.keys(POSES)) expect(pixels(paintHero(DEFAULT_LOOK, future, pose))).toBe(pixels(paintHero(DEFAULT_LOOK, {}, pose)))
  expect(pixels(paintHero(DEFAULT_LOOK, future))).toBe(plain)
  expect(() => paintHeroDead(DEFAULT_LOOK, future)).not.toThrow()
  for (const junk of [null, undefined, 'x', { helm: null }, { helm: 'capuz' }, { weapon: { r: 'rare' } }]) {
    expect(() => paintHero(DEFAULT_LOOK, junk)).not.toThrow()
    expect(() => paintHeroDead(DEFAULT_LOOK, junk)).not.toThrow()
  }
})

it('an unknown rarity paints as common instead of throwing', () => {
  const odd = pixels(paintHero(DEFAULT_LOOK, { chest: { b: 'armadura', r: 'mythic' } }))
  expect(odd).toBe(pixels(paintHero(DEFAULT_LOOK, { chest: { b: 'armadura', r: 'common' } })))
})

it('a legacy or junk look paints as its normalized look', () => {
  expect(pixels(paintHero({ hood: 3, outfit: 5, hair: 2 }, {}))).toBe(pixels(paintHero({ ...DEFAULT_LOOK, outfit: 5, hairColor: 2 }, {})))
  for (const junk of [null, undefined, 'x', 7, { skin: 99, hairStyle: -1 }]) {
    expect(pixels(paintHero(junk, {})), String(junk)).toBe(pixels(paintHero(DEFAULT_LOOK, {})))
    expect(() => paintHeroDead(junk, {})).not.toThrow()
  }
})

it('gearOf maps equipped gear to { b, r } by slot, uniques through their base', () => {
  const items = [
    { kind: 'gear', base: 'capuz', slot: 'helm', rarity: 'rare', equipped: 'helm' },
    { kind: 'gear', base: 'cajado', slot: 'weapon', rarity: 'legendary', unique: 'excalibug', equipped: 'weapon' },
    { kind: 'gear', base: 'anel', slot: 'ring', rarity: 'legendary', unique: 'not-a-unique', equipped: 'ring' },
    { kind: 'gear', base: 'armadura', slot: 'chest', rarity: 'epic', equipped: null },
    { kind: 'gem', gem: 'logica', equipped: 'chest' },
    { kind: 'gear', base: 'botas', slot: 'boots', rarity: 'common', equipped: 'nowhere' },
    null,
  ]
  expect(gearOf(items)).toEqual({
    helm: { b: 'capuz', r: 'rare' },
    weapon: { b: 'espada', r: 'legendary' },
    ring: { b: 'anel', r: 'legendary' },
  })
  expect(gearOf(undefined)).toEqual({})
  expect(gearOf([])).toEqual({})
})

it('the cache hands back the same canvas for the same look, gear and pose', () => {
  const gear = { helm: { b: 'capuz', r: 'rare' } }
  const first = heroSprite(DEFAULT_LOOK, gear, 'idle0')
  expect(heroSprite({ ...DEFAULT_LOOK }, { helm: { b: 'capuz', r: 'rare' } }, 'idle0')).toBe(first)
  expect(heroSprite(DEFAULT_LOOK, gear, 'idle1')).not.toBe(first)
  expect(heroSprite(DEFAULT_LOOK, { helm: { b: 'capuz', r: 'epic' } }, 'idle0')).not.toBe(first)
  expect(heroSprite({ ...DEFAULT_LOOK, skin: 1 }, gear, 'idle0')).not.toBe(first)
  expect(pixels(heroSprite(DEFAULT_LOOK, gear, 'dead'))).toBe(pixels(paintHeroDead(DEFAULT_LOOK, gear)))
})

it('the cache keeps at most 64 sprites, dropping the least recently used', () => {
  const look = (i) => ({ ...DEFAULT_LOOK, skin: i % 5, outfit: Math.floor(i / 5) % 8, hairColor: Math.floor(i / 40) })
  const first = heroSprite(look(0), {}, 'idle0')
  const second = heroSprite(look(1), {}, 'idle0')
  for (let i = 2; i < 64; i++) heroSprite(look(i), {}, 'idle0')
  expect(heroSprite(look(0), {}, 'idle0')).toBe(first)
  heroSprite(look(64), {}, 'idle0')
  expect(heroSprite(look(0), {}, 'idle0')).toBe(first)
  expect(heroSprite(look(1), {}, 'idle0')).not.toBe(second)
})

it('HeroCanvas is an image with its label, sized by scale', () => {
  render(<HeroCanvas look={DEFAULT_LOOK} gear={{}} scale={3} label="Herói" />)
  const img = screen.getByRole('img', { name: 'Herói' })
  expect(img.width).toBe(SPRITE.w * 3)
  expect(img.height).toBe(SPRITE.h * 3)
})

it('HeroCanvas crop="head" draws only the head box', () => {
  render(<HeroCanvas look={DEFAULT_LOOK} gear={{}} scale={2} crop="head" label="Rosto" />)
  const img = screen.getByRole('img', { name: 'Rosto' })
  expect(img.width).toBe(HEAD_CROP.w * 2)
  expect(img.height).toBe(HEAD_CROP.h * 2)
})

it('HeroCanvas animates the idle loop with requestAnimationFrame and stops on unmount', () => {
  const raf = vi.fn(() => 9)
  const caf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  const { unmount } = render(<HeroCanvas look={DEFAULT_LOOK} gear={{}} animate label="Herói" />)
  expect(raf).toHaveBeenCalled()
  unmount()
  expect(caf).toHaveBeenCalledWith(9)
})

// Records the sprites HeroCanvas copies onto its own canvas.
function watchDrawImage() {
  const images = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!this.recorded) {
      this.recorded = recorder(this)
      this.recorded.drawImage = (img) => images.push(img)
    }
    return this.recorded
  })
  return images
}

it('HeroCanvas shows idle0 and starts no loop with reduced motion', () => {
  reduce = true
  const raf = vi.fn(() => 1)
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const images = watchDrawImage()
  render(<HeroCanvas look={DEFAULT_LOOK} gear={{}} animate label="Herói" />)
  expect(raf).not.toHaveBeenCalled()
  expect(images.length).toBeGreaterThan(0)
  expect(images.every((img) => img === heroSprite(DEFAULT_LOOK, {}, 'idle0'))).toBe(true)
  expect(screen.getByRole('img').getContext('2d').imageSmoothingEnabled).toBe(false)
})

it('HeroCanvas without animate starts no loop and shows the given pose', () => {
  const raf = vi.fn(() => 1)
  vi.stubGlobal('requestAnimationFrame', raf)
  const images = watchDrawImage()
  render(<HeroCanvas look={DEFAULT_LOOK} gear={{}} pose="hurt" label="Herói" />)
  expect(raf).not.toHaveBeenCalled()
  expect(images.at(-1)).toBe(heroSprite(DEFAULT_LOOK, {}, 'hurt'))
})
