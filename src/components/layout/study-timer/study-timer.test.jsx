import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { addStudyTime, getProgress, listCases, listNotes, startStudySession, stopStudySession, updateStudySession } from '../../../lib/api.js'
import { localDay } from '../../../lib/day.js'
import { renderAt } from '../../../test/render.jsx'

vi.mock('../../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn(),
  addStudyTime: vi.fn(),
  startStudySession: vi.fn(),
  stopStudySession: vi.fn(),
  updateStudySession: vi.fn(),
  listCases: vi.fn(),
  listNotes: vi.fn(),
}))

let opened = 0
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.mocked(getProgress).mockReset().mockResolvedValue(null)
  // The server answers each report with the run to report to next: the same one.
  vi.mocked(addStudyTime)
    .mockReset()
    .mockImplementation(async ({ sessionId }) => (sessionId ? { todaySeconds: 60, sessionId } : { todaySeconds: 60 }))
  opened = 0
  vi.mocked(startStudySession)
    .mockReset()
    .mockImplementation(async (fields) => ({ id: `s${++opened}`, ...fields }))
  vi.mocked(stopStudySession).mockReset().mockResolvedValue({ id: 's1' })
  vi.mocked(updateStudySession).mockReset().mockResolvedValue({ id: 's1' })
  vi.mocked(listCases).mockReset().mockResolvedValue([])
  vi.mocked(listNotes).mockReset().mockResolvedValue([])
})
afterEach(() => {
  vi.useRealTimers()
})

const clock = () => screen.getByTestId('timer-clock').textContent
const reported = () => vi.mocked(addStudyTime).mock.calls.map(([body]) => body)

// Start opens "What are you studying?"; its own Start begins the run.
async function startTimer(topic) {
  fireEvent.click(screen.getByRole('button', { name: 'Start the study timer' }))
  if (topic) fireEvent.change(screen.getByLabelText(/What are you studying/), { target: { value: topic } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  })
}

const pauseTimer = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pause the study timer' }))
  })

it('counts, reports every minute to its study session and pauses', async () => {
  renderAt('/progress', { user: 'alice' })
  await startTimer('Promises em JavaScript')
  expect(startStudySession).toHaveBeenCalledWith(
    expect.objectContaining({ topic: 'Promises em JavaScript', caseId: null, noteId: null, day: localDay() }),
    'token-alice',
  )
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(clock()).toBe('01:00')
  expect(addStudyTime).toHaveBeenCalledWith({ seconds: 60, day: localDay(), sessionId: 's1' }, 'token-alice', { keepalive: false })

  await act(async () => {
    vi.advanceTimersByTime(5_000)
  })
  const pausedAt = Date.now()
  await pauseTimer()
  expect(addStudyTime).toHaveBeenLastCalledWith({ seconds: 5, day: localDay(), sessionId: 's1' }, 'token-alice', { keepalive: false })
  // Pausing ends the session there, once its last seconds went out.
  expect(stopStudySession).toHaveBeenCalledWith('s1', { endedAt: new Date(pausedAt).toISOString() }, 'token-alice', { keepalive: false })
  await act(async () => {
    vi.advanceTimersByTime(30_000)
  })
  expect(clock()).toBe('01:05')
  expect(screen.getByText('Paused')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start the study timer' })).toHaveTextContent('Resume')
})

it('starts without a topic too, and shows the topic while it runs', async () => {
  renderAt('/progress', { user: 'alice' })
  await startTimer()
  expect(startStudySession).toHaveBeenCalledWith(expect.objectContaining({ topic: '' }), 'token-alice')
  expect(screen.getByTestId('timer-topic')).toHaveTextContent('No topic yet')
})

it('changes the topic while running, on the open session too', async () => {
  renderAt('/progress', { user: 'alice' })
  await startTimer('Promises')
  expect(screen.getByTestId('timer-topic')).toHaveTextContent('Promises')
  fireEvent.click(screen.getByRole('button', { name: 'Change what you are studying' }))
  fireEvent.change(screen.getByLabelText(/What are you studying/), { target: { value: '  Closures   in JS ' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(updateStudySession).toHaveBeenCalledWith('s1', { topic: 'Closures in JS', caseId: null, noteId: null }, 'token-alice')
  expect(screen.getByTestId('timer-topic')).toHaveTextContent('Closures in JS')
})

it('links the run to a case picked from a search', async () => {
  vi.mocked(listCases).mockResolvedValue([{ id: 'c1', kind: 'error', error: 'TypeError: x is undefined' }, { id: 'c2', kind: 'error', error: 'KeyError: name' }])
  vi.mocked(listNotes).mockResolvedValue([{ id: 'n1', title: 'Async notes' }])
  renderAt('/progress', { user: 'alice' })
  fireEvent.click(screen.getByRole('button', { name: 'Start the study timer' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Link a case or note' }))
  })
  fireEvent.change(screen.getByLabelText('Search your cases and notes'), { target: { value: 'keyerror' } })
  expect(screen.queryByText('Async notes')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /KeyError: name/ }))
  expect(screen.getByText('KeyError: name')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  })
  expect(startStudySession).toHaveBeenCalledWith(expect.objectContaining({ caseId: 'c2', noteId: null }), 'token-alice')
})

it('opens a new session on resume, with the same topic', async () => {
  renderAt('/progress', { user: 'alice' })
  await startTimer('Recursion')
  await act(async () => {
    vi.advanceTimersByTime(90_000)
  })
  await pauseTimer()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start the study timer' }))
  })
  expect(startStudySession).toHaveBeenCalledTimes(2)
  expect(vi.mocked(startStudySession).mock.calls[1][0]).toMatchObject({ topic: 'Recursion' })
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(reported().at(-1)).toMatchObject({ sessionId: 's2' })
})

it('keeps running after a reload', async () => {
  const first = renderAt('/progress', { user: 'alice' })
  await startTimer('Graphs')
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
  expect(screen.getByTestId('timer-topic')).toHaveTextContent('Graphs')
  // The same session carries on: no second one is opened.
  expect(startStudySession).toHaveBeenCalledTimes(1)
})

it('resets a paused session', async () => {
  renderAt('/progress', { user: 'alice' })
  await startTimer()
  await act(async () => {
    vi.advanceTimersByTime(10_000)
  })
  await pauseTimer()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reset the study timer' }))
  })
  expect(clock()).toBe('00:00')
  expect(screen.queryByTestId('timer-topic')).not.toBeInTheDocument()
})

it('keeps the time from a failed report and sends it with the next one', async () => {
  vi.mocked(addStudyTime).mockRejectedValueOnce(new Error('Could not reach the server. Check your connection.'))
  renderAt('/progress', { user: 'alice' })
  await startTimer()
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(reported().map((body) => body.seconds)).toEqual([60, 120])
  expect(screen.getByText('Studying')).toBeInTheDocument()
})

it('tries to close a session again when the close failed', async () => {
  vi.mocked(stopStudySession).mockRejectedValueOnce(new Error('Could not reach the server. Check your connection.'))
  renderAt('/progress', { user: 'alice' })
  await startTimer()
  await act(async () => {
    vi.advanceTimersByTime(70_000)
  })
  await pauseTimer()
  expect(stopStudySession).toHaveBeenCalledTimes(1)
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(stopStudySession).toHaveBeenCalledTimes(2)
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(stopStudySession).toHaveBeenCalledTimes(2)
})

it('pauses on its own after the computer slept, keeping the time before', async () => {
  renderAt('/progress', { user: 'alice' })
  await startTimer()
  await act(async () => {
    vi.advanceTimersByTime(30_000)
  })
  // The lid closes for 20 minutes: no timers run, then the tab wakes up.
  vi.setSystemTime(Date.now() + 20 * 60_000)
  await act(async () => {
    vi.advanceTimersByTime(15_000)
  })
  expect(screen.getByText('Paused')).toBeInTheDocument()
  expect(clock()).toBe('00:30')
})

it('ends the session of a closed tab at its last heartbeat', async () => {
  const first = renderAt('/progress', { user: 'alice' })
  await startTimer('Sorting')
  await act(async () => {
    vi.advanceTimersByTime(75_000)
  })
  // The last heartbeat this tab sent; a few seconds later the tab closes (keepalive report on the way out).
  const seenAt = JSON.parse(localStorage.getItem('gd:timer:alice')).seenAt
  vi.setSystemTime(Date.now() + 5_000)
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'))
  })
  expect(addStudyTime).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 's1' }), 'token-alice', { keepalive: true })
  expect(stopStudySession).not.toHaveBeenCalled()
  first.unmount()

  // Back an hour later: the run paused where the tab was last seen, and its session ends there.
  vi.setSystemTime(Date.now() + 3_600_000)
  renderAt('/progress', { user: 'alice' })
  await act(async () => {})
  expect(stopStudySession).toHaveBeenCalledWith('s1', { endedAt: new Date(seenAt).toISOString() }, 'token-alice', { keepalive: false })
  expect(screen.getByText('Paused')).toBeInTheDocument()
})

it('stops writing to a session the server no longer has open', async () => {
  vi.mocked(addStudyTime).mockImplementation(async () => ({ todaySeconds: 60, sessionId: null }))
  renderAt('/progress', { user: 'alice' })
  await startTimer()
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(reported().map((body) => body.sessionId)).toEqual(['s1', undefined])
  expect(startStudySession).toHaveBeenCalledTimes(1)
})

it('links to the study log', () => {
  renderAt('/progress', { user: 'alice' })
  expect(screen.getByRole('link', { name: 'Open the study log' })).toHaveAttribute('href', '/study')
})
