import { screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { BADGES } from '../../shared/badges.js'
import { getProgress } from '../lib/api.js'
import { renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn(),
  addStudyTime: vi.fn(),
}))

const progressWith = (earnedIds, extra = {}) => ({
  xp: 145,
  level: 2,
  title: 'Junior Detective',
  levelXp: 100,
  nextLevelXp: 300,
  streak: 3,
  todaySeconds: 1500,
  totalSeconds: 4200,
  badges: BADGES.map((badge) => ({ id: badge.id, earned: earnedIds.includes(badge.id) })),
  ...extra,
})

beforeEach(() => {
  vi.mocked(getProgress).mockReset()
})

it('links to the people search', async () => {
  vi.mocked(getProgress).mockResolvedValue(progressWith([]))
  renderAt('/progress', { user: 'alice' })
  expect(await screen.findByRole('link', { name: 'Find detectives' })).toHaveAttribute('href', '/people')
})

it('shows the level, xp, streak and study time', async () => {
  vi.mocked(getProgress).mockResolvedValue(progressWith(['first-clue']))
  renderAt('/progress', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Junior Detective' })).toBeInTheDocument()
  expect(screen.getByText('145 XP')).toBeInTheDocument()
  expect(screen.getByText(/155 XP to level 3/)).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Experience toward the next level' })).toHaveAttribute('aria-valuenow', '145')
  const summary = screen.getByRole('list', { name: 'Study summary' })
  expect(within(summary).getByText('3d')).toBeInTheDocument()
  expect(within(summary).getByText('25m')).toBeInTheDocument()
  expect(within(summary).getByText('1h 10m')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Progress (level 2)' })).toBeInTheDocument()
})

it('marks earned and locked badges', async () => {
  vi.mocked(getProgress).mockResolvedValue(progressWith(['first-clue', 'fixed-it']))
  renderAt('/progress', { user: 'alice' })
  expect(await screen.findByText(`2/${BADGES.length} earned`)).toBeInTheDocument()
  expect(screen.getAllByText('Earned')).toHaveLength(2)
  expect(screen.getAllByText('Locked')).toHaveLength(BADGES.length - 2)
})

it('announces a badge earned since the last visit, but not on the first one', async () => {
  vi.mocked(getProgress).mockResolvedValue(progressWith(['first-clue']))
  const first = renderAt('/progress', { user: 'alice' })
  await screen.findByRole('heading', { name: 'Junior Detective' })
  expect(screen.queryByText('New badge')).toBeNull()
  first.unmount()

  vi.mocked(getProgress).mockResolvedValue(progressWith(['first-clue', 'fixed-it']))
  renderAt('/progress', { user: 'alice' })
  const toasts = await screen.findByRole('list', { name: 'New badges' })
  expect(await within(toasts).findByRole('link', { name: 'Fixed it' })).toBeInTheDocument()
  expect(within(toasts).queryByText('First clue')).toBeNull()
})

it('speaks Brazilian Portuguese: header, level, timer and badges', async () => {
  vi.mocked(getProgress).mockResolvedValue(progressWith(['first-clue']))
  renderAt('/progress', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { name: 'Detetive júnior' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Seu progresso' })).toBeInTheDocument()
  expect(screen.getByText(/155 XP para o nível 3/)).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Experiência até o próximo nível' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Progresso (nível 2)' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Notas' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Iniciar o cronômetro de estudo' })).toBeInTheDocument()
  expect(screen.getByText(`1/${BADGES.length} conquistadas`)).toBeInTheDocument()
  expect(screen.getAllByText('Primeira pista').length).toBeGreaterThan(0)
  expect(screen.getByText('Investigue seu primeiro erro.')).toBeInTheDocument()
  expect(screen.getAllByText('Bloqueada')).toHaveLength(BADGES.length - 1)
  expect(screen.getByRole('heading', { name: 'Como ganhar XP' })).toBeInTheDocument()
  expect(screen.getByText('Resolver um caso')).toBeInTheDocument()
})
