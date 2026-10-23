import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { closeEvent, getEvent, pickWinners, submitEntry, updateEntry, voteEntry } from '../lib/api.js'
import { loadedEvent, makeEntry, makeEvent } from '../test/events.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  listEvents: vi.fn().mockResolvedValue({ events: [], page: 1, hasMore: false }),
  getEvent: vi.fn(),
  submitEntry: vi.fn(),
  updateEntry: vi.fn(),
  voteEntry: vi.fn(),
  closeEvent: vi.fn(),
  pickWinners: vi.fn(),
}))

const DAY = 86_400_000

beforeEach(() => {
  vi.mocked(getEvent).mockReset().mockResolvedValue(loadedEvent())
  for (const fn of [submitEntry, updateEntry, voteEntry, closeEvent, pickWinners]) vi.mocked(fn).mockReset()
})

it('shows the event and its entries safely to a signed-out visitor', async () => {
  renderAt('/events/e1')
  expect(await screen.findByRole('heading', { level: 1, name: 'Rinha de Backend' })).toBeInTheDocument()
  expect(vi.mocked(getEvent).mock.lastCall).toEqual(['e1', null])
  expect(screen.getByText('Live')).toBeInTheDocument()
  expect(screen.getByText('Ends in')).toBeInTheDocument()
  // Description and rules are plain text: HTML shows as text, never runs.
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
  expect(screen.getByText('One entry each.')).toBeInTheDocument()
  expect(screen.getByText('A gold pixel medal.')).toBeInTheDocument()

  const entry = screen.getByRole('article', { name: 'Queue first' })
  const code = within(entry).getByRole('link', { name: /Code/ })
  expect(code).toHaveAttribute('href', 'https://github.com/bo/rinha')
  expect(code).toHaveAttribute('target', '_blank')
  expect(code).toHaveAttribute('rel', 'noopener noreferrer nofollow')
  // The YouTube player loads only after a click, from the no-cookie domain, sandboxed.
  expect(document.querySelector('iframe')).toBeNull()
  await userEvent.click(within(entry).getByRole('button', { name: 'Play the video here' }))
  const player = within(entry).getByTitle('Video: Queue first')
  expect(player).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1')
  expect(player.getAttribute('sandbox')).not.toMatch(/allow-top-navigation|allow-popups/)

  expect(screen.getByRole('link', { name: 'Sign in to join' })).toHaveAttribute('href', '/login?next=%2Fevents%2Fe1')
  const ranking = screen.getByRole('region', { name: 'Ranking' })
  expect(within(ranking).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['#1Queue first3', '#2Cache it1'])
})

it('sends a signed-out visitor to sign in when they vote', async () => {
  renderAt('/events/e1')
  await userEvent.click(await screen.findByRole('button', { name: 'Vote for Queue first (3)' }))
  expect(currentLocation()).toBe('/login?next=%2Fevents%2Fe1')
  expect(voteEntry).not.toHaveBeenCalled()
})

it('joins with an entry, showing only the links the event asks for', async () => {
  const saved = makeEntry({ id: 'x3', title: 'Mine', votes: 0, rank: 3, mine: true, videoUrl: null, author: { handle: null, name: 'Me', avatar: { seed: 'm', color: 'cobalt' }, isPublic: false } })
  vi.mocked(submitEntry).mockResolvedValue(saved)
  renderAt('/events/e1', { user: 'me' })
  await userEvent.click(await screen.findByRole('button', { name: 'Join with your entry' }))

  const form = screen.getByRole('form', { name: 'Join with your entry' })
  expect(within(form).queryByLabelText(/Live demo link/)).not.toBeInTheDocument()
  const send = within(form).getByRole('button', { name: 'Send entry' })
  await userEvent.type(within(form).getByLabelText('Title'), 'Mine')
  // The repository is required for this event.
  expect(send).toBeDisabled()
  fireEvent.change(within(form).getByLabelText('Repository link'), { target: { value: 'https://github.com/me/rinha' } })
  await userEvent.click(send)

  expect(vi.mocked(submitEntry).mock.lastCall).toEqual(['e1', { title: 'Mine', description: '', repoUrl: 'https://github.com/me/rinha', videoUrl: '' }, 'token-me'])
  expect(await screen.findByText('Entry sent. Good luck!')).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Mine' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit my entry' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Entries (3)' })).toBeInTheDocument()
})

it('edits my own entry, which I cannot vote for', async () => {
  const mine = makeEntry({ id: 'x2', title: 'Cache it', mine: true, votes: 1, rank: 2 })
  vi.mocked(getEvent).mockResolvedValue(loadedEvent({ entries: [makeEntry(), mine], myEntry: mine }))
  vi.mocked(updateEntry).mockResolvedValue({ ...mine, title: 'Cache it v2' })
  renderAt('/events/e1', { user: 'me' })
  const card = await screen.findByRole('article', { name: 'Cache it' })
  expect(within(card).queryByRole('button', { name: /Vote/ })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Edit my entry' }))
  const title = screen.getByLabelText('Title')
  expect(title).toHaveValue('Cache it')
  await userEvent.clear(title)
  await userEvent.type(title, 'Cache it v2')
  await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))
  expect(vi.mocked(updateEntry).mock.lastCall[0]).toBe('x2')
  expect(await screen.findByRole('article', { name: 'Cache it v2' })).toBeInTheDocument()
})

it('votes and takes the vote back, reordering the ranking', async () => {
  vi.mocked(voteEntry).mockResolvedValueOnce({ voted: true, votes: 4 }).mockResolvedValueOnce({ voted: false, votes: 3 })
  vi.mocked(getEvent).mockResolvedValue(
    loadedEvent({
      entries: [makeEntry({ votes: 3 }), makeEntry({ id: 'x2', title: 'Cache it', votes: 3, rank: 1, videoUrl: null })],
    }),
  )
  renderAt('/events/e1', { user: 'cy' })
  await userEvent.click(await screen.findByRole('button', { name: 'Vote for Cache it (3)' }))
  expect(vi.mocked(voteEntry).mock.lastCall).toEqual(['x2', true, 'token-cy'])
  const voted = await screen.findByRole('button', { name: 'Voted for Cache it (4)' })
  expect(voted).toHaveAttribute('aria-pressed', 'true')
  const ranking = screen.getByRole('region', { name: 'Ranking' })
  expect(within(ranking).getAllByRole('listitem')[0]).toHaveTextContent('Cache it')

  await userEvent.click(voted)
  expect(vi.mocked(voteEntry).mock.lastCall).toEqual(['x2', false, 'token-cy'])
  expect(await screen.findByRole('button', { name: 'Vote for Cache it (3)' })).toHaveAttribute('aria-pressed', 'false')
})

it('lets demo accounts look but not join or vote', async () => {
  localStorage.setItem('gd:session', JSON.stringify({ token: 'token-demo', user: { id: 'demo', email: 'demo@demo.glitch', isDemo: true } }))
  renderAt('/events/e1')
  expect(await screen.findByText('Demo accounts can look around. Sign up to join events and vote.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vote for Queue first (3)' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Join with your entry' })).not.toBeInTheDocument()
})

it('gives the organizer the tools for each stage', async () => {
  vi.mocked(getEvent).mockResolvedValue(loadedEvent({ event: makeEvent({ mine: true }) }))
  vi.mocked(closeEvent).mockResolvedValue(
    loadedEvent({ event: makeEvent({ mine: true, endsAt: new Date(Date.now() - 1000).toISOString(), status: 'voting' }) }),
  )
  vi.mocked(pickWinners).mockResolvedValue(
    loadedEvent({
      event: makeEvent({ mine: true, endsAt: new Date(Date.now() - 1000).toISOString(), closesAt: new Date(Date.now() - 500).toISOString(), announced: true }),
      entries: [makeEntry({ place: 1 }), makeEntry({ id: 'x2', title: 'Cache it', votes: 1, rank: 2, place: 2, videoUrl: null })],
    }),
  )
  renderAt('/events/e1', { user: 'ada' })
  const tools = await screen.findByRole('region', { name: 'Organizer tools' })
  expect(screen.getByText("You organize this event, so you can't enter it. You can still vote.")).toBeInTheDocument()

  await userEvent.click(within(tools).getByRole('button', { name: 'Close entries now' }))
  await userEvent.click(within(tools).getByRole('button', { name: 'Yes, close' }))
  expect(vi.mocked(closeEvent).mock.lastCall).toEqual(['e1', 'token-ada'])

  // After the end: pick winners, suggested by votes.
  expect(await within(tools).findByLabelText('1st place')).toHaveValue('x1')
  expect(within(tools).getByLabelText('2nd place')).toHaveValue('x2')
  await userEvent.click(within(tools).getByRole('button', { name: 'Announce winners' }))
  expect(vi.mocked(pickWinners).mock.lastCall).toEqual(['e1', ['x1', 'x2'], 'token-ada'])

  const podium = await screen.findByRole('region', { name: 'Winners' })
  expect(within(podium).getByRole('img', { name: '1st place' })).toBeInTheDocument()
  expect(within(podium).getByRole('img', { name: '2nd place' })).toBeInTheDocument()
  expect(screen.getByText('Ended', { selector: 'span' })).toBeInTheDocument()
})

it('only offers editing to the organizer before the start', async () => {
  const later = Date.now() + DAY
  vi.mocked(getEvent).mockResolvedValue(
    loadedEvent({ event: makeEvent({ mine: true, startsAt: new Date(later).toISOString(), endsAt: new Date(later + DAY).toISOString() }), entries: [] }),
  )
  renderAt('/events/e1', { user: 'ada' })
  expect(await screen.findByRole('link', { name: 'Edit event' })).toHaveAttribute('href', '/events/e1/edit')
  expect(screen.getByText('Starts in')).toBeInTheDocument()
  expect(screen.getByText('No entries yet. Yours could be the first.')).toBeInTheDocument()
})

it('shows server errors in Portuguese for a Portuguese reader', async () => {
  vi.mocked(voteEntry).mockRejectedValue(new Error('A votação deste evento está encerrada.'))
  renderAt('/events/e1', { user: 'cy', locale: 'pt-BR' })
  expect(await screen.findByText('Termina em')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Participações (2)' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Cada participação inclui' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Votar em Queue first (3)' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A votação deste evento está encerrada.'))
})
