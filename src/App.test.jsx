import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App.jsx'

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
