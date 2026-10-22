import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { addStudyTime, getProgress } from '../lib/api.js'
import { localDay } from '../lib/day.js'
import { renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn(),
  addStudyTime: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.mocked(getProgress).mockReset().mockResolvedValue(null)
  vi.mocked(addStudyTime).mockReset().mockResolvedValue(60)
})
afterEach(() => {
  vi.useRealTimers()
})

const clock = () => screen.getByTestId('timer-clock').textContent

it('counts, reports every minute and pauses', async () => {
  renderAt('/progress', { user: 'alice' })
  fireEvent.click(screen.getByRole('button', { name: 'Start the study timer' }))
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(clock()).toBe('01:00')
  expect(addStudyTime).toHaveBeenCalledWith({ seconds: 60, day: localDay() }, 'token-alice', { keepalive: false })

  await act(async () => {
    vi.advanceTimersByTime(5_000)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pause the study timer' }))
  })
  expect(addStudyTime).toHaveBeenLastCalledWith({ seconds: 5, day: localDay() }, 'token-alice', { keepalive: false })
  await act(async () => {
    vi.advanceTimersByTime(30_000)
  })
  expect(clock()).toBe('01:05')
  expect(screen.getByText('Paused')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start the study timer' })).toHaveTextContent('Resume')
})

it('keeps running after a reload', async () => {
  const first = renderAt('/progress', { user: 'alice' })
  fireEvent.click(screen.getByRole('button', { name: 'Start the study timer' }))
  await act(async () => {
    vi.advanceTimersByTime(30_000)
  })
  first.unmount()

  renderAt('/progress', { user: 'alice' })
  await act(async () => {
    vi.advanceTimersByTime(1_000)
  })
  expect(clock()).toBe('00:31')
  expect(screen.getByText('Studying')).toBeInTheDocument()
})

it('resets a paused session', async () => {
  renderAt('/progress', { user: 'alice' })
  fireEvent.click(screen.getByRole('button', { name: 'Start the study timer' }))
  await act(async () => {
    vi.advanceTimersByTime(10_000)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pause the study timer' }))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reset the study timer' }))
  })
  expect(clock()).toBe('00:00')
})
