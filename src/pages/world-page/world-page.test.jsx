import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { unlocks } from '../../../shared/world/unlocks.js'
import { getWorld, saveWorldPosition, stopHunt, syncGame } from '../../lib/api.js'
import { makeView } from '../../components/game/panel/fixtures.js'
import { renderAt } from '../../test/render.jsx'

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
}))

const stateAt = (position, { codeSolved = 0, ...areas } = {}) => {
  const signals = { enemCorrect: { linguagens: 0, humanas: 0, natureza: 0, matematica: 0, ...areas }, codeSolved }
  return { ...unlocks(signals), signals, position }
}

const open = () => renderAt('/mundo', { user: 'ana', locale: 'pt-BR' })
const title = () => screen.findByRole('heading', { level: 1 })

beforeEach(() => {
  vi.mocked(getWorld).mockReset()
  vi.mocked(saveWorldPosition).mockReset().mockResolvedValue({ world: 'laboratorio', x: 2, y: 2 })
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
