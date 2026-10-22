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

const EMPTY_ABOUT = {
  role: null,
  headline: '',
  university: '',
  course: '',
  work: '',
  location: '',
  languages: [],
  links: {},
  openTo: [],
}
const PROFILE = {
  handle: null,
  displayName: 'alice',
  bio: '',
  avatar: { seed: 'abc123', color: 'violet' },
  featuredBadges: [],
  isPublic: false,
  ...EMPTY_ABOUT,
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
    ...EMPTY_ABOUT,
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

it('describes you in "About you" and the preview follows along', async () => {
  await openEditor()
  const about = screen.getByRole('group', { name: 'About you' })
  await userEvent.click(within(about).getByRole('radio', { name: 'Student' }))
  await userEvent.type(field('Headline'), 'Learning React at night')
  await userEvent.type(field('University'), 'Infnet')
  await userEvent.type(field('Course'), 'Software Engineering')
  await userEvent.type(field('Job or company'), 'Support at Acme')
  await userEvent.type(field('Location'), 'Rio de Janeiro')
  const languages = within(about).getByRole('group', { name: 'Languages you write' })
  await userEvent.click(within(languages).getByRole('button', { name: 'Python' }))
  await userEvent.click(within(languages).getByRole('button', { name: 'C#' }))
  await userEvent.click(within(within(about).getByRole('group', { name: 'Open to' })).getByRole('button', { name: 'Internships' }))

  const card = preview()
  expect(within(card).getByText('Student')).toBeInTheDocument()
  expect(within(card).getByText('Learning React at night')).toBeInTheDocument()
  expect(within(card).getByText('Software Engineering at Infnet')).toBeInTheDocument()
  expect(within(card).getByText('Support at Acme')).toBeInTheDocument()
  expect(within(card).getByText('Rio de Janeiro')).toBeInTheDocument()
  expect(within(within(card).getByRole('list', { name: 'Languages' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Python', 'C#'])
  expect(within(card).getByRole('list', { name: 'Open to' })).toHaveTextContent('Internships')

  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
  await waitFor(() => expect(saveProfile).toHaveBeenCalled())
  expect(savedPatch()).toMatchObject({
    role: 'student',
    headline: 'Learning React at night',
    university: 'Infnet',
    course: 'Software Engineering',
    work: 'Support at Acme',
    location: 'Rio de Janeiro',
    languages: ['python', 'csharp'],
    openTo: ['internships'],
  })
})

it('checks links while you type and only saves good ones', async () => {
  await openEditor()
  await userEvent.type(field('GitHub'), 'https://gitlab.com/ada')
  expect(screen.getByText('Use a github.com link.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
  expect(within(preview()).queryByRole('link', { name: /GitHub/ })).toBeNull()

  await userEvent.clear(field('GitHub'))
  await userEvent.type(field('GitHub'), 'https://github.com/ada')
  await userEvent.type(field('Website'), 'https://ada.dev')
  const link = within(preview()).getByRole('link', { name: /GitHub/ })
  expect(link).toHaveAttribute('href', 'https://github.com/ada')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')

  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
  await waitFor(() => expect(saveProfile).toHaveBeenCalled())
  expect(savedPatch().links).toEqual({ github: 'https://github.com/ada', website: 'https://ada.dev' })
})

it('lets you pick up to 8 languages', async () => {
  await openEditor()
  const languages = screen.getByRole('group', { name: 'Languages you write' })
  const buttons = within(languages).getAllByRole('button')
  for (const button of buttons.slice(0, 8)) await userEvent.click(button)
  expect(buttons[8]).toBeDisabled()
  expect(screen.getByText('8/8 picked')).toBeInTheDocument()
})

it('loads saved about-you fields into the editor', async () => {
  vi.mocked(getMyProfile).mockResolvedValue({
    ...MINE,
    profile: { ...PROFILE, role: 'teacher', headline: 'Teaching Python', languages: ['python'], links: { linkedin: 'https://www.linkedin.com/in/ada' } },
  })
  await openEditor()
  expect(screen.getByRole('radio', { name: 'Teacher' })).toBeChecked()
  expect(field('Headline')).toHaveValue('Teaching Python')
  expect(within(screen.getByRole('group', { name: 'Languages you write' })).getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true')
  expect(field('LinkedIn')).toHaveValue('https://www.linkedin.com/in/ada')
})

it('links to the people search', async () => {
  await openEditor()
  expect(screen.getByRole('link', { name: 'Find detectives' })).toHaveAttribute('href', '/people')
})

it('speaks Brazilian Portuguese: fields, hints, choices and the preview', async () => {
  renderAt('/profile', { user: 'alice', locale: 'pt-BR' })
  await waitFor(() => expect(field('Nome de exibição')).toHaveValue('alice'))
  expect(screen.getByRole('heading', { level: 1, name: 'Seu perfil' })).toBeInTheDocument()
  const card = screen.getByRole('region', { name: 'Como os outros veem você' })
  expect(within(card).getByText('Nv 2')).toBeInTheDocument()
  expect(within(card).getByText('Detetive Júnior')).toBeInTheDocument()
  expect(screen.getByText('Letras minúsculas, números, _ e -. De 3 a 20 caracteres.')).toBeInTheDocument()
  await userEvent.type(field('Nome de usuário'), 'ab')
  expect(screen.getByText('Use pelo menos 3 caracteres.')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Estudante' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Parceiros de estudo' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Cor do avatar' })).toBeInTheDocument()
  await userEvent.type(field('GitHub'), 'https://gitlab.com/ada')
  expect(screen.getByText('Use um link do github.com.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvar perfil' })).toBeDisabled()
})
