import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getDuel, getDuelLobby, getProgress, sendDuel } from '../lib/api.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getDuelLobby: vi.fn(),
  getDuel: vi.fn(),
  sendDuel: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

const LOBBY = (fields = {}) => ({
  rating: { rating: 1016, games: 3, wins: 2, losses: 1, draws: 0 },
  recent: [
    {
      id: 'd1',
      kind: 'bot',
      finishedAt: '2026-10-22T15:00:00.000Z',
      outcome: 'win',
      you: 820,
      them: 410,
      rated: false,
      ratingAfter: null,
      opponent: { name: 'Glitch Bot', handle: null, avatar: null, bot: true },
    },
    {
      id: 'd2',
      kind: 'private',
      finishedAt: '2026-10-22T14:00:00.000Z',
      outcome: 'loss',
      you: 300,
      them: 500,
      rated: true,
      ratingAfter: 984,
      opponent: { name: 'Anonymous detective', handle: null, avatar: null, bot: false },
    },
  ],
  leaderboard: [
    { rank: 1, name: 'Ada', handle: 'ada', avatar: { seed: 'ada', color: 'violet' }, rating: 1100, games: 5, wins: 4, isYou: false },
    { rank: 2, name: 'Anonymous detective', handle: null, avatar: null, rating: 1016, games: 3, wins: 1, isYou: true },
  ],
  active: null,
  isDemo: false,
  ...fields,
})

const WAITING = { id: 'q1', code: 'QQQ234', kind: 'queue', status: 'waiting', now: new Date().toISOString(), roundCount: 5, you: 0, players: [{ name: 'Anonymous detective', handle: null, avatar: null, bot: false, you: true }], rematchId: null, joinable: false, createdAt: new Date().toISOString() }

beforeEach(() => {
  vi.mocked(getDuelLobby).mockReset().mockResolvedValue(LOBBY())
  vi.mocked(getDuel).mockReset().mockResolvedValue(WAITING)
  vi.mocked(sendDuel).mockReset().mockResolvedValue({ duel: WAITING })
  vi.mocked(getProgress).mockClear()
})

it('shows the ways to play, the tab rule, my rating, recent duels and the leaderboard', async () => {
  renderAt('/duel', { user: 'alice' })
  expect(screen.getByRole('heading', { level: 1, name: 'Duel' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Duel' })).toHaveAttribute('aria-current', 'page')
  for (const name of ['Quick match', 'Create a private duel', 'Play the Glitch Bot']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  expect(screen.getByText('Stay on this tab. Leaving it (another tab or app) while a round is open costs you that round.')).toBeInTheDocument()

  expect((await screen.findByRole('heading', { name: 'Your rating' })).parentElement).toHaveTextContent('Your rating1016')
  expect(screen.getByText('2 W · 0 D · 1 L')).toBeInTheDocument()
  const recent = screen.getByRole('region', { name: 'Recent duels' })
  const rows = within(recent).getAllByRole('link')
  expect(rows[0]).toHaveAttribute('href', '/duel/d1')
  expect(rows[0]).toHaveTextContent('vs Glitch Bot')
  expect(rows[0]).toHaveTextContent('Win')
  expect(rows[0]).toHaveTextContent('820 - 410')
  expect(rows[1]).toHaveTextContent('vs Anonymous detective')
  expect(rows[1]).toHaveTextContent('984')

  const board = screen.getByRole('list', { name: 'Leaderboard' })
  const entries = within(board).getAllByRole('listitem')
  expect(within(entries[0]).getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/u/ada')
  expect(entries[1]).toHaveTextContent('You')
  expect(entries[1]).toHaveTextContent('1 win')
  expect(getDuelLobby).toHaveBeenCalledWith('token-alice')
})

it('starts a quick match and opens the waiting room', async () => {
  renderAt('/duel', { user: 'alice' })
  await userEvent.click(screen.getByRole('button', { name: 'Quick match' }))
  expect(sendDuel).toHaveBeenCalledWith('queue', {}, 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/duel/q1'))
  expect(await screen.findByRole('heading', { name: 'Looking for an opponent' })).toBeInTheDocument()
})

it('creates a private duel or plays the bot', async () => {
  renderAt('/duel', { user: 'alice' })
  await userEvent.click(screen.getByRole('button', { name: 'Create a private duel' }))
  expect(sendDuel).toHaveBeenCalledWith('create', {}, 'token-alice')
  await waitFor(() => expect(currentLocation()).toBe('/duel/q1'))
})

it('joins with a code, in capitals, and shows what went wrong', async () => {
  vi.mocked(sendDuel).mockRejectedValueOnce(new Error('No duel has that code.'))
  renderAt('/duel', { user: 'alice' })
  const box = screen.getByRole('textbox', { name: 'Duel code' })
  const join = screen.getByRole('button', { name: 'Join' })
  expect(join).toBeDisabled()
  await userEvent.type(box, 'abc2345')
  expect(box).toHaveValue('ABC234')
  await userEvent.click(join)
  expect(sendDuel).toHaveBeenCalledWith('join', { code: 'ABC234' }, 'token-alice')
  expect(await screen.findByRole('alert')).toHaveTextContent('No duel has that code.')
  await userEvent.click(join)
  await waitFor(() => expect(currentLocation()).toBe('/duel/q1'))
})

it('links back to a duel in progress and explains demo ratings', async () => {
  vi.mocked(getDuelLobby).mockResolvedValue(LOBBY({ active: { id: 'live1', kind: 'queue' }, isDemo: true, leaderboard: [], recent: [] }))
  renderAt('/duel', { user: 'alice' })
  expect(await screen.findByRole('link', { name: 'Go back to it' })).toHaveAttribute('href', '/duel/live1')
  expect(screen.getByText('Demo accounts play for fun: your rating and the leaderboard stay the same.')).toBeInTheDocument()
  expect(screen.getByText('No duels yet. Start one!')).toBeInTheDocument()
  expect(screen.getByText('Nobody is ranked yet. Win a duel against a person to be the first.')).toBeInTheDocument()
})

it('speaks Brazilian Portuguese', async () => {
  renderAt('/duel', { user: 'alice', locale: 'pt-BR' })
  expect(screen.getByRole('heading', { level: 1, name: 'Duelo' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Partida rápida' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Jogar contra o Glitch Bot' })).toBeInTheDocument()
  expect(screen.getByText('Fique nesta aba. Sair dela (outra aba ou app) com uma rodada aberta faz você perder essa rodada.')).toBeInTheDocument()
  expect(await screen.findByText('Seu rating')).toBeInTheDocument()
  expect(screen.getByText('2 V · 0 E · 1 D')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Duelos recentes' })).toHaveTextContent('contra Detetive anônimo')
  expect(screen.getByRole('list', { name: 'Ranking' })).toHaveTextContent('1 vitória')
})
