import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getProgress } from '../api.js'
import { AuthProvider } from '../auth/auth-provider.jsx'
import { ProgressProvider, useProgressRefresh } from '../progress/progress-provider.jsx'
import { StudyTimerProvider, useStudyClock, useStudyTimer } from './study-timer-provider.jsx'

vi.mock('../api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn(),
  addStudyTime: vi.fn().mockResolvedValue(60),
}))

// Frame-rate guards: the timer ticks every second and progress refreshes after actions, so a
// component that only needs the Start button or refresh() must not re-render with them.
const renders = { page: 0, refresher: 0, clock: 0 }

function Page() {
  renders.page++
  const { running, start } = useStudyTimer()
  return (
    <button type="button" onClick={start}>
      {running ? 'running' : 'start'}
    </button>
  )
}

function Refresher() {
  renders.refresher++
  useProgressRefresh()
  return null
}

function Clock() {
  renders.clock++
  const { seconds } = useStudyClock()
  return <output data-testid="clock">{Math.floor(seconds)}</output>
}

function renderApp() {
  localStorage.setItem('gd:session', JSON.stringify({ token: 'token-alice', user: { id: 'alice', email: 'alice@test.dev', isDemo: false } }))
  return render(
    <AuthProvider>
      <ProgressProvider>
        <StudyTimerProvider>
          <Page />
          <Refresher />
          <Clock />
        </StudyTimerProvider>
      </ProgressProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.mocked(getProgress).mockReset().mockResolvedValue({ level: 1, todaySeconds: 0, badges: [] })
  renders.page = 0
  renders.refresher = 0
  renders.clock = 0
})
afterEach(() => {
  vi.useRealTimers()
})

it('ticks only the clock, not a page that just has a Start button', async () => {
  renderApp()
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  expect(screen.getByRole('button')).toHaveTextContent('running')
  const page = renders.page
  const clock = renders.clock

  for (let second = 0; second < 10; second++) {
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
  }
  expect(screen.getByTestId('clock')).toHaveTextContent('10')
  expect(renders.clock - clock).toBeGreaterThanOrEqual(10)
  // Ten ticks later the page hasn't rendered once more.
  expect(renders.page).toBe(page)
})

it('keeps refresh-only components still when new progress arrives', async () => {
  renderApp()
  await act(async () => {})
  const before = renders.refresher
  vi.mocked(getProgress).mockResolvedValue({ level: 2, todaySeconds: 60, badges: [] })
  // The timer's minute report refreshes progress.
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(getProgress).toHaveBeenCalledTimes(2)
  expect(renders.refresher).toBe(before)
})

it('stops ticking while the tab is hidden and catches up when it shows', async () => {
  renderApp()
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const clock = renders.clock
  await act(async () => {
    vi.advanceTimersByTime(5_000)
  })
  expect(renders.clock).toBe(clock)

  hidden.mockReturnValue(false)
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(screen.getByTestId('clock')).toHaveTextContent('5')
  hidden.mockRestore()
})
