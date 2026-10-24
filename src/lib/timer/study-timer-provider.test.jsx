import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getProgress, updateStudySession } from '../api.js'
import { AuthProvider } from '../auth/auth-provider.jsx'
import { ProgressProvider, useProgressRefresh } from '../progress/progress-provider.jsx'
import { StudyTimerProvider, useStudyClock, useStudyFocus, useStudyTimer } from './study-timer-provider.jsx'

vi.mock('../api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn(),
  addStudyTime: vi.fn().mockResolvedValue({ todaySeconds: 60 }),
  startStudySession: vi.fn().mockResolvedValue({ id: 's1' }),
  stopStudySession: vi.fn().mockResolvedValue({ id: 's1' }),
  updateStudySession: vi.fn().mockResolvedValue({ id: 's1' }),
}))

// Frame-rate guards: the timer ticks every second and progress refreshes after actions, so a
// component that only needs the Start button or refresh() must not re-render with them.
const renders = { page: 0, refresher: 0, clock: 0, topic: 0 }

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

function Topic() {
  renders.topic++
  const { topic } = useStudyFocus()
  return <output data-testid="topic">{topic}</output>
}

// Stands in for the timer's topic form: it only needs setFocus, which never changes.
function TopicEditor() {
  const { setFocus } = useStudyTimer()
  return (
    <button type="button" onClick={() => setFocus({ topic: 'Closures' })}>
      edit topic
    </button>
  )
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
          <Topic />
          <TopicEditor />
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
  renders.topic = 0
})
afterEach(() => {
  vi.useRealTimers()
})

it('ticks only the clock, not a page that just has a Start button', async () => {
  renderApp()
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  expect(screen.getByRole('button', { name: 'running' })).toBeInTheDocument()
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

it('re-renders only what shows the topic when it changes, and not with the clock', async () => {
  renderApp()
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  await act(async () => {})
  const page = renders.page
  const topic = renders.topic
  for (let second = 0; second < 5; second++) {
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
  }
  expect(renders.topic).toBe(topic)

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'edit topic' }))
  })
  expect(screen.getByTestId('topic')).toHaveTextContent('Closures')
  expect(renders.topic).toBe(topic + 1)
  expect(renders.page).toBe(page)
  // The open session gets the new topic too.
  expect(updateStudySession).toHaveBeenCalledWith('s1', { topic: 'Closures' }, 'token-alice')
})
