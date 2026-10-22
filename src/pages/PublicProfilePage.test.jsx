import { screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getPublicProfile } from '../lib/api.js'
import { renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  getPublicProfile: vi.fn(),
}))

const PUBLIC = {
  handle: 'ada_dev',
  displayName: 'Ada',
  bio: 'I read stack traces for fun.',
  avatar: { seed: 'abc123', color: 'cobalt' },
  level: 2,
  title: 'Junior Detective',
  xp: 145,
  levelXp: 100,
  nextLevelXp: 300,
  streak: 3,
  totalSeconds: 4200,
  counts: { cases: 4, solved: 1, passedChallenges: 3 },
  badges: ['first-clue', 'fixed-it', 'case-closed', 'sharp-eye'],
  featuredBadges: ['case-closed', 'sharp-eye'],
  memberSince: '2026-10-01T12:00:00Z',
}

beforeEach(() => {
  vi.mocked(getPublicProfile).mockReset().mockResolvedValue(PUBLIC)
})

it('shows a public profile to a signed-out visitor', async () => {
  renderAt('/u/ada_dev')
  expect(await screen.findByRole('heading', { name: 'Ada', level: 1 })).toBeInTheDocument()
  expect(vi.mocked(getPublicProfile).mock.lastCall[0]).toBe('ada_dev')
  expect(screen.getByText('@ada_dev')).toBeInTheDocument()
  expect(screen.getByText('I read stack traces for fun.')).toBeInTheDocument()
  expect(screen.getByText('Junior Detective')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Experience toward the next level' })).toHaveAttribute('aria-valuenow', '145')

  const stats = screen.getByRole('list', { name: 'Stats' })
  expect(within(stats).getByText('3d')).toBeInTheDocument()
  expect(within(stats).getByText('1h 10m')).toBeInTheDocument()
  expect(within(stats).getByText('4')).toBeInTheDocument()

  const featured = screen.getByRole('list', { name: 'Featured badges' })
  expect(within(featured).getAllByRole('listitem')).toHaveLength(2)
  expect(within(featured).getByText('Case closed')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Earned badges' })).getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText(/Member since October 2026/)).toBeInTheDocument()

  expect(screen.getByRole('link', { name: 'Try Glitch Detective' })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
})

it('says so kindly when there is no public profile', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue(null)
  renderAt('/u/ghost')
  expect(await screen.findByRole('heading', { name: 'No detective here' })).toBeInTheDocument()
  expect(screen.getByText(/@ghost/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Try Glitch Detective' })).toHaveAttribute('href', '/')
})

it('shows the error when the profile cannot load', async () => {
  vi.mocked(getPublicProfile).mockRejectedValue(new Error('Could not reach the server. Check your connection.'))
  renderAt('/u/ada_dev')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
})
