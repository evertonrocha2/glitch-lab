import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { answerReview, getReview, startReview } from '../../lib/api.js'
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx'
import { localDay } from '../../lib/day.js'
import { I18nProvider } from '../../lib/i18n/I18nProvider.jsx'
import { ProgressProvider } from '../../lib/progress/ProgressProvider.jsx'
import ReviewToday from './ReviewToday.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getReview: vi.fn(),
  startReview: vi.fn(),
  answerReview: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
}))

function renderCard(locale = 'en') {
  localStorage.setItem('gd:session', JSON.stringify({ token: 'token-alice', user: { id: 'alice', email: 'alice@test.dev', isDemo: false } }))
  return render(
    <I18nProvider locale={locale}>
      <AuthProvider>
        <ProgressProvider>
          <MemoryRouter>
            <ReviewToday />
          </MemoryRouter>
        </ProgressProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

const TODAY = localDay()
const overview = (overrides = {}) => ({
  today: TODAY,
  met: 3,
  due: [
    { concept: 'undefined-access', box: 1 },
    { concept: 'off-by-one', box: 2 },
  ],
  nextDueDay: TODAY,
  session: null,
  day: { cards: 0, right: 0, completed: false, xp: 0 },
  xpCap: 30,
  ...overrides,
})

const CAUSE = {
  index: 0,
  type: 'cause',
  concept: null,
  prompt: { error: "TypeError: Cannot read properties of undefined (reading 'city')", lines: null, language: 'javascript' },
  options: [
    { id: 'a', value: 'off-by-one' },
    { id: 'b', value: 'undefined-access' },
    { id: 'c', value: 'key-error' },
    { id: 'd', value: 'async-await' },
  ],
}
const LINE = {
  index: 1,
  type: 'line',
  concept: 'off-by-one',
  prompt: { lines: ['items = [1, 2, 3]', 'for i in range(len(items) - 1):', '    print(items[i])'], language: 'python', symptom: 'Never prints 3.' },
  options: [
    { id: 'l1', value: 0 },
    { id: 'l2', value: 1 },
    { id: 'l3', value: 2 },
  ],
}
const SESSION = { id: 's1', cards: [CAUSE, LINE], answers: [], right: 0, done: false }

beforeEach(() => {
  vi.mocked(getReview).mockReset().mockResolvedValue(overview())
  vi.mocked(startReview).mockReset().mockResolvedValue(SESSION)
  vi.mocked(answerReview).mockReset()
})

it('lists what is due and runs a session card by card', async () => {
  const user = userEvent.setup()
  renderCard()
  expect(await screen.findByText('2 bug types to review')).toBeInTheDocument()
  const due = screen.getByRole('list', { name: 'Due today' })
  expect(within(due).getByText('Reading undefined')).toBeInTheDocument()
  expect(within(due).getByText('Off by one')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Review' }))
  expect(startReview).toHaveBeenCalledWith(TODAY, 'token-alice')
  expect(await screen.findByText('Card 1 of 2')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'What kind of bug causes this?' })).toBeInTheDocument()
  expect(screen.getByText(CAUSE.prompt.error)).toBeInTheDocument()

  // A wrong answer: the right one is marked, the box drops and the concept is back tomorrow.
  vi.mocked(answerReview).mockResolvedValueOnce({
    result: { index: 0, choice: 'a', correct: false, answer: 'b', concept: 'undefined-access', explanation: 'user.address is undefined.', fixed: null },
    item: { concept: 'undefined-access', box: 1, dueDay: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) },
    xp: 0,
    session: { ...SESSION, answers: [{ index: 0, choice: 'a', correct: false, answer: 'b', concept: 'undefined-access', explanation: 'user.address is undefined.', fixed: null }] },
    day: { cards: 1, right: 0, completed: false, xp: 0 },
  })
  const answers = screen.getByRole('group', { name: 'Answers' })
  await user.click(within(answers).getByRole('button', { name: 'Off by one' }))
  expect(answerReview).toHaveBeenCalledWith({ sessionId: 's1', index: 0, choice: 'a', today: TODAY }, 'token-alice')
  expect(await screen.findByRole('heading', { name: 'Not quite.' })).toHaveFocus()
  expect(screen.getByText('It was Reading undefined.')).toBeInTheDocument()
  expect(screen.getByText('user.address is undefined.')).toBeInTheDocument()
  expect(within(answers).getByRole('button', { name: /Reading undefined\s*Right answer/ })).toBeDisabled()

  // Which line? Each code line is a button.
  await user.click(screen.getByRole('button', { name: 'Next card' }))
  expect(screen.getByText('Card 2 of 2')).toBeInTheDocument()
  expect(screen.getByText('Bug type: Off by one')).toBeInTheDocument()
  const answered = { index: 1, choice: 'l2', correct: true, answer: 'l2', concept: 'off-by-one', explanation: null, fixed: 'for i in range(len(items)):' }
  vi.mocked(answerReview).mockResolvedValueOnce({
    result: answered,
    item: { concept: 'off-by-one', box: 3, dueDay: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) },
    xp: 3,
    session: { ...SESSION, answers: [SESSION.answers[0], answered].filter(Boolean), right: 1, done: true },
    day: { cards: 2, right: 1, completed: true, xp: 3 },
  })
  await user.click(screen.getByRole('button', { name: 'Line 2: for i in range(len(items) - 1):' }))
  expect(await screen.findByRole('heading', { name: /Right!/ })).toBeInTheDocument()
  expect(screen.getByText('+3 XP')).toBeInTheDocument()
  expect(screen.getByText('for i in range(len(items)):')).toBeInTheDocument()
  expect(screen.getByText(/Box 3 of 5\. Back in 7 days\./)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'See results' }))
  expect(screen.getByRole('heading', { name: 'Review done' })).toHaveFocus()
  expect(screen.getByText('You got 1 of 2 right.')).toBeInTheDocument()
  expect(screen.getByText('Today so far: +3 XP (up to 30 a day).')).toBeInTheDocument()

  vi.mocked(getReview).mockResolvedValue(overview({ due: [], nextDueDay: '2026-10-25', day: { cards: 2, right: 1, completed: true, xp: 3 } }))
  await user.click(screen.getByRole('button', { name: 'Back to today' }))
  expect(await screen.findByText('All caught up for today.')).toBeInTheDocument()
  expect(screen.getByText('Today: 1 of 2 right, +3 XP.')).toBeInTheDocument()
  expect(screen.getByText(/^Next review: /)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument()
})

it('asks for a first case when nothing was met, in Portuguese too', async () => {
  vi.mocked(getReview).mockResolvedValue(overview({ met: 0, due: [], nextDueDay: null }))
  renderCard('pt-BR')
  expect(screen.getByRole('heading', { name: 'Revisão de hoje' })).toBeInTheDocument()
  expect(await screen.findByText(/Nada para revisar ainda/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument()
})

it('resumes an open session and shows errors', async () => {
  const user = userEvent.setup()
  vi.mocked(getReview).mockResolvedValue(overview({ session: SESSION }))
  vi.mocked(startReview).mockRejectedValueOnce(new Error('Nothing to review right now.'))
  renderCard()
  await user.click(await screen.findByRole('button', { name: 'Continue review' }))
  expect(await screen.findByText('Nothing to review right now.')).toBeInTheDocument()
})
