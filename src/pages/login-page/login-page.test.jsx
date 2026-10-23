import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { signIn, signUp, startDemo } from '../../lib/api.js'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  listCases: vi.fn().mockResolvedValue([]),
  listNotes: vi.fn().mockResolvedValue([]),
  signIn: vi.fn(),
  signUp: vi.fn(),
  startDemo: vi.fn(),
}))

const SESSION = { token: 'signed-token', user: { id: 'u1', email: 'ada@example.com', isDemo: false } }

beforeEach(() => {
  vi.mocked(signIn).mockReset()
  vi.mocked(signUp).mockReset()
  vi.mocked(startDemo).mockReset().mockResolvedValue({ ...SESSION, user: { ...SESSION.user, isDemo: true } })
})

async function fillIn(email, password) {
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
}

it('signs in with email and password and goes where I was headed', async () => {
  vi.mocked(signIn).mockResolvedValue(SESSION)
  renderAt('/login?next=/gym/abc')
  await fillIn('ada@example.com', 'correct horse')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await waitFor(() => expect(currentLocation()).toBe('/gym/abc'))
  expect(signIn).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse' })
})

it('shows the message when the password is wrong', async () => {
  vi.mocked(signIn).mockRejectedValue(new Error('Wrong email or password.'))
  renderAt('/login')
  await fillIn('ada@example.com', 'wrong horse')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
  expect(currentLocation()).toBe('/login')
})

it('creates an account', async () => {
  vi.mocked(signUp).mockResolvedValue(SESSION)
  renderAt('/login')
  await userEvent.click(screen.getByRole('button', { name: 'Create an account' }))
  await fillIn('ada@example.com', 'correct horse')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await waitFor(() => expect(currentLocation()).toBe('/board'))
  expect(signUp).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse' })
})

it('keeps me signed in after a reload', async () => {
  vi.mocked(signIn).mockResolvedValue(SESSION)
  const { unmount } = renderAt('/login')
  await fillIn('ada@example.com', 'correct horse')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await waitFor(() => expect(currentLocation()).toBe('/board'))
  unmount()
  renderAt('/board')
  expect(currentLocation()).toBe('/board')
})

it('goes to next after the demo login', async () => {
  renderAt('/login?next=/gym/abc')
  await userEvent.click(screen.getByRole('button', { name: 'Use demo account' }))
  await waitFor(() => expect(currentLocation()).toBe('/gym/abc'))
  expect(startDemo).toHaveBeenCalled()
})

it('ignores a next that would leave the site', async () => {
  renderAt('/login?next=//evil.example')
  await userEvent.click(screen.getByRole('button', { name: 'Use demo account' }))
  await waitFor(() => expect(currentLocation()).toBe('/board'))
})

it('speaks Brazilian Portuguese', () => {
  renderAt('/login', { locale: 'pt-BR' })
  expect(screen.getByRole('heading', { level: 1, name: 'Entre no seu board de casos' })).toBeInTheDocument()
  expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
  expect(screen.getByLabelText('Senha')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Usar conta demo' })).toBeInTheDocument()
})
