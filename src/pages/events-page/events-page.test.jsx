import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { listEvents } from '../../lib/api.js'
import { makeEventSummary } from '../../test/events.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  listEvents: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(listEvents).mockReset().mockResolvedValue({ events: [makeEventSummary()], page: 1, hasMore: false })
})

it('lists live events for a signed-out visitor, with kind, status, dates, countdown and entries', async () => {
  renderAt('/events')
  const list = await screen.findByRole('list', { name: 'Events' })
  const card = within(list).getByRole('article')
  expect(within(card).getByRole('link', { name: 'Rinha de Backend' })).toHaveAttribute('href', '/events/e1')
  expect(within(card).getByText('Backend battle')).toBeInTheDocument()
  expect(within(card).getByText('Live')).toBeInTheDocument()
  expect(within(card).getByText('Ends in')).toBeInTheDocument()
  expect(within(card).getByText(/2 entries/)).toBeInTheDocument()
  expect(vi.mocked(listEvents).mock.lastCall[0]).toEqual({ q: '', tab: 'live', page: 1 })
  expect(screen.getByRole('link', { name: 'Sign in to create' })).toHaveAttribute('href', '/login?next=%2Fevents%2Fnew')
})

it('switches tabs and searches through the address', async () => {
  vi.mocked(listEvents).mockResolvedValue({ events: [], page: 1, hasMore: false })
  renderAt('/events', { user: 'ada' })
  expect(await screen.findByText(/Nothing live right now/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Create an event' })).toHaveAttribute('href', '/events/new')

  await userEvent.click(screen.getByRole('button', { name: 'Upcoming' }))
  expect(currentLocation()).toBe('/events?tab=upcoming')
  expect(vi.mocked(listEvents).mock.lastCall[0]).toMatchObject({ tab: 'upcoming' })
  expect(await screen.findByText(/No upcoming events yet/)).toBeInTheDocument()

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search events' }), 'rinha{Enter}')
  expect(currentLocation()).toBe('/events?tab=upcoming&q=rinha')
  expect(vi.mocked(listEvents).mock.lastCall[0]).toEqual({ q: 'rinha', tab: 'upcoming', page: 1 })
  expect(await screen.findByText('No events match that search.')).toBeInTheDocument()
})

it('loads more events', async () => {
  vi.mocked(listEvents)
    .mockResolvedValueOnce({ events: [makeEventSummary()], page: 1, hasMore: true })
    .mockResolvedValueOnce({ events: [makeEventSummary({ id: 'e2', title: 'Go study group', kind: 'study-group' })], page: 2, hasMore: false })
  renderAt('/events')
  await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
  expect(await screen.findByRole('link', { name: 'Go study group' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
})

it('speaks Portuguese', async () => {
  renderAt('/events', { locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Eventos' })).toBeInTheDocument()
  expect(screen.getByText('Rinha')).toBeInTheDocument()
  expect(screen.getByText('Termina em')).toBeInTheDocument()
  expect(screen.getByText(/2 participações/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Em breve' })).toBeInTheDocument()
})

it('shows Events in the app navigation', async () => {
  renderAt('/events', { user: 'ada' })
  const nav = await screen.findByRole('navigation', { name: 'Main' })
  expect(within(nav).getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events')
})
