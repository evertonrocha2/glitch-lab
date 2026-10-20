import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import ResultCards from './ResultCards.jsx'

const analysis = {
  explicacao: 'You read .length of something that does not exist.',
  causa: 'user.name was never set, so it is undefined.',
  correcao: 'if (user.name) console.log(user.name.length)',
  exercicio: { enunciado: 'const a = {}\nconsole.log(a.b.c)', resposta: 'a.b is undefined, so check it first.' },
}

it('shows the three cards', () => {
  render(<ResultCards analysis={analysis} />)
  for (const name of ['What happened', 'Why it broke', 'Practice']) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
  }
  expect(screen.getByText(analysis.explicacao)).toBeInTheDocument()
  expect(screen.getByText(analysis.causa)).toBeInTheDocument()
})

it('hides the fix until Show fix is clicked', async () => {
  render(<ResultCards analysis={analysis} />)
  expect(screen.queryByText(analysis.correcao)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Show fix' }))
  expect(screen.getByText(analysis.correcao)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hide fix' })).toBeInTheDocument()
})

it('hides the answer until Show answer is clicked', async () => {
  render(<ResultCards analysis={analysis} />)
  expect(screen.queryByText(analysis.exercicio.resposta)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Show answer' }))
  expect(screen.getByText(analysis.exercicio.resposta)).toBeInTheDocument()
})

it('renders HTML from the AI as plain text', () => {
  const evil = '<img src=x onerror=alert(1)>'
  const { container } = render(<ResultCards analysis={{ ...analysis, explicacao: evil }} />)
  expect(screen.getByText(evil)).toBeInTheDocument()
  expect(container.querySelector('img')).toBeNull()
})
