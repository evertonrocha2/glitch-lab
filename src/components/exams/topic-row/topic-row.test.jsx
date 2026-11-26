import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import TopicRow from './topic-row.jsx'

const topic = (stats = {}) => ({ id: 'funcoes', name: 'Funções', questions: 30, answered: 4, correct: 3, ...stats })

const show = (props) =>
  render(
    <I18nProvider locale="pt-BR">
      <MemoryRouter>
        <ul>
          <TopicRow examId="enem" {...props} />
        </ul>
      </MemoryRouter>
    </I18nProvider>,
  )

it('shows the lesson badge when the topic has a lesson', () => {
  show({ topic: topic(), lesson: true })
  const link = screen.getByRole('link', { name: /Funções/ })
  expect(within(link).getByText('Aula')).toBeInTheDocument()
  expect(within(link).getByText('3 de 4 certas · 30 questões')).toBeInTheDocument()
})

it('shows no badge without a lesson', () => {
  show({ topic: topic() })
  expect(within(screen.getByRole('link', { name: /Funções/ })).queryByText('Aula')).not.toBeInTheDocument()
})

it('links a topic with a lesson but no questions yet', () => {
  show({ topic: topic({ questions: 0, answered: 0, correct: 0 }), lesson: true })
  const link = screen.getByRole('link', { name: /Funções/ })
  expect(link).toHaveAttribute('href', '/exams/enem/funcoes')
  expect(within(link).getByText('questões em breve')).toBeInTheDocument()
  expect(within(link).getByText('Aula')).toBeInTheDocument()
})

it('keeps a topic with neither as coming soon', () => {
  show({ topic: topic({ questions: 0 }) })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('em breve')).toBeInTheDocument()
})
