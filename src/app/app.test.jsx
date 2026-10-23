import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { takeDraft } from '../lib/draft.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({ AuthError: class extends Error {}, listCases: vi.fn().mockResolvedValue([]) }))

const TAGLINE = 'Paste the error. Understand why. Practice so it never happens again.'

it('shows the brand and the tagline as the main heading', () => {
  renderAt('/')
  expect(within(screen.getByRole('banner')).getByText('Glitch Lab')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: TAGLINE })).toBeInTheDocument()
})

it('points every Try it link at the error form', () => {
  renderAt('/')
  const links = screen.getAllByRole('link', { name: /try it/i })
  expect(links.length).toBeGreaterThan(0)
  for (const link of links) expect(link).toHaveAttribute('href', '#try')
  expect(within(document.getElementById('try')).getByLabelText('Error message')).toBeInTheDocument()
})

it('explains the three parts in order', () => {
  renderAt('/')
  const steps = within(screen.getByRole('list', { name: 'How it works' })).getAllByRole('heading', { level: 3 })
  expect(steps.map((step) => step.textContent)).toEqual(['Investigate an error', 'Study your board', 'Train in the gym'])
})

it('offers sign in when signed out and the board when signed in', () => {
  const { unmount } = renderAt('/')
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  unmount()
  renderAt('/', { user: 'alice' })
  expect(screen.getByRole('link', { name: 'My board' })).toHaveAttribute('href', '/board')
})

it('keeps the pasted error and goes to the board', async () => {
  renderAt('/')
  await userEvent.type(screen.getByLabelText('Error message'), 'ReferenceError: x is not defined')
  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
  expect(currentLocation()).toBe('/login?next=%2Fboard')
  expect(takeDraft()).toEqual({ error: 'ReferenceError: x is not defined', code: '' })
})

it('presents the features, the comparison, bug types, ranks and answers', async () => {
  renderAt('/')
  const features = within(screen.getByRole('list', { name: 'Features' })).getAllByRole('heading', { level: 3 })
  expect(features).toHaveLength(8)
  expect(features.at(-1)).toHaveTextContent('A study trail made from your cases')
  expect(within(screen.getByRole('list', { name: 'A chatbot compared with Glitch Lab' })).getAllByRole('listitem').length).toBeGreaterThan(3)
  expect(within(screen.getByRole('list', { name: 'Bug types' })).getAllByRole('listitem')).toHaveLength(12)
  const ranks = within(screen.getByRole('list', { name: 'Detective ranks' })).getAllByRole('listitem')
  expect(ranks[0]).toHaveTextContent('Rookie')
  expect(ranks.at(-1)).toHaveTextContent('Bug Whisperer')

  const question = screen.getByRole('button', { name: 'Will it just give me the answer?' })
  expect(question).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(question)
  expect(question).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('region', { name: 'Will it just give me the answer?' })).toHaveTextContent('Only when you ask.')
  await userEvent.click(screen.getByRole('button', { name: 'Open all' }))
  expect(screen.getByRole('button', { name: 'Is my code safe?' })).toHaveAttribute('aria-expanded', 'true')
})

it('speaks Brazilian Portuguese on the landing page', async () => {
  renderAt('/', { locale: 'pt-BR' })
  expect(screen.getByRole('heading', { level: 1, name: 'Cole o erro. Entenda o porquê. Pratique para nunca mais errar igual.' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
  const steps = within(screen.getByRole('list', { name: 'Como funciona' })).getAllByRole('heading', { level: 3 })
  expect(steps.map((step) => step.textContent)).toEqual(['Investigue um erro', 'Estude seu board', 'Treine no gym'])
  expect(within(screen.getByRole('list', { name: 'Tipos de bug' })).getByText('Erro de um a mais')).toBeInTheDocument()
  const ranks = within(screen.getByRole('list', { name: 'Patentes de detetive' })).getAllByRole('listitem')
  expect(ranks.at(-1)).toHaveTextContent('Encantador de bugs')
  expect(screen.getByRole('heading', { name: 'De Novato a Encantador de bugs' })).toBeInTheDocument()
  expect(screen.getByText('user.name nunca foi definido. Ele é undefined, e undefined não tem .length para ler.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Abrir todas' }))
  expect(screen.getByRole('button', { name: 'Meu código está seguro?' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('Mensagem de erro')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Investigar' })).toBeDisabled()
})
