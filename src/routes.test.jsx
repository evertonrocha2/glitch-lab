import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { currentLocation, renderAt } from './test/render.jsx'

vi.mock('./lib/api.js', () => ({ AuthError: class extends Error {}, listCases: vi.fn().mockResolvedValue([]) }))

it('sends signed-out visitors to login and remembers where they were going', async () => {
  renderAt('/board')
  expect(screen.getByRole('heading', { level: 1, name: 'Sign in to your case board' })).toBeInTheDocument()
  expect(currentLocation()).toBe('/login?next=%2Fboard')

  await userEvent.click(screen.getByRole('button', { name: 'Use demo account' }))
  await waitFor(() => expect(currentLocation()).toBe('/board'))
})

it('lets a signed-in person straight into the board', () => {
  renderAt('/board', { user: 'alice' })
  expect(currentLocation()).toBe('/board')
})
