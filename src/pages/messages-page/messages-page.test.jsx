import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { blockPerson, getConversationMessages, listConversations, markConversationRead, sendConversationMessage } from '../../lib/api.js'
import { forgetUnreadMessages } from '../../lib/chat/unread.js'
import { BO } from '../../test/community.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  getUnreadMessages: vi.fn().mockResolvedValue(2),
  listConversations: vi.fn(),
  getConversationMessages: vi.fn(),
  sendConversationMessage: vi.fn(),
  markConversationRead: vi.fn(),
  blockPerson: vi.fn(),
  unblockPerson: vi.fn(),
  reportMessage: vi.fn(),
}))

// The realtime channel, faked: every topic joined, with the handlers the page gave it.
const realtime = vi.hoisted(() => ({ channels: [] }))
vi.mock('../../lib/realtime/index.js', () => ({
  dmTopic: (id) => `dm:${id}`,
  communityTopic: (id) => `community:${id}`,
  joinTopic: vi.fn((topic, handlers) => {
    const channel = { topic, handlers, nudge: vi.fn(), leave: vi.fn() }
    realtime.channels.push(channel)
    handlers.onStatus('live')
    return channel
  }),
  joinDuel: vi.fn(() => ({ nudge: vi.fn(), setSeat: vi.fn(), leave: vi.fn() })),
  nudgeDuel: vi.fn(),
}))

const ME = { handle: 'ada_dev', name: 'Ada', avatar: { seed: 'ada', color: 'cobalt' }, isPublic: true }
const now = Date.now()
const at = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString()
const message = (id, body, mine, minutesAgo) => ({ id, body, mine, sender: mine ? ME : BO, createdAt: at(minutesAgo) })
const CONVERSATION = { id: 'c1', other: BO, blocked: false, canSend: true, reason: null }
const INBOX = [
  { id: 'c1', other: BO, blocked: false, lastMessage: { body: 'See https://glitch.dev', mine: false, createdAt: at(5) }, lastMessageAt: at(5), unread: true },
  { id: 'c2', other: { ...ME, name: 'Cy', handle: 'cy' }, blocked: false, lastMessage: { body: 'Thanks!', mine: true, createdAt: at(90) }, lastMessageAt: at(90), unread: false },
]

beforeEach(() => {
  realtime.channels.length = 0
  forgetUnreadMessages()
  vi.mocked(listConversations).mockReset().mockResolvedValue({ conversations: INBOX, unread: 1 })
  vi.mocked(getConversationMessages)
    .mockReset()
    .mockResolvedValue({ conversation: CONVERSATION, messages: [message('m1', 'Hi Ada', false, 10), message('m2', 'Hey Bo', true, 8), message('m3', 'See https://glitch.dev', false, 5)], hasMore: false })
  vi.mocked(sendConversationMessage).mockReset()
  vi.mocked(markConversationRead).mockReset().mockResolvedValue(0)
  vi.mocked(blockPerson).mockReset().mockResolvedValue({ blocked: true })
})

it('lists conversations newest first with the last message and an unread mark', async () => {
  renderAt('/messages', { user: 'ada' })
  const inbox = await screen.findByRole('list', { name: 'Conversations' })
  const items = within(inbox).getAllByRole('link')
  expect(items.map((item) => item.getAttribute('href'))).toEqual(['/messages/c1', '/messages/c2'])
  expect(within(items[0]).getByText('Bo')).toBeInTheDocument()
  expect(within(items[0]).getByText('(unread)')).toBeInTheDocument()
  expect(within(items[1]).getByText('You: Thanks!')).toBeInTheDocument()
  expect(within(items[1]).queryByText('(unread)')).not.toBeInTheDocument()
  expect(screen.getByText('Pick a conversation to read it.')).toBeInTheDocument()
})

it('shows the unread count on the Messages nav item', async () => {
  vi.mocked(listConversations).mockResolvedValue({ conversations: INBOX, unread: 2 })
  renderAt('/messages', { user: 'ada' })
  const nav = await screen.findByRole('navigation', { name: 'Main' })
  const link = within(nav).getByRole('link', { name: /^Messages/ })
  expect(link).toHaveAttribute('href', '/messages')
  expect(await within(link).findByText('(2 unread conversations)')).toBeInTheDocument()
  expect(within(nav).getByRole('link', { name: 'Communities' })).toHaveAttribute('href', '/communities')
})

it('opens a conversation: messages by day, safe links, read mark, and a back button for phones', async () => {
  renderAt('/messages/c1', { user: 'ada' })
  const log = await screen.findByRole('list', { name: 'Messages with Bo' })
  expect(within(log).getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  expect(within(log).getByText('Hey Bo')).toBeInTheDocument()
  const link = within(log).getByRole('link', { name: 'https://glitch.dev' })
  expect(link).toHaveAttribute('href', 'https://glitch.dev/')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
  await waitFor(() => expect(markConversationRead).toHaveBeenCalledWith('c1', 'token-ada'))

  await userEvent.click(screen.getByRole('link', { name: 'Back to conversations' }))
  expect(currentLocation()).toBe('/messages')
})

it('sends with Enter, keeps Shift+Enter as a new line, and nudges the channel', async () => {
  vi.mocked(sendConversationMessage).mockImplementation(async (_id, body) => message('m9', body, true, 0))
  renderAt('/messages/c1', { user: 'ada' })
  const box = await screen.findByRole('textbox', { name: 'Message to Bo' })
  await userEvent.type(box, 'Line one{Shift>}{Enter}{/Shift}line two')
  expect(sendConversationMessage).not.toHaveBeenCalled()
  await userEvent.type(box, '{Enter}')
  expect(sendConversationMessage).toHaveBeenCalledWith('c1', 'Line one\nline two', 'token-ada')
  expect(await screen.findByText(/line two/)).toBeInTheDocument()
  expect(box).toHaveValue('')
  expect(realtime.channels.at(-1)).toMatchObject({ topic: 'dm:c1' })
  expect(realtime.channels.at(-1).nudge).toHaveBeenCalled()
})

it('keeps the text and shows the server message when sending fails', async () => {
  vi.mocked(sendConversationMessage).mockRejectedValue(new Error('You can send 20 messages a minute. Wait a moment.'))
  renderAt('/messages/c1', { user: 'ada' })
  const box = await screen.findByRole('textbox', { name: 'Message to Bo' })
  await userEvent.type(box, 'Too fast{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('You can send 20 messages a minute.')
  expect(box).toHaveValue('Too fast')
})

it('counts down near the limit', async () => {
  renderAt('/messages/c1', { user: 'ada' })
  const box = await screen.findByRole('textbox', { name: 'Message to Bo' })
  await userEvent.click(box)
  await userEvent.paste('x'.repeat(1990))
  expect(screen.getByText('10 characters left')).toBeInTheDocument()
  await userEvent.paste('x'.repeat(15))
  expect(screen.getByText('5 characters too many')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
})

it('refetches what is new when the realtime channel says it changed, and announces it', async () => {
  renderAt('/messages/c1', { user: 'ada' })
  await screen.findByRole('list', { name: 'Messages with Bo' })
  vi.mocked(getConversationMessages).mockResolvedValueOnce({ conversation: CONVERSATION, messages: [message('m4', 'Are you there?', false, 0)], hasMore: false })
  await act(async () => realtime.channels.at(-1).handlers.onChange())
  expect(vi.mocked(getConversationMessages).mock.lastCall).toEqual(['c1', { after: at(5) }, 'token-ada'])
  expect(await screen.findByText('Are you there?')).toBeInTheDocument()
  expect(screen.getByText('New message from Bo: Are you there?')).toBeInTheDocument()
})

it('does not announce my own messages', async () => {
  vi.mocked(sendConversationMessage).mockImplementation(async (_id, body) => message('m9', body, true, 0))
  renderAt('/messages/c1', { user: 'ada' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Message to Bo' }), 'Mine{Enter}')
  await screen.findByText('Mine')
  expect(screen.queryByText(/New message from/)).not.toBeInTheDocument()
})

it('blocks after a confirm, and then has no composer', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderAt('/messages/c1', { user: 'ada' })
  await screen.findByRole('list', { name: 'Messages with Bo' })
  vi.mocked(getConversationMessages).mockResolvedValue({
    conversation: { ...CONVERSATION, blocked: true, canSend: false, reason: 'blocked' },
    messages: [message('m2', 'Hey Bo', true, 8)],
    hasMore: false,
  })
  await userEvent.click(screen.getByRole('button', { name: 'Block' }))
  expect(blockPerson).toHaveBeenCalledWith({ conversationId: 'c1' }, 'token-ada')
  expect(await screen.findByText('You blocked this person. Unblock them to send a message.')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Unblock' })).toBeInTheDocument()
  vi.restoreAllMocks()
})

it('speaks Portuguese', async () => {
  renderAt('/messages/c1', { user: 'ada', locale: 'pt-BR' })
  expect(await screen.findByRole('list', { name: 'Mensagens com Bo' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Mensagem para Bo' })).toHaveAttribute('placeholder', expect.stringMatching(/^Ex\.: /))
  expect(screen.getByRole('button', { name: 'Bloquear' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Voltar para as conversas' })).toBeInTheDocument()
})
