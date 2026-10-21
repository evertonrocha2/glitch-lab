import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthError, analyzeError, listCases, startChallenge } from '../lib/api.js'
import { saveDraft, takeDraft } from '../lib/draft.js'
import { makeCase } from '../test/fixtures.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  analyzeError: vi.fn(),
  listCases: vi.fn(),
  startChallenge: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(listCases).mockReset().mockResolvedValue([])
  vi.mocked(analyzeError).mockReset()
  vi.mocked(startChallenge).mockReset()
})

const newColumn = () => screen.getByRole('region', { name: 'New' })

async function investigate(error) {
  await userEvent.type(await screen.findByLabelText('Error message'), error)
  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
}

it('loads my cases', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase({ status: 'training', passedCount: 1 })])
  renderAt('/board', { user: 'alice' })
  expect(await screen.findByText('1/2 challenges')).toBeInTheDocument()
  expect(listCases).toHaveBeenCalledWith('dev:alice')
})

it('folds the form behind New investigation once I have cases', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'New investigation' }))
  expect(screen.getByLabelText('Error message')).toBeInTheDocument()
})

it('Train this opens the gym', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  vi.mocked(startChallenge).mockResolvedValue({ id: 'ch9' })
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: /TypeError/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Train this' }))
  await waitFor(() => expect(currentLocation()).toBe('/gym/ch9'))
  expect(startChallenge).toHaveBeenCalledWith('c1', 'dev:alice')
})

it('Train this cannot be clicked twice', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  vi.mocked(startChallenge).mockReturnValue(new Promise(() => {}))
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: /TypeError/ }))
  const train = screen.getByRole('button', { name: 'Train this' })
  await userEvent.click(train)
  await userEvent.click(train)
  expect(await screen.findByRole('button', { name: 'Preparing your challenge...' })).toBeDisabled()
  expect(startChallenge).toHaveBeenCalledTimes(1)
})

it('says the board is empty at first', async () => {
  renderAt('/board', { user: 'alice' })
  expect(await screen.findByText('No cases yet. Paste your first error above.')).toBeInTheDocument()
})

it('investigating adds a card to New and opens it', async () => {
  vi.mocked(analyzeError).mockResolvedValue(makeCase({ id: 'fresh' }))
  renderAt('/board', { user: 'alice' })
  await investigate('TypeError: x')
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(within(newColumn()).getByText('01')).toBeInTheDocument()
  expect(analyzeError).toHaveBeenCalledWith({ error: 'TypeError: x', code: '' }, 'dev:alice')
})

it('investigates the draft from the landing right away', async () => {
  vi.mocked(analyzeError).mockResolvedValue(makeCase())
  saveDraft({ error: 'ReferenceError: y is not defined', code: 'print(y)' })
  renderAt('/board', { user: 'alice' })
  await waitFor(() =>
    expect(analyzeError).toHaveBeenCalledWith({ error: 'ReferenceError: y is not defined', code: 'print(y)' }, 'dev:alice'),
  )
})

it('shows the message when the AI fails', async () => {
  vi.mocked(analyzeError).mockRejectedValue(new Error('The AI is busy right now. Try again in a minute.'))
  renderAt('/board', { user: 'alice' })
  await investigate('TypeError: x')
  expect(await screen.findByRole('alert')).toHaveTextContent('The AI is busy right now. Try again in a minute.')
})

it('sends me to login when my session expired, keeping what I pasted', async () => {
  vi.mocked(analyzeError).mockRejectedValue(new AuthError('Sign in to continue.'))
  renderAt('/board', { user: 'alice' })
  await investigate('TypeError: x')
  await waitFor(() => expect(currentLocation()).toBe('/login?next=%2Fboard'))
  expect(takeDraft()).toEqual({ error: 'TypeError: x', code: '' })
})

it('Investigate cannot be sent twice while waiting', async () => {
  vi.mocked(analyzeError).mockReturnValue(new Promise(() => {}))
  renderAt('/board', { user: 'alice' })
  await userEvent.type(await screen.findByLabelText('Error message'), 'TypeError: x')
  const button = screen.getByRole('button', { name: 'Investigate' })
  await userEvent.click(button)
  await userEvent.click(button)
  expect(await screen.findByText('Investigating your error')).toBeInTheDocument()
  expect(analyzeError).toHaveBeenCalledTimes(1)
})
