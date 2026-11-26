import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { answerExamQuestion, listTopicQuestions } from '../../lib/api.js'
import { loadLessons } from '../../lib/exams/lessons.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  startStudySession: vi.fn(),
  stopStudySession: vi.fn(),
  listTopicQuestions: vi.fn(),
  answerExamQuestion: vi.fn(),
}))

vi.mock('../../lib/exams/lessons.js', () => ({ loadLessons: vi.fn() }))

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

const LESSON = {
  topic: 'funcoes',
  title: 'Funções',
  cai: 'O ENEM pede para ler gráficos. Também pede a lei de uma função.',
  ideias: ['Uma função liga x a um só y.', 'f(x) = ax + b é uma reta.', 'a é a taxa.', 'b corta o eixo y.', 'x² cresce rápido.'],
  exemplo: {
    year: 2021,
    number: 140,
    enunciado: 'Quanto custa uma corrida de 10 km?',
    alternativas: { A: 'R$ 20', B: 'R$ 25', C: 'R$ 30', D: 'R$ 35', E: 'R$ 40' },
    passos: ['A lei é f(x) = 2x + 5.', 'f(10) = 25.', 'Letra B.'],
    resposta: 'B',
  },
  pegadinhas: ['Esquecer a parte fixa.', 'Trocar a com b.', 'Ler o eixo errado.'],
}

const lessons = (byTopic = {}) => ({ lessonFor: (id) => byTopic[id] ?? null })
const withLesson = () => vi.mocked(loadLessons).mockResolvedValue(lessons({ funcoes: LESSON }))
const tab = (name) => screen.getByRole('tab', { name })

beforeEach(() => {
  vi.mocked(listTopicQuestions).mockReset()
  vi.mocked(answerExamQuestion).mockReset()
  // Most tests are about the questions: their topic has no lesson.
  vi.mocked(loadLessons).mockReset().mockResolvedValue(lessons())
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

it('clears an error once answering works again', async () => {
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(2), question(3)]))
  vi.mocked(answerExamQuestion)
    .mockRejectedValueOnce(new Error('Sem conexão.'))
    .mockResolvedValueOnce({ attempt: answered, first: true })
  open()
  await screen.findByText('Questão oficial · ENEM 2023 · Q2')
  await userEvent.click(option('A'))
  await userEvent.click(screen.getByRole('button', { name: 'Responder' }))
  expect(await screen.findByText('Sem conexão.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Responder' }))
  expect(await screen.findByText('Acertou!')).toBeInTheDocument()
  expect(screen.queryByText('Sem conexão.')).not.toBeInTheDocument()
})

it('says the question is gone when answering finds nothing', async () => {
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(2)]))
  vi.mocked(answerExamQuestion).mockRejectedValue(Object.assign(new Error('Questão não encontrada.'), { status: 404 }))
  open()
  await screen.findByText('Questão oficial · ENEM 2023 · Q2')
  await userEvent.click(option('A'))
  await userEvent.click(screen.getByRole('button', { name: 'Responder' }))
  expect(await screen.findByText('Questão não encontrada.')).toBeInTheDocument()
  expect(screen.queryByText('Assunto não encontrado.')).not.toBeInTheDocument()
})

it('handles an unknown topic', async () => {
  vi.mocked(listTopicQuestions).mockRejectedValue(Object.assign(new Error('Assunto não encontrado.'), { status: 404 }))
  renderAt('/exams/enem/nope', { user: 'ana', locale: 'pt-BR' })
  expect(await screen.findByText('Assunto não encontrado.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Voltar para ENEM' })).toHaveAttribute('href', '/exams/enem')
})

it('opens on the lesson when no question of the topic was answered', async () => {
  withLesson()
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1), question(2)]))
  open()
  expect(await screen.findByRole('heading', { name: 'O que cai' })).toBeInTheDocument()
  expect(tab('Aula')).toHaveAttribute('aria-selected', 'true')
  expect(tab('Questões')).toHaveAttribute('aria-selected', 'false')
  expect(screen.queryByText('Questão oficial · ENEM 2023 · Q1')).not.toBeInTheDocument()
  expect(screen.queryByText('1 de 2')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Praticar questões' }))
  expect(tab('Questões')).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('Questão oficial · ENEM 2023 · Q1')).toBeInTheDocument()
  expect(screen.getByText('1 de 2')).toBeInTheDocument()
})

it('opens on the questions when one was answered, and the Aula tab still shows the lesson', async () => {
  withLesson()
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1, answered), question(2)]))
  open()
  expect(await screen.findByText('Questão oficial · ENEM 2023 · Q2')).toBeInTheDocument()
  expect(tab('Questões')).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(tab('Aula'))
  expect(tab('Aula')).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: 'Questão resolvida' })).toBeInTheDocument()
  expect(screen.queryByText('Questão oficial · ENEM 2023 · Q2')).not.toBeInTheDocument()
  await userEvent.click(tab('Questões'))
  expect(screen.getByText('Questão oficial · ENEM 2023 · Q2')).toBeInTheDocument()
})

it('moves between the tabs with the arrow keys', async () => {
  withLesson()
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1)]))
  open()
  await screen.findByRole('heading', { name: 'O que cai' })
  tab('Aula').focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(tab('Questões')).toHaveAttribute('aria-selected', 'true')
  expect(tab('Questões')).toHaveFocus()
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tab('Questões').id)
})

it('shows no Aula tab for a topic without a lesson', async () => {
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1)]))
  open()
  expect(await screen.findByText('Questão oficial · ENEM 2023 · Q1')).toBeInTheDocument()
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Aula' })).not.toBeInTheDocument()
})

it('shows the questions and a retry notice when the lesson chunk fails', async () => {
  vi.mocked(loadLessons).mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module')).mockResolvedValueOnce(lessons({ funcoes: LESSON }))
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1)]))
  open()
  expect(await screen.findByText('Questão oficial · ENEM 2023 · Q1')).toBeInTheDocument()
  expect(tab('Questões')).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(tab('Aula'))
  expect(screen.getByRole('alert')).toHaveTextContent('Não deu pra carregar a aula.')
  await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByRole('heading', { name: 'O que cai' })).toBeInTheDocument()
  expect(loadLessons).toHaveBeenCalledTimes(2)
})

it('keeps the tabs and the practice button inside the study window', async () => {
  withLesson()
  vi.mocked(listTopicQuestions).mockResolvedValue(page([question(1)]))
  renderAt('/exams/enem/funcoes?embed=1', { user: 'ana', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { name: 'O que cai' })).toBeInTheDocument()
  expect(screen.queryByRole('banner')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Praticar questões' }))
  expect(screen.getByText('Questão oficial · ENEM 2023 · Q1')).toBeInTheDocument()
  expect(currentLocation()).toBe('/exams/enem/funcoes?embed=1')
})

it('says the questions are coming when the topic has a lesson but none yet', async () => {
  withLesson()
  vi.mocked(listTopicQuestions).mockResolvedValue(page([]))
  open()
  expect(await screen.findByRole('heading', { name: 'O que cai' })).toBeInTheDocument()
  await userEvent.click(tab('Questões'))
  expect(screen.getByText('Ainda não tem questões deste assunto. A aula já está aqui.')).toBeInTheDocument()
  expect(screen.queryByText('Você respondeu todas as questões deste assunto.')).not.toBeInTheDocument()
})
