import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { analyzeError } from './lib/analyzeError.js'

vi.mock('./lib/analyzeError.js', () => ({ analyzeError: vi.fn() }))

const analysis = {
  explicacao: 'x was used before it existed.',
  causa: 'Variables must be declared before use.',
  correcao: 'let x = 1',
  exercicio: { enunciado: 'console.log(y)', resposta: 'Declare y first.' },
}

beforeEach(() => {
  analyzeError.mockReset()
})

async function investigate(error) {
  await userEvent.type(screen.getByLabelText('Error message'), error)
  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
}

const TAGLINE = 'Paste the error. Understand why. Practice so it never happens again.'

it('shows the brand and the tagline as the main heading', () => {
  render(<App />)
  expect(within(screen.getByRole('banner')).getByText('Glitch Detective')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: TAGLINE })).toBeInTheDocument()
})

it('points every Try it link at the error form', () => {
  render(<App />)
  const links = screen.getAllByRole('link', { name: /try it/i })
  expect(links.length).toBeGreaterThan(0)
  for (const link of links) expect(link).toHaveAttribute('href', '#try')
  expect(within(document.getElementById('try')).getByLabelText('Error message')).toBeInTheDocument()
})

it('explains the three steps in order', () => {
  render(<App />)
  const steps = within(screen.getByRole('list', { name: 'How it works' })).getAllByRole('heading', { level: 3 })
  expect(steps.map((step) => step.textContent)).toEqual(['Paste the error', 'Read the why', 'Practice on a tiny bug'])
})

it('shows the error form', () => {
  render(<App />)
  expect(screen.getByLabelText('Error message')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Investigate' })).toBeInTheDocument()
})

it('shows the cards after a successful investigation', async () => {
  analyzeError.mockResolvedValue(analysis)
  render(<App />)
  await investigate('ReferenceError: x is not defined')
  expect(await screen.findByRole('heading', { name: 'What happened' })).toBeInTheDocument()
  expect(analyzeError).toHaveBeenCalledWith({ error: 'ReferenceError: x is not defined', code: '' })
})

it('shows the server message when it fails', async () => {
  analyzeError.mockRejectedValue(new Error('The AI is busy right now. Try again in a minute.'))
  render(<App />)
  await investigate('ReferenceError: x is not defined')
  expect(await screen.findByRole('alert')).toHaveTextContent('The AI is busy right now. Try again in a minute.')
})

it('closes the answer again for a new analysis', async () => {
  analyzeError.mockResolvedValue(analysis)
  render(<App />)
  await investigate('ReferenceError: x is not defined')
  await userEvent.click(await screen.findByRole('button', { name: 'Show answer' }))
  expect(screen.getByText(analysis.exercicio.resposta)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
  expect(await screen.findByRole('button', { name: 'Show answer' })).toBeInTheDocument()
  expect(screen.queryByText(analysis.exercicio.resposta)).not.toBeInTheDocument()
})
