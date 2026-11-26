import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK } from '../../../../shared/game/look.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import WorldPageSkeleton from '../../../pages/world-page/world-page-skeleton.jsx'
import GameView from '../game-view.jsx'
import { heroSprite } from '../hero/hero-cache.js'
import HeroLoading, { filledAt, SEGMENTS, TIP_COUNT, TIP_MS } from './hero-loading.jsx'
import { forgetHero, knownHero, rememberHero } from './hero-memory.js'

// The real sprites, watched: the screen must walk the hero it was given or remembers.
vi.mock('../hero/hero-cache.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, heroSprite: vi.fn(actual.heroSprite) }
})

const LOOK = { skin: 2, hairStyle: 4, hairColor: 6, eyeStyle: 1, eyeColor: 3, outfit: 7 }

// A 2D context that takes every call (gradients included), so the scene paints in jsdom.
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

let reduce
let drawing
beforeEach(() => {
  reduce = false
  drawing = true
  vi.stubGlobal('matchMedia', (query) => ({ matches: reduce && query.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!drawing) return null
    this.ctx ??= anyContext(this)
    return this.ctx
  })
  vi.mocked(heroSprite).mockClear()
  forgetHero()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ui = (node, locale = 'pt-BR') => render(<I18nProvider locale={locale}>{node}</I18nProvider>)

it('is a busy status named for the hero, in both languages', () => {
  const { unmount } = ui(<HeroLoading />)
  const status = screen.getByRole('status', { name: 'Carregando seu herói' })
  expect(status).toHaveAttribute('aria-busy', 'true')
  unmount()
  ui(<HeroLoading />, 'en')
  expect(screen.getByRole('status', { name: 'Loading your hero' })).toBeInTheDocument()
})

it('takes the label a page gives it', () => {
  ui(<HeroLoading label="Carregando o mundo" />)
  expect(screen.getByRole('status', { name: 'Carregando o mundo' })).toBeInTheDocument()
})

it('rotates the tips on a timer', () => {
  vi.useFakeTimers()
  ui(<HeroLoading />)
  const shown = () => document.querySelector('[data-tip]')
  const first = Number(shown().dataset.tip)
  expect(shown().textContent.length).toBeGreaterThan(10)
  act(() => vi.advanceTimersByTime(TIP_MS))
  expect(Number(shown().dataset.tip)).toBe((first + 1) % TIP_COUNT)
  act(() => vi.advanceTimersByTime(TIP_MS))
  expect(Number(shown().dataset.tip)).toBe((first + 2) % TIP_COUNT)
})

it('has a tip in each language for every index', () => {
  for (const locale of ['pt-BR', 'en']) {
    const { unmount } = ui(<HeroLoading />, locale)
    expect(document.querySelector('[data-tip]').textContent).not.toMatch(/^gameLoading\./)
    unmount()
  }
})

it('fills the bar in segments over time and leaves the last one for the load', () => {
  expect(filledAt(0)).toBe(1)
  expect(filledAt(1000)).toBeGreaterThan(filledAt(300))
  expect(filledAt(60_000)).toBe(SEGMENTS - 1)
  vi.useFakeTimers()
  ui(<HeroLoading />)
  const lit = () => document.querySelectorAll('[data-lit]').length
  expect(lit()).toBe(1)
  act(() => vi.advanceTimersByTime(2000))
  expect(lit()).toBeGreaterThan(4)
  act(() => vi.advanceTimersByTime(30_000))
  expect(lit()).toBe(SEGMENTS - 1)
})

it('animates with requestAnimationFrame and cancels the loop on unmount', () => {
  const raf = vi.fn(() => 7)
  const caf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  const { unmount } = ui(<HeroLoading />)
  expect(raf).toHaveBeenCalled()
  // One frame runs and asks for the next.
  act(() => raf.mock.calls[0][0](16))
  expect(raf).toHaveBeenCalledTimes(2)
  unmount()
  expect(caf).toHaveBeenCalledWith(7)
})

it('with reduced motion paints one still frame and starts no loop', () => {
  reduce = true
  const raf = vi.fn(() => 1)
  vi.stubGlobal('requestAnimationFrame', raf)
  ui(<HeroLoading look={LOOK} />)
  expect(raf).not.toHaveBeenCalled()
  expect(heroSprite).toHaveBeenCalledWith(LOOK, {}, 'idle0')
})

it('starts no loop when the canvas cannot draw', () => {
  drawing = false
  const raf = vi.fn(() => 1)
  vi.stubGlobal('requestAnimationFrame', raf)
  ui(<HeroLoading />)
  expect(raf).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toBeInTheDocument()
})

it('walks the hero it is given, else the one the browser remembers, else a newcomer', () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const gear = { weapon: { b: 'espada', r: 'epic' } }
  const first = ui(<HeroLoading look={LOOK} gear={gear} />)
  expect(heroSprite).toHaveBeenCalledWith(LOOK, gear, 'idle1')
  first.unmount()

  rememberHero({ ...LOOK, outfit: 1 }, gear)
  vi.mocked(heroSprite).mockClear()
  const second = ui(<HeroLoading />)
  expect(heroSprite).toHaveBeenCalledWith({ ...LOOK, outfit: 1 }, gear, 'idle0')
  second.unmount()

  forgetHero()
  localStorage.clear()
  vi.mocked(heroSprite).mockClear()
  ui(<HeroLoading />)
  const [look, drawn] = vi.mocked(heroSprite).mock.calls[0]
  expect({ ...look, hairColor: 0 }).toEqual(DEFAULT_LOOK)
  expect(drawn).toEqual({})
})

it('remembers a hero across reloads and ignores anything that is not a look', () => {
  rememberHero({ nope: true }, {})
  expect(knownHero()).toBeNull()
  rememberHero(LOOK, { chest: { b: 'armadura', r: 'rare' }, junk: { b: 'x' } })
  forgetHero()
  expect(knownHero()).toEqual({ look: LOOK, gear: { chest: { b: 'armadura', r: 'rare' } } })
})

it('stands in for the hunt while the game View loads', () => {
  const api = new Proxy({}, { get: () => vi.fn(() => new Promise(() => {})) })
  ui(
    <MemoryRouter>
      <GameView worldId="floresta-js" api={api} onLeave={vi.fn()} studyHref="/daily" />
    </MemoryRouter>,
  )
  const status = screen.getByRole('status', { name: 'Carregando seu herói' })
  expect(within(status).getByText('Dica')).toBeInTheDocument()
})

it('stands in for the map while the world page loads', () => {
  ui(<WorldPageSkeleton />)
  const status = screen.getByRole('status', { name: 'Carregando o mundo' })
  expect(status).toHaveAttribute('aria-busy', 'true')
  expect(within(status).getByText('Dica')).toBeInTheDocument()
  expect(screen.getAllByRole('status')).toHaveLength(1)
})
