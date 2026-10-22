import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getMyProfile, saveProfile } from '../lib/api.js'
import { forgetMyProfiles } from '../lib/profile/myProfile.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const PROFILE = {
  handle: null,
  displayName: 'alice',
  bio: '',
  avatar: { seed: 'abc123', color: 'violet' },
  featuredBadges: [],
  isPublic: false,
}
const MINE = {
  profile: PROFILE,
  earnedBadges: ['first-clue', 'fixed-it', 'case-closed', 'sharp-eye'],
  progress: { level: 2, title: 'Junior Detective', xp: 145, levelXp: 100, nextLevelXp: 300 },
}

beforeEach(() => {
  forgetMyProfiles()
  vi.mocked(getMyProfile).mockReset().mockResolvedValue(MINE)
  vi.mocked(saveProfile).mockReset().mockImplementation(async (patch) => ({ ...PROFILE, ...patch }))
})

const preview = () => screen.getByRole('region', { name: 'How others see you' })
const field = (name) => screen.getByRole('textbox', { name })
const savedPatch = () => vi.mocked(saveProfile).mock.lastCall[0]

async function openEditor() {
  renderAt('/profile', { user: 'alice' })
  await waitFor(() => expect(field('Display name')).toHaveValue('alice'))
}

it('opens from the avatar in the header', async () => {
  renderAt('/progress', { user: 'alice' })
  await userEvent.click(await screen.findByRole('link', { name: 'Your profile' }))
  expect(currentLocation()).toBe('/profile')
  await waitFor(() => expect(field('Display name')).toHaveValue('alice'))
})

it('shares one request between the header and the page', async () => {
  await openEditor()
  expect(getMyProfile).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: 'Your profile' }).querySelectorAll('rect').length).toBeGreaterThan(0)
})

it('shows changes in the preview as you type', async () => {
  await openEditor()
  expect(within(preview()).getByText('Junior Detective')).toBeInTheDocument()
  await userEvent.clear(field('Display name'))
  await userEvent.type(field('Display name'), 'Ada L.')
  await userEvent.type(field('Bio'), 'Bug hunter')
  expect(within(preview()).getByRole('heading', { name: 'Ada L.' })).toBeInTheDocument()
  expect(within(preview()).getByText('Bug hunter')).toBeInTheDocument()
  expect(screen.getByText('10/160')).toBeInTheDocument()
})

it('explains the handle rules while you type', async () => {
  await openEditor()
  await userEvent.type(field('Handle'), 'Ada Dev')
  expect(screen.getByText(/only lowercase letters, numbers/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
  await userEvent.clear(field('Handle'))
  await userEvent.type(field('Handle'), 'ada_dev')
  expect(screen.getByText('Looks good. Your link: /u/ada_dev')).toBeInTheDocument()
  expect(within(preview()).getByText('@ada_dev')).toBeInTheDocument()
})

it('features up to 3 earned badges', async () => {
  await openEditor()
  const picker = screen.getByRole('group', { name: 'Featured badges' })
  // Only earned badges can be picked.
  expect(within(picker).getAllByRole('button')).toHaveLength(4)
  for (const name of ['First clue', 'Fixed it', 'Case closed']) {
    await userEvent.click(within(picker).getByRole('button', { name }))
  }
  expect(within(picker).getByRole('button', { name: 'Sharp eye' })).toBeDisabled()
  expect(within(picker).getByRole('button', { name: 'First clue' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(preview()).getByRole('list', { name: 'Featured badges' }).children).toHaveLength(3)

  await userEvent.click(within(picker).getByRole('button', { name: 'First clue' }))
  expect(within(picker).getByRole('button', { name: 'Sharp eye' })).toBeEnabled()
})

it('changes the avatar color and shuffles the picture', async () => {
  await openEditor()
  await userEvent.click(screen.getByRole('radio', { name: 'Cobalt' }))
  await userEvent.click(screen.getByRole('button', { name: 'Shuffle' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
  await waitFor(() => expect(saveProfile).toHaveBeenCalled())
  expect(savedPatch().avatar.color).toBe('cobalt')
  expect(savedPatch().avatar.seed).not.toBe('abc123')
})

it('saves everything and shows the public link', async () => {
  await openEditor()
  await userEvent.type(field('Handle'), 'ada_dev')
  await userEvent.type(field('Bio'), 'Reads stack traces for fun.')
  await userEvent.click(screen.getByRole('button', { name: 'Fixed it' }))
  await userEvent.click(screen.getByRole('checkbox', { name: /Make my profile public/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))

  expect(await screen.findByText('Saved.')).toBeInTheDocument()
  expect(savedPatch()).toEqual({
    handle: 'ada_dev',
    displayName: 'alice',
    bio: 'Reads stack traces for fun.',
    avatar: { seed: 'abc123', color: 'violet' },
    featuredBadges: ['fixed-it'],
    isPublic: true,
  })
  expect(screen.getByRole('textbox', { name: 'Your public link' })).toHaveValue(`${window.location.origin}/u/ada_dev`)
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/u/ada_dev')
})

it('needs a handle before going public', async () => {
  await openEditor()
  await userEvent.click(screen.getByRole('checkbox', { name: /Make my profile public/ }))
  expect(screen.getByText('Pick a handle to share your profile.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
})

it('shows the server error when the handle is taken', async () => {
  vi.mocked(saveProfile).mockRejectedValue(new Error('That handle is taken. Try another one.'))
  await openEditor()
  await userEvent.type(field('Handle'), 'ada_dev')
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('That handle is taken. Try another one.')
  expect(screen.queryByText('Saved.')).toBeNull()
})

it('shows an error when the profile cannot load', async () => {
  vi.mocked(getMyProfile).mockRejectedValue(new Error('Could not reach the server. Check your connection.'))
  renderAt('/profile', { user: 'alice' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
})
