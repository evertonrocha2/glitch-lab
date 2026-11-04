import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { answerExamQuestion, listTopicQuestions } from '../../lib/api.js'
import { renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  startStudySession: vi.fn(),
  stopStudySession: vi.fn(),
  listTopicQuestions: vi.fn(),
  answerExamQuestion: vi.fn(),
}))

const TOPIC = { id: 'funcoes', name: 'Funções', area: 'matematica' }

const question = (number, attempt = null) => ({
  id: `q${number}`,
  year: 2023,
  number,
  area: 'matematica',
  topic: 'funcoes',
  context: `Contexto da questão ${number}`,
  statement: 'Qual é o valor?',
  alternatives: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: `opção ${letter}`, image: null })),
  attempt,
})

const page = (questions, { page: number = 1, hasMore = false } = {}) => ({ topic: TOPIC, questions, page: number, hasMore })
const answered = { choice: 'A', correct: true, answer: 'A' }

const open = () => renderAt('/exams/enem/funcoes', { user: 'ana', locale: 'pt-BR' })
const option = (letter) => screen.getByRole('button', { name: new RegExp(`^${letter}\\b`) })

beforeEach(() => {
  vi.mocked(listTopicQuestions).mockReset()
  vi.mocked(answerExamQuestion).mockReset()
})

it('starts at the first unanswered question', async () => {
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1, answered), question(2), question(3)]))
  open()
  expect(await screen.findByText('Questão oficial · ENEM 2023 · Q2')).toBeInTheDocument()
  expect(listTopicQuestions).toHaveBeenCalledWith({ examId: 'enem', topicId: 'funcoes', page: 1 }, 'token-ana')
  expect(screen.getByRole('heading', { name: 'Funções' })).toBeInTheDocument()
  expect(screen.getByText('2 de 3')).toBeInTheDocument()
})

it('answers and moves on', async () => {
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(2), question(3)]))
  vi.mocked(answerExamQuestion).mockResolvedValue({ attempt: { choice: 'B', correct: true, answer: 'B' }, first: true })
  open()
  await screen.findByText('Questão oficial · ENEM 2023 · Q2')
  await userEvent.click(option('B'))
  await userEvent.click(screen.getByRole('button', { name: 'Responder' }))
  expect(answerExamQuestion).toHaveBeenCalledWith('q2', 'B', 'token-ana')
  expect(await screen.findByText('Acertou!')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(screen.getByText('Questão oficial · ENEM 2023 · Q3')).toBeInTheDocument()
  expect(screen.queryByText('Acertou!')).not.toBeInTheDocument()
})

it('shows the first answer when the question was answered elsewhere', async () => {
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(2), question(3)]))
  vi.mocked(answerExamQuestion).mockResolvedValue({ attempt: { choice: 'C', correct: false, answer: 'B' }, first: false })
  open()
  await screen.findByText('Questão oficial · ENEM 2023 · Q2')
  await userEvent.click(option('A'))
  await userEvent.click(screen.getByRole('button', { name: 'Responder' }))
  expect(await screen.findByText('Não foi dessa vez. A resposta é a B.')).toBeInTheDocument()
})

it('loads the next page at the end', async () => {
  vi.mocked(listTopicQuestions)
    .mockResolvedValueOnce(page([question(1, answered), question(2)], { hasMore: true }))
    .mockResolvedValueOnce(page([question(11)], { page: 2 }))
  vi.mocked(answerExamQuestion).mockResolvedValue({ attempt: answered, first: true })
  open()
  await screen.findByText('Questão oficial · ENEM 2023 · Q2')
  await userEvent.click(option('A'))
  await userEvent.click(screen.getByRole('button', { name: 'Responder' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Questão oficial · ENEM 2023 · Q11')).toBeInTheDocument()
  expect(listTopicQuestions).toHaveBeenLastCalledWith({ examId: 'enem', topicId: 'funcoes', page: 2 }, 'token-ana')
})

it('skips pages where everything is answered', async () => {
  vi.mocked(listTopicQuestions)
    .mockResolvedValueOnce(page([question(1, answered)], { hasMore: true }))
    .mockResolvedValueOnce(page([question(11)], { page: 2 }))
  open()
  expect(await screen.findByText('Questão oficial · ENEM 2023 · Q11')).toBeInTheDocument()
})

it('says when the topic is done', async () => {
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1, answered)]))
  open()
  expect(await screen.findByText('Você respondeu todas as questões deste assunto.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Voltar para ENEM' })).toHaveAttribute('href', '/exams/enem')
})

it('handles an unknown topic', async () => {
  vi.mocked(listTopicQuestions).mockRejectedValue(Object.assign(new Error('Assunto não encontrado.'), { status: 404 }))
  renderAt('/exams/enem/nope', { user: 'ana', locale: 'pt-BR' })
  expect(await screen.findByText('Assunto não encontrado.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Voltar para ENEM' })).toHaveAttribute('href', '/exams/enem')
})
