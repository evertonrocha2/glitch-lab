import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthError, askAssistant, listCases, listNotes, StreamUnavailableError, startChallenge, streamAssistant } from '../../../lib/api.js'
import { makeCase } from '../../../test/fixtures.js'
import { currentLocation, renderAt } from '../../../test/render.jsx'

vi.mock('../../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  askAssistant: vi.fn(),
  StreamUnavailableError: class StreamUnavailableError extends Error {},
  streamAssistant: vi.fn(),
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
  // Most tests read the plain answer: the stream is unavailable, as behind a proxy that blocks it.
  vi.mocked(streamAssistant).mockReset().mockRejectedValue(new StreamUnavailableError('no stream'))
  vi.mocked(startChallenge).mockReset()
  vi.mocked(listCases).mockReset().mockResolvedValue([])
  vi.mocked(listNotes).mockReset().mockResolvedValue([])
})

const openButton = () => screen.getByRole('button', { name: 'Lab assistant' })
const panel = () => screen.getByRole('dialog', { name: 'Lab assistant' })

async function openPanel(path = '/board') {
  renderAt(path, { user: 'alice' })
  await userEvent.click(openButton())
  return panel()
}

it('opens from the header and closes with Escape, giving focus back', async () => {
  await openPanel()
  expect(screen.getByLabelText('Your question')).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Lab assistant' })).toBeNull()
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
  expect(await within(within(panel()).getByRole('log')).findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
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
  expect(screen.queryByRole('dialog', { name: 'Lab assistant' })).toBeNull()
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
  expect(screen.queryByRole('dialog', { name: 'Lab assistant' })).toBeNull()
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
  expect(screen.queryByRole('dialog', { name: 'Lab assistant' })).toBeNull()
  expect(screen.getByRole('dialog', { name: /TypeError/ })).toBeInTheDocument()
})

it('is not on signed-out pages', () => {
  renderAt('/')
  expect(screen.queryByRole('button', { name: 'Lab assistant' })).toBeNull()
})

it('speaks Brazilian Portuguese: chips, thinking steps and the answer trace', async () => {
  let answer
  vi.mocked(askAssistant).mockReturnValue(
    new Promise((resolve) => {
      answer = resolve
    }),
  )
  renderAt('/board', { user: 'alice', locale: 'pt-BR' })
  await userEvent.click(screen.getByRole('button', { name: 'Assistente do Lab' }))
  const dialog = screen.getByRole('dialog', { name: 'Assistente do Lab' })
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

// A stream the test drives: emit(type, data) sends an event, finish(answer) or fail(err) ends it.
function controlledStream() {
  const control = {}
  vi.mocked(streamAssistant).mockImplementation(
    (_body, _token, { onEvent, signal }) =>
      new Promise((resolve, reject) => {
        control.signal = signal
        control.emit = (type, data) => act(async () => onEvent({ type, data }))
        control.finish = (answer) => act(async () => resolve(answer))
        control.fail = (err) => act(async () => reject(err))
      }),
  )
  return control
}

it('shows the answer growing as it streams, with a caret, then the buttons when it is done', async () => {
  const stream = controlledStream()
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'What is my weak spot?{Enter}')
  expect(streamAssistant).toHaveBeenCalledWith(
    { messages: [{ role: 'user', content: 'What is my weak spot?' }], page: { path: '/board' } },
    'token-alice',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )

  await stream.emit('step', { kind: 'routing', text: 'Routing your question' })
  await stream.emit('step', { kind: 'context', agent: 'board', text: 'Board analyst is looking at your cases' })
  const thinking = within(panel()).getByRole('status')
  expect(within(thinking).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Routing your question', 'Board analyst is looking at your cases'])
  expect(within(panel()).getByRole('log')).toHaveAttribute('aria-busy', 'true')

  await stream.emit('delta', { agent: 'board', text: 'Your weak spot ' })
  expect(within(panel()).queryByRole('status')).toBeNull()
  expect(within(panel()).getByText('Board analyst is typing')).toBeInTheDocument()
  expect(within(panel()).getByText('Your weak spot', { exact: false })).toBeInTheDocument()
  expect(within(panel()).getByTestId('typing-caret')).toHaveClass('motion-safe:animate-blink')
  await stream.emit('delta', { agent: 'board', text: 'is `undefined` access.' })
  expect(within(panel()).getByText('undefined', { selector: 'code' })).toBeInTheDocument()
  // Nothing is announced word by word.
  expect(screen.getByTestId('assistant-announcer')).toHaveTextContent('')
  expect(within(panel()).getByRole('button', { name: 'Stop' })).toBeInTheDocument()

  await stream.finish({ ...REPLY, actions: [{ type: 'start_timer', target: '', label: 'Start the study timer' }] })
  expect(await within(panel()).findByText('Answered by Board analyst')).toBeInTheDocument()
  expect(within(panel()).queryByTestId('typing-caret')).toBeNull()
  expect(within(panel()).getByRole('button', { name: 'Start the study timer' })).toBeInTheDocument()
  expect(screen.getByTestId('assistant-announcer')).toHaveTextContent('Your weak spot is `undefined` access.')
  expect(within(panel()).getByRole('log')).toHaveAttribute('aria-busy', 'false')
  expect(askAssistant).not.toHaveBeenCalled()
})

it('labels each specialist as their streamed parts arrive', async () => {
  const stream = controlledStream()
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'help{Enter}')
  await stream.emit('delta', { agent: 'gym', text: 'Look at a.b.' })
  await stream.emit('delta', { agent: 'study', text: 'Study 20' })
  expect(within(panel()).getByText('Study planner is typing')).toBeInTheDocument()
  expect(within(panel()).getByRole('heading', { name: 'Gym coach' })).toBeInTheDocument()
  expect(within(panel()).getByRole('heading', { name: 'Study planner' })).toBeInTheDocument()
})

it('falls back to the plain answer when the stream is unavailable before any text', async () => {
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'hi{Enter}')
  expect(await within(panel()).findByText('Answered by Board analyst')).toBeInTheDocument()
  expect(streamAssistant).toHaveBeenCalledTimes(1)
  expect(askAssistant).toHaveBeenCalledWith({ messages: [{ role: 'user', content: 'hi' }], page: { path: '/board' } }, 'token-alice')
})

it('does not ask twice once text has streamed, or when the server answered with an error', async () => {
  const stream = controlledStream()
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'hi{Enter}')
  await stream.emit('delta', { agent: 'board', text: 'Half an ans' })
  await stream.fail(new StreamUnavailableError('cut'))
  expect(await within(panel()).findByRole('alert')).toHaveTextContent('cut')

  vi.mocked(streamAssistant).mockRejectedValueOnce(new Error('The AI is busy right now. Try again in a minute.'))
  await userEvent.click(within(panel()).getByRole('button', { name: 'Try again' }))
  expect(await within(panel()).findByRole('alert')).toHaveTextContent('The AI is busy right now.')
  expect(askAssistant).not.toHaveBeenCalled()
})

it('stops an answer halfway and keeps what was written', async () => {
  const stream = controlledStream()
  await openPanel()
  await userEvent.type(screen.getByLabelText('Your question'), 'explain{Enter}')
  await stream.emit('delta', { agent: 'board', text: 'First, look at' })
  await userEvent.click(within(panel()).getByRole('button', { name: 'Stop' }))
  expect(stream.signal.aborted).toBe(true)
  expect(within(panel()).getByText('First, look at')).toBeInTheDocument()
  expect(within(panel()).getByText('You stopped this answer here.')).toBeInTheDocument()
  expect(within(panel()).queryByTestId('typing-caret')).toBeNull()
  // A late end of the stopped stream changes nothing.
  await stream.finish(REPLY)
  expect(within(panel()).queryByText('Then read it')).toBeNull()
  expect(within(panel()).getByRole('button', { name: 'Send' })).toBeInTheDocument()
})

it('says who is typing and stops in Portuguese', async () => {
  const stream = controlledStream()
  renderAt('/board', { user: 'alice', locale: 'pt-BR' })
  await userEvent.click(screen.getByRole('button', { name: 'Assistente do Lab' }))
  await userEvent.type(screen.getByLabelText('Sua pergunta'), 'oi{Enter}')
  await stream.emit('step', { kind: 'routing', text: 'Encaminhando sua pergunta' })
  expect(screen.getByText('Encaminhando sua pergunta')).toBeInTheDocument()
  await stream.emit('delta', { agent: 'guide', text: 'Aqui você' })
  expect(screen.getByText('Guia do app está digitando')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Parar' }))
  expect(screen.getByText('Você parou esta resposta aqui.')).toBeInTheDocument()
})
