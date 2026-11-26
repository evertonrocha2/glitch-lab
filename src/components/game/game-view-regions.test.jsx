import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { worldById } from '../../../shared/world/worlds.js'
import { I18nProvider } from '../../lib/i18n/I18nProvider.jsx'
import { SETTLE_MS } from '../world/use-auto-hunt.js'
import GameView, { FADE_MS, startPlace } from './game-view.jsx'
import { makeView } from './panel/fixtures.js'

// The one walking view (fase 3): roads between regions, hunting by standing in a zone, the town's
// keepers and terminals.

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

const HUNT = { world: 'floresta-js', zone: 'z1', difficulty: 'normal', startedAt: 0, claims: 0 }

function makeApi(view = makeView()) {
  const ok = () => vi.fn(async () => view)
  return Object.fromEntries(
    ['syncGame', 'startHunt', 'stopHunt', 'fightBoss', 'equipItem', 'unequipSlot', 'forgeUpgrade', 'forgeSalvage', 'forgeReroll', 'forgeSocket', 'openChest', 'buyPotions', 'allocateTalents', 'respecTalents', 'socketSupport', 'unsocketSupport', 'buySkill', 'upgradeSkill', 'saveLoadout', 'saveLook'].map((name) => [name, ok()]),
  )
}

function ui({ api = makeApi(), start, locale = 'pt-BR', onSave = vi.fn(async () => {}), onNpc, onWorldChange = vi.fn() } = {}) {
  render(
    <I18nProvider locale={locale}>
      <MemoryRouter>
        <GameView start={start} api={api} onSave={onSave} onNpc={onNpc} onWorldChange={onWorldChange} studyHref="/daily" />
      </MemoryRouter>
    </I18nProvider>,
  )
  return { api, onSave, onWorldChange }
}

const scene = () => screen.getByRole('region', { name: /^Glitch World: / })
const place = () => scene().dataset.place
const key = (name, type = 'keydown') => act(async () => document.body.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true })))
const tap = async (name) => {
  await key(name)
  await key(name, 'keyup')
}
const status = () => screen.getAllByRole('status').map((node) => node.textContent).join(' ')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('roads', () => {
  it('walks off the town west gate into the Forest, at the matching road tile, saving there', async () => {
    const { onSave, onWorldChange } = ui({ start: { world: 'laboratorio', x: 1, y: 13 } })
    await screen.findByRole('tablist')
    expect(place()).toBe('laboratorio 1 13')
    await tap('ArrowLeft')
    expect(place()).toBe('laboratorio 0 13')
    await act(() => vi.advanceTimersByTimeAsync(FADE_MS))
    expect(place()).toBe('floresta-js 30 11')
    expect(onWorldChange).toHaveBeenCalledWith('floresta-js')
    expect(onSave).toHaveBeenLastCalledWith({ world: 'floresta-js', x: 30, y: 11 }, { keepalive: false })
    expect(status()).toContain('Você entrou em Floresta do JavaScript')
    expect(scene()).toHaveAccessibleName('Glitch World: Floresta do JavaScript, Clareira')
  })

  it('swaps the region at once, with no fade, under reduced motion', async () => {
    window.matchMedia = (query) => ({ matches: query.includes('reduce') || query.includes('min-width'), media: query, addEventListener() {}, removeEventListener() {} })
    try {
      ui({ start: { world: 'floresta-js', x: 30, y: 10 } })
      await screen.findByRole('tablist')
      await tap('ArrowRight')
      expect(place()).toBe('laboratorio 1 12')
    } finally {
      delete window.matchMedia
    }
  })

  it('walls up the roads to ENEM regions in English, and opens them in Portuguese', async () => {
    ui({ start: { world: 'laboratorio', x: 34, y: 12 }, locale: 'en' })
    await screen.findByRole('tablist')
    await tap('ArrowRight')
    await act(() => vi.advanceTimersByTimeAsync(FADE_MS * 2))
    expect(place()).toBe('laboratorio 34 12')
  })

  it('opens the east gate to the Library in Portuguese', async () => {
    ui({ start: { world: 'laboratorio', x: 34, y: 12 } })
    await screen.findByRole('tablist')
    await tap('ArrowRight')
    await act(() => vi.advanceTimersByTimeAsync(FADE_MS))
    expect(place()).toBe('biblioteca-linguagens 1 10')
  })

  it('walks with the on-screen pad too', async () => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    try {
      ui({ start: { world: 'laboratorio', x: 16, y: 8 } })
      const pad = await screen.findByRole('group', { name: 'Andar' })
      await screen.findByRole('button', { name: 'Abrir o painel' })
      fireEvent.click(within(pad).getByRole('button', { name: 'Andar para a esquerda' }), { detail: 0 })
      expect(place()).toBe('laboratorio 15 8')
    } finally {
      delete window.matchMedia
    }
  })
})

describe('hunting where the hero stands', () => {
  it('starts a hunt in the zone the hero walks into, once it settles there', async () => {
    const { api } = ui({ start: { world: 'laboratorio', x: 1, y: 12 } })
    await screen.findByRole('tablist')
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS * 2))
    expect(api.startHunt).not.toHaveBeenCalled()
    await tap('ArrowLeft')
    await act(() => vi.advanceTimersByTimeAsync(FADE_MS))
    expect(status()).toContain('Preparando a caça em Clareira')
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS))
    expect(api.startHunt).toHaveBeenCalledWith({ world: 'floresta-js', zone: 'z1', difficulty: 'normal' })
  })

  it('stops the hunt when the hero walks back into town', async () => {
    const api = makeApi(makeView({ hunt: HUNT }))
    ui({ api, start: { world: 'floresta-js', x: 30, y: 10 } })
    await screen.findByRole('tablist')
    await tap('ArrowRight')
    await act(() => vi.advanceTimersByTimeAsync(FADE_MS))
    expect(place()).toBe('laboratorio 1 12')
    expect(api.stopHunt).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS))
    expect(api.stopHunt).toHaveBeenCalledTimes(1)
    expect(api.startHunt).not.toHaveBeenCalled()
  })

  it('moves the hunt to the next zone, on the picked difficulty', async () => {
    const api = makeApi(makeView({ hunt: HUNT, level: 30 }))
    ui({ api, start: { world: 'floresta-js', x: 22, y: 10 } })
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('tab', { name: /Mundo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Pesadelo' }))
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS))
    expect(api.startHunt).toHaveBeenLastCalledWith({ world: 'floresta-js', zone: 'z1', difficulty: 'pesadelo' })
    await tap('ArrowLeft')
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS))
    expect(api.startHunt).toHaveBeenLastCalledWith({ world: 'floresta-js', zone: 'z2', difficulty: 'pesadelo' })
  })

  it('pauses the hunt by hand until the hero leaves the zone', async () => {
    const api = makeApi(makeView({ hunt: HUNT }))
    api.stopHunt.mockResolvedValue(makeView())
    ui({ api, start: { world: 'floresta-js', x: 29, y: 10 } })
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('tab', { name: /Mundo/ }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pausar a caça aqui' })))
    expect(api.stopHunt).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS * 3))
    expect(api.startHunt).not.toHaveBeenCalled()
    expect(status()).toContain('Caça pausada em Clareira')
  })

  it('puts the hero in the zone a running hunt is in, so the hunt goes on around it', async () => {
    const { api } = ui({ api: makeApi(makeView({ hunt: { ...HUNT, zone: 'z2' } })), start: { world: 'laboratorio', x: 16, y: 8 } })
    await screen.findByRole('tablist')
    expect(place()).toMatch(/^floresta-js /)
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS * 2))
    expect(api.startHunt).not.toHaveBeenCalled()
    expect(api.stopHunt).not.toHaveBeenCalled()
  })

  it('names the zone and what an hour there pays when the hero walks in', async () => {
    ui({ start: { world: 'floresta-js', x: 29, y: 10 } })
    await screen.findByRole('tablist')
    expect(status()).toMatch(/Clareira · Tier 1/)
    expect(status()).toMatch(/Nível 1 · ~[\d.]+ XP\/h/)
    expect(status()).toMatch(/Perigo: Tranquila/)
  })

  it('calls the town safe', async () => {
    ui({ start: { world: 'laboratorio', x: 16, y: 8 } })
    await screen.findByRole('tablist')
    expect(status()).toContain('Cidade do Laboratório · Zona segura')
  })
})

describe('the town', () => {
  const merchant = worldById('laboratorio').npcs.find((npc) => npc.id === 'merchant')

  it('talks to the keeper next to the hero on Enter, through onNpc', async () => {
    const onNpc = vi.fn()
    ui({ start: { world: 'laboratorio', x: merchant.x - 1, y: merchant.y }, onNpc })
    await screen.findByRole('tablist')
    expect(screen.getByRole('button', { name: /Falar com o Mercador/ })).toBeInTheDocument()
    await key('Enter')
    expect(onNpc).toHaveBeenCalledWith('merchant')
  })

  it('says the shop opens soon when no one answers onNpc', async () => {
    ui({ start: { world: 'laboratorio', x: merchant.x + 1, y: merchant.y } })
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: /Falar com o Mercador/ }))
    expect(status()).toContain('Mercador: abre em breve.')
  })

  it('reads the quest board', async () => {
    const onNpc = vi.fn()
    const board = worldById('laboratorio').npcs.find((npc) => npc.id === 'quests')
    ui({ start: { world: 'laboratorio', x: board.x, y: board.y + 1 }, onNpc })
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: /Ler o Quadro de missões/ }))
    expect(onNpc).toHaveBeenCalledWith('quests')
  })

  it('opens a terminal in the study window after saving, once even when Enter comes again', async () => {
    let finish
    const onSave = vi.fn(() => new Promise((resolve) => {
      finish = resolve
    }))
    ui({ start: { world: 'laboratorio', x: 12, y: 7 }, onSave })
    await screen.findByRole('tablist')
    expect(screen.getByRole('button', { name: /Abrir Desafio do dia|Abrir/ })).toBeInTheDocument()
    await key('Enter')
    await key('Enter')
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ world: 'laboratorio', x: 12, y: 7 }, { keepalive: false })
    expect(screen.queryByRole('region', { name: 'Estudo' })).toBeNull()
    await act(async () => finish())
    expect(screen.getByRole('region', { name: 'Estudo' }).querySelector('iframe')).toHaveAttribute('src', '/daily?embed=1')
    expect(scene()).toBeInTheDocument()
  })

  it('opens the terminal even when the save fails', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('offline')
    })
    ui({ start: { world: 'laboratorio', x: 12, y: 7 }, onSave })
    await screen.findByRole('tablist')
    await key('Enter')
    expect(await screen.findByRole('region', { name: 'Estudo' })).toBeInTheDocument()
  })

  it('stops at walls and keepers', async () => {
    ui({ start: { world: 'laboratorio', x: merchant.x - 1, y: merchant.y } })
    await screen.findByRole('tablist')
    await tap('ArrowRight')
    expect(place()).toBe(`laboratorio ${merchant.x - 1} ${merchant.y}`)
    await tap('ArrowUp')
    expect(place()).toBe(`laboratorio ${merchant.x - 1} ${merchant.y}`)
  })
})

describe('startPlace', () => {
  const town = { world: 'laboratorio', x: 16, y: 8 }
  it('keeps the saved place without a hunt, or when the hero already stands in its zone', () => {
    expect(startPlace(town, makeView(), 'pt-BR')).toBe(town)
    const inZone = { world: 'floresta-js', x: 29, y: 10 }
    expect(startPlace(inZone, makeView({ hunt: HUNT }), 'pt-BR')).toBe(inZone)
  })
  it('moves the hero into the hunted zone otherwise', () => {
    const at = startPlace(town, makeView({ hunt: { ...HUNT, zone: 'z3' } }), 'pt-BR')
    expect(at.world).toBe('floresta-js')
    expect(at.x).toBeLessThan(11)
  })
  it('leaves a hunt in a hidden ENEM region alone (the town stops it)', () => {
    const hunt = { ...HUNT, world: 'biblioteca-linguagens' }
    expect(startPlace(town, makeView({ hunt }), 'en')).toBe(town)
    expect(startPlace(town, makeView({ hunt }), 'pt-BR').world).toBe('biblioteca-linguagens')
  })
})
