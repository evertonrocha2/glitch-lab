import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK } from '../../../shared/game/look.js'
import { unlocks } from '../../../shared/world/unlocks.js'
import { gearOf } from '../../components/game/hero/gear.js'
import { heroSprite } from '../../components/game/hero/hero-cache.js'
import { makeView } from '../../components/game/panel/fixtures.js'
import { getGame, getWorld, saveLook, saveWorldPosition, stopHunt, syncGame } from '../../lib/api.js'
import { renderAt } from '../../test/render.jsx'

// The real sprites, watched: the hub must draw the hero the game View describes.
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
  buySkill: vi.fn(),
  upgradeSkill: vi.fn(),
  saveLoadout: vi.fn(),
  saveLook: vi.fn(),
}))

const stateAt = (position, { codeSolved = 0, ...areas } = {}) => {
  const signals = { enemCorrect: { linguagens: 0, humanas: 0, natureza: 0, matematica: 0, ...areas }, codeSolved }
  return { ...unlocks(signals), signals, position }
}

const open = () => renderAt('/mundo', { user: 'ana', locale: 'pt-BR' })
const title = () => screen.findByRole('heading', { level: 1 })

// A 2D context that takes every call, so the hub draws its hero in jsdom.
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

beforeEach(() => {
  // jsdom has no canvas: the hub draws nothing unless a test asks for a context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.mocked(heroSprite).mockClear()
  vi.mocked(saveLook).mockReset()
  vi.mocked(getWorld).mockReset()
  vi.mocked(saveWorldPosition).mockReset().mockResolvedValue({ world: 'laboratorio', x: 2, y: 2 })
  vi.mocked(getGame).mockReset().mockResolvedValue(makeView())
})

it('shows the hub and the closest goal for a new player', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 7, y: 5 }))
  open()
  expect(await screen.findByRole('heading', { level: 1, name: 'Laboratório' })).toBeInTheDocument()
  const worlds = screen.getByRole('list', { name: 'Mundos' })
  expect(within(worlds).getByText('Floresta do JavaScript').closest('li')).toHaveTextContent('Aberto')
  expect(within(worlds).getByText('Torre da Matemática').closest('li')).toHaveTextContent('0 de 5 acertos em Matemática')
  expect(screen.getByText('Caverna do SQL: faltam 3 desafios de programação')).toBeInTheDocument()
  expect(getWorld).toHaveBeenCalledWith('token-ana')
})

it('names a zone and counts one left in the singular', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'caverna-sql', x: 3, y: 10 }, { codeSolved: 7, linguagens: 5, humanas: 5, natureza: 5, matematica: 5 }))
  open()
  expect(await screen.findByText('Caverna do SQL, área 2: falta 1 desafio de programação')).toBeInTheDocument()
})

it('puts the hero back where it was saved', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'caverna-sql', x: 3, y: 10 }, { codeSolved: 3 }))
  open()
  expect(await title()).toHaveTextContent('Caverna do SQL')
  expect(screen.getByRole('application')).toHaveAttribute('data-place', 'caverna-sql 3 10')
})

it('follows the hero through a portal and saves it through the API', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'caverna-sql', x: 2, y: 10 }, { codeSolved: 3 }))
  open()
  await title()
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowLeft' })
  fireEvent.keyUp(screen.getByRole('application'), { key: 'ArrowLeft' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Laboratório' })).toBeInTheDocument()
  await vi.waitFor(() => expect(saveWorldPosition).toHaveBeenCalledWith({ world: 'laboratorio', x: 7, y: 2 }, 'token-ana', { keepalive: false }))
})

it('opens the hunt game in the Forest and comes back beside its portal', async () => {
  HTMLCanvasElement.prototype.getContext = () => null
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 2, y: 2 }))
  vi.mocked(syncGame).mockResolvedValue(makeView())
  vi.mocked(stopHunt).mockResolvedValue(makeView())
  open()
  await title()
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowUp' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Floresta do JavaScript' })).toBeInTheDocument()
  await vi.waitFor(() => expect(syncGame).toHaveBeenCalledWith('token-ana'))
  fireEvent.click(await screen.findByRole('tab', { name: /Mundo/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Laboratório' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Laboratório' })).toBeInTheDocument()
  expect(screen.getByRole('application')).toHaveAttribute('data-place', 'laboratorio 2 2')
  await vi.waitFor(() => expect(saveWorldPosition).toHaveBeenCalledWith({ world: 'laboratorio', x: 2, y: 2 }, 'token-ana', undefined))
})

it('shows an error when the world cannot load', async () => {
  vi.mocked(getWorld).mockRejectedValue(new Error('Não foi possível falar com o servidor.'))
  open()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
})

it('links to the world from the main navigation', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 9, y: 7 }))
  open()
  await title()
  expect(screen.getByRole('link', { name: 'Glitch World' })).toHaveAttribute('href', '/mundo')
})

it('opens the hunt straight away after a reload when a hunt is running, with the away summary', async () => {
  HTMLCanvasElement.prototype.getContext = () => null
  const hunting = makeView({ hunt: { world: 'floresta-js', zone: 'z1', difficulty: 'normal', startedAt: 0, claims: 0 } })
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 2, y: 2 }))
  vi.mocked(getGame).mockResolvedValue(hunting)
  vi.mocked(syncGame).mockResolvedValue({ ...hunting, away: { elapsedMs: 3_600_000, kills: 40, elites: 4, deaths: 0, gold: 300, items: 2, gems: 0, scrap: 0 } })
  open()
  expect(await screen.findByRole('heading', { level: 1, name: 'Floresta do JavaScript' })).toBeInTheDocument()
  expect(await screen.findByRole('dialog', { name: 'Bem-vindo de volta' })).toHaveTextContent('Enquanto você estava fora: 40 inimigos, 300 de ouro, 2 itens')
})

it('stays in the hub when the game cannot be read', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 7, y: 5 }))
  vi.mocked(getGame).mockRejectedValue(new Error('offline'))
  open()
  expect(await screen.findByRole('heading', { level: 1, name: 'Laboratório' })).toBeInTheDocument()
})

it('puts a hero saved in an ENEM world beside the hub portal when the language hides ENEM', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'torre-matematica', x: 3, y: 10 }, { matematica: 5 }))
  renderAt('/mundo', { user: 'ana', locale: 'en' })
  expect(await screen.findByRole('heading', { level: 1, name: 'The Lab' })).toBeInTheDocument()
  expect(screen.getByRole('application')).toHaveAttribute('data-place', expect.stringMatching(/^laboratorio /))
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('draws the hub hero with the look and gear of the game', async () => {
  drawing()
  const view = viewWith({ look: LOOK })
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 7, y: 5 }))
  vi.mocked(getGame).mockResolvedValue(view)
  open()
  await title()
  await vi.waitFor(() => expect(heroSprite).toHaveBeenCalledWith(LOOK, gearOf(view.hero.items), expect.stringMatching(/^idle[01]$/)))
  expect(Object.keys(gearOf(view.hero.items)).length).toBeGreaterThan(0)
})

it('draws the default hero when the game cannot be read', async () => {
  drawing()
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 7, y: 5 }))
  vi.mocked(getGame).mockRejectedValue(new Error('offline'))
  open()
  await title()
  await vi.waitFor(() => expect(heroSprite).toHaveBeenCalledWith(DEFAULT_LOOK, {}, expect.stringMatching(/^idle[01]$/)))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('opens the character creator in the hub when the hero never picked a look, and wears the saved one', async () => {
  drawing()
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 7, y: 5 }))
  vi.mocked(getGame).mockResolvedValue(viewWith({ lookSet: false }))
  vi.mocked(saveLook).mockImplementation(async (look) => viewWith({ look, lookSet: true }))
  open()
  const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
  fireEvent.click(within(dialog).getAllByRole('radio', { checked: false })[0])
  fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(saveLook).toHaveBeenCalledTimes(1)
  const [saved, token] = vi.mocked(saveLook).mock.calls[0]
  expect(token).toBe('token-ana')
  expect(saved).not.toEqual(DEFAULT_LOOK)
  await vi.waitFor(() => expect(heroSprite).toHaveBeenLastCalledWith(saved, expect.anything(), expect.anything()))
})

it('keeps the look it has when the creator is put off for later, and does not ask again', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 7, y: 5 }))
  vi.mocked(getGame).mockResolvedValue(viewWith({ look: LOOK, lookSet: false }))
  vi.mocked(saveLook).mockImplementation(async (look) => viewWith({ look, lookSet: true }))
  open()
  const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Depois' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await vi.waitFor(() => expect(saveLook).toHaveBeenCalledWith(LOOK, 'token-ana'))
})

it('does not open the creator for a hero that already has a look', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'laboratorio', x: 7, y: 5 }))
  open()
  await title()
  await vi.waitFor(() => expect(getGame).toHaveBeenCalled())
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('opens a hub terminal in the study window and stays in the world', async () => {
  vi.mocked(getWorld).mockResolvedValue(stateAt({ world: 'caverna-sql', x: 2, y: 5 }, { codeSolved: 3 }))
  open()
  expect(await title()).toHaveTextContent('Caverna do SQL')
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  await vi.waitFor(() => expect(document.querySelector('iframe')?.getAttribute('src')).toContain('/daily'))
  expect(screen.getByTestId('location')).toHaveTextContent('/mundo')
  expect(screen.getByRole('application')).toHaveAttribute('data-place', 'caverna-sql 2 5')
})
