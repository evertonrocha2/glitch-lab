import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getMessageSettings, getMessagingWith, getPublicProfile, saveMessageSettings, startConversation, unblockPerson } from '../../../lib/api.js'
import { forgetMyProfiles } from '../../../lib/profile/my-profile.js'
import { currentLocation, renderAt } from '../../../test/render.jsx'

vi.mock('../../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  getUnreadMessages: vi.fn().mockResolvedValue(0),
  getPublicProfile: vi.fn(),
  listPublicNotes: vi.fn().mockResolvedValue([]),
  getMessagingWith: vi.fn(),
  startConversation: vi.fn(),
  unblockPerson: vi.fn(),
  getMessageSettings: vi.fn(),
  saveMessageSettings: vi.fn(),
}))

const PROFILE = {
  handle: 'bo_reads',
  displayName: 'Bo',
  bio: '',
  avatar: { seed: 'bo', color: 'violet' },
  level: 1,
  title: 'Rookie',
  xp: 0,
  levelXp: 0,
  nextLevelXp: 100,
  streak: 0,
  totalSeconds: 0,
  counts: { cases: 0, solved: 0, passedChallenges: 0 },
  badges: [],
  featuredBadges: [],
  memberSince: '2026-10-01T12:00:00Z',
}

beforeEach(() => {
  forgetMyProfiles()
  vi.mocked(getPublicProfile).mockReset().mockResolvedValue({ profile: PROFILE, preview: false })
  vi.mocked(getMessagingWith).mockReset().mockResolvedValue({ canMessage: true, reason: null, blocked: false, conversationId: null })
  vi.mocked(startConversation).mockReset().mockResolvedValue({ id: 'c7' })
  vi.mocked(unblockPerson).mockReset().mockResolvedValue({ blocked: false })
})

it('starts a conversation from a public profile', async () => {
  renderAt('/u/bo_reads', { user: 'ada' })
  await userEvent.click(await screen.findByRole('button', { name: 'Send message' }))
  expect(startConversation).toHaveBeenCalledWith('bo_reads', 'token-ada')
  await waitFor(() => expect(currentLocation()).toBe('/messages/c7'))
})

it('reopens the conversation already there', async () => {
  vi.mocked(getMessagingWith).mockResolvedValue({ canMessage: true, reason: null, blocked: false, conversationId: 'c3' })
  renderAt('/u/bo_reads', { user: 'ada' })
  await userEvent.click(await screen.findByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(currentLocation()).toBe('/messages/c3'))
  expect(startConversation).not.toHaveBeenCalled()
})

it('shows nothing signed out, or when the person takes no messages', async () => {
  renderAt('/u/bo_reads')
  expect(await screen.findByRole('heading', { level: 1, name: 'Bo' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument()
  expect(getMessagingWith).not.toHaveBeenCalled()
})

it('hides the button when messages are closed, and offers unblock to the blocker', async () => {
  vi.mocked(getMessagingWith).mockResolvedValueOnce({ canMessage: false, reason: 'unavailable', blocked: false, conversationId: null })
  const first = renderAt('/u/bo_reads', { user: 'ada' })
  await screen.findByRole('heading', { level: 1, name: 'Bo' })
  await waitFor(() => expect(getMessagingWith).toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument()
  first.unmount()

  vi.mocked(getMessagingWith)
    .mockResolvedValueOnce({ canMessage: false, reason: 'blocked', blocked: true, conversationId: null })
    .mockResolvedValueOnce({ canMessage: true, reason: null, blocked: false, conversationId: null })
  renderAt('/u/bo_reads', { user: 'ada' })
  await userEvent.click(await screen.findByRole('button', { name: 'Unblock to send a message' }))
  expect(unblockPerson).toHaveBeenCalledWith({ handle: 'bo_reads' }, 'token-ada')
  expect(await screen.findByRole('button', { name: 'Send message' })).toBeInTheDocument()
})

it('saves who can message me from the profile page', async () => {
  vi.mocked(getMessageSettings).mockResolvedValue('everyone')
  vi.mocked(saveMessageSettings).mockResolvedValue('nobody')
  const { getMyProfile } = await import('../../../lib/api.js')
  vi.mocked(getMyProfile).mockResolvedValue({
    profile: { handle: 'ada_dev', displayName: 'Ada', bio: '', avatar: { seed: 'a', color: 'violet' }, featuredBadges: [], isPublic: true, role: null, headline: '', university: '', course: '', work: '', location: '', languages: [], links: {}, openTo: [] },
    earnedBadges: [],
    progress: { level: 1, title: 'Rookie', xp: 0, levelXp: 0, nextLevelXp: 100 },
  })
  renderAt('/profile', { user: 'ada' })
  const everyone = await screen.findByRole('radio', { name: 'Everyone' })
  expect(everyone).toBeChecked()
  await userEvent.click(screen.getByRole('radio', { name: 'Nobody' }))
  expect(saveMessageSettings).toHaveBeenCalledWith('nobody', 'token-ada')
  expect(await screen.findByText('Saved')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Nobody' })).toBeChecked()
})
