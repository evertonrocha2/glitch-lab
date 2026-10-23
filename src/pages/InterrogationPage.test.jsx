import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { advance, emptyInterrogation, INTERROGATION_STEPS } from '../../shared/interrogation.js'
import { answerInterrogation, createNote, getInterrogation } from '../lib/api.js'
import { makeCase } from '../test/fixtures.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  getInterrogation: vi.fn(),
  answerInterrogation: vi.fn(),
  createNote: vi.fn(),
  getNote: vi.fn().mockResolvedValue(null),
  listNotes: vi.fn().mockResolvedValue([]),
  listCases: vi.fn().mockResolvedValue([]),
}))

const AT = '2026-10-23T10:00:00.000Z'
const view = (state) => ({ ...state, steps: INTERROGATION_STEPS, finished: state.step >= 6, xp: 60 })
const pass = (state, answer, feedback = 'Good.') => advance(state, answer, { passed: true, feedback, question: '' }, AT)

function finishedState() {
  let state = emptyInterrogation('c1')
  for (const id of INTERROGATION_STEPS) state = pass(state, `my ${id} answer`, `nice ${id}`)
  return state
}

beforeEach(() => {
  vi.mocked(getInterrogation).mockReset().mockResolvedValue({ case: makeCase(), interrogation: view(emptyInterrogation('c1')) })
  vi.mocked(answerInterrogation).mockReset()
  vi.mocked(createNote).mockReset()
})

const answerBox = () => screen.findByLabelText('Your answer')

it('opens on step 1 with the case, a labelled field and an example', async () => {
  renderAt('/interrogate/c1', { user: 'alice' })
  const box = await answerBox()
  expect(box).toHaveAttribute('placeholder', expect.stringMatching(/^Ex\.: /))
  expect(screen.getByRole('heading', { name: 'Reproduce' })).toBeInTheDocument()
  expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Interrogation steps' })).toBeInTheDocument()
  expect(screen.getByText('Step 1, Reproduce: current')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'The case' })).toBeInTheDocument()
  expect(getInterrogation).toHaveBeenCalledWith('c1', 'token-alice')
  expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled()
})

it('shows the guiding question in a live region when the answer is off', async () => {
  const state = advance(emptyInterrogation('c1'), 'it breaks', { passed: false, feedback: 'Too vague.', question: 'What input did you use?' }, AT)
  vi.mocked(answerInterrogation).mockResolvedValue({ interrogation: view(state), turn: state.turns[0], finished: false, xp: 0 })
  renderAt('/interrogate/c1', { user: 'alice' })
  await userEvent.type(await answerBox(), 'it breaks')
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }))

  expect(answerInterrogation).toHaveBeenCalledWith({ caseId: 'c1', answer: 'it breaks' }, 'token-alice')
  expect(await screen.findByText('What input did you use?')).toBeInTheDocument()
  expect(screen.getByText('Not yet').closest('[aria-live="polite"]')).toBeInTheDocument()
  // Still on step 1, and the answer stays so it can be improved.
  expect(screen.getByLabelText('Your answer')).toHaveValue('it breaks')
  expect(screen.getByText('Your tries on this step (1)')).toBeInTheDocument()
})

it('moves to the next step when the answer passes', async () => {
  const state = pass(emptyInterrogation('c1'), 'user is {}', 'Right input.')
  vi.mocked(answerInterrogation).mockResolvedValue({ interrogation: view(state), turn: state.turns[0], finished: false, xp: 0 })
  renderAt('/interrogate/c1', { user: 'alice' })
  await userEvent.type(await answerBox(), 'user is {{}')
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }))

  expect(await screen.findByText('Step passed')).toBeInTheDocument()
  expect(screen.getByText('Next: Read the error')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Read the error' })).toBeInTheDocument()
  expect(screen.getByLabelText('Your answer')).toHaveValue('')
  // The timeline starts filling in.
  const timeline = screen.getByRole('region', { name: 'Interrogation timeline' })
  expect(within(timeline).getByText('user is {}')).toBeInTheDocument()
})

it('celebrates the finish and exports the Q&A as a note', async () => {
  let state = emptyInterrogation('c1')
  for (const id of INTERROGATION_STEPS.slice(0, 5)) state = pass(state, `my ${id} answer`, `nice ${id}`)
  vi.mocked(getInterrogation).mockResolvedValue({ case: makeCase(), interrogation: view(state) })
  const done = finishedState()
  vi.mocked(answerInterrogation).mockResolvedValue({ interrogation: view(done), turn: done.turns.at(-1), finished: true, xp: 60 })
  vi.mocked(createNote).mockResolvedValue({ id: 'n9', title: 'x', blocks: [] })

  renderAt('/interrogate/c1', { user: 'alice' })
  await userEvent.type(await answerBox(), 'a test with an empty user')
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }))
  expect(await screen.findByText('You walked the whole method: +60 XP and the Scientific method badge.')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Export as note' }))
  await waitFor(() => expect(currentLocation()).toBe('/notes/n9'))
  const [note, token] = vi.mocked(createNote).mock.calls[0]
  expect(token).toBe('token-alice')
  expect(note.title).toBe('Interrogation: TypeError')
  expect(note.blocks[0]).toMatchObject({ type: 'case', caseId: 'c1' })
  expect(note.blocks.filter((block) => block.type === 'heading').map((block) => block.text)).toEqual([
    '1. Reproduce',
    '2. Read the error',
    '3. Hypothesis',
    '4. Isolate',
    '5. Fix',
    '6. Prevent',
  ])
  expect(note.blocks).toContainEqual(expect.objectContaining({ type: 'text', text: 'My answer: my fix answer' }))
  expect(note.blocks).toContainEqual(expect.objectContaining({ type: 'text', text: 'Coach: nice fix' }))
})

it('shows a finished interrogation as a timeline with no answer field', async () => {
  vi.mocked(getInterrogation).mockResolvedValue({ case: makeCase(), interrogation: view(finishedState()) })
  renderAt('/interrogate/c1', { user: 'alice' })
  expect(await screen.findByText('You already walked the whole method on this case.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument()
  expect(screen.getByText('my prevent answer')).toBeInTheDocument()
})

it('speaks Portuguese', async () => {
  renderAt('/interrogate/c1', { user: 'alice', locale: 'pt-BR' })
  expect(await screen.findByLabelText('Sua resposta')).toHaveAttribute('placeholder', expect.stringMatching(/^Ex\.: /))
  expect(screen.getByRole('heading', { name: 'Interrogar o bug' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Reproduzir' })).toBeInTheDocument()
})

it('shows what went wrong when the case is missing', async () => {
  vi.mocked(getInterrogation).mockRejectedValue(new Error('Case not found.'))
  renderAt('/interrogate/zzz', { user: 'alice' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Case not found.')
})
