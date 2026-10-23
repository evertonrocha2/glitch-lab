import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import ErrorForm from './error-form.jsx'

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
  // The editor indents after "def f():" and keeps the indent on the next line, as in VS Code.
  await userEvent.type(screen.getByLabelText('Code (optional)'), 'def f():{enter}return 1{enter}')
  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
  expect(onSubmit).toHaveBeenCalledWith({ error: 'IndentationError', code: 'def f():\n    return 1\n    ' })
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

it('fills both fields when an example is picked', async () => {
  render(<ErrorForm onSubmit={vi.fn()} loading={false} />)
  await userEvent.click(screen.getByRole('button', { name: 'Python: IndexError' }))
  expect(screen.getByLabelText('Error message')).toHaveValue('IndexError: list index out of range')
  expect(screen.getByLabelText('Code (optional)')).toHaveValue('nums = [10, 20, 30]\nprint(nums[3])')
})

it('starts with the initial values', () => {
  render(<ErrorForm onSubmit={vi.fn()} loading={false} initialError="KeyError: 'email'" initialCode="user['email']" />)
  expect(screen.getByLabelText('Error message')).toHaveValue("KeyError: 'email'")
  expect(screen.getByLabelText('Code (optional)')).toHaveValue("user['email']")
})

it('scans the error as I type', async () => {
  render(<ErrorForm onSubmit={vi.fn()} loading={false} />)
  await userEvent.type(screen.getByLabelText('Error message'), 'IndexError: list index out of range')
  expect(screen.getByText('IndexError')).toBeInTheDocument()
  expect(screen.getByText('python')).toBeInTheDocument()
})

it('attaches a file the error mentions, ticks it and sends it with the context', async () => {
  const onSubmit = vi.fn()
  render(<ErrorForm onSubmit={onSubmit} loading={false} />)
  await userEvent.click(screen.getByRole('button', { name: 'JS: TypeError' }))
  await userEvent.clear(screen.getByLabelText('Error message'))
  await userEvent.type(screen.getByLabelText('Error message'), 'TypeError: boom at run (src/cart.js:2:5)')
  await userEvent.type(screen.getByLabelText('What were you trying to do? (optional)'), 'Show the name')
  const cart = new File(['const user = {}\nuser.name.length'], 'cart.js', { type: 'text/javascript' })
  Object.defineProperty(cart, 'webkitRelativePath', { value: 'shop/src/cart.js' })
  const readme = new File(['# hi'], 'README.md')
  await userEvent.upload(screen.getByLabelText('Upload a folder'), [cart, readme])

  expect(await screen.findByRole('checkbox', { name: 'Send shop/src/cart.js' })).toBeChecked()
  expect(screen.getByText('Error · Line 2')).toBeInTheDocument()
  expect(screen.getByText(/1 skipped/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Investigate' }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      context: 'Show the name',
      files: [{ path: 'shop/src/cart.js', content: 'const user = {}\nuser.name.length' }],
    }),
  )
})

it('speaks Brazilian Portuguese inside the provider, scan and attachments included', async () => {
  render(
    <I18nProvider locale="pt-BR">
      <ErrorForm onSubmit={vi.fn()} loading={false} />
    </I18nProvider>,
  )
  expect(screen.getByLabelText('Código (opcional)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar uma pasta' })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Mensagem de erro'), 'oops')
  expect(screen.getByText('Nenhum tipo de erro encontrado ainda. Cole a mensagem inteira.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Investigar' })).toBeEnabled()
})
