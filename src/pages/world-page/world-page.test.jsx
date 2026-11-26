import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { worldById } from '../../../shared/world/worlds.js'
import { FADE_MS } from '../../components/game/game-view.jsx'
import { gearOf } from '../../components/game/hero/gear.js'
import { heroSprite } from '../../components/game/hero/hero-cache.js'
import { makeView } from '../../components/game/panel/fixtures.js'
import { NPC_LOOKS } from '../../components/game/scene/town.js'
import { prefetchWorld, resetWorldPrefetch } from '../../components/world/world-prefetch.js'
import { getGame, getWorld, saveLook, saveWorldPosition, startHunt, syncGame } from '../../lib/api.js'
import { renderAt } from '../../test/render.jsx'

// The real sprites, watched: the scene must draw the hero the game View describes, and the keepers.
vi.mock('../../components/game/hero/hero-cache.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, heroSprite: vi.fn(actual.heroSprite) }
})

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  startStudySession: vi.fn(),
  stopStudySession: vi.fn(),
  getWorld: vi.fn(),
  saveWorldPosition: vi.fn(),
  getDaily: vi.fn().mockResolvedValue({ puzzles: [] }),
  getHunt: vi.fn().mockResolvedValue({ run: null }),
  getGame: vi.fn(),
  syncGame: vi.fn(),
  stopHunt: vi.fn(),
  startHunt: vi.fn(),
  fightBoss: vi.fn(),
  equipItem: vi.fn(),
  unequipSlot: vi.fn(),
  forgeUpgrade: vi.fn(),
  forgeSalvage: vi.fn(),
  forgeReroll: vi.fn(),
  forgeSocket: vi.fn(),
  openChest: vi.fn(),
  buyPotions: vi.fn(),
  allocateTalents: vi.fn(),
  respecTalents: vi.fn(),
  socketSupport: vi.fn(),
  unsocketSupport: vi.fn(),
  buySkill: vi.fn(),
  upgradeSkill: vi.fn(),
  saveLoadout: vi.fn(),
  saveLook: vi.fn(),
  buyMarketItem: vi.fn(),
  sellItems: vi.fn(),
  rerollMarket: vi.fn(),
  buyElixir: vi.fn(),
  buyJewel: vi.fn(),
  combineGems: vi.fn(),
  claimQuest: vi.fn(),
}))

const at = (position) => ({ position })
const open = (locale = 'pt-BR') => renderAt('/mundo', { user: 'ana', locale })
const title = () => screen.findByRole('heading', { level: 1 })
const scene = () => screen.findByRole('region', { name: /^Glitch World: / })
const key = (name, type = 'keydown') => act(async () => document.body.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true })))

// A 2D context that takes every call, so the scene draws in jsdom.
function anyContext(canvas) {
  const store = { canvas, createRadialGradient: () => ({ addColorStop() {} }), measureText: (text) => ({ width: text.length * 4 }) }
  return new Proxy(store, {
    get: (target, name) => (name in target ? target[name] : () => {}),
    set: (target, name, value) => {
      target[name] = value
      return true
    },
  })
}
const drawing = () =>
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return anyContext(this)
  })

const LOOK = { skin: 2, hairStyle: 4, hairColor: 6, eyeStyle: 1, eyeColor: 3, outfit: 7 }
const viewWith = (hero) => {
  const view = makeView()
  view.hero = { ...view.hero, ...hero }
  return view
}
const TOWN = { world: 'laboratorio', x: 16, y: 8 }

beforeEach(() => {
  // jsdom has no canvas: the scene draws nothing unless a test asks for a context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.mocked(heroSprite).mockClear()
  vi.mocked(saveLook).mockReset()
  vi.mocked(getWorld).mockReset()
  vi.mocked(startHunt).mockReset().mockResolvedValue(makeView())
  vi.mocked(saveWorldPosition).mockReset().mockResolvedValue({ position: TOWN })
  vi.mocked(syncGame).mockReset().mockResolvedValue(makeView())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('starts a new player in the town square, safe, with the game around it', async () => {
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  open()
  expect(await screen.findByRole('heading', { level: 1, name: 'Cidade do Laboratório' })).toBeInTheDocument()
  expect(await scene()).toHaveAttribute('data-place', 'laboratorio 16 8')
  expect(screen.getAllByText('Cidade do Laboratório · Zona segura').length).toBeGreaterThan(0)
  expect(getWorld).toHaveBeenCalledWith('token-ana')
  expect(syncGame).toHaveBeenCalledWith('token-ana')
})

it('opens on the hero the signed-in shell prefetched, before the first sync answers', async () => {
  resetWorldPrefetch()
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  vi.mocked(getGame).mockReset().mockResolvedValue(makeView())
  vi.mocked(syncGame).mockReturnValue(new Promise(() => {}))
  prefetchWorld('ana', async () => 'token-ana')
  open()
  expect(await scene()).toHaveAttribute('data-place', 'laboratorio 16 8')
  expect(getWorld).toHaveBeenCalledTimes(1)
  expect(getGame).toHaveBeenCalledTimes(1)
})

it('links to the world from the main navigation', async () => {
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  open()
  await title()
  expect(screen.getByRole('link', { name: 'Glitch World' })).toHaveAttribute('href', '/mundo')
})

it('puts the hero back where it was saved, in any region', async () => {
  vi.mocked(getWorld).mockResolvedValue(at({ world: 'caverna-sql', x: 3, y: 10 }))
  open()
  expect(await title()).toHaveTextContent('Caverna do SQL')
  expect(await scene()).toHaveAttribute('data-place', 'caverna-sql 3 10')
})

it('follows the hero down a road into the next region and saves it through the API', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(getWorld).mockResolvedValue(at({ world: 'laboratorio', x: 1, y: 12 }))
  open()
  await scene()
  await key('ArrowLeft')
  await key('ArrowLeft', 'keyup')
  await act(() => vi.advanceTimersByTimeAsync(FADE_MS))
  expect(await screen.findByRole('heading', { level: 1, name: 'Floresta do JavaScript' })).toBeInTheDocument()
  await vi.waitFor(() => expect(saveWorldPosition).toHaveBeenCalledWith({ world: 'floresta-js', x: 46, y: 15 }, 'token-ana', { keepalive: false }))
})

it('hunts the zone the hero stands in through the API', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(getWorld).mockResolvedValue(at({ world: 'floresta-js', x: 44, y: 15 }))
  open()
  await scene()
  await act(() => vi.advanceTimersByTimeAsync(2000))
  expect(startHunt).toHaveBeenCalledWith({ world: 'floresta-js', zone: 'z1', difficulty: 'normal' }, 'token-ana')
})

it('opens on the hunt after a reload when a hunt is running, with the away summary', async () => {
  const hunting = makeView({ hunt: { world: 'floresta-js', zone: 'z1', difficulty: 'normal', startedAt: 0, claims: 0 } })
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  vi.mocked(syncGame).mockResolvedValue({ ...hunting, away: { elapsedMs: 3_600_000, kills: 40, elites: 4, deaths: 0, gold: 300, items: 2, gems: 0, scrap: 0 } })
  open()
  expect(await screen.findByRole('heading', { level: 1, name: 'Floresta do JavaScript' })).toBeInTheDocument()
  expect(await screen.findByRole('dialog', { name: 'Bem-vindo de volta' })).toHaveTextContent('Enquanto você estava fora: 40 inimigos, 300 de ouro, 2 itens')
})

it('shows an error when the world cannot load', async () => {
  vi.mocked(getWorld).mockRejectedValue(new Error('Não foi possível falar com o servidor.'))
  open()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
})

it('starts a hero saved in an ENEM region in the town when the language hides ENEM', async () => {
  vi.mocked(getWorld).mockResolvedValue(at({ world: 'torre-matematica', x: 3, y: 10 }))
  open('en')
  expect(await screen.findByRole('heading', { level: 1, name: 'Lab City' })).toBeInTheDocument()
  expect(await scene()).toHaveAttribute('data-place', `laboratorio ${worldById('laboratorio').spawn.x} ${worldById('laboratorio').spawn.y}`)
})

it('draws the hero with the look and gear of the game, and the town keepers in theirs', async () => {
  drawing()
  const view = viewWith({ look: LOOK })
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  vi.mocked(syncGame).mockResolvedValue(view)
  open()
  await scene()
  await vi.waitFor(() => expect(heroSprite).toHaveBeenCalledWith(LOOK, gearOf(view.hero.items), expect.stringMatching(/^idle[01]$/)))
  for (const id of ['merchant', 'alchemist', 'smith', 'jeweler']) {
    expect(heroSprite).toHaveBeenCalledWith(NPC_LOOKS[id].look, NPC_LOOKS[id].gear, expect.stringMatching(/^idle[01]$/))
  }
})

it('opens the character creator when the hero never picked a look, and wears the saved one', async () => {
  drawing()
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  vi.mocked(syncGame).mockResolvedValue(viewWith({ lookSet: false }))
  vi.mocked(saveLook).mockImplementation(async (look) => viewWith({ look, lookSet: true }))
  open()
  const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
  fireEvent.click(within(dialog).getAllByRole('radio', { checked: false })[0])
  fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(saveLook).toHaveBeenCalledTimes(1)
  const [saved, token] = vi.mocked(saveLook).mock.calls[0]
  expect(token).toBe('token-ana')
  await vi.waitFor(() => expect(heroSprite).toHaveBeenCalledWith(saved, expect.anything(), expect.anything()))
})

it('keeps the look it has when the creator is put off for later', async () => {
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  vi.mocked(syncGame).mockResolvedValue(viewWith({ look: LOOK, lookSet: false }))
  vi.mocked(saveLook).mockImplementation(async (look) => viewWith({ look, lookSet: true }))
  open()
  const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Depois' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await vi.waitFor(() => expect(saveLook).toHaveBeenCalledWith(LOOK, 'token-ana'))
})

it('does not open the creator for a hero that already has a look', async () => {
  vi.mocked(getWorld).mockResolvedValue(at(TOWN))
  open()
  await scene()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('opens a town terminal in the study window and stays in the world', async () => {
  vi.mocked(getWorld).mockResolvedValue(at({ world: 'laboratorio', x: 12, y: 7 }))
  open()
  await scene()
  await key('Enter')
  await vi.waitFor(() => expect(document.querySelector('iframe')?.getAttribute('src')).toContain('/daily'))
  expect(screen.getByTestId('location')).toHaveTextContent('/mundo')
  expect(await scene()).toHaveAttribute('data-place', 'laboratorio 12 7')
})
