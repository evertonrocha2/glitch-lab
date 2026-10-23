import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createCommunity,
  deleteCommunityMessage,
  getCommunity,
  getCommunityMessages,
  joinCommunity,
  listCommunities,
  postCommunityMessage,
  removeCommunityMember,
} from '../../lib/api.js'
import { ADA, BO } from '../../test/community.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  getUnreadMessages: vi.fn().mockResolvedValue(0),
  listCommunities: vi.fn(),
  createCommunity: vi.fn(),
  getCommunity: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  getCommunityMessages: vi.fn(),
  postCommunityMessage: vi.fn(),
  deleteCommunityMessage: vi.fn(),
  removeCommunityMember: vi.fn(),
  reportMessage: vi.fn(),
}))

const realtime = vi.hoisted(() => ({ channels: [] }))
vi.mock('../../lib/realtime/index.js', () => ({
  dmTopic: (id) => `dm:${id}`,
  communityTopic: (id) => `community:${id}`,
  joinTopic: vi.fn((topic, handlers) => {
    const channel = { topic, handlers, nudge: vi.fn(), leave: vi.fn() }
    realtime.channels.push(channel)
    handlers.onStatus('off')
    return channel
  }),
  joinDuel: vi.fn(() => ({ nudge: vi.fn(), setSeat: vi.fn(), leave: vi.fn() })),
  nudgeDuel: vi.fn(),
}))

const CARD = { id: 'k1', slug: 'cafe-com-js', name: 'Café com JS', description: 'Async and coffee.', topics: ['javascript'], color: 'cobalt', icon: 'coffee', memberCount: 2, createdAt: '2026-10-20T12:00:00Z', joined: false }
const detail = (overrides = {}) => ({
  community: { ...CARD, owner: ADA },
  membership: null,
  canPost: false,
  members: [
    { person: ADA, role: 'owner', joinedAt: '2026-10-20T12:00:00Z' },
    { person: BO, role: 'member', joinedAt: '2026-10-21T12:00:00Z' },
  ],
  ...overrides,
})
const at = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
const message = (id, body, sender, overrides = {}) => ({ id, body, sender, mine: false, canDelete: false, createdAt: at(5), ...overrides })

beforeEach(() => {
  realtime.channels.length = 0
  vi.mocked(listCommunities).mockReset().mockResolvedValue({ communities: [CARD], page: 1, hasMore: false, mine: [] })
  vi.mocked(getCommunity).mockReset().mockResolvedValue(detail())
  vi.mocked(getCommunityMessages).mockReset().mockResolvedValue({ messages: [message('x1', 'Oi pessoal', BO)], hasMore: false })
  vi.mocked(joinCommunity).mockReset()
  vi.mocked(postCommunityMessage).mockReset()
  vi.mocked(deleteCommunityMessage).mockReset().mockResolvedValue(undefined)
  vi.mocked(removeCommunityMember).mockReset().mockResolvedValue(undefined)
  vi.mocked(createCommunity).mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('lists communities for a signed-out visitor and filters by topic and search', async () => {
  renderAt('/communities')
  const list = await screen.findByRole('list', { name: 'Communities' })
  expect(within(list).getByRole('link', { name: 'Café com JS' })).toHaveAttribute('href', '/communities/cafe-com-js')
  expect(within(list).getByText('2 members')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign in to create' })).toHaveAttribute('href', '/login?next=%2Fcommunities%2Fnew')

  vi.mocked(listCommunities).mockResolvedValue({ communities: [], page: 1, hasMore: false, mine: [] })
  await userEvent.click(screen.getByRole('button', { name: 'Python' }))
  expect(currentLocation()).toBe('/communities?topic=python')
  expect(vi.mocked(listCommunities).mock.lastCall[0]).toEqual({ q: '', topic: 'python', page: 1 })
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search communities' }), 'rinha{Enter}')
  expect(vi.mocked(listCommunities).mock.lastCall[0]).toEqual({ q: 'rinha', topic: 'python', page: 1 })
  expect(await screen.findByText('No communities match that search.')).toBeInTheDocument()
})

it('shows a public community chat signed out, with a sign-in prompt instead of the composer', async () => {
  renderAt('/communities/cafe-com-js')
  expect(await screen.findByRole('heading', { level: 1, name: 'Café com JS' })).toBeInTheDocument()
  expect(await screen.findByText('Oi pessoal')).toBeInTheDocument()
  expect(screen.getByText('Sign in and join to chat.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign in to join' })).toHaveAttribute('href', '/login?next=%2Fcommunities%2Fcafe-com-js')
  const members = screen.getByRole('list', { name: 'Members' })
  expect(within(members).getByText('Owner')).toBeInTheDocument()
  expect(within(members).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  expect(realtime.channels.at(-1).topic).toBe('community:k1')
})

it('joins, posts and polls for news when realtime is off', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(joinCommunity).mockResolvedValue(detail({ membership: { role: 'member' }, canPost: true, community: { ...CARD, owner: ADA, memberCount: 3, joined: true } }))
  vi.mocked(postCommunityMessage).mockImplementation(async (_slug, body) => message('x2', body, ADA, { mine: true, canDelete: true, createdAt: at(0) }))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/communities/cafe-com-js', { user: 'ada' })
  await user.click(await screen.findByRole('button', { name: 'Join' }))
  expect(joinCommunity).toHaveBeenCalledWith('cafe-com-js', 'token-ada')
  expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Message in Café com JS' }), 'Bora estudar{Enter}')
  expect(postCommunityMessage).toHaveBeenCalledWith('cafe-com-js', 'Bora estudar', 'token-ada')
  expect(await screen.findByText('Bora estudar')).toBeInTheDocument()

  vi.mocked(getCommunityMessages).mockResolvedValue({ messages: [message('x3', 'Bora!', BO, { createdAt: at(0) })], hasMore: false })
  await act(async () => vi.advanceTimersByTime(5000))
  expect(await screen.findByText('Bora!')).toBeInTheDocument()
  expect(vi.mocked(getCommunityMessages).mock.lastCall[1]).toEqual({ after: expect.any(String) })
})

it('lets the owner delete any message and remove a member', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const owned = detail({
    membership: { role: 'owner' },
    canPost: true,
    members: [
      { id: 'u-ada', person: ADA, role: 'owner', joinedAt: '2026-10-20T12:00:00Z' },
      { id: 'u-bo', person: BO, role: 'member', joinedAt: '2026-10-21T12:00:00Z' },
    ],
  })
  vi.mocked(getCommunity).mockResolvedValue(owned)
  vi.mocked(getCommunityMessages).mockResolvedValue({ messages: [message('x1', 'spam spam', BO, { canDelete: true })], hasMore: false })
  renderAt('/communities/cafe-com-js', { user: 'ada' })

  await userEvent.click(await screen.findByRole('button', { name: 'Delete message' }))
  expect(deleteCommunityMessage).toHaveBeenCalledWith('x1', 'token-ada')
  await waitFor(() => expect(screen.queryByText('spam spam')).not.toBeInTheDocument())

  await userEvent.click(screen.getByRole('button', { name: 'Remove Bo' }))
  expect(removeCommunityMember).toHaveBeenCalledWith('cafe-com-js', 'u-bo', 'token-ada')
})

it('creates a community and opens it', async () => {
  vi.mocked(createCommunity).mockResolvedValue({ ...CARD, slug: 'rust-rio' })
  renderAt('/communities/new', { user: 'ada' })
  const save = await screen.findByRole('button', { name: 'Create community' })
  expect(save).toBeDisabled()
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Rust Rio')
  await userEvent.click(screen.getByRole('button', { name: 'Backend' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Sky' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Rocket' }))
  await userEvent.click(save)
  expect(createCommunity).toHaveBeenCalledWith({ name: 'Rust Rio', description: '', topics: ['backend'], color: 'sky', icon: 'rocket' }, 'token-ada')
  await waitFor(() => expect(currentLocation()).toBe('/communities/rust-rio'))
})

it('speaks Portuguese', async () => {
  renderAt('/communities', { locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Comunidades' })).toBeInTheDocument()
  expect(screen.getByText('2 membros')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Buscar comunidades' })).toHaveAttribute('placeholder', expect.stringMatching(/^Ex\.: /))
  expect(screen.getByRole('button', { name: 'Grupo de estudo' })).toBeInTheDocument()
})
