import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({ AuthError: class extends Error {}, listCases: vi.fn().mockResolvedValue([]) }))

it('goes to next after the demo login', async () => {
  renderAt('/login?next=/gym/abc')
  await userEvent.click(screen.getByRole('button', { name: 'Use demo account' }))
  await waitFor(() => expect(currentLocation()).toBe('/gym/abc'))
})

it('goes to the board after the dev login', async () => {
  renderAt('/login')
  await userEvent.click(screen.getByRole('button', { name: 'Dev login' }))
  await waitFor(() => expect(currentLocation()).toBe('/board'))
})

it('ignores a next that would leave the site', async () => {
  renderAt('/login?next=//evil.example')
  await userEvent.click(screen.getByRole('button', { name: 'Use demo account' }))
  await waitFor(() => expect(currentLocation()).toBe('/board'))
})
