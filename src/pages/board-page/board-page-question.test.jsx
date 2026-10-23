import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createCaseFromQuestion, listCases, streamQuestion } from '../../lib/api.js'
import { makeCase } from '../../test/fixtures.js'
import { renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  analyzeError: vi.fn(),
  listCases: vi.fn(),
  startChallenge: vi.fn(),
  listNotes: vi.fn().mockResolvedValue([]),
  createNote: vi.fn(),
  getInterrogation: vi.fn().mockReturnValue(new Promise(() => {})),
  streamQuestion: vi.fn(),
  createCaseFromQuestion: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
}))

const CARD = {
  concept: 'off-by-one',
  topic: 'range end',
  language: 'python',
  title: 'range stops before its end',
  summary: 'range(n) gives 0 up to n - 1.',
  explanation: 'The end of a range is never included.',
  exercise: { prompt: 'Print every item of xs.', answer: 'range(len(xs))' },
}

const questionCase = (overrides = {}) =>
  makeCase({
    id: 'q1',
    kind: 'question',
    error: '',
    question: 'Why does my loop skip the last item?',
    topic: CARD.topic,
    title: CARD.title,
    recap: 'Asked why the loop skips the last item.',
    concept: 'off-by-one',
    language: 'python',
    analysis: { explicacao: CARD.summary, causa: CARD.explanation, correcao: '', exercicio: { enunciado: CARD.exercise.prompt, resposta: CARD.exercise.answer } },
    ...overrides,
  })

// A tutor turn that writes `deltas` and then waits for finish(done).
function tutorTurn(deltas) {
  let finish
  vi.mocked(streamQuestion).mockImplementationOnce(async (_body, _token, { onEvent }) => {
    for (const text of deltas) onEvent({ type: 'delta', data: { text } })
    return new Promise((resolve) => (finish = resolve))
  })
  return (done) => finish(done)
}

// A tutor turn that answers `done` right away.
const answerWith = (done) => vi.mocked(streamQuestion).mockResolvedValueOnce(done)

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(listCases).mockReset().mockResolvedValue([makeCase()])
  vi.mocked(streamQuestion).mockReset()
  vi.mocked(createCaseFromQuestion).mockReset()
})

// The chat log: final answers are also in the live region, said once.
const log = () => screen.getByRole('log', { name: 'Question chat' })

async function openChat() {
  await userEvent.click(await screen.findByRole('button', { name: 'Ask a question' }))
  return screen.getByRole('dialog', { name: 'Ask a question' })
}

async function ask(text) {
  await userEvent.type(screen.getByLabelText('Your question'), text)
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
}

it('opens the chat next to New investigation, focused on the question, without calling the AI', async () => {
  renderAt('/board', { user: 'alice' })
  expect(await screen.findByRole('button', { name: 'New investigation' })).toBeInTheDocument()
  const chat = await openChat()
  expect(screen.getByLabelText('Your question')).toHaveFocus()
  expect(screen.getByLabelText('Your question')).toHaveAttribute('placeholder', 'Ex.: Why does my for loop skip the last item?')
  expect(within(chat).getByText(/Tell me your doubt in your own words/)).toBeInTheDocument()
  expect(streamQuestion).not.toHaveBeenCalled()

  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Ask a question' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ask a question' })).toHaveFocus()
})

it('offers the chat on an empty board too', async () => {
  vi.mocked(listCases).mockResolvedValue([])
  renderAt('/board', { user: 'alice' })
  expect(await screen.findByRole('button', { name: 'Ask a question' })).toBeInTheDocument()
})

it('streams the answer, proposes a card, and accepting puts it on the board with its badge', async () => {
  renderAt('/board', { user: 'alice' })
  const chat = await openChat()
  const finish = tutorTurn(['range leaves ', 'its end out.'])
  await ask('Why does my loop skip the last item?')

  expect(await within(chat).findByText('range leaves its end out.')).toBeInTheDocument()
  expect(within(chat).getByTestId('typing-caret')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  expect(screen.getByTestId('doubt-announcer')).toBeEmptyDOMElement()
  expect(streamQuestion).toHaveBeenCalledWith({ messages: [{ role: 'user', content: 'Why does my loop skip the last item?' }] }, 'token-alice', expect.objectContaining({ signal: expect.any(AbortSignal) }))

  finish({ reply: 'range leaves its end out. What does range(3) give?', card: CARD, turns: 1, turnsLeft: 11 })
  const proposal = await within(chat).findByRole('region', { name: 'Board card' })
  expect(within(proposal).getByText(CARD.title)).toBeInTheDocument()
  expect(within(proposal).getByText('Question')).toBeInTheDocument()
  expect(within(proposal).getByText('range end')).toBeInTheDocument()
  expect(screen.getByTestId('doubt-announcer')).toHaveTextContent('range leaves its end out. What does range(3) give? Card ready to create: range stops before its end')
  expect(within(chat).queryByTestId('typing-caret')).not.toBeInTheDocument()

  vi.mocked(createCaseFromQuestion).mockResolvedValue(questionCase())
  await userEvent.click(within(proposal).getByRole('button', { name: 'Create a board card' }))
  expect(await within(proposal).findByText('Card created on your board.')).toBeInTheDocument()
  expect(createCaseFromQuestion).toHaveBeenCalledWith(
    {
      messages: [
        { role: 'user', content: 'Why does my loop skip the last item?' },
        { role: 'assistant', content: 'range leaves its end out. What does range(3) give?', cardTopic: 'range end' },
      ],
      card: CARD,
    },
    'token-alice',
  )
  expect(within(proposal).getByRole('button', { name: 'Open the card' })).toHaveFocus()
  expect(screen.getByTestId('doubt-announcer')).toHaveTextContent('Card created on your board: range stops before its end')

  // It's on the board already; Open the card closes the chat and opens it there.
  await userEvent.click(within(proposal).getByRole('button', { name: 'Open the card' }))
  const drawer = await screen.findByRole('dialog', { name: /range stops before its end/ })
  expect(within(drawer).getByText('Why does my loop skip the last item?')).toBeInTheDocument()
  expect(within(drawer).getByText('Asked why the loop skips the last item.')).toBeInTheDocument()
  expect(within(drawer).getByRole('heading', { name: 'In short' })).toBeInTheDocument()
  expect(within(drawer).queryByRole('button', { name: /fix/i })).not.toBeInTheDocument()
  await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }))

  const card = within(screen.getByRole('region', { name: 'New' })).getByRole('button', { name: /^Question: range stops before its end/ })
  expect(within(card).getByText('Question')).toBeInTheDocument()
  expect(within(card).getByText('range end')).toBeInTheDocument()
})

it('lets me dismiss a card and keep chatting, telling the tutor a card was shown', async () => {
  renderAt('/board', { user: 'alice' })
  const chat = await openChat()
  answerWith({ reply: 'What does range(3) give?', card: CARD, turns: 1, turnsLeft: 11 })
  await ask('Why?')
  const proposal = await within(chat).findByRole('region', { name: 'Board card' })
  await userEvent.click(within(proposal).getByRole('button', { name: 'Not now' }))
  expect(within(chat).getByText('Card dismissed. You can keep chatting.')).toBeInTheDocument()
  expect(within(chat).queryByRole('region', { name: 'Board card' })).not.toBeInTheDocument()

  answerWith({ reply: 'Right, 0, 1 and 2.', card: null, turns: 2, turnsLeft: 10 })
  await ask('0, 1 and 2?')
  expect(await within(log()).findByText('Right, 0, 1 and 2.')).toBeInTheDocument()
  expect(streamQuestion.mock.lastCall[0].messages).toEqual([
    { role: 'user', content: 'Why?' },
    { role: 'assistant', content: 'What does range(3) give?', cardTopic: 'range end' },
    { role: 'user', content: '0, 1 and 2?' },
  ])
  expect(within(chat).getByText('2 of 12 questions in this chat')).toBeInTheDocument()
  expect(createCaseFromQuestion).not.toHaveBeenCalled()
})

it('sends pasted code with the question and shows it in the chat', async () => {
  renderAt('/board', { user: 'alice' })
  const chat = await openChat()
  answerWith({ reply: 'Look at the range end.', card: null, turns: 1, turnsLeft: 11 })
  await userEvent.click(within(chat).getByRole('button', { name: 'Add code' }))
  await userEvent.type(screen.getByLabelText('Code (optional)'), 'for i in range(2): pass')
  await ask('Why?')
  expect(await within(log()).findByText('Look at the range end.')).toBeInTheDocument()
  expect(streamQuestion.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'Why?', code: 'for i in range(2): pass' }])
  expect(within(chat).getByText('for i in range(2): pass')).toBeInTheDocument()
  expect(screen.queryByLabelText('Code (optional)')).not.toBeInTheDocument()
})

it('Stop keeps what was written, and a failed turn can be tried again', async () => {
  renderAt('/board', { user: 'alice' })
  const chat = await openChat()
  tutorTurn(['Half an answer'])
  await ask('Why?')
  await within(chat).findByText('Half an answer')
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(within(chat).getByText('Answer stopped.')).toBeInTheDocument()

  vi.mocked(streamQuestion).mockRejectedValueOnce(new Error('The AI is busy right now. Try again in a minute.'))
  await ask('And now?')
  expect(await within(chat).findByRole('alert')).toHaveTextContent('The AI is busy right now.')
  answerWith({ reply: 'Here it is.', card: null, turns: 2, turnsLeft: 10 })
  await userEvent.click(within(chat).getByRole('button', { name: 'Try again' }))
  expect(await within(log()).findByText('Here it is.')).toBeInTheDocument()
  expect(streamQuestion).toHaveBeenCalledTimes(3)
})

it('stops taking questions at the cap until a new chat', async () => {
  const full = Array.from({ length: 12 }, (_, index) => [
    { id: `u${index}`, role: 'user', content: `Question ${index}` },
    { id: `a${index}`, role: 'assistant', content: `Answer ${index}` },
  ]).flat()
  sessionStorage.setItem('gd:doubt:alice', JSON.stringify(full))
  renderAt('/board', { user: 'alice' })
  const chat = await openChat()
  expect(within(chat).getByText('This chat reached its limit of 12 questions. Start a new chat to keep going.')).toBeInTheDocument()
  expect(screen.getByLabelText('Your question')).toBeDisabled()
  await userEvent.click(within(chat).getByRole('button', { name: 'New chat' }))
  expect(screen.getByLabelText('Your question')).toBeEnabled()
  expect(within(chat).getByText('0 of 12 questions in this chat')).toBeInTheDocument()
})

it('speaks Portuguese: the button, the chat, the proposal and the badge', async () => {
  vi.mocked(listCases).mockResolvedValue([questionCase()])
  renderAt('/board', { user: 'alice', locale: 'pt-BR' })
  const card = await screen.findByRole('button', { name: /^Dúvida: range stops before its end/ })
  expect(within(card).getByText('Dúvida')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Tirar uma dúvida' }))
  const chat = screen.getByRole('dialog', { name: 'Tirar uma dúvida' })
  expect(screen.getByLabelText('Sua dúvida')).toHaveAttribute('placeholder', 'Ex.: Por que meu for pula o último item da lista?')
  expect(within(chat).getByRole('button', { name: 'Adicionar código' })).toBeInTheDocument()
  answerWith({ reply: 'O fim do range fica de fora.', card: CARD, turns: 1, turnsLeft: 11 })
  await userEvent.type(screen.getByLabelText('Sua dúvida'), 'Por quê?')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  const proposal = await within(chat).findByRole('region', { name: 'Card para o board' })
  expect(within(proposal).getByRole('button', { name: 'Criar card no board' })).toBeInTheDocument()
  expect(within(proposal).getByRole('button', { name: 'Agora não' })).toBeInTheDocument()
  expect(within(proposal).getByText('Dúvida')).toBeInTheDocument()
  expect(within(chat).getByText('1 de 12 perguntas nesta conversa')).toBeInTheDocument()
})

it('opens a question card from the board with its question, recap and practice', async () => {
  vi.mocked(listCases).mockResolvedValue([questionCase({ language: 'unknown' })])
  renderAt('/board', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: /^Question: range stops before its end/ }))
  const drawer = screen.getByRole('dialog', { name: /range stops before its end/ })
  expect(within(drawer).getByText('Your question')).toBeInTheDocument()
  expect(within(drawer).getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
  expect(within(drawer).getByText(CARD.exercise.prompt)).toBeInTheDocument()
  expect(within(drawer).queryByText('unknown')).not.toBeInTheDocument()
  await waitFor(() => expect(within(drawer).getByRole('button', { name: 'Train this' })).toBeEnabled())
})
