import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { checkFix, getChallenge, revealHint } from '../lib/api.js'
import { makeCase, makeChallenge } from '../test/fixtures.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getChallenge: vi.fn(),
  revealHint: vi.fn(),
  checkFix: vi.fn(),
  listCases: vi.fn().mockResolvedValue([]),
}))

const HINTS = ['Which value is undefined?', 'order.items was never set.', 'Give order an items array.']

beforeEach(() => {
  vi.mocked(getChallenge).mockReset().mockResolvedValue(makeChallenge())
  vi.mocked(revealHint).mockReset()
  vi.mocked(checkFix).mockReset()
})

const editor = () => screen.findByLabelText('Your fix')

it('shows the symptom and the broken code', async () => {
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await editor()).toHaveValue('const order = {}\nconsole.log(order.items.length)')
  expect(screen.getByText("TypeError: Cannot read properties of undefined (reading 'length')")).toBeInTheDocument()
  expect(getChallenge).toHaveBeenCalledWith('ch1', 'dev:alice')
})

it('reveals hints one by one and stops at three', async () => {
  for (const [index, hint] of HINTS.entries()) {
    vi.mocked(revealHint).mockResolvedValueOnce({ hint, hintsRevealed: index + 1 })
  }
  renderAt('/gym/ch1', { user: 'alice' })
  await editor()
  for (const [index, hint] of HINTS.entries()) {
    await userEvent.click(screen.getByRole('button', { name: `Get a hint (${index}/3)` }))
    expect(await screen.findByText(hint)).toBeInTheDocument()
  }
  expect(screen.queryByRole('button', { name: /Get a hint/ })).not.toBeInTheDocument()
  expect(revealHint).toHaveBeenCalledTimes(3)
})

it('shows a pass and the way back to the board', async () => {
  vi.mocked(checkFix).mockResolvedValue({
    passed: true,
    feedback: 'order.items exists now.',
    case: makeCase({ status: 'training', passedCount: 1 }),
  })
  renderAt('/gym/ch1', { user: 'alice' })
  const box = await editor()
  await userEvent.clear(box)
  await userEvent.type(box, 'const order = new Order()')
  await userEvent.click(screen.getByRole('button', { name: 'Submit fix' }))
  expect(await screen.findByText('order.items exists now.')).toBeInTheDocument()
  expect(screen.getByText('1/2 challenges passed on this case')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Back to board' }))
  expect(currentLocation()).toBe('/board')
})

it('keeps my code when the fix fails', async () => {
  vi.mocked(checkFix).mockResolvedValue({ passed: false, feedback: 'order.items is still undefined.', case: makeCase() })
  renderAt('/gym/ch1', { user: 'alice' })
  const box = await editor()
  await userEvent.type(box, '\n// tried')
  await userEvent.click(screen.getByRole('button', { name: 'Submit fix' }))
  expect(await screen.findByText('order.items is still undefined.')).toBeInTheDocument()
  expect(box).toHaveValue('const order = {}\nconsole.log(order.items.length)\n// tried')
  expect(screen.getByRole('button', { name: 'Submit fix' })).toBeEnabled()
})

it('Submit fix cannot be sent twice while waiting', async () => {
  vi.mocked(checkFix).mockReturnValue(new Promise(() => {}))
  renderAt('/gym/ch1', { user: 'alice' })
  await userEvent.type(await editor(), '// x')
  const submit = screen.getByRole('button', { name: 'Submit fix' })
  await userEvent.click(submit)
  await userEvent.click(submit)
  expect(await screen.findByText('Checking your fix')).toBeInTheDocument()
  expect(checkFix).toHaveBeenCalledTimes(1)
})

it('says when the challenge does not exist', async () => {
  vi.mocked(getChallenge).mockRejectedValue(new Error('Challenge not found.'))
  renderAt('/gym/nope', { user: 'alice' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Challenge not found.')
  await waitFor(() => expect(currentLocation()).toBe('/gym/nope'))
})
