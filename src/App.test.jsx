import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App.jsx'

it('shows the app name and tagline', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1, name: 'Glitch Detective' })).toBeInTheDocument()
  expect(
    screen.getByText('Paste the error. Understand why. Practice so it never happens again.'),
  ).toBeInTheDocument()
})

it('shows the error form', () => {
  render(<App />)
  expect(screen.getByLabelText('Error message')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Investigate' })).toBeInTheDocument()
})
