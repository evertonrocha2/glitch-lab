import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getConversationMessages, listConversations, listNotifications } from '../../../lib/api.js'
import { ALERT_POLL_MS, ALERT_REALTIME_POLL_MS, previewText, titleWithCount } from '../../../lib/chat/message-alerts.jsx'
import { forgetUnreadMessages } from '../../../lib/chat/unread.js'
import { forgetNotifications } from '../../../lib/community/notifications.js'
import { BO } from '../../../test/community.js'
import { currentLocation, renderAt } from '../../../test/render.jsx'
import { SHOW_MS } from './message-toasts.jsx'

vi.mock('../../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  getUnreadMessages: vi.fn().mockResolvedValue(0),
  listConversations: vi.fn(),
  getConversationMessages: vi.fn(),
  sendConversationMessage: vi.fn(),
  markConversationRead: vi.fn().mockResolvedValue(0),
  blockPerson: vi.fn(),
  unblockPerson: vi.fn(),
  reportMessage: vi.fn(),
}))

// The realtime channels, faked: every topic joined, with the handlers it was given.
const realtime = vi.hoisted(() => ({ channels: [], status: 'live' }))
vi.mock('../../../lib/realtime/index.js', () => ({
  dmTopic: (id) => `dm:${id}`,
  communityTopic: (id) => `community:${id}`,
  userTopic: (id) => `user:${id}`,
  joinTopic: vi.fn((topic, handlers) => {
    const channel = { topic, handlers, nudge: vi.fn(), leave: vi.fn() }
    realtime.channels.push(channel)
    handlers.onStatus(realtime.status)
    return channel
  }),
  joinDuel: vi.fn(() => ({ nudge: vi.fn(), setSeat: vi.fn(), leave: vi.fn() })),
  nudgeDuel: vi.fn(),
  nudgeTopic: vi.fn(),
}))

const ME = { handle: 'ada_dev', name: 'Ada', avatar: { seed: 'ada', color: 'cobalt' }, isPublic: true }
const ANA = { handle: 'ana', name: 'Ana', avatar: { seed: 'ana', color: 'violet' }, isPublic: true }
const CY = { handle: 'cy', name: 'Cy', avatar: { seed: 'cy', color: 'cobalt' }, isPublic: true }
const PEOPLE = { c1: BO, c3: ANA, c4: CY }

// A tiny server: each conversation's messages, and the inbox built from them.
let threads
let inbox
let clock
let hidden

function deliver(id, body, { mine = false } = {}) {
  clock += 60_000
  const createdAt = new Date(clock).toISOString()
  const other = PEOPLE[id]
  threads[id] = [...(threads[id] ?? []), { id: `m${clock}`, body, mine, sender: mine ? ME : other, createdAt }]
  inbox = [{ id, other, blocked: false, lastMessage: { body, mine, createdAt }, lastMessageAt: createdAt, unread: !mine }, ...inbox.filter((item) => item.id !== id)]
}

function readAll() {
  inbox = inbox.map((item) => ({ ...item, unread: false }))
}

const userChannel = () => realtime.channels.filter((channel) => channel.topic === 'user:ada').at(-1)
const toasts = () => within(screen.getByRole('status', { name: 'New messages' }))
const nudge = () => act(async () => userChannel().handlers.onChange())

beforeEach(() => {
  realtime.channels.length = 0
  realtime.status = 'live'
  forgetUnreadMessages()
  forgetNotifications()
  threads = {}
  inbox = []
  clock = Date.parse('2026-10-23T12:00:00Z')
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.title = 'Glitch Lab'
  // An old unread message from Bo, there before the app opened.
  deliver('c1', 'Old news')
  vi.mocked(listConversations)
    .mockReset()
    .mockImplementation(async () => ({ conversations: inbox, unread: inbox.filter((item) => item.unread).length }))
  vi.mocked(getConversationMessages)
    .mockReset()
    .mockImplementation(async (id, cursor = {}) => ({
      conversation: { id, other: PEOPLE[id], blocked: false, canSend: true, reason: null },
      messages: (threads[id] ?? []).filter((item) => !cursor.after || item.createdAt > cursor.after),
      hasMore: false,
    }))
  vi.mocked(listNotifications).mockReset().mockResolvedValue({ notifications: [], unread: 0 })
})
afterEach(() => {
  vi.useRealTimers()
  delete document.hidden
})

// The page is up and the alerts took their first look at the inbox (the messages page asks too).
async function open(path = '/messages', options = {}) {
  renderAt(path, { user: 'ada', messageAlerts: true, ...options })
  await waitFor(() => expect(userChannel()).toBeDefined())
  const asks = path.startsWith('/messages') ? 2 : 1
  await waitFor(() => expect(listConversations.mock.calls.length).toBeGreaterThanOrEqual(asks))
  await act(async () => {})
}

it('shows nothing for old unread messages on the first load, and tracks the title', async () => {
  await open()
  expect(toasts().queryAllByRole('listitem')).toHaveLength(0)
  await waitFor(() => expect(document.title).toBe('(1) Glitch Lab'))
})

it('on a nudge, refetches and shows a toast with the name, a preview and a link', async () => {
  await open()
  const long = `Found the bug: ${'the loop starts at one instead of zero and '.repeat(4)}that's it`
  deliver('c3', long)
  vi.mocked(listNotifications).mockResolvedValue({ notifications: [], unread: 1 })
  await nudge()

  const link = await toasts().findByRole('link', { name: 'Ana sent you a message' })
  expect(link).toHaveAttribute('href', '/messages/c3')
  expect(link).toHaveTextContent('💬 Ana sent you a message')
  const preview = toasts().getByText(/^Found the bug/)
  expect(preview.textContent.length).toBeLessThanOrEqual(80)
  expect(preview.textContent.endsWith('...')).toBe(true)
  expect(toasts().getByRole('button', { name: 'Close the message from Ana' })).toBeInTheDocument()
  // Polite and out of the way: nothing took the focus.
  expect(screen.getByRole('status', { name: 'New messages' })).toHaveAttribute('aria-live', 'polite')
  expect(document.activeElement).toBe(document.body)

  // The bell, the nav badge and the tab title follow from the same refetch.
  expect(await screen.findByRole('button', { name: /1 unread/ })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(within(nav).getByText('(2 unread conversations)')).toBeInTheDocument()
  expect(document.title).toBe('(2) Glitch Lab')
  // And the inbox on the page.
  expect(await within(screen.getByRole('list', { name: 'Conversations' })).findByText('Ana')).toBeInTheDocument()

  // Opening it from the toast takes me there and closes the toast.
  await userEvent.click(link)
  expect(currentLocation()).toBe('/messages/c3')
  expect(toasts().queryAllByRole('listitem')).toHaveLength(0)
})

it('groups new messages from the same person into one toast', async () => {
  await open()
  deliver('c3', 'One')
  await nudge()
  await toasts().findByRole('link', { name: 'Ana sent you a message' })
  deliver('c3', 'Two')
  deliver('c3', 'Three')
  await nudge()
  expect(await toasts().findByRole('link', { name: '3 new messages from Ana' })).toBeInTheDocument()
  expect(toasts().getAllByRole('listitem')).toHaveLength(1)
  expect(toasts().getByText('Three')).toBeInTheDocument()
})

it('shows no toast for the conversation already open, nor for my own messages', async () => {
  deliver('c3', 'Hi')
  readAll()
  await open('/messages/c3')
  deliver('c3', 'Are you there?')
  deliver('c1', 'Sent from my other tab', { mine: true })
  await nudge()
  await waitFor(() => expect(listConversations.mock.calls.length).toBeGreaterThanOrEqual(3))
  await act(async () => {})
  expect(toasts().queryAllByRole('listitem')).toHaveLength(0)
  // Someone else still gets through.
  deliver('c4', 'Hey Ada')
  await nudge()
  expect(await toasts().findByRole('link', { name: 'Cy sent you a message' })).toBeInTheDocument()
  expect(toasts().getAllByRole('listitem')).toHaveLength(1)
})

it('closes on its button, and on its own after a few seconds unless hovered', async () => {
  await open()
  deliver('c3', 'First')
  await nudge()
  await userEvent.click(await toasts().findByRole('button', { name: 'Close the message from Ana' }))
  expect(toasts().queryAllByRole('listitem')).toHaveLength(0)

  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  deliver('c3', 'Second')
  await nudge()
  await act(async () => {})
  const item = toasts().getByRole('listitem')
  act(() => item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
  await act(async () => vi.advanceTimersByTime(SHOW_MS * 3))
  expect(toasts().getAllByRole('listitem')).toHaveLength(1)
  act(() => item.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
  await act(async () => vi.advanceTimersByTime(SHOW_MS - 100))
  expect(toasts().getAllByRole('listitem')).toHaveLength(1)
  await act(async () => vi.advanceTimersByTime(200))
  expect(toasts().queryAllByRole('listitem')).toHaveLength(0)
})

it('restores the title once everything is read', async () => {
  await open()
  await waitFor(() => expect(document.title).toBe('(1) Glitch Lab'))
  readAll()
  await nudge()
  await waitFor(() => expect(document.title).toBe('Glitch Lab'))
})

it('polls every 10 seconds without realtime, every 30 with it, and not while the tab is hidden', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  realtime.status = 'off'
  await open()
  const calls = () => listConversations.mock.calls.length
  let before = calls()
  deliver('c3', 'Polled in')
  await act(async () => vi.advanceTimersByTime(ALERT_POLL_MS - 1000))
  expect(calls()).toBe(before)
  await act(async () => vi.advanceTimersByTime(1000))
  await waitFor(() => expect(calls()).toBeGreaterThan(before))
  expect(await toasts().findByRole('link', { name: 'Ana sent you a message' })).toBeInTheDocument()

  hidden = true
  before = calls()
  await act(async () => vi.advanceTimersByTime(ALERT_POLL_MS * 2))
  expect(calls()).toBe(before)
  hidden = false
})

it('with realtime on, the poll waits 30 seconds', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  // Not the messages page, which polls its own list.
  await open('/notes')
  const before = listConversations.mock.calls.length
  await act(async () => vi.advanceTimersByTime(ALERT_REALTIME_POLL_MS - 1000))
  expect(listConversations.mock.calls.length).toBe(before)
  await act(async () => vi.advanceTimersByTime(1000))
  await waitFor(() => expect(listConversations.mock.calls.length).toBe(before + 1))
})

it('speaks Portuguese', async () => {
  await open('/messages', { locale: 'pt-BR' })
  deliver('c3', 'Oi')
  await nudge()
  const list = within(screen.getByRole('status', { name: 'Mensagens novas' }))
  expect(await list.findByRole('link', { name: 'Ana mandou uma mensagem' })).toBeInTheDocument()
  expect(list.getByRole('button', { name: 'Fechar a mensagem de Ana' })).toBeInTheDocument()
  deliver('c3', 'Tudo bem?')
  await nudge()
  expect(await list.findByRole('link', { name: '2 mensagens novas de Ana' })).toBeInTheDocument()
})

it('makes a one-line preview and a counted title', () => {
  expect(previewText('  two\n\nlines  ')).toBe('two lines')
  expect(previewText('x'.repeat(200))).toHaveLength(80)
  expect(titleWithCount('Glitch Lab', 3)).toBe('(3) Glitch Lab')
  expect(titleWithCount('(3) Glitch Lab', 1)).toBe('(1) Glitch Lab')
  expect(titleWithCount('(3) Glitch Lab', 0)).toBe('Glitch Lab')
})
