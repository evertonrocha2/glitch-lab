import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import ErrorForm from './ErrorForm.jsx'

it('disables Investigate until an error is typed', async () => {
  render(<ErrorForm onSubmit={vi.fn()} loading={false} />)
  const button = screen.getByRole('button', { name: 'Investigate' })
  expect(button).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Error message'), '   ')
  expect(button).toBeDisabled()
})

it('submits the error trimmed and the code untouched', async () => {
  const onSubmit = vi.fn()
  render(<ErrorForm onSubmit={onSubmit} loading={false} />)
  await userEvent.type(screen.getByLabelText('Error message'), '  IndentationError  ')
  await userEvent.type(screen.getByLabelText('Code (optional)'), 'def f():{enter}    return 1{enter}')
  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
  expect(onSubmit).toHaveBeenCalledWith({ error: 'IndentationError', code: 'def f():\n    return 1\n' })
})

it('shows Investigating... and blocks resubmits while loading', () => {
  render(<ErrorForm onSubmit={vi.fn()} loading />)
  expect(screen.getByRole('button', { name: 'Investigating...' })).toBeDisabled()
})

it('caps both fields at the shared limits', () => {
  render(<ErrorForm onSubmit={vi.fn()} loading={false} />)
  expect(screen.getByLabelText('Error message')).toHaveAttribute('maxlength', '2000')
  expect(screen.getByLabelText('Code (optional)')).toHaveAttribute('maxlength', '6000')
})
