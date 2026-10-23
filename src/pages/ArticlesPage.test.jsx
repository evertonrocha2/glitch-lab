import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { listArticles } from '../lib/api.js'
import { BO, makeSummary } from '../test/community.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  listArticles: vi.fn(),
}))

const FIRST = makeSummary()
const SECOND = makeSummary({ id: 'a2', title: 'Off by one', tags: ['python', 'loops'], author: BO, counts: { likes: 0, valid: 0, bad: 1, comments: 0 } })

beforeEach(() => {
  vi.mocked(listArticles).mockReset().mockResolvedValue({ articles: [FIRST, SECOND], page: 1, hasMore: false })
})

const lastFilters = () => vi.mocked(listArticles).mock.lastCall[0]

it('lists articles for a signed-out visitor, with authors, tags and counts', async () => {
  renderAt('/articles')
  const card = (await screen.findByRole('heading', { name: 'Undefined everywhere' })).closest('article')
  expect(within(card).getByRole('link', { name: 'Undefined everywhere' })).toHaveAttribute('href', '/articles/a1')
  expect(within(card).getByText('Reading a property of undefined throws.')).toBeInTheDocument()
  expect(within(card).getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/u/ada_dev')
  expect(within(card).getByText('3 likes, 2 valid, 0 bad, 1 comment')).toBeInTheDocument()
  // A private profile shows the name without a link.
  const other = screen.getByRole('heading', { name: 'Off by one' }).closest('article')
  expect(within(other).getByText('Bo')).toBeInTheDocument()
  expect(within(other).queryByRole('link', { name: 'Bo' })).toBeNull()

  expect(screen.getByRole('link', { name: 'Sign in to write' })).toHaveAttribute('href', '/login?next=%2Farticles%2Fnew')
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
})

it('offers signed-in people a write button inside the app shell', async () => {
  renderAt('/articles', { user: 'alice' })
  expect(await screen.findByRole('link', { name: 'Write an article' })).toHaveAttribute('href', '/articles/new')
  expect(screen.getByRole('link', { name: 'Articles' })).toHaveAttribute('aria-current', 'page')
})

it('searches, filters by tag and sorts, keeping it in the address', async () => {
  renderAt('/articles')
  await screen.findByRole('heading', { name: 'Undefined everywhere' })

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search articles' }), 'undefined')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(lastFilters()).toMatchObject({ q: 'undefined', sort: 'new', page: 1 }))
  expect(currentLocation()).toBe('/articles?q=undefined')

  await userEvent.click(screen.getByRole('button', { name: 'Top likes' }))
  await waitFor(() => expect(lastFilters()).toMatchObject({ q: 'undefined', sort: 'top' }))
  expect(screen.getByRole('button', { name: 'Top likes' })).toHaveAttribute('aria-pressed', 'true')

  await userEvent.click(screen.getAllByRole('button', { name: 'Filter by #python' })[0])
  await waitFor(() => expect(lastFilters()).toMatchObject({ tag: 'python' }))
  await userEvent.click(screen.getByRole('button', { name: 'Clear tag python' }))
  await waitFor(() => expect(lastFilters().tag).toBeFalsy())
})

it('reads filters from the address', async () => {
  renderAt('/articles?tag=loops&sort=valid&q=range')
  await waitFor(() => expect(lastFilters()).toMatchObject({ tag: 'loops', sort: 'valid', q: 'range' }))
  expect(screen.getByRole('searchbox', { name: 'Search articles' })).toHaveValue('range')
})

it('loads more pages', async () => {
  vi.mocked(listArticles).mockResolvedValueOnce({ articles: [FIRST], page: 1, hasMore: true }).mockResolvedValueOnce({ articles: [SECOND], page: 2, hasMore: false })
  renderAt('/articles')
  await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
  expect(await screen.findByRole('heading', { name: 'Off by one' })).toBeInTheDocument()
  expect(lastFilters()).toMatchObject({ page: 2 })
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
})

it('says so when nothing matches, and shows errors', async () => {
  vi.mocked(listArticles).mockResolvedValue({ articles: [], page: 1, hasMore: false })
  renderAt('/articles?q=zzz')
  expect(await screen.findByText(/No articles match/)).toBeInTheDocument()
  vi.mocked(listArticles).mockRejectedValue(new Error('Could not reach the server. Check your connection.'))
  await userEvent.click(screen.getByRole('button', { name: 'Most valid' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
})

it('lists articles in Brazilian Portuguese, with a language picker when signed out', async () => {
  renderAt('/articles', { locale: 'pt-BR' })
  const card = (await screen.findByRole('heading', { name: 'Undefined everywhere' })).closest('article')
  expect(screen.getByRole('heading', { level: 1, name: 'Artigos' })).toBeInTheDocument()
  expect(within(card).getByText('3 curtidas, 2 votos válidos, 0 votos ruins, 1 comentário')).toBeInTheDocument()
  expect(within(card).getByText(/Anteontem|Há 2 dias/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Entre para escrever' })).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Buscar artigos' })).toHaveAttribute('placeholder', 'Títulos, tags ou autores')
  expect(within(screen.getByRole('group', { name: 'Ordenar' })).getAllByRole('button').map((button) => button.textContent)).toEqual([
    'Novos',
    'Mais curtidos',
    'Mais válidos',
  ])
  expect(screen.getAllByRole('button', { name: 'Filtrar por #javascript' }).length).toBeGreaterThan(0)
  // Signed out, the light header still lets readers switch language.
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'en')
  expect(await screen.findByRole('heading', { level: 1, name: 'Articles' })).toBeInTheDocument()
})
