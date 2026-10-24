import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { categoryById, itemById } from '../../../shared/riddle/categories.js'
import { compareGuess, MAX_GUESSES } from '../../../shared/riddle/game.js'
import { languageById } from '../../../shared/riddle/languages.js'
import { getProgress, getRiddle, guessRiddle } from '../../lib/api.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getRiddle: vi.fn(),
  guessRiddle: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

const inHours = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString()
const classicGuess = (id, answer = 'rust') => ({ id, name: languageById(id).name, ...compareGuess(languageById(id), languageById(answer)) })
const frameworkGuess = (id, answer = 'react') => ({
  id,
  name: itemById('frameworks', id).name,
  ...compareGuess(itemById('frameworks', id), itemById('frameworks', answer), categoryById('frameworks').attributes),
})
const open = (mode, fields = {}) => ({ mode, category: 'languages', solved: false, over: false, guessCount: 0, guessesLeft: MAX_GUESSES, answer: null, guesses: [], ...fields })
const zeros = () => Array(10).fill(0)
const SLOT_ZEROS = () => ({ classic: zeros(), error: zeros(), snippet: zeros(), frameworks: zeros(), databases: zeros() })
const NOBODY = { players: 0, solved: 0, averageGuesses: null }

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
    frameworks: open('frameworks', { category: 'frameworks' }),
    databases: open('databases', { category: 'databases' }),
  },
  stats: {
    xp: 0,
    played: 1,
    perfectDays: 0,
    fullDays: 0,
    streak: 0,
    longestStreak: 0,
    solved: { classic: 0, error: 0, snippet: 0, frameworks: 0, databases: 0 },
    distribution: SLOT_ZEROS(),
  },
  community: {
    classic: { players: 4, solved: 3, averageGuesses: 5.3 },
    error: NOBODY,
    snippet: NOBODY,
    frameworks: NOBODY,
    databases: NOBODY,
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
    stats: { ...game.stats, xp: 25, solved: { ...game.stats.solved, classic: 1 }, distribution },
  }
}

beforeEach(() => {
  vi.mocked(getRiddle).mockReset().mockResolvedValue(GAME())
  vi.mocked(guessRiddle).mockReset()
  vi.mocked(getProgress).mockClear()
})

// The board being played: the innermost panel (a language mode inside the Languages category).
const board = async () => (await screen.findAllByRole('tabpanel')).at(-1)
const P = '\u{1F7EA}'
const Y = '\u{1F7E8}'
const W = '⬜'
const squares = (guess) => guess.cells.map((cell) => ({ match: P, partial: Y, miss: W })[cell.status]).join('')
const host = () => window.location.origin.replace(/^https?:\/\//, '')

it('shows the game number, countdown, modes and my Classic board', async () => {
  renderAt('/glitchdle', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'Glitchdle #1' })).toBeInTheDocument()
  expect(screen.getByText(/^[45]:\d{2}:\d{2}$/)).toBeInTheDocument()
  const tabs = within(screen.getByRole('tablist', { name: 'Game modes' })).getAllByRole('tab')
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Classic1 try', 'ErrorNew', 'SnippetNew'])
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
  const input = await screen.findByRole('combobox', { name: 'Guess a language' })
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
  const input = await screen.findByRole('combobox', { name: 'Guess a language' })
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
  await user.type(await screen.findByRole('combobox', { name: 'Guess a language' }), 'rust{Enter}')

  expect(await screen.findByText(/Solved in 2 guesses!/)).toHaveTextContent('It was Rust.')
  expect(screen.getByTestId('win-burst')).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Guess a language' })).not.toBeInTheDocument()
  expect(screen.getByText(/Next Glitchdle in/)).toBeInTheDocument()
  expect(within(screen.getByRole('tab', { name: /Classic/ })).getByText('(solved)')).toBeInTheDocument()
  // The progress refreshes for the XP and the badge toasts.
  await waitFor(() => expect(getProgress.mock.calls.length).toBeGreaterThan(1))

  await user.click(screen.getByRole('button', { name: 'Copy result' }))
  const text = await navigator.clipboard.readText()
  expect(text).toBe(
    [
      '\u{1F50D} Glitchdle #1 (Oct 22)',
      '',
      '\u{1F9E9} Classic: solved in 2 guesses',
      '⚠️ Error: not played',
      '✂️ Snippet: not played',
      '\u{1F9F1} Frameworks: not played',
      '\u{1F5C4}️ Databases: not played',
      '',
      squares(classicGuess('python')),
      P.repeat(classicGuess('rust').cells.length),
      '',
      `Can you do better? ${host()}/glitchdle`,
    ].join('\n'),
  )
  expect(text).not.toMatch(/rust/i)
  expect(await screen.findByText('Copied!')).toBeInTheDocument()
})

it('copies the result in Brazilian Portuguese, with the streak and the earlier guesses', async () => {
  const user = userEvent.setup()
  const won = WON()
  const wrong = ['python', 'go', 'java', 'c', 'ruby']
  won.modes.classic = { ...won.modes.classic, guessCount: 6, guesses: [classicGuess('rust'), ...wrong.map((id) => classicGuess(id))] }
  won.modes.error = { ...won.modes.error, solved: true, over: true, guessCount: 1, answer: { id: 'rust', name: 'Rust' }, guesses: [{ id: 'rust', name: 'Rust', correct: true }] }
  won.stats = { ...won.stats, streak: 3 }
  vi.mocked(getRiddle).mockResolvedValue(won)
  renderAt('/glitchdle', { user: 'alice', locale: 'pt-BR' })
  await user.click(await screen.findByRole('tab', { name: /Clássico/ }))
  await user.click(screen.getByRole('button', { name: 'Copiar resultado' }))
  const rows = ['go', 'python'].map((id) => squares(classicGuess(id)))
  expect(await navigator.clipboard.readText()).toBe(
    [
      '\u{1F50D} Glitchdle #1 (22/10)',
      '',
      '\u{1F9E9} Clássico: acertei em 6 palpites',
      '⚠️ Erro: acertei em 1 palpite',
      '✂️ Trecho: não joguei',
      '\u{1F9F1} Frameworks: não joguei',
      '\u{1F5C4}️ Bancos de dados: não joguei',
      '',
      squares(classicGuess('java')),
      ...rows,
      P.repeat(classicGuess('rust').cells.length),
      '(+2 palpites antes)',
      '',
      '\u{1F525} 3 dias seguidos',
      `Consegue fazer melhor? ${host()}/glitchdle`,
    ].join('\n'),
  )
  expect(await screen.findByText('Copiado!')).toBeInTheDocument()
})

it('switches to the framework board and grades it with its own traits', async () => {
  const user = userEvent.setup()
  const game = GAME()
  vi.mocked(guessRiddle).mockResolvedValue({
    ...game,
    correct: false,
    modes: { ...game.modes, frameworks: { ...game.modes.frameworks, guessCount: 1, guessesLeft: MAX_GUESSES - 1, guesses: [frameworkGuess('django')] } },
  })
  renderAt('/glitchdle', { user: 'alice' })
  const categories = within(await screen.findByRole('tablist', { name: 'Categories' })).getAllByRole('tab')
  expect(categories.map((tab) => tab.textContent)).toEqual(['Languages0/3 solved', 'FrameworksNew', 'DatabasesNew'])
  await user.click(categories[1])
  expect(categories[1]).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('tablist', { name: 'Game modes' })).not.toBeInTheDocument()
  const input = screen.getByRole('combobox', { name: 'Guess a framework' })
  expect(input).toHaveAttribute('placeholder', 'e.g. React, Django, Flutter')
  await user.type(input, 'rails')
  expect(within(screen.getByRole('listbox', { name: 'Frameworks' })).getAllByRole('option')[0]).toHaveTextContent('Ruby on Rails')
  await user.clear(input)
  await user.type(input, 'django{Enter}')
  expect(guessRiddle).toHaveBeenCalledWith({ mode: 'frameworks', guess: 'django', day: '2026-10-22' }, 'token-alice')
  const card = await within(screen.getByRole('list', { name: 'Your guesses' })).findByRole('listitem', { name: 'Django' })
  expect(card).toHaveTextContent('Main language')
  expect(card).toHaveTextContent('Python')
  expect(card).toHaveTextContent('Backend')
  expect(screen.getByRole('list', { name: 'What the colors mean' })).toHaveTextContent('Answer is newer or ranks higher')
  expect(screen.getByRole('heading', { name: 'Frameworks guess distribution' })).toBeInTheDocument()
})

it('shows the database board in Brazilian Portuguese, and where the data comes from', async () => {
  const user = userEvent.setup()
  const game = GAME()
  const db = (id) => ({ id, name: itemById('databases', id).name, ...compareGuess(itemById('databases', id), itemById('databases', 'postgresql'), categoryById('databases').attributes) })
  game.modes.databases = { ...game.modes.databases, guessCount: 1, guesses: [db('mongodb')] }
  vi.mocked(getRiddle).mockResolvedValue(game)
  renderAt('/glitchdle', { user: 'alice', locale: 'pt-BR' })
  await user.click(await screen.findByRole('tab', { name: /Bancos de dados/ }))
  expect(screen.getByRole('combobox', { name: 'Dê um palpite de banco de dados' })).toBeInTheDocument()
  const card = within(screen.getByRole('list', { name: 'Seus palpites' })).getByRole('listitem', { name: 'MongoDB' })
  expect(card).toHaveTextContent('Modelo de dados')
  expect(card).toHaveTextContent('Documentos')
  expect(card).toHaveTextContent('Escrito em')
  expect(screen.getByText(/Dados das características/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Wikidata (CC0)' })).toHaveAttribute('href', 'https://www.wikidata.org')
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

it('shows the hints a classic board has unlocked, and when the next one comes', async () => {
  const game = GAME()
  game.modes.classic = { ...game.modes.classic, hints: [{ kind: 'trait', key: 'typing', value: 'static' }, { kind: 'letter', value: 'R' }], nextHintIn: 4 }
  vi.mocked(getRiddle).mockResolvedValue(game)
  renderAt('/glitchdle', { user: 'alice' })
  const hints = within(await board()).getByRole('list', { name: 'Hints' })
  const items = within(hints).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual(["Answer's TypingStatic", 'First letterR', 'Hint 3 lockedUnlocks after 4 more wrong guesses'])
})

it('names the decade and the name length on a framework board, in Brazilian Portuguese too', async () => {
  const user = userEvent.setup()
  const game = GAME()
  game.modes.frameworks = {
    ...game.modes.frameworks,
    hints: [
      { kind: 'decade', value: 2010 },
      { kind: 'letter', value: 'D' },
      { kind: 'length', value: 6 },
    ],
    nextHintIn: null,
  }
  vi.mocked(getRiddle).mockResolvedValue(game)
  renderAt('/glitchdle', { user: 'alice', locale: 'pt-BR' })
  await user.click(await screen.findByRole('tab', { name: /Frameworks/ }))
  const hints = screen.getByRole('list', { name: 'Dicas' })
  expect(within(hints).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['DécadaAnos 2010', 'Primeira letraD', 'Tamanho do nome6 caracteres, sem espaços'])
})

it('starts a classic board with every hint locked, and drops the box once the board is over', async () => {
  const game = GAME()
  game.modes.classic = { ...game.modes.classic, hints: [], nextHintIn: 4 }
  vi.mocked(getRiddle).mockResolvedValue(game)
  const { unmount } = renderAt('/glitchdle', { user: 'alice' })
  const hints = within(await board()).getByRole('list', { name: 'Hints' })
  expect(within(hints).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Hint 1 lockedUnlocks after 4 more wrong guesses',
    'Hint 2 lockedUnlocks later',
    'Hint 3 lockedUnlocks later',
  ])
  unmount()
  const won = WON()
  won.modes.classic = { ...won.modes.classic, hints: [{ kind: 'letter', value: 'R' }], nextHintIn: null }
  vi.mocked(getRiddle).mockResolvedValue(won)
  renderAt('/glitchdle', { user: 'alice' })
  await userEvent.click(await screen.findByRole('tab', { name: /Classic/ }))
  expect(await screen.findByText(/Solved in 2 guesses!/)).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Hints' })).not.toBeInTheDocument()
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
  expect(within(table).getByRole('row', { name: /Classic/ })).toHaveTextContent('3/45.31 try')
  expect(within(table).getAllByRole('row')).toHaveLength(6)
})

it('says what went wrong and reloads the board when a guess is refused', async () => {
  vi.mocked(guessRiddle).mockRejectedValue(new Error('You already tried that language.'))
  renderAt('/glitchdle', { user: 'alice' })
  await userEvent.type(await screen.findByRole('combobox', { name: 'Guess a language' }), 'rust{Enter}')
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

it('speaks Brazilian Portuguese: modes, traits, legend and the panels', async () => {
  renderAt('/glitchdle', { user: 'alice', locale: 'pt-BR' })
  const tabs = within(await screen.findByRole('tablist', { name: 'Modos de jogo' })).getAllByRole('tab')
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Clássico1 tentativa', 'ErroNovo', 'TrechoNovo'])
  expect(screen.getByText(`${MAX_GUESSES - 1}/${MAX_GUESSES} palpites restantes`)).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Dê um palpite de linguagem' })).toHaveAttribute('placeholder', 'Ex.: Python, Rust, Go')
  const guess = within(screen.getByRole('list', { name: 'Seus palpites' })).getByRole('listitem', { name: 'Python' })
  expect(within(guess).getByText('Paradigmas')).toBeInTheDocument()
  expect(within(guess).getByText('Família de sintaxe')).toBeInTheDocument()
  expect(within(guess).getByText('Estilo Python')).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'O que as cores significam' })).toHaveTextContent('Algo em comum')
  expect(screen.getByRole('heading', { name: 'Suas estatísticas' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Jogadores de hoje' })).toBeInTheDocument()
  expect(screen.getByText('Nenhum acerto no modo Clássico ainda. O primeiro começa o gráfico.')).toBeInTheDocument()
})

it('puts my stats and the community in a sidebar, and reads the guesses left with the input', async () => {
  renderAt('/glitchdle', { user: 'alice' })
  const input = await screen.findByRole('combobox', { name: 'Guess a language' })
  expect(input).toHaveAccessibleDescription(`${MAX_GUESSES - 1}/${MAX_GUESSES} guesses left`)

  const sidebar = screen.getByRole('complementary', { name: 'Stats and community' })
  expect(within(sidebar).getByRole('heading', { name: 'Your stats' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('heading', { name: 'Classic guess distribution' })).toBeInTheDocument()
  const table = within(sidebar).getByRole('table')
  // The column says "Avg" on screen and the whole name to screen readers.
  expect(within(table).getByRole('columnheader', { name: 'Avg guesses' })).toHaveTextContent('Avg')
  expect(await board()).not.toContainElement(sidebar)
})
