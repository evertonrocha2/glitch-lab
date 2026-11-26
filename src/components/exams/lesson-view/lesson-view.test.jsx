import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import LessonView from './lesson-view.jsx'

const LESSON = {
  topic: 'funcoes',
  title: 'Funções',
  cai: 'O ENEM pede para ler gráficos. Também pede a lei de uma função.',
  ideias: ['Uma função liga x a um só y.', 'f(x) = ax + b é uma **reta**.', 'a é a taxa de variação.', 'b corta o eixo y.', 'x² cresce mais rápido.'],
  exemplo: {
    year: 2021,
    number: 140,
    enunciado: 'Um táxi cobra R$ 5 fixos e R$ 2 por km.\n\nQuanto custa uma corrida de 10 km?',
    alternativas: { A: 'R$ 20', B: 'R$ 25', C: 'R$ 30', D: 'R$ 35', E: 'R$ 40' },
    passos: ['A lei é f(x) = 2x + 5.', 'f(10) = 2 · 10 + 5.', 'f(10) = 25, letra B.'],
    resposta: 'B',
  },
  pegadinhas: ['Esquecer a parte fixa.', 'Trocar a com b.', 'Ler o gráfico pelo eixo errado.'],
}

const show = (onPractice = vi.fn()) => {
  render(
    <I18nProvider locale="pt-BR">
      <LessonView lesson={LESSON} onPractice={onPractice} />
    </I18nProvider>,
  )
  return onPractice
}

const section = (name) => screen.getByRole('heading', { name }).closest('section')

it('shows the four parts in order, each under its heading', () => {
  show()
  const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  expect(headings).toEqual(['O que cai', 'Ideias principais', 'Questão resolvida', 'Pegadinhas'])
  expect(within(section('O que cai')).getByText(LESSON.cai)).toBeInTheDocument()
  expect(within(section('Ideias principais')).getAllByRole('listitem')).toHaveLength(5)
  expect(within(section('Pegadinhas')).getAllByRole('listitem')).toHaveLength(3)
  expect(within(section('Pegadinhas')).getByText('Trocar a com b.')).toBeInTheDocument()
})

it('renders bold from the text as bold, never as asterisks', () => {
  show()
  const bold = screen.getByText('reta')
  expect(bold).toHaveClass('font-semibold')
  expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument()
})

it('shows the solved question with its source, five alternatives, the steps and then the answer', () => {
  show()
  const example = section('Questão resolvida')
  expect(within(example).getByText('ENEM 2021, questão 140')).toBeInTheDocument()
  expect(within(example).getByText('Quanto custa uma corrida de 10 km?')).toBeInTheDocument()
  const options = within(within(example).getByRole('list', { name: 'Alternativas' })).getAllByRole('listitem')
  expect(options.map((item) => item.textContent)).toEqual(['AR$ 20', 'BR$ 25', 'CR$ 30', 'DR$ 35', 'ER$ 40'])
  const steps = within(within(example).getByRole('list', { name: 'Passo a passo' })).getAllByRole('listitem')
  expect(steps).toHaveLength(3)
  const answer = within(example).getByText('Resposta: B')
  expect(answer.closest('p')).toHaveTextContent('Resposta: B R$ 25')
  // The answer comes after the last step.
  expect(steps[2].compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('sends the student to the questions', async () => {
  const onPractice = show()
  await userEvent.click(screen.getByRole('button', { name: 'Praticar questões' }))
  expect(onPractice).toHaveBeenCalledOnce()
})
