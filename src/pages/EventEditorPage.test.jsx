import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createEvent, getEvent, updateEvent } from '../lib/api.js'
import { loadedEvent, makeEvent } from '../test/events.js'
import { currentLocation, renderAt } from '../test/render.jsx'
import { toLocalInput } from './EventEditorPage.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
  getEvent: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
}))

const DAY = 86_400_000
// Long fields are filled in one go: typing them key by key only slows the suite down.
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  vi.mocked(getEvent).mockReset().mockResolvedValue(loadedEvent())
  vi.mocked(createEvent).mockReset().mockResolvedValue(loadedEvent({ event: makeEvent({ id: 'new1' }) }))
  vi.mocked(updateEvent).mockReset()
})

it('asks signed-out visitors to sign in first', () => {
  renderAt('/events/new')
  expect(currentLocation()).toBe('/login?next=%2Fevents%2Fnew')
})

it('creates an event with dates and entry requirements', async () => {
  renderAt('/events/new', { user: 'ada' })
  const create = await screen.findByRole('button', { name: 'Create event' })
  expect(create).toBeDisabled()

  await userEvent.type(screen.getByLabelText('Title'), 'Rinha de Backend')
  fill('Summary', 'Fast APIs only.')
  fill('Description', 'Two endpoints.')
  await userEvent.selectOptions(screen.getByLabelText('Kind'), 'battle')
  fill('Tags', 'backend, Go')
  const start = Date.now() + DAY
  fill('Starts', toLocalInput(start))
  fill('Ends', toLocalInput(start - DAY / 2))
  expect(screen.getByText('The end must come after the start.')).toBeInTheDocument()
  expect(create).toBeDisabled()
  fill('Ends', toLocalInput(start + 3 * DAY))

  // The repository can be required or optional, never off.
  const repo = screen.getByRole('group', { name: 'Repository' })
  expect(repo.querySelectorAll('button')).toHaveLength(2)
  await userEvent.click(screen.getByRole('group', { name: 'Video' }).querySelector('button'))
  await userEvent.click(screen.getByRole('group', { name: 'Live demo' }).querySelectorAll('button')[2])

  await userEvent.click(create)
  const [fields, token] = vi.mocked(createEvent).mock.lastCall
  expect(token).toBe('token-ada')
  expect(fields).toMatchObject({
    title: 'Rinha de Backend',
    summary: 'Fast APIs only.',
    description: 'Two endpoints.',
    kind: 'battle',
    tags: ['backend', 'go'],
    requirements: { repo: 'required', video: 'required', demo: 'off' },
  })
  // Local times go out as exact instants, to the minute.
  expect(Date.parse(fields.startsAt)).toBe(Math.floor(start / 60_000) * 60_000)
  await waitFor(() => expect(currentLocation()).toBe('/events/new1'))
})

it("edits the organizer's upcoming event", async () => {
  const startsAt = new Date(Date.now() + DAY).toISOString()
  const endsAt = new Date(Date.now() + 2 * DAY).toISOString()
  vi.mocked(getEvent).mockResolvedValue(loadedEvent({ event: makeEvent({ mine: true, startsAt, endsAt }) }))
  vi.mocked(updateEvent).mockResolvedValue(loadedEvent({ event: makeEvent({ title: 'Rinha 2' }) }))
  renderAt('/events/e1/edit', { user: 'ada' })
  const title = await screen.findByLabelText('Title')
  expect(title).toHaveValue('Rinha de Backend')
  expect(screen.getByLabelText('Tags')).toHaveValue('backend, go')
  await userEvent.clear(title)
  await userEvent.type(title, 'Rinha 2')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(vi.mocked(updateEvent).mock.lastCall[0]).toBe('e1')
  expect(vi.mocked(updateEvent).mock.lastCall[1]).toMatchObject({ title: 'Rinha 2', requirements: { repo: 'required', video: 'optional', demo: 'off' } })
  await waitFor(() => expect(currentLocation()).toBe('/events/e1'))
})

it('refuses to edit an event that is not mine', async () => {
  renderAt('/events/e1/edit', { user: 'bob' })
  expect(await screen.findByText('Only the organizer can edit this event.')).toBeInTheDocument()
})

it('says when the event already started', async () => {
  vi.mocked(getEvent).mockResolvedValue(loadedEvent({ event: makeEvent({ mine: true }) }))
  renderAt('/events/e1/edit', { user: 'ada' })
  expect(await screen.findByText('This event already started, so it can no longer be edited.')).toBeInTheDocument()
})

it('shows server errors and speaks Portuguese', async () => {
  vi.mocked(createEvent).mockRejectedValue(new Error('Você pode criar 3 eventos por dia. Volte amanhã.'))
  renderAt('/events/new', { user: 'ada', locale: 'pt-BR' })
  await userEvent.type(await screen.findByLabelText('Título'), 'Rinha')
  fill('Resumo', 'APIs rápidas.')
  fill('Descrição', 'Dois endpoints.')
  expect(screen.getByRole('group', { name: 'Repositório' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Criar evento' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Você pode criar 3 eventos por dia. Volte amanhã.')
})
