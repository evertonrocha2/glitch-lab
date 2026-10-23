import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthError, askAssistant, listCases, listNotes, startChallenge } from '../../../lib/api.js'
import { makeCase } from '../../../test/fixtures.js'
import { currentLocation, renderAt } from '../../../test/render.jsx'

vi.mock('../../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  askAssistant: vi.fn(),
  startChallenge: vi.fn(),
  listCases: vi.fn(),
  listNotes: vi.fn(),
  createNote: vi.fn(),
  analyzeError: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

const REPLY = {
  reply: 'Your weak spot is `undefined` access.\n\n- Check the value\n- Then read it',
  parts: [{ agent: 'board', reply: 'Your weak spot is `undefined` access.\n\n- Check the value\n- Then read it' }],
  actions: [],
  agents: ['board'],
  steps: ['Routing your question', 'Board analyst is looking at your cases'],
}

beforeEach(() => {
  vi.mocked(askAssistant).mockReset().mockResolvedValue(REPLY)
  vi.mocked(startChallenge).mockReset()
  vi.mocked(listCases).mockReset().mockResolvedValue([])
  vi.mocked(listNotes).mockReset().mockResolvedValue([])
})

const openButton = () => screen.getByRole('button', { name: 'Ask the detective' })
const panel = () => screen.getByRole('dialog', { name: 'Ask the detective' })

async function openPanel(path = '/board') {
  renderAt(path, { user: 'alice' })
  await userEvent.click(openButton())
  return panel()
}

it('opens from the header and closes with Escape, giving focus back', async () => {
  await openPanel()
  expect(screen.getByLabelText('Your question')).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Ask the detective' })).toBeNull()
  expect(openButton()).toHaveFocus()
})

it('opens and closes with Alt+A and Ctrl+/', async () => {
  renderAt('/board', { user: 'alice' })
  await userEvent.keyboard('{Alt>}a{/Alt}')
  expect(panel()).toBeInTheDocument()
  await userEvent.keyboard('{Control>}/{/Control}')
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('closes with the close button and the backdrop', async () => {
  await openPanel()
  await userEvent.click(within(panel()).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await userEvent.click(openButton())
  await userEvent.click(screen.getByRole('button', { name: 'Close the assistant' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps Tab inside the panel', async () => {
  const dialog = await openPanel()
  const close = within(dialog).getByRole('button', { name: 'Close' })
  close.focus()
  await userEvent.tab({ shift: true })
  expect(dialog.contains(document.activeElement)).toBe(true)
  const buttons = within(dialog).getAllByRole('button')
  buttons.at(-1).focus()
  await userEvent.tab()
  expect(dialog.contains(document.activeElement)).toBe(true)
})

it('suggests questions for the page I am on', async () => {
  await openPanel('/progress')
  expect(within(panel()).getByRole('button', { name: 'Plan my next 30 minutes' })).toBeInTheDocument()
  expect(within(panel()).queryByRole('button', { name: 'Give me a hint without spoiling it' })).toBeNull()
})

it('sends a suggested question and shows the reply with who answered', async () => {
  let answer
  vi.mocked(askAssistant).mockReturnValue(new Promise((resolve) => (answer = resolve)))
  await openPanel()
  await userEvent.click(within(panel()).getByRole('button', { name: 'What is my weak spot?' }))

  expect(askAssistant).toHaveBeenCalledWith(
    { messages: [{ role: 'user', content: 'What is my weak spot?' }], page: { path: '/board' } },
    'token-alice',
  )
  const thinking = within(panel()).getByRole('status')
  expect(thinking).toHaveTextContent('Routing your question')
  expect(thinking).toHaveTextContent('Board analyst is looking at your cases')

  await act(async () => answer(REPLY))
  expect(await within(panel()).findByText('Answered by Board analyst')).toBeInTheDocument()
  expect(within(panel()).getByText('undefined', { selector: 'code' })).toBeInTheDocument()
  expect(within(panel()).getByRole('list', { name: 'Board analyst reply list' })).toBeInTheDocument()
  expect(within(panel()).queryByRole('status')).toBeNull()
})

it('sends with Enter and adds a line with Shift+Enter', async () => {
  await openPanel()
  const box = screen.getByLabelText('Your question')
  await userEvent.type(box, 'line one{Shift>}{Enter}{/Shift}line two')
  expect(box).toHaveValue('line one\nline two')
  await userEvent.keyboard('{Enter}')
  expect(askAssistant).toHaveBeenCalledWith(
    expect.objectContaining({ messages: [{ role: 'user', content: 'line one\nline two' }] }),
    'token-alice',
  )
  expect(box).toHaveValue('')
  expect(await within(panel()).findByText('line two', { exact: false })).toBeInTheDocument()
})

it('renders the reply as text, never as HTML', async () => {
  vi.mocked(askAssistant).mockResolvedValue({ ...REPLY, reply: '<img src=x onerror=alert(1)>', parts: [{ agent: 'board', reply: '<img src=x onerror=alert(1)>' }] })
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'hi{Enter}')
  expect(await within(panel()).findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(panel().querySelector('img')).toBeNull()
})

it('labels each part when two specialists answered', async () => {
  vi.mocked(askAssistant).mockResolvedValue({
    reply: 'Look at a.b.\n\nStudy 20 minutes.',
    parts: [
      { agent: 'gym', reply: 'Look at a.b.' },
      { agent: 'study', reply: 'Study 20 minutes.' },
    ],
    actions: [],
    agents: ['gym', 'study'],
    steps: ['Routing your question', 'Gym coach is checking your gym challenges', 'Study planner is looking at your progress', 'Putting the answers together'],
  })
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'help{Enter}')
  expect(await within(panel()).findByText('Answered by Gym coach + Study planner')).toBeInTheDocument()
  expect(within(panel()).getByText('Look at a.b.')).toBeInTheDocument()
  expect(within(panel()).getByText('Study 20 minutes.')).toBeInTheDocument()
  expect(within(panel()).getByText('Putting the answers together')).toBeInTheDocument()
})

it('opens a case from a reply action and closes the panel', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  vi.mocked(askAssistant).mockResolvedValue({ ...REPLY, actions: [{ type: 'open_case', target: 'c1', label: 'Open the case', href: '/board?case=c1' }] })
  await openPanel('/progress')
  await userEvent.type(screen.getByLabelText('Your question'), 'hi{Enter}')
  await userEvent.click(await within(panel()).findByRole('button', { name: 'Open the case' }))
  await waitFor(() => expect(currentLocation()).toBe('/board'))
  expect(screen.queryByRole('dialog', { name: 'Ask the detective' })).toBeNull()
  expect(await screen.findByRole('dialog', { name: /TypeError/ })).toBeInTheDocument()
})

it('trains a case from a reply action', async () => {
  vi.mocked(startChallenge).mockResolvedValue({ id: 'ch9' })
  vi.mocked(askAssistant).mockResolvedValue({ ...REPLY, actions: [{ type: 'train_case', target: 'c1', label: 'Train it' }] })
  await openPanel('/progress')
  await userEvent.type(screen.getByLabelText('Your question'), 'hi{Enter}')
  await userEvent.click(await within(panel()).findByRole('button', { name: 'Train it' }))
  await waitFor(() => expect(currentLocation()).toBe('/gym/ch9'))
  expect(startChallenge).toHaveBeenCalledWith('c1', 'token-alice')
})

it('starts the study timer from a reply action', async () => {
  vi.mocked(askAssistant).mockResolvedValue({ ...REPLY, actions: [{ type: 'start_timer', target: '', label: 'Start the study timer' }] })
  await openPanel('/progress')
  await userEvent.type(screen.getByLabelText('Your question'), 'plan{Enter}')
  await userEvent.click(await within(panel()).findByRole('button', { name: 'Start the study timer' }))
  expect(screen.queryByRole('dialog', { name: 'Ask the detective' })).toBeNull()
  expect(within(screen.getByRole('region', { name: 'Study timer' })).getByText('Studying')).toBeInTheDocument()
})

it('keeps the chat for the session and starts over with New chat', async () => {
  const first = renderAt('/board', { user: 'alice' })
  await userEvent.click(openButton())
  await userEvent.type(screen.getByLabelText('Your question'), 'remember me{Enter}')
  await within(panel()).findByText('Answered by Board analyst')
  first.unmount()

  renderAt('/progress', { user: 'alice' })
  await userEvent.click(openButton())
  expect(within(panel()).getByText('remember me')).toBeInTheDocument()
  await userEvent.click(within(panel()).getByRole('button', { name: 'New chat' }))
  expect(within(panel()).queryByText('remember me')).toBeNull()
  expect(within(panel()).getByRole('button', { name: 'Plan my next 30 minutes' })).toBeInTheDocument()
})

it('shows the error and tries again', async () => {
  vi.mocked(askAssistant).mockRejectedValueOnce(new Error('The AI is busy right now. Try again in a minute.'))
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'hi{Enter}')
  expect(await within(panel()).findByRole('alert')).toHaveTextContent('The AI is busy right now.')
  await userEvent.click(within(panel()).getByRole('button', { name: 'Try again' }))
  expect(await within(panel()).findByText('Answered by Board analyst')).toBeInTheDocument()
  expect(askAssistant).toHaveBeenCalledTimes(2)
  expect(vi.mocked(askAssistant).mock.calls[1][0].messages).toEqual([{ role: 'user', content: 'hi' }])
})

it('signs out when the session expired', async () => {
  vi.mocked(askAssistant).mockRejectedValue(new AuthError('Sign in to continue.'))
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'hi{Enter}')
  await waitFor(() => expect(currentLocation()).toMatch(/^\/login/))
})

it('knows which case is open on the board, and Escape closes only the assistant', async () => {
  vi.mocked(listCases).mockResolvedValue([makeCase()])
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: /TypeError/ }))
  await userEvent.keyboard('{Alt>}a{/Alt}')
  await userEvent.type(screen.getByLabelText('Your question'), 'why does this case happen?{Enter}')
  expect(askAssistant).toHaveBeenCalledWith(expect.objectContaining({ page: { path: '/board', caseId: 'c1' } }), 'token-alice')
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Ask the detective' })).toBeNull()
  expect(screen.getByRole('dialog', { name: /TypeError/ })).toBeInTheDocument()
})

it('is not on signed-out pages', () => {
  renderAt('/')
  expect(screen.queryByRole('button', { name: 'Ask the detective' })).toBeNull()
})

it('speaks Brazilian Portuguese: chips, thinking steps and the answer trace', async () => {
  let answer
  vi.mocked(askAssistant).mockReturnValue(
    new Promise((resolve) => {
      answer = resolve
    }),
  )
  renderAt('/board', { user: 'alice', locale: 'pt-BR' })
  await userEvent.click(screen.getByRole('button', { name: 'Pergunte ao detetive' }))
  const dialog = screen.getByRole('dialog', { name: 'Pergunte ao detetive' })
  expect(within(dialog).getByLabelText('Sua pergunta')).toHaveAttribute('placeholder', 'Ex.: Qual bug eu mais repito?')
  const chips = within(dialog).getByRole('list', { name: 'Perguntas sugeridas' })
  await userEvent.click(within(chips).getByRole('button', { name: 'Qual é o meu ponto fraco?' }))
  expect(vi.mocked(askAssistant).mock.lastCall[0].messages.at(-1).content).toBe('Qual é o meu ponto fraco?')
  expect(within(dialog).getByText('Encaminhando sua pergunta')).toBeInTheDocument()
  expect(within(dialog).getByText('Analista do board está olhando seus casos')).toBeInTheDocument()
  await act(async () => answer({ ...REPLY, actions: [{ type: 'start_timer', target: 'timer', label: 'Start the study timer' }] }))
  expect(within(dialog).getByText('Respondido por Analista do board')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Iniciar o cronômetro de estudo' })).toBeInTheDocument()
  expect(within(dialog).getByText('Como chegamos nesta resposta')).toBeInTheDocument()
  expect(within(dialog).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
    expect.arrayContaining(['Encaminhando sua pergunta', 'Analista do board está olhando seus casos']),
  )
  expect(within(dialog).getByRole('button', { name: 'Nova conversa' })).toBeEnabled()
})
