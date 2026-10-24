import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthError, checkFix, getChallenge, revealHint, switchPuzzleLanguage } from '../../lib/api.js'
import { saveGymDraft, takeGymDraft } from '../../lib/draft.js'
import { makeCase, makeChallenge } from '../../test/fixtures.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getChallenge: vi.fn(),
  revealHint: vi.fn(),
  checkFix: vi.fn(),
  switchPuzzleLanguage: vi.fn(),
  listCases: vi.fn().mockResolvedValue([]),
  listNotes: vi.fn().mockResolvedValue([]),
}))

const HINTS = ['Which value is undefined?', 'order.items was never set.', 'Give order an items array.']

beforeEach(() => {
  vi.mocked(getChallenge).mockReset().mockResolvedValue(makeChallenge())
  vi.mocked(revealHint).mockReset()
  vi.mocked(checkFix).mockReset()
  vi.mocked(switchPuzzleLanguage).mockReset()
})

const editor = () => screen.findByLabelText('Your fix')

it('shows the symptom and the broken code', async () => {
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await editor()).toHaveValue('const order = {}\nconsole.log(order.items.length)')
  expect(screen.getByText("TypeError: Cannot read properties of undefined (reading 'length')")).toBeInTheDocument()
  expect(getChallenge).toHaveBeenCalledWith('ch1', 'token-alice')
})

it('reveals hints one by one and stops at three', async () => {
  for (const [index, hint] of HINTS.entries()) {
    vi.mocked(revealHint).mockResolvedValueOnce({ hint, hintsRevealed: index + 1 })
  }
  renderAt('/gym/ch1', { user: 'alice' })
  await editor()
  for (const [index, hint] of HINTS.entries()) {
    await userEvent.click(screen.getByRole('button', { name: `Get a hint (${index}/3)` }))
    expect(await screen.findByText(hint)).toBeInTheDocument()
  }
  expect(screen.queryByRole('button', { name: /Get a hint/ })).not.toBeInTheDocument()
  expect(revealHint).toHaveBeenCalledTimes(3)
})

it('shows a pass and the way back to the board', async () => {
  vi.mocked(checkFix).mockResolvedValue({
    passed: true,
    feedback: 'order.items exists now.',
    case: makeCase({ status: 'training', passedCount: 1 }),
  })
  renderAt('/gym/ch1', { user: 'alice' })
  const box = await editor()
  await userEvent.clear(box)
  await userEvent.type(box, 'const order = new Order()')
  await userEvent.click(screen.getByRole('button', { name: 'Submit fix' }))
  expect(await screen.findByText('order.items exists now.')).toBeInTheDocument()
  expect(screen.getByText('1/2 challenges passed on this case')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Back to board' }))
  expect(currentLocation()).toBe('/board')
})

it('keeps my code when the fix fails', async () => {
  vi.mocked(checkFix).mockResolvedValue({ passed: false, feedback: 'order.items is still undefined.', case: makeCase() })
  renderAt('/gym/ch1', { user: 'alice' })
  const box = await editor()
  await userEvent.type(box, '\n// tried')
  await userEvent.click(screen.getByRole('button', { name: 'Submit fix' }))
  expect(await screen.findByText('order.items is still undefined.')).toBeInTheDocument()
  expect(box).toHaveValue('const order = {}\nconsole.log(order.items.length)\n// tried')
  expect(screen.getByRole('button', { name: 'Submit fix' })).toBeEnabled()
})

it('Submit fix cannot be sent twice while waiting', async () => {
  vi.mocked(checkFix).mockReturnValue(new Promise(() => {}))
  renderAt('/gym/ch1', { user: 'alice' })
  await userEvent.type(await editor(), '// x')
  const submit = screen.getByRole('button', { name: 'Submit fix' })
  await userEvent.click(submit)
  await userEvent.click(submit)
  expect(await screen.findByText('Checking your fix')).toBeInTheDocument()
  expect(checkFix).toHaveBeenCalledTimes(1)
})

it('keeps my fix when the session expires', async () => {
  vi.mocked(checkFix).mockRejectedValue(new AuthError('Sign in to continue.'))
  renderAt('/gym/ch1', { user: 'alice' })
  const box = await editor()
  await userEvent.type(box, '\n// my fix')
  await userEvent.click(screen.getByRole('button', { name: 'Submit fix' }))
  await waitFor(() => expect(currentLocation()).toBe('/login?next=%2Fgym%2Fch1'))
  expect(takeGymDraft('ch1')).toBe('const order = {}\nconsole.log(order.items.length)\n// my fix')
})

it('brings my saved fix back after signing in again', async () => {
  saveGymDraft('ch1', 'const order = { items: 1 }')
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await editor()).toHaveValue('const order = { items: 1 }')
})

it('names the bug type being trained', async () => {
  vi.mocked(getChallenge).mockResolvedValue(makeChallenge({ concept: 'undefined-access' }))
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await screen.findByText('Reading undefined')).toBeInTheDocument()
})

it('Get a hint cannot be sent twice while waiting', async () => {
  vi.mocked(revealHint).mockReturnValue(new Promise(() => {}))
  renderAt('/gym/ch1', { user: 'alice' })
  await editor()
  const button = screen.getByRole('button', { name: 'Get a hint (0/3)' })
  await userEvent.click(button)
  await userEvent.click(button)
  expect(revealHint).toHaveBeenCalledTimes(1)
})

it('shows a skeleton of the gym while the challenge loads', async () => {
  vi.mocked(getChallenge).mockReturnValue(new Promise(() => {}))
  renderAt('/gym/ch1', { user: 'alice' })
  const skeleton = await screen.findByRole('status', { name: 'Loading your challenge...' })
  expect(skeleton).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByLabelText('Your fix')).not.toBeInTheDocument()
})

it('says when the challenge is already fixed', async () => {
  vi.mocked(getChallenge).mockResolvedValue(makeChallenge({ status: 'passed' }))
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await screen.findByText('You already fixed this one. Head back to the board to train again.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Submit fix' })).not.toBeInTheDocument()
})

it('says when the challenge does not exist', async () => {
  vi.mocked(getChallenge).mockRejectedValue(new Error('Challenge not found.'))
  renderAt('/gym/nope', { user: 'alice' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Challenge not found.')
  await waitFor(() => expect(currentLocation()).toBe('/gym/nope'))
})

// Daily and global puzzles run in the same gym, without a case.
const PUZZLE = { id: 'p1', kind: 'daily', day: '2026-10-22', difficulty: 'medium', title: 'The missing last item' }
const puzzleChallenge = (overrides = {}) => makeChallenge({ caseId: null, concept: 'off-by-one', puzzle: PUZZLE, ...overrides })

it('names a daily puzzle and leads back to the daily page', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge())
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'The missing last item' })).toBeInTheDocument()
  expect(screen.getByText('medium')).toBeInTheDocument()
  expect(screen.getByText('Off by one')).toBeInTheDocument()
  expect(screen.queryByText(/same kind as your case/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: '< Back to daily' }))
  expect(currentLocation()).toBe('/daily')
})

it('shows a passed puzzle without any case progress', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge())
  vi.mocked(checkFix).mockResolvedValue({ passed: true, feedback: 'Every item prints now.', case: null })
  renderAt('/gym/ch1', { user: 'alice' })
  await userEvent.type(await editor(), '# fixed')
  await userEvent.click(screen.getByRole('button', { name: 'Submit fix' }))
  expect(await screen.findByText('Every item prints now.')).toBeInTheDocument()
  expect(screen.queryByText(/challenges passed on this case/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Back to daily' }))
  expect(currentLocation()).toBe('/daily')
})

it('says when a puzzle is already fixed', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge({ status: 'passed' }))
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await screen.findByText('You already fixed this one. Head back to the daily page for the next one.')).toBeInTheDocument()
})

it('calls out the global challenge', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge({ puzzle: { ...PUZZLE, kind: 'global', difficulty: 'hard', title: 'The big one' } }))
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await screen.findByRole('heading', { name: 'The big one' })).toBeInTheDocument()
  expect(screen.getByText(/more than one bug/)).toBeInTheDocument()
})

it('speaks Portuguese in the gym', async () => {
  renderAt('/gym/ch1', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByLabelText('Sua correção')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Conserte o bug' })).toBeInTheDocument()
  expect(screen.getByText('O que aparece quando você roda')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pedir uma dica (0/3)' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar correção' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '< Voltar ao board' })).toBeInTheDocument()
})

it('names a daily puzzle in Portuguese and says how the fix went', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge())
  vi.mocked(checkFix).mockResolvedValue({ passed: false, feedback: 'Quase lá.', case: null })
  renderAt('/gym/ch1', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByText('médio')).toBeInTheDocument()
  expect(screen.getByText('Erro de um a mais')).toBeInTheDocument()
  expect(screen.getByText(/desafio diário/)).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Sua correção'), '# fixed')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar correção' }))
  expect(await screen.findByText('Ainda não')).toBeInTheDocument()
  expect(screen.getByText('Ajuste sua correção e envie de novo.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '< Voltar aos diários' })).toHaveAttribute('href', '/daily')
})

it('reads a daily puzzle again in the new language after a switch, keeping the fix being written', async () => {
  vi.mocked(getChallenge)
    .mockResolvedValueOnce(puzzleChallenge({ hints: ['Count the lines.'], hintsRevealed: 1 }))
    .mockResolvedValueOnce(puzzleChallenge({ puzzle: { ...PUZZLE, title: 'O último item sumido' }, hints: ['Conte as linhas.'], hintsRevealed: 1 }))
  renderAt('/gym/ch1', { user: 'alice' })
  expect(await screen.findByText('Count the lines.')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Your fix'), '# mine')
  await userEvent.selectOptions(screen.getAllByLabelText('Language')[0], 'pt-BR')
  expect(await screen.findByRole('heading', { name: 'O último item sumido' })).toBeInTheDocument()
  expect(screen.getByText('Conte as linhas.')).toBeInTheDocument()
  expect(screen.queryByText('Count the lines.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Sua correção').value).toMatch(/# mine$/)
  expect(getChallenge).toHaveBeenCalledTimes(2)
})

// Switching a puzzle to another programming language, once, from the gym header.
const PYTHON = { brokenCode: 'items = [1, 2, 3]\nfor i in range(len(items) - 1):\n    print(items[i])', language: 'python', symptom: 'Prints 1 and 2.' }
const PORTED = {
  brokenCode: 'const items = [1, 2, 3]\nfor (let i = 0; i < items.length - 1; i++) console.log(items[i])',
  language: 'javascript',
  symptom: 'Logs 1 and 2.',
}

it('switches a puzzle to another language from the gym: the code starts over, hints stay opened, then the button is gone', async () => {
  vi.mocked(getChallenge).mockResolvedValue(
    puzzleChallenge({ ...PYTHON, hints: ['Count the lines.'], hintsRevealed: 1, attempts: 2, puzzle: { ...PUZZLE, switchedFrom: null, canSwitch: true } }),
  )
  vi.mocked(switchPuzzleLanguage).mockResolvedValue({
    puzzle: { id: 'p1' },
    challenge: puzzleChallenge({ ...PORTED, hints: ['Count the logs.'], hintsRevealed: 1, attempts: 2, puzzle: { ...PUZZLE, switchedFrom: 'python', canSwitch: false } }),
    switchedFrom: 'python',
  })
  renderAt('/gym/ch1', { user: 'alice' })
  await userEvent.type(await editor(), '# my try')

  await userEvent.click(screen.getByRole('button', { name: 'Switch language: The missing last item' }))
  const dialog = screen.getByRole('dialog', { name: 'Switch language' })
  // The current language is not on the list.
  const options = within(dialog).getAllByRole('radio')
  expect(options).toHaveLength(12)
  expect(within(dialog).queryByRole('radio', { name: 'Python' })).not.toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('radio', { name: 'JavaScript' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }))

  const confirm = screen.getByRole('dialog', { name: 'Switch to JavaScript?' })
  expect(confirm).toHaveTextContent('You can only switch once in this challenge.')
  expect(confirm).toHaveTextContent('Your code starts over in JavaScript.')
  expect(within(confirm).getByRole('button', { name: 'Back' })).toHaveFocus()
  await userEvent.click(within(confirm).getByRole('button', { name: 'Switch to JavaScript' }))

  expect(switchPuzzleLanguage).toHaveBeenCalledWith('p1', 'javascript', 'token-alice')
  expect(await screen.findByText('Switched from Python to JavaScript')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Switch language/ })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Your fix')).toHaveValue(PORTED.brokenCode)
  expect(screen.getByText('Logs 1 and 2.')).toBeInTheDocument()
  expect(screen.getByText('Count the logs.')).toBeInTheDocument()
  expect(screen.queryByText('Count the lines.')).not.toBeInTheDocument()
})

it('keeps the picker open with the reason when a switch fails, and goes back to the list', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge({ ...PYTHON, puzzle: { ...PUZZLE, switchedFrom: null, canSwitch: true } }))
  vi.mocked(switchPuzzleLanguage).mockRejectedValue(new Error("Couldn't make this challenge in Go right now. Your switch is still unused, so you can try again later."))
  renderAt('/gym/ch1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Switch language: The missing last item' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Go' }))
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await userEvent.click(screen.getByRole('button', { name: 'Switch to Go' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your switch is still unused')
  expect(screen.getByLabelText('Your fix')).toHaveValue(PYTHON.brokenCode)
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('radio', { name: 'Go' })).toBeChecked()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Switch language: The missing last item' })).toHaveFocus()
})

it('shows the switch note in Portuguese and no button on a switched or solved puzzle', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge({ ...PORTED, puzzle: { ...PUZZLE, switchedFrom: 'python', canSwitch: false } }))
  renderAt('/gym/ch1', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByText('Trocado de Python para JavaScript')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Trocar linguagem/ })).not.toBeInTheDocument()
})

it('hides the switch once the fix passes', async () => {
  vi.mocked(getChallenge).mockResolvedValue(puzzleChallenge({ ...PYTHON, puzzle: { ...PUZZLE, switchedFrom: null, canSwitch: true } }))
  vi.mocked(checkFix).mockResolvedValue({ passed: true, feedback: 'Every item prints now.', case: null })
  renderAt('/gym/ch1', { user: 'alice' })
  await userEvent.type(await editor(), '# fixed')
  expect(screen.getByRole('button', { name: 'Switch language: The missing last item' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Submit fix' }))
  expect(await screen.findByText('Every item prints now.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Switch language/ })).not.toBeInTheDocument()
})
