import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createArticle, getArticle, listCases, updateArticle } from '../../lib/api.js'
import { makeArticle } from '../../test/community.js'
import { makeCase } from '../../test/fixtures.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  listCases: vi.fn(),
  getArticle: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  reactToArticle: vi.fn(),
  addArticleComment: vi.fn(),
  deleteArticleComment: vi.fn(),
  deleteArticle: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(listCases).mockReset().mockResolvedValue([makeCase({ id: 'c1' })])
  vi.mocked(createArticle).mockReset().mockResolvedValue(makeArticle({ id: 'a9', mine: true }))
  vi.mocked(updateArticle).mockReset().mockResolvedValue(makeArticle({ mine: true }))
  vi.mocked(getArticle).mockReset().mockResolvedValue({ article: makeArticle({ mine: true, caseId: 'c1' }), comments: [], reaction: null })
})

it('sends signed-out visitors to sign in first', () => {
  renderAt('/articles/new')
  expect(currentLocation()).toBe('/login?next=%2Farticles%2Fnew')
})

it('writes, previews and publishes an article with a linked case', async () => {
  renderAt('/articles/new', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Title' }), 'Reading undefined')
  await userEvent.type(screen.getByRole('textbox', { name: 'Tags' }), 'JavaScript, loops')
  expect(screen.getByText('#javascript')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Article' }), 'Check `x` first.')

  await userEvent.click(screen.getByRole('tab', { name: 'Preview' }))
  expect(screen.getByText('x').tagName).toBe('CODE')

  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Linked case (optional)' }), 'c1')
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
  expect(vi.mocked(createArticle).mock.lastCall.slice(0, 2)).toEqual([
    { title: 'Reading undefined', tags: ['javascript', 'loops'], body: 'Check `x` first.', caseId: 'c1' },
    'token-alice',
  ])
  await waitFor(() => expect(currentLocation()).toBe('/articles/a9'))
})

it('shows what is wrong before publishing', async () => {
  renderAt('/articles/new', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Tags' }), 'c++ a b c d e')
  expect(screen.getByText(/Tags use only lowercase letters/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
})

it('shows the server message when publishing fails', async () => {
  vi.mocked(createArticle).mockRejectedValue(new Error('You can publish 5 articles a day. Come back tomorrow.'))
  renderAt('/articles/new', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Title' }), 'T')
  await userEvent.type(screen.getByRole('textbox', { name: 'Article' }), 'B')
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('5 articles a day')
})

it('edits my article', async () => {
  renderAt('/articles/a1/edit', { user: 'alice' })
  const title = await screen.findByRole('textbox', { name: 'Title' })
  await waitFor(() => expect(title).toHaveValue('Undefined everywhere'))
  expect(screen.getByRole('textbox', { name: 'Tags' })).toHaveValue('javascript, undefined')
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Linked case (optional)' })).toHaveValue('c1'))
  await userEvent.clear(title)
  await userEvent.type(title, 'Undefined, again')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(vi.mocked(updateArticle).mock.lastCall[0]).toBe('a1')
  expect(vi.mocked(updateArticle).mock.lastCall[1]).toMatchObject({ title: 'Undefined, again' })
  await waitFor(() => expect(currentLocation()).toBe('/articles/a1'))
})

it("won't edit someone else's article", async () => {
  vi.mocked(getArticle).mockResolvedValue({ article: makeArticle({ mine: false }), comments: [], reaction: null })
  renderAt('/articles/a1/edit', { user: 'bob' })
  expect(await screen.findByText('You can only edit your own articles.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
})

it('asks demo accounts to sign up to publish', async () => {
  localStorage.setItem('gd:session', JSON.stringify({ token: 'token-demo', user: { id: 'demo', email: 'demo-1@demo.glitch', isDemo: true } }))
  renderAt('/articles/new')
  expect(await screen.findByText(/Sign up to publish/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
})

it('writes an article in Brazilian Portuguese', async () => {
  renderAt('/articles/new', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Escrever um artigo' })).toBeInTheDocument()
  expect(screen.getByText('Até 5 palavras, separadas por vírgula.')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Tags' }), 'c++')
  expect(screen.getByText('Tags usam só letras minúsculas, números e -.')).toBeInTheDocument()
  await userEvent.clear(screen.getByRole('textbox', { name: 'Tags' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Tags' }), 'a b c d e f')
  expect(screen.getByText('Use no máximo 5 tags.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Artigo' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Prévia' })).toBeInTheDocument()
  const select = await screen.findByRole('combobox', { name: 'Caso vinculado (opcional)' })
  await waitFor(() => expect(select).toHaveTextContent('TypeError · Lendo undefined'))
  expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
})
