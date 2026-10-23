import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Countdown from '../components/hunt/Countdown.jsx'
import { getHunt, getPracticeSnippet, sendHunt } from '../lib/api.js'
import { I18nProvider } from '../lib/i18n/I18nProvider.jsx'
import { renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getHunt: vi.fn(),
  sendHunt: vi.fn(),
  getPracticeSnippet: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

const CODE = ['function sum(list) {', '  let total = 0', '  for (let i = 0; i <= list.length; i++) {', '    total += list[i]', '  }', '', '  return total', '}']
const SNIPPET = { language: 'javascript', symptom: 'Prints NaN instead of 9.', code: CODE }
const REVEAL = { ...SNIPPET, index: 0, answer: 3, concept: 'off-by-one', explanation: 'The loop runs one step too far.', picked: 2, correct: false, timedOut: false, ms: 4000, points: 0 }

const base = (run, extra = {}) => ({
  day: '2026-10-22',
  nextResetAt: new Date(Date.now() + 5 * 3_600_000).toISOString(),
  rounds: 8,
  roundMs: 20_000,
  isDemo: false,
  run,
  players: 0,
  leaderboard: [],
  you: null,
  ...extra,
})
const runWith = (fields) => ({ finished: false, score: 0, correct: 0, ms: 0, xp: 0, results: [], current: null, nextIndex: null, ...fields })
const PLAYING = base(runWith({ current: { index: 0, ...SNIPPET, remainingMs: 20_000 } }))

beforeEach(() => {
  vi.mocked(getHunt).mockReset().mockResolvedValue(base(null))
  vi.mocked(sendHunt).mockReset()
  vi.mocked(getPracticeSnippet).mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

it('explains the hunt and starts the run', async () => {
  vi.mocked(sendHunt).mockResolvedValueOnce(PLAYING)
  renderAt('/hunt', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: "Today's hunt" })).toBeInTheDocument()
  expect(screen.getByText("Nobody has finished today yet. Be the first.")).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Start the hunt' }))
  expect(sendHunt).toHaveBeenCalledWith('start', { day: '2026-10-22' }, 'token-alice')
  expect(await screen.findByText('Snippet 1 of 8')).toBeInTheDocument()
  expect(screen.getByText('Prints NaN instead of 9.')).toBeInTheDocument()
  expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('20s')
})

it('plays a round with the keyboard: arrows move between lines, Enter picks one, Enter again goes on', async () => {
  vi.mocked(getHunt).mockResolvedValue(PLAYING)
  vi.mocked(sendHunt)
    .mockResolvedValueOnce({ result: REVEAL, ...base(runWith({ results: [REVEAL], nextIndex: 1 })) })
    .mockResolvedValueOnce(base(runWith({ results: [REVEAL], current: { index: 1, ...SNIPPET, symptom: 'Second symptom', remainingMs: 20_000 } })))
  renderAt('/hunt', { user: 'alice' })

  const list = await screen.findByRole('list', { name: 'Lines of the snippet' })
  // Blank lines are not a choice: 7 buttons for 8 lines.
  const lines = within(list).getAllByRole('button')
  expect(lines).toHaveLength(7)
  // The first line has the focus as soon as the snippet shows up.
  await waitFor(() => expect(lines[0]).toHaveFocus())
  expect(lines[0]).toHaveAttribute('tabindex', '0')
  expect(lines[1]).toHaveAttribute('tabindex', '-1')

  await userEvent.keyboard('{ArrowDown}')
  expect(screen.getByRole('button', { name: 'Line 2: let total = 0' })).toHaveFocus()
  await userEvent.keyboard('{End}')
  expect(screen.getByRole('button', { name: 'Line 8: }' })).toHaveFocus()
  await userEvent.keyboard('{Home}{ArrowDown}{Enter}')

  expect(sendHunt).toHaveBeenCalledWith('answer', { index: 0, line: 2, day: '2026-10-22' }, 'token-alice')
  expect(await screen.findByText('Not that line')).toBeInTheDocument()
  expect(screen.getByText('The bug is on line 3.')).toBeInTheDocument()
  expect(screen.getByText('The loop runs one step too far.')).toBeInTheDocument()
  expect(screen.getByText('Off by one')).toBeInTheDocument()
  // The bug line and my pick are marked, and the lines can't be picked again.
  expect(screen.getByRole('button', { name: 'Line 3: for (let i = 0; i <= list.length; i++) {, Bug' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Line 2: let total = 0, Your pick' })).toBeDisabled()

  const next = screen.getByRole('button', { name: 'Next snippet' })
  await waitFor(() => expect(next).toHaveFocus())
  await userEvent.keyboard('{Enter}')
  expect(sendHunt).toHaveBeenLastCalledWith('next', { day: '2026-10-22' }, 'token-alice')
  expect(await screen.findByText('Snippet 2 of 8')).toBeInTheDocument()
  expect(screen.getByText('Second symptom')).toBeInTheDocument()
})

it('keeps the practice tab closed while a daily round runs', async () => {
  vi.mocked(getHunt).mockResolvedValue(PLAYING)
  renderAt('/hunt', { user: 'alice' })
  expect(await screen.findByRole('tab', { name: 'Practice' })).toBeDisabled()
  expect(screen.getByRole('tab', { name: 'Daily run' })).toHaveAttribute('aria-selected', 'true')
})

it('shows the last result, then the summary with score, rank and the round-by-round recap', async () => {
  const results = Array.from({ length: 8 }, (_, index) => ({ ...REVEAL, index, correct: true, picked: 3, points: 140 }))
  const finished = base(runWith({ finished: true, score: 1120, correct: 8, xp: 50, results }), {
    players: 3,
    you: { rank: 1, score: 1120, correct: 8 },
    leaderboard: [{ rank: 1, name: 'Ada', handle: 'ada', avatar: null, score: 1120, correct: 8, seconds: 12, isYou: true }],
  })
  vi.mocked(getHunt).mockResolvedValue(base(runWith({ results: results.slice(0, 7), current: { index: 7, ...SNIPPET, remainingMs: 20_000 } })))
  vi.mocked(sendHunt).mockResolvedValueOnce({ result: results[7], ...finished })
  renderAt('/hunt', { user: 'alice' })

  await userEvent.click(await screen.findByRole('button', { name: 'Line 3: for (let i = 0; i <= list.length; i++) {' }))
  expect(await screen.findByText('Found it')).toBeInTheDocument()
  expect(screen.getByText('+140 points')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'See my result' }))

  expect(await screen.findByRole('heading', { name: "Today's hunt is done" })).toBeInTheDocument()
  expect(screen.getByText('All 8 lines. Eagle eye!')).toBeInTheDocument()
  expect(screen.getByText('Rank').parentElement).toHaveTextContent('Rank#1of 3')
  expect(screen.getByText('XP earned').parentElement).toHaveTextContent('+50')
  expect(screen.getByText('Lines found').parentElement).toHaveTextContent('8/8')
  expect(screen.getByRole('list', { name: "Today's top 10" })).toHaveTextContent('Ada')
  expect(screen.getByText('Round by round').nextElementSibling.children).toHaveLength(8)
})

it('practices pool snippets for no XP, one after another', async () => {
  vi.mocked(getPracticeSnippet)
    .mockResolvedValueOnce({ roundMs: 20_000, snippet: { id: 'js-a', ...SNIPPET } })
    .mockResolvedValueOnce({ roundMs: 20_000, snippet: { id: 'js-b', ...SNIPPET, symptom: 'Another one' } })
  vi.mocked(sendHunt).mockResolvedValueOnce({ result: { ...REVEAL, picked: 3, correct: true, points: 0 } })
  renderAt('/hunt', { user: 'alice' })

  await userEvent.click(await screen.findByRole('tab', { name: 'Practice' }))
  expect(screen.getByText('Snippets from the pool, with the same 20 seconds. No XP and no ranking.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Start practicing' }))
  expect(getPracticeSnippet).toHaveBeenCalledWith(undefined, 'token-alice')
  await userEvent.click(await screen.findByRole('button', { name: 'Line 3: for (let i = 0; i <= list.length; i++) {' }))
  expect(sendHunt).toHaveBeenCalledWith('practice', { id: 'js-a', line: 3 }, 'token-alice')
  expect(await screen.findByText('Found it')).toBeInTheDocument()
  expect(screen.getByText('Practice, no XP · 1/1')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Another snippet' }))
  expect(getPracticeSnippet).toHaveBeenLastCalledWith('js-a', 'token-alice')
  expect(await screen.findByText('Another one')).toBeInTheDocument()
})

it('runs the clock down and reports the end once', async () => {
  vi.useFakeTimers()
  const onExpire = vi.fn()
  render(
    <I18nProvider locale="en">
      <Countdown deadline={Date.now() + 1500} totalMs={20_000} onExpire={onExpire} />
    </I18nProvider>,
  )
  expect(screen.getByRole('timer')).toHaveTextContent('2s')
  await act(async () => {
    vi.advanceTimersByTime(1600)
  })
  expect(screen.getByRole('timer')).toHaveTextContent('0s')
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  expect(onExpire).toHaveBeenCalledTimes(1)
})
