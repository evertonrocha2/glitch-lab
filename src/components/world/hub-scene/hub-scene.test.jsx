import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK } from '../../../../shared/game/look.js'
import { worldById } from '../../../../shared/world/worlds.js'
import { heroSprite } from '../../game/hero/hero-cache.js'
import { paintPadlock } from '../../game/scene/tiles.js'
import HubScene from './hub-scene.jsx'

vi.mock('../../game/hero/hero-cache.js', () => ({ heroSprite: vi.fn(() => ({ hero: true })) }))
vi.mock('../../game/scene/tiles.js', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, paintPadlock: vi.fn(real.paintPadlock) }
})

const cave = worldById('caverna-sql')
const lab = worldById('laboratorio')
const look = { ...DEFAULT_LOOK, hairStyle: 3, outfit: 5 }
const gear = { weapon: { b: 'espada', r: 'rare' } }

// A context that takes every call; it keeps what the hero test needs to read.
function anyContext(canvas, log) {
  const store = {
    canvas,
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage: (img, x, y) => log.images.push({ img, x, y }),
    scale: (x, y) => log.scales.push([x, y]),
  }
  return new Proxy(store, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: (target, key, value) => {
      target[key] = value
      return true
    },
  })
}

let reduce
let log
let frames
beforeEach(() => {
  reduce = false
  log = { images: [], scales: [] }
  frames = []
  vi.stubGlobal('matchMedia', (query) => ({ matches: reduce && query.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return anyContext(this, log)
  })
  vi.mocked(heroSprite).mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Runs the frames waiting, at `ms` milliseconds.
const tick = (ms) =>
  act(() => {
    const waiting = frames.splice(0)
    for (const cb of waiting) cb(ms)
  })

const hero = (x, y, more = {}) => ({ world: cave.id, x, y, facing: 'down', frame: 0, ...more })
const draw = (props = {}) => render(<HubScene world={cave} hero={hero(3, 10)} look={look} gear={gear} crop={{ w: 24, h: 15 }} onTileClick={() => {}} {...props} />)
const heroDraws = () => log.images.filter((d) => d.img?.hero)
const lastPose = () => vi.mocked(heroSprite).mock.calls.at(-1)

it('is a pixel canvas hidden from screen readers, as big as the crop', () => {
  const { container } = draw()
  const canvas = container.querySelector('canvas')
  expect(canvas).toHaveAttribute('aria-hidden', 'true')
  expect(canvas).toHaveAttribute('width', String(24 * 16))
  expect(canvas).toHaveAttribute('height', String(15 * 16))
})

it('draws the hero with the look and gear it is given', () => {
  draw()
  expect(heroSprite).toHaveBeenCalledWith(look, gear, expect.stringMatching(/^idle[01]$/))
  expect(heroDraws().length).toBeGreaterThan(0)
})

it('swaps the idle frames once per step while walking, and bobs on the second', () => {
  const { rerender } = draw()
  tick(0)
  const still = heroDraws().at(-1)
  rerender(<HubScene world={cave} hero={hero(4, 10, { facing: 'right', frame: 1 })} look={look} gear={gear} crop={{ w: 24, h: 15 }} onTileClick={() => {}} />)
  tick(140)
  expect(lastPose()[2]).toBe('idle1')
  // Now standing on (4,10): one tile right of where it stood, one pixel lower for the bob.
  expect(heroDraws().at(-1).x).toBe(still.x + 16)
  expect(heroDraws().at(-1).y).toBe(still.y + 1)
  rerender(<HubScene world={cave} hero={hero(5, 10, { facing: 'right', frame: 0 })} look={look} gear={gear} crop={{ w: 24, h: 15 }} onTileClick={() => {}} />)
  tick(280)
  expect(lastPose()[2]).toBe('idle0')
})

it('breathes idle when it has stopped walking', () => {
  const { rerender } = draw()
  tick(0)
  rerender(<HubScene world={cave} hero={hero(4, 10, { facing: 'right', frame: 1 })} look={look} gear={gear} crop={{ w: 24, h: 15 }} onTileClick={() => {}} />)
  tick(140)
  expect(lastPose()[2]).toBe('idle1')
  // Long after the last step, frame 1 no longer means walking: the idle clock picks the frame.
  tick(2100)
  expect(lastPose()[2]).toBe('idle0')
  expect(heroDraws().at(-1).y).toBe(heroDraws().at(0).y)
})

it('mirrors the hero when it faces left and keeps that side walking up', () => {
  const { rerender } = draw({ hero: hero(3, 10, { facing: 'left' }) })
  expect(log.scales).toContainEqual([-1, 1])
  log.scales.length = 0
  rerender(<HubScene world={cave} hero={hero(3, 9, { facing: 'up', frame: 1 })} look={look} gear={gear} crop={{ w: 24, h: 15 }} onTileClick={() => {}} />)
  tick(100)
  expect(log.scales).toContainEqual([-1, 1])
  log.scales.length = 0
  rerender(<HubScene world={cave} hero={hero(4, 9, { facing: 'right' })} look={look} gear={gear} crop={{ w: 24, h: 15 }} onTileClick={() => {}} />)
  tick(300)
  expect(log.scales).not.toContainEqual([-1, 1])
})

it('reports the clicked tile through the camera and the crop', () => {
  const onTileClick = vi.fn()
  const { container, rerender } = draw({ hero: hero(16, 10), onTileClick })
  const canvas = container.querySelector('canvas')
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 480, height: 300, right: 580, bottom: 350 })
  // 24 tiles in 480px, camera at 4.5,3 (the hero in the middle): 20px a tile.
  fireEvent.click(canvas, { clientX: 110, clientY: 60 })
  expect(onTileClick).toHaveBeenLastCalledWith(5, 3)
  // Zoomed in to 15x9 the same box holds bigger tiles: 32px each, camera at 9, 6.
  rerender(<HubScene world={cave} hero={hero(16, 10)} look={look} gear={gear} crop={{ w: 15, h: 9 }} onTileClick={onTileClick} />)
  fireEvent.click(canvas, { clientX: 100 + 70, clientY: 50 + 40 })
  expect(onTileClick).toHaveBeenLastCalledWith(11, 7)
})

it('draws one still frame per change and no loop with reduced motion', () => {
  reduce = true
  const { rerender } = draw()
  expect(frames).toHaveLength(0)
  expect(lastPose()[2]).toBe('idle0')
  const before = heroDraws().length
  rerender(<HubScene world={cave} hero={hero(4, 10, { facing: 'right', frame: 1 })} look={look} gear={gear} crop={{ w: 24, h: 15 }} onTileClick={() => {}} />)
  expect(frames).toHaveLength(0)
  expect(heroDraws().length).toBeGreaterThan(before)
  expect(lastPose()[2]).toBe('idle0')
})

it('copes with a canvas that has no 2D context', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const onTileClick = vi.fn()
  const { container } = render(<HubScene world={lab} hero={{ world: lab.id, x: 7, y: 5, facing: 'down', frame: 0 }} look={look} gear={{}} crop={{ w: 15, h: 10 }} onTileClick={onTileClick} />)
  const canvas = container.querySelector('canvas')
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 150, height: 100, right: 150, bottom: 100 })
  fireEvent.click(canvas, { clientX: 25, clientY: 15 })
  expect(onTileClick).toHaveBeenCalledWith(2, 1)
})

it("puts a padlock on a locked world's portal only, never on a zone's door", () => {
  vi.mocked(paintPadlock).mockClear()
  // Zones are open inside every world: a zone rect handed over by an old caller fogs nothing.
  draw({ lockedRects: cave.zones.map((zone) => zone.rect), lockedPortals: [{ x: 1, y: 10 }] })
  expect(vi.mocked(paintPadlock).mock.calls.map(([, x, y]) => [x, y])).toEqual([[1, 10]])
})
