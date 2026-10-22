import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { addArticleComment, deleteArticle, deleteArticleComment, getArticle, reactToArticle } from '../lib/api.js'
import { BO, makeArticle, makeComment } from '../test/community.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  listArticles: vi.fn().mockResolvedValue({ articles: [], page: 1, hasMore: false }),
  getArticle: vi.fn(),
  deleteArticle: vi.fn(),
  addArticleComment: vi.fn(),
  deleteArticleComment: vi.fn(),
  reactToArticle: vi.fn(),
}))

const loaded = (overrides = {}) => ({ article: makeArticle(), comments: [makeComment()], reaction: null, ...overrides })

beforeEach(() => {
  vi.mocked(getArticle).mockReset().mockResolvedValue(loaded())
  vi.mocked(reactToArticle).mockReset()
  vi.mocked(addArticleComment).mockReset()
  vi.mocked(deleteArticleComment).mockReset().mockResolvedValue()
  vi.mocked(deleteArticle).mockReset().mockResolvedValue()
})

it('shows the article safely to a signed-out reader', async () => {
  renderAt('/articles/a1')
  expect(await screen.findByRole('heading', { level: 1, name: 'Undefined everywhere' })).toBeInTheDocument()
  expect(vi.mocked(getArticle).mock.lastCall[0]).toBe('a1')
  expect(screen.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/u/ada_dev')
  // Inline code, a code block, and HTML shown as plain text (never run).
  expect(screen.getByText('a?.b').tagName).toBe('CODE')
  expect(screen.getByText('const name = user?.name').closest('pre')).not.toBeNull()
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()

  const linked = screen.getByRole('region', { name: 'Linked case' })
  expect(within(linked).getByText('TypeError')).toBeInTheDocument()
  expect(within(linked).getByText('Reading undefined')).toBeInTheDocument()

  expect(screen.getByRole('link', { name: '#javascript' })).toHaveAttribute('href', '/articles?tag=javascript')
  expect(screen.getByText('Great tip.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign in to comment' })).toHaveAttribute('href', '/login?next=%2Farticles%2Fa1')
})

it('sends signed-out readers to sign in when they react', async () => {
  renderAt('/articles/a1')
  await userEvent.click(await screen.findByRole('button', { name: 'Like (3)' }))
  expect(currentLocation()).toBe('/login?next=%2Farticles%2Fa1')
  expect(reactToArticle).not.toHaveBeenCalled()
})

it('likes and rates an article, updating the counts', async () => {
  vi.mocked(reactToArticle)
    .mockResolvedValueOnce({ reaction: { liked: true, rating: null }, counts: { likes: 4, valid: 2, bad: 0, comments: 1 } })
    .mockResolvedValueOnce({ reaction: { liked: true, rating: 'valid' }, counts: { likes: 4, valid: 3, bad: 0, comments: 1 } })
    .mockResolvedValueOnce({ reaction: { liked: true, rating: null }, counts: { likes: 4, valid: 2, bad: 0, comments: 1 } })
  renderAt('/articles/a1', { user: 'bob' })

  await userEvent.click(await screen.findByRole('button', { name: 'Like (3)' }))
  expect(vi.mocked(reactToArticle).mock.lastCall.slice(0, 3)).toEqual(['a1', { like: true }, 'token-bob'])
  expect(await screen.findByRole('button', { name: 'Like (4)' })).toHaveAttribute('aria-pressed', 'true')

  await userEvent.click(screen.getByRole('button', { name: 'Valid (2)' }))
  expect(vi.mocked(reactToArticle).mock.lastCall[1]).toEqual({ rating: 'valid' })
  expect(await screen.findByRole('button', { name: 'Valid (3)' })).toHaveAttribute('aria-pressed', 'true')

  // Pressing the same rating again takes it back.
  await userEvent.click(screen.getByRole('button', { name: 'Valid (3)' }))
  expect(vi.mocked(reactToArticle).mock.lastCall[1]).toEqual({ rating: null })
  expect(await screen.findByRole('button', { name: 'Valid (2)' })).toHaveAttribute('aria-pressed', 'false')
})

it('posts a comment and deletes one the reader may delete', async () => {
  vi.mocked(getArticle).mockResolvedValue(loaded({ comments: [makeComment({ canDelete: true })] }))
  vi.mocked(addArticleComment).mockResolvedValue(makeComment({ id: 'c2', body: 'Thanks, this helped.', author: { ...BO, name: 'Bob' }, canDelete: true }))
  renderAt('/articles/a1', { user: 'bob' })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Your comment' }), 'Thanks, this helped.')
  await userEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(vi.mocked(addArticleComment).mock.lastCall.slice(0, 3)).toEqual(['a1', 'Thanks, this helped.', 'token-bob'])
  expect(await screen.findByText('Thanks, this helped.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Your comment' })).toHaveValue('')
  expect(screen.getByRole('heading', { name: 'Comments (2)' })).toBeInTheDocument()

  const first = screen.getByText('Great tip.').closest('li')
  await userEvent.click(within(first).getByRole('button', { name: 'Delete comment' }))
  expect(vi.mocked(deleteArticleComment).mock.lastCall[0]).toBe('c1')
  await waitFor(() => expect(screen.queryByText('Great tip.')).toBeNull())
})

it("lets the author edit or delete, but not rate, their own article", async () => {
  vi.mocked(getArticle).mockResolvedValue(loaded({ article: makeArticle({ mine: true, caseId: 'c9' }) }))
  renderAt('/articles/a1', { user: 'alice' })
  expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/articles/a1/edit')
  expect(screen.getByRole('button', { name: 'Valid (2)' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Like (3)' })).toBeDisabled()
  expect(screen.getByText("You can't like or rate your own article.")).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))
  expect(vi.mocked(deleteArticle).mock.lastCall[0]).toBe('a1')
  await waitFor(() => expect(currentLocation()).toBe('/articles'))
})

it('tells demo accounts to sign up before commenting', async () => {
  localStorage.setItem('gd:session', JSON.stringify({ token: 'token-demo', user: { id: 'demo', email: 'demo-1@demo.glitch', isDemo: true } }))
  renderAt('/articles/a1')
  expect(await screen.findByText(/Sign up to comment/)).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Your comment' })).toBeNull()
})

it('says when the article is gone', async () => {
  vi.mocked(getArticle).mockRejectedValue(new Error('Article not found.'))
  renderAt('/articles/zzz')
  expect(await screen.findByRole('alert')).toHaveTextContent('Article not found.')
  expect(screen.getByRole('link', { name: '< All articles' })).toHaveAttribute('href', '/articles')
})
