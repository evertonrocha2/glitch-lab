import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { BADGES } from '../../shared/badges.js'
import { getPublicProfile, listPublicNotes } from '../lib/api.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  getPublicProfile: vi.fn(),
  listPublicNotes: vi.fn(),
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

const ABOUT = {
  role: 'student',
  headline: 'Learning React at night',
  university: 'Infnet',
  course: 'Software Engineering',
  work: 'Support at Acme',
  location: 'Rio de Janeiro',
  languages: ['javascript', 'cpp'],
  links: { github: 'https://github.com/ada', linkedin: 'https://www.linkedin.com/in/ada' },
  openTo: ['mentoring', 'jobs'],
}

const NOTES = [
  { id: 'n1', title: 'Reading undefined', updatedAt: '2026-10-21T12:00:00Z', excerpt: 'Check the object first.', blockCount: 4 },
  { id: 'n2', title: '', updatedAt: '2026-10-20T12:00:00Z', excerpt: '', blockCount: 1 },
]

beforeEach(() => {
  vi.mocked(getPublicProfile).mockReset().mockResolvedValue({ profile: PUBLIC, preview: false })
  vi.mocked(listPublicNotes).mockReset().mockResolvedValue([])
})

it('shows who they are: role, headline, school, job, languages, links and open-to', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue({ profile: { ...PUBLIC, ...ABOUT }, preview: false })
  renderAt('/u/ada_dev')
  await screen.findByRole('heading', { name: 'Ada', level: 1 })
  expect(screen.getByText('Student')).toBeInTheDocument()
  expect(screen.getByText('Learning React at night')).toBeInTheDocument()
  expect(screen.getByText('Software Engineering at Infnet')).toBeInTheDocument()
  expect(screen.getByText('Support at Acme')).toBeInTheDocument()
  expect(screen.getByText('Rio de Janeiro')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Languages' })).getByText('C++')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Open to' })).getAllByRole('listitem')).toHaveLength(2)
  const links = within(screen.getByRole('list', { name: 'Links' })).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://github.com/ada', 'https://www.linkedin.com/in/ada'])
  for (const link of links) {
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
})

it('lists their public notes, each linking to its own page', async () => {
  vi.mocked(listPublicNotes).mockResolvedValue(NOTES)
  renderAt('/u/ada_dev')
  const section = await screen.findByRole('region', { name: 'Notes' })
  expect(vi.mocked(listPublicNotes).mock.lastCall[0]).toBe('ada_dev')
  const links = await within(section).findAllByRole('link')
  expect(links).toHaveLength(2)
  expect(links[0]).toHaveAttribute('href', '/u/ada_dev/notes/n1')
  expect(links[0]).toHaveTextContent('Reading undefined')
  expect(links[0]).toHaveTextContent('Check the object first.')
  expect(links[1]).toHaveTextContent('Untitled')
})

it('says when there are no public notes yet', async () => {
  renderAt('/u/ada_dev')
  expect(await screen.findByText('No public notes yet.')).toBeInTheDocument()
})

it('links to the people search from the header', async () => {
  renderAt('/u/ada_dev')
  await screen.findByRole('heading', { name: 'Ada', level: 1 })
  expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/people')
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

  expect(screen.getByRole('link', { name: 'Try Glitch Lab' })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
})

it('says so kindly when there is no public profile', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue(null)
  renderAt('/u/ghost')
  expect(await screen.findByRole('heading', { name: 'No detective here' })).toBeInTheDocument()
  expect(screen.getByText(/@ghost/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Try Glitch Lab' })).toHaveAttribute('href', '/')
})

it('shows the error when the profile cannot load', async () => {
  vi.mocked(getPublicProfile).mockRejectedValue(new Error('Could not reach the server. Check your connection.'))
  renderAt('/u/ada_dev')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
})

it('opens the profile from /@handle and from /u/@Handle', async () => {
  renderAt('/@ada_dev')
  await waitFor(() => expect(currentLocation()).toBe('/u/ada_dev'))
  expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
})

it('tidies /u/@Ada_Dev to the plain handle', async () => {
  renderAt('/u/@Ada_Dev')
  await waitFor(() => expect(currentLocation()).toBe('/u/ada_dev'))
  expect(getPublicProfile).toHaveBeenLastCalledWith('ada_dev', expect.any(String), null)
})

it('tells owners when they are looking at their own private profile', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue({ profile: PUBLIC, preview: true })
  renderAt('/u/ada_dev', { user: 'alice' })
  expect(await screen.findByText(/Only you can see this page/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Make it public' })).toHaveAttribute('href', '/profile')
  expect(getPublicProfile).toHaveBeenLastCalledWith('ada_dev', expect.any(String), 'token-alice')
})

it('offers the way back to the board instead of a sign-up pitch when signed in', async () => {
  renderAt('/u/ada_dev', { user: 'alice' })
  expect(await screen.findByRole('link', { name: 'Back to your board' })).toHaveAttribute('href', '/board')
  expect(screen.queryByRole('link', { name: 'Try Glitch Lab' })).toBeNull()
})

it('speaks Brazilian Portuguese: stats, badges, notes and dates', async () => {
  vi.mocked(listPublicNotes).mockResolvedValue(NOTES)
  renderAt('/u/ada_dev', { locale: 'pt-BR' })
  await screen.findByRole('heading', { name: 'Ada', level: 1 })
  const stats = screen.getByRole('list', { name: 'Estatísticas' })
  expect(within(stats).getByText('Sequência')).toBeInTheDocument()
  expect(within(stats).getByText('desafios concluídos')).toBeInTheDocument()
  expect(screen.getByText(/Membro desde outubro de 2026/)).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Medalhas conquistadas' })).getByText('Caso encerrado')).toBeInTheDocument()
  // Counted against every badge there is, so new badges don't break it.
  expect(screen.getByText(`4/${BADGES.length} conquistadas`)).toBeInTheDocument()
  const notes = await screen.findByRole('region', { name: 'Notas' })
  expect(await within(notes).findByText('Sem título')).toBeInTheDocument()
  expect(within(notes).getByText(/4 blocos · 21 de out\. de 2026/)).toBeInTheDocument()
  expect(within(notes).getByText('2 compartilhadas')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Experimente grátis' })).toHaveAttribute('href', '/')
})
