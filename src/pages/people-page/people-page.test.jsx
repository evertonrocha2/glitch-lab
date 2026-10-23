import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { searchProfiles } from '../../lib/api.js'
import { renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  searchProfiles: vi.fn(),
}))

const card = (handle, fields = {}) => ({
  handle,
  displayName: handle.toUpperCase(),
  avatar: { seed: handle, color: 'violet' },
  role: null,
  headline: '',
  university: '',
  work: '',
  location: '',
  languages: [],
  ...fields,
})

beforeEach(() => {
  vi.mocked(searchProfiles)
    .mockReset()
    .mockImplementation(async (query) =>
      query ? [card('ada_dev', { role: 'student', headline: 'Learning React', languages: ['python'] })] : [card('ada_dev'), card('grace')],
    )
})

it('lists the newest public profiles, signed out', async () => {
  renderAt('/people')
  expect(await screen.findByRole('heading', { name: 'Find people', level: 1 })).toBeInTheDocument()
  const results = await screen.findByRole('list', { name: 'People' })
  expect(vi.mocked(searchProfiles).mock.calls[0][0]).toBe('')
  const links = within(results).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/u/ada_dev', '/u/grace'])
})

it('searches by handle or name', async () => {
  renderAt('/people')
  await screen.findByRole('list', { name: 'People' })
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search by handle or name' }), 'ada{Enter}')
  expect(vi.mocked(searchProfiles).mock.lastCall[0]).toBe('ada')
  const results = await screen.findByRole('list', { name: 'People' })
  expect(await within(results).findByText('Learning React')).toBeInTheDocument()
  expect(within(results).getByText('Student')).toBeInTheDocument()
  expect(within(results).getAllByRole('link')).toHaveLength(1)
})

it('says when nobody matches', async () => {
  vi.mocked(searchProfiles).mockResolvedValue([])
  renderAt('/people')
  expect(await screen.findByText('No public profiles match that yet.')).toBeInTheDocument()
})

it('shows the error when the search fails', async () => {
  vi.mocked(searchProfiles).mockRejectedValue(new Error('Search with letters, numbers, spaces, _ . and -, up to 40 characters.'))
  renderAt('/people')
  expect(await screen.findByRole('alert')).toHaveTextContent('Search with letters')
})

it('speaks Brazilian Portuguese, roles included', async () => {
  renderAt('/people', { locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { name: 'Encontre pessoas', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Pessoas' })).toHaveAttribute('href', '/people')
  await screen.findByRole('list', { name: 'Pessoas' })
  expect(screen.getByText('Perfis mais recentes')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por usuário ou nome' }), 'ada{Enter}')
  expect(await screen.findByText('Resultados para "ada"')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Pessoas' })).getByText('Estudante')).toBeInTheDocument()
})
