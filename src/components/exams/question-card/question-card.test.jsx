import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import QuestionCard from './question-card.jsx'

const QUESTION = {
  id: 'q1',
  year: 2023,
  number: 136,
  area: 'matematica',
  topic: 'geometria-espacial',
  context: 'Um artista esculpe um cone.',
  statement: 'O volume final é',
  alternatives: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: `opção ${letter}`, image: null })),
  attempt: null,
}

const show = (question, onAnswer = vi.fn()) => {
  render(
    <I18nProvider locale="pt-BR">
      <QuestionCard question={question} onAnswer={onAnswer} />
    </I18nProvider>,
  )
  return onAnswer
}

const option = (letter) => screen.getByRole('button', { name: new RegExp(`^${letter}\\b`) })

it('shows where the question comes from', () => {
  show(QUESTION)
  expect(screen.getByText('Questão oficial · ENEM 2023 · Q136')).toBeInTheDocument()
  expect(screen.getByText('Um artista esculpe um cone.')).toBeInTheDocument()
  expect(screen.getByText('O volume final é')).toBeInTheDocument()
})

it('answers only after picking, once', async () => {
  let finish
  const onAnswer = show(QUESTION, vi.fn(() => new Promise((done) => (finish = done))))
  const submit = screen.getByRole('button', { name: 'Responder' })
  expect(submit).toBeDisabled()
  await userEvent.click(option('B'))
  expect(option('B')).toHaveAttribute('aria-pressed', 'true')
  expect(submit).toBeEnabled()
  await userEvent.click(submit)
  await userEvent.click(submit)
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith('B')
  finish()
})

it('shows the result of an answered question', () => {
  show({ ...QUESTION, attempt: { choice: 'C', correct: false, answer: 'B' } })
  expect(screen.getByText('Não foi dessa vez. A resposta é a B.')).toBeInTheDocument()
  expect(within(option('B')).getByText('gabarito')).toBeInTheDocument()
  expect(within(option('C')).getByText('sua resposta')).toBeInTheDocument()
  for (const letter of ['A', 'B', 'C', 'D', 'E']) expect(option(letter)).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
})

it('celebrates a right answer', () => {
  show({ ...QUESTION, attempt: { choice: 'B', correct: true, answer: 'B' } })
  expect(screen.getByText('Acertou!')).toBeInTheDocument()
})

it('renders question text safely', () => {
  show({ ...QUESTION, context: '<b>x</b>\n\n![mapa](https://enem.dev/a.png)' })
  expect(screen.getByText('<b>x</b>')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'mapa' })).toHaveAttribute('src', 'https://enem.dev/a.png')
})

it('shows an alternative that is an image', () => {
  const alternatives = QUESTION.alternatives.map((item) => (item.letter === 'D' ? { ...item, text: '', image: 'https://enem.dev/d.png' } : item))
  show({ ...QUESTION, alternatives })
  expect(within(option('D')).getByRole('img')).toHaveAttribute('src', 'https://enem.dev/d.png')
})
