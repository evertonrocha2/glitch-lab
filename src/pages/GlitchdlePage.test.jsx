import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { compareGuess, MAX_GUESSES } from '../../shared/riddle/game.js'
import { languageById } from '../../shared/riddle/languages.js'
import { getProgress, getRiddle, guessRiddle } from '../lib/api.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getRiddle: vi.fn(),
  guessRiddle: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

const inHours = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString()
const classicGuess = (id, answer = 'rust') => ({ id, name: languageById(id).name, ...compareGuess(languageById(id), languageById(answer)) })
const open = (mode, fields = {}) => ({ mode, solved: false, over: false, guessCount: 0, guessesLeft: MAX_GUESSES, answer: null, guesses: [], ...fields })
const zeros = () => Array(10).fill(0)

const GAME = (overrides = {}) => ({
  day: '2026-10-22',
  number: 1,
  nextResetAt: inHours(5),
  modes: {
    classic: open('classic', { guessCount: 1, guessesLeft: MAX_GUESSES - 1, guesses: [classicGuess('python')] }),
    error: open('error', { text: "error[E0382]: borrow of moved value: `name`", hints: [], nextHintIn: 3 }),
    snippet: open('snippet', {
      lines: [{ text: 'fn main() {' }, { hidden: true, width: 24 }, { text: '' }, { hidden: true, width: 1 }],
    }),
  },
  stats: { xp: 0, played: 1, perfectDays: 0, streak: 0, longestStreak: 0, solved: { classic: 0, error: 0, snippet: 0 }, distribution: { classic: zeros(), error: zeros(), snippet: zeros() } },
  community: {
    classic: { players: 4, solved: 3, averageGuesses: 5.3 },
    error: { players: 0, solved: 0, averageGuesses: null },
    snippet: { players: 0, solved: 0, averageGuesses: null },
  },
  ...overrides,
})

const WON = () => {
  const game = GAME()
  const distribution = { ...game.stats.distribution, classic: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] }
  return {
    ...game,
    correct: true,
    modes: {
      ...game.modes,
      classic: { ...game.modes.classic, solved: true, over: true, guessCount: 2, guessesLeft: MAX_GUESSES - 2, answer: { id: 'rust', name: 'Rust' }, guesses: [classicGuess('rust'), classicGuess('python')] },
    },
    stats: { ...game.stats, xp: 25, solved: { classic: 1, error: 0, snippet: 0 }, distribution },
  }
}

beforeEach(() => {
  vi.mocked(getRiddle).mockReset().mockResolvedValue(GAME())
  vi.mocked(guessRiddle).mockReset()
  vi.mocked(getProgress).mockClear()
})

const board = () => screen.findByRole('tabpanel')

it('shows the game number, countdown, modes and my Classic board', async () => {
  renderAt('/glitchdle', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Glitchdle #1' })).toBeInTheDocument()
  expect(screen.getByText(/^[45]:\d{2}:\d{2}$/)).toBeInTheDocument()
  const tabs = within(screen.getByRole('tablist', { name: 'Game modes' })).getAllByRole('tab')
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Classic1 tries', 'Errornew', 'Snippetnew'])
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')

  const guesses = within(await board()).getByRole('list', { name: 'Your guesses' })
  const python = within(guesses).getByRole('listitem', { name: 'Python' })
  expect(python).toHaveTextContent('Interpreted')
  expect(python).toHaveTextContent('1991')
  expect(python).toHaveTextContent('the answer appeared later')
  expect(getRiddle).toHaveBeenCalledWith('token-alice')
})

it('filters languages as I type, skips guessed ones, and guesses with the keyboard', async () => {
  vi.mocked(guessRiddle).mockResolvedValue({ ...GAME(), correct: false })
  renderAt('/glitchdle', { user: 'alice' })
  const input = await screen.findByRole('combobox')
  await userEvent.type(input, 'py')
  const list = screen.getByRole('listbox')
  expect(within(list).getByRole('option', { name: /Python/ })).toHaveAttribute('aria-disabled', 'true')

  await userEvent.clear(input)
  await userEvent.type(input, 'ru')
  const names = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)
  expect(names[0]).toMatch(/^Ruby/)
  expect(names[1]).toMatch(/^Rust/)
  await userEvent.keyboard('{ArrowDown}{ArrowDown}')
  expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('rust'))
  await userEvent.keyboard('{Enter}')
  expect(guessRiddle).toHaveBeenCalledWith({ mode: 'classic', guess: 'rust', day: '2026-10-22' }, 'token-alice')
  await waitFor(() => expect(input).toHaveValue(''))
})

it('closes the list with Escape and guesses the best match with the button', async () => {
  vi.mocked(guessRiddle).mockResolvedValue({ ...GAME(), correct: false })
  renderAt('/glitchdle', { user: 'alice' })
  const input = await screen.findByRole('combobox')
  await userEvent.type(input, 'golang')
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(input).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(screen.getByRole('button', { name: 'Guess' }))
  expect(guessRiddle).toHaveBeenCalledWith({ mode: 'classic', guess: 'go', day: '2026-10-22' }, 'token-alice')
})

it('celebrates a win, shows the answer and copies a spoiler-free result', async () => {
  const user = userEvent.setup()
  vi.mocked(guessRiddle).mockResolvedValue(WON())
  renderAt('/glitchdle', { user: 'alice' })
  await user.type(await screen.findByRole('combobox'), 'rust{Enter}')

  expect(await screen.findByText(/Solved in 2 guesses!/)).toHaveTextContent('It was Rust.')
  expect(screen.getByTestId('win-burst')).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByText(/Next Glitchdle in/)).toBeInTheDocument()
  expect(within(screen.getByRole('tab', { name: /Classic/ })).getByText('(solved)')).toBeInTheDocument()
  // The progress refreshes for the XP and the badge toasts.
  await waitFor(() => expect(getProgress.mock.calls.length).toBeGreaterThan(1))

  await user.click(screen.getByRole('button', { name: 'Share result' }))
  const text = await navigator.clipboard.readText()
  expect(text.split('\n')[0]).toBe('Glitchdle #1  Classic 2 · Error ? · Snippet ?')
  expect(text.split('\n')[2]).toBe('\u{1F7EA}'.repeat(8))
  expect(text).not.toMatch(/rust/i)
  expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
})

it('shows the error message and its hints in Error mode', async () => {
  const game = GAME()
  game.modes.error = { ...game.modes.error, guessCount: 3, guesses: [{ id: 'go', name: 'Go', correct: false }], hints: [{ label: 'File extension', value: '.rs' }], nextHintIn: 3 }
  vi.mocked(getRiddle).mockResolvedValue(game)
  renderAt('/glitchdle', { user: 'alice' })
  await userEvent.click(await screen.findByRole('tab', { name: /Error/ }))
  const panel = await board()
  expect(within(panel).getByText(/borrow of moved value/)).toBeInTheDocument()
  expect(within(within(panel).getByRole('list', { name: 'Hints' })).getByText('.rs')).toBeInTheDocument()
  expect(within(panel).getByText('Unlocks after 3 more wrong guesses')).toBeInTheDocument()
  expect(within(panel).getByRole('list', { name: 'Your guesses' })).toHaveTextContent('Go(wrong)')
})

it('hides snippet lines until they are earned', async () => {
  renderAt('/glitchdle', { user: 'alice' })
  await userEvent.click(await screen.findByRole('tab', { name: /Snippet/ }))
  const code = within(await board()).getByRole('list', { name: 'Code' })
  expect(code).toHaveTextContent('fn main() {')
  expect(within(code).getAllByText('Hidden line')).toHaveLength(2)
  expect(screen.getByText('2 lines hidden')).toBeInTheDocument()
})

it("shows my stats and today's community numbers", async () => {
  renderAt('/glitchdle', { user: 'alice' })
  const numbers = await screen.findByRole('list', { name: 'Your Glitchdle numbers' })
  expect(numbers).toHaveTextContent('1Played')
  const table = screen.getByRole('table')
  expect(within(table).getByRole('row', { name: /Classic/ })).toHaveTextContent('3/45.31...')
})

it('says what went wrong and reloads the board when a guess is refused', async () => {
  vi.mocked(guessRiddle).mockRejectedValue(new Error('You already tried that language.'))
  renderAt('/glitchdle', { user: 'alice' })
  await userEvent.type(await screen.findByRole('combobox'), 'rust{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('You already tried that language.')
  await waitFor(() => expect(getRiddle).toHaveBeenCalledTimes(2))
})

it('is in the main nav and needs an account', async () => {
  renderAt('/glitchdle', { user: 'alice' })
  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(within(nav).getByRole('link', { name: 'Glitchdle' })).toHaveAttribute('href', '/glitchdle')
  await screen.findByRole('heading', { name: 'Glitchdle #1' })
})

it('asks for sign in', () => {
  renderAt('/glitchdle')
  expect(currentLocation()).toBe('/login?next=%2Fglitchdle')
})
