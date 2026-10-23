import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { listNotifications, markNotificationsRead } from '../../lib/api.js'
import { forgetNotifications } from '../../lib/community/notifications.js'
import { makeNotification } from '../../test/community.js'
import { renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listEvents: vi.fn().mockResolvedValue({ events: [], page: 1, hasMore: false }),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}))

const event = (overrides) => makeNotification({ articleId: null, articleTitle: null, eventId: 'e1', eventTitle: 'Rinha de Backend', ...overrides })

beforeEach(() => {
  forgetNotifications()
  vi.mocked(listNotifications)
    .mockReset()
    .mockResolvedValue({
      notifications: [event({ id: 'n1', type: 'event_join' }), event({ id: 'n2', type: 'event_vote' }), event({ id: 'n3', type: 'event_winner', read: true })],
      unread: 2,
    })
  vi.mocked(markNotificationsRead).mockReset().mockResolvedValue(1)
})

it('tells what happened in an event and opens it', async () => {
  renderAt('/events', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications (2 unread)' }))
  const items = within(screen.getByRole('list', { name: 'Notifications' })).getAllByRole('link')
  expect(items.map((item) => item.textContent)).toEqual([
    expect.stringContaining('Ana joined Rinha de Backend'),
    expect.stringContaining('Ana voted for your entry in Rinha de Backend'),
    expect.stringContaining('Ana announced the winners of Rinha de Backend'),
  ])
  for (const item of items) expect(item).toHaveAttribute('href', '/events/e1')
})

it('says it in Portuguese', async () => {
  renderAt('/events', { user: 'alice', locale: 'pt-BR' })
  await userEvent.click(await screen.findByRole('button', { name: 'Notificações (2 não lidas)' }))
  expect(screen.getByText('Ana votou na sua participação em Rinha de Backend')).toBeInTheDocument()
})
