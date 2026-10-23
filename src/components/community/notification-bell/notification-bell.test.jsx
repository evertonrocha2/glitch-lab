import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { listNotifications, markNotificationsRead } from '../../../lib/api.js'
import { forgetNotifications } from '../../../lib/community/notifications.js'
import { makeNotification } from '../../../test/community.js'
import { currentLocation, renderAt } from '../../../test/render.jsx'

vi.mock('../../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listArticles: vi.fn().mockResolvedValue({ articles: [], page: 1, hasMore: false }),
  getArticle: vi.fn().mockResolvedValue({ article: null, comments: [], reaction: null }),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}))

const NOTES = [
  makeNotification(),
  makeNotification({ id: 'n2', type: 'rating_valid', actor: { name: 'Bo', handle: null, avatar: { seed: 'x', color: 'violet' }, isPublic: false } }),
  makeNotification({ id: 'n3', type: 'like', read: true, articleId: 'a2', articleTitle: 'Off by one' }),
]

beforeEach(() => {
  forgetNotifications()
  vi.mocked(listNotifications).mockReset().mockResolvedValue({ notifications: NOTES, unread: 2 })
  vi.mocked(markNotificationsRead).mockReset().mockResolvedValue(1)
})
afterEach(() => {
  vi.useRealTimers()
})

it('shows the unread count and lists what happened', async () => {
  renderAt('/articles', { user: 'alice' })
  const bell = await screen.findByRole('button', { name: 'Notifications (2 unread)' })
  await userEvent.click(bell)
  expect(bell).toHaveAttribute('aria-expanded', 'true')
  const list = screen.getByRole('list', { name: 'Notifications' })
  const items = within(list).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual([
    expect.stringContaining('Ana commented on Undefined everywhere'),
    expect.stringContaining('Bo rated Undefined everywhere valid'),
    expect.stringContaining('Ana liked Off by one'),
  ])
})

it('says what happened in Brazilian Portuguese', async () => {
  renderAt('/articles', { user: 'alice', locale: 'pt-BR' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notificações (2 não lidas)' }))
  const list = screen.getByRole('list', { name: 'Notificações' })
  expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    expect.stringContaining('Ana comentou em Undefined everywhere'),
    expect.stringContaining('Bo avaliou Undefined everywhere como válido'),
    expect.stringContaining('Ana curtiu Off by one'),
  ])
  expect(screen.getByRole('button', { name: 'Marcar todas como lidas' })).toBeInTheDocument()
})

it('opens the article and marks that one read', async () => {
  renderAt('/articles', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications (2 unread)' }))
  // What the server says once that one is read (the next page checks again).
  vi.mocked(listNotifications).mockResolvedValue({ notifications: [{ ...NOTES[0], read: true }, ...NOTES.slice(1)], unread: 1 })
  await userEvent.click(screen.getByRole('link', { name: /Ana commented on Undefined everywhere/ }))
  expect(currentLocation()).toBe('/articles/a1')
  expect(vi.mocked(markNotificationsRead).mock.lastCall.slice(0, 2)).toEqual(['n1', 'token-alice'])
  expect(await screen.findByRole('button', { name: 'Notifications (1 unread)' })).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Notifications' })).toBeNull()
})

it('marks everything read', async () => {
  vi.mocked(markNotificationsRead).mockResolvedValue(0)
  renderAt('/articles', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications (2 unread)' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
  expect(vi.mocked(markNotificationsRead).mock.lastCall[0]).toBeNull()
  expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
})

it('checks again every minute and when the window gets focus', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  renderAt('/articles', { user: 'alice' })
  await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(1))
  vi.mocked(listNotifications).mockResolvedValue({ notifications: [makeNotification({ id: 'n4' }), ...NOTES], unread: 3 })
  await act(async () => vi.advanceTimersByTime(60_000))
  expect(await screen.findByRole('button', { name: 'Notifications (3 unread)' })).toBeInTheDocument()
  await act(async () => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(3))
})

it('stays a plain bell when there is nothing new or it cannot load', async () => {
  vi.mocked(listNotifications).mockRejectedValue(new Error('offline'))
  renderAt('/articles', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }))
  expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
})

it('draws placeholder rows until the first check comes back, then the list or the empty note', async () => {
  let resolve
  vi.mocked(listNotifications).mockReturnValue(new Promise((done) => (resolve = done)))
  renderAt('/articles', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }))
  expect(screen.getByRole('status', { name: 'Loading notifications...' })).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByText('No notifications yet.')).not.toBeInTheDocument()

  await act(async () => resolve({ notifications: [], unread: 0 }))
  expect(await screen.findByText('No notifications yet.')).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Loading notifications...' })).not.toBeInTheDocument()
})

it('stops loading when the first check fails', async () => {
  vi.mocked(listNotifications).mockRejectedValue(new Error('offline'))
  renderAt('/articles', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }))
  expect(await screen.findByText('No notifications yet.')).toBeInTheDocument()
})
