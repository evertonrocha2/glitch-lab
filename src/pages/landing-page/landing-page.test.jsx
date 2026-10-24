import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentLocation, renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  listCases: vi.fn().mockResolvedValue([]),
  listNotes: vi.fn().mockResolvedValue([]),
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

const hero = () => screen.getByRole('heading', { level: 1 }).closest('section')
const header = () => screen.getAllByRole('banner')[0]

it('sends "Create a free account" to the login page on sign up', async () => {
  renderAt('/')
  await userEvent.click(within(hero()).getByRole('link', { name: 'Create a free account' }))
  expect(currentLocation()).toBe('/login?mode=signup')
  expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
})

it('sends "Sign in" to the login page on sign in', async () => {
  renderAt('/')
  await userEvent.click(within(hero()).getByRole('link', { name: 'Sign in' }))
  expect(currentLocation()).toBe('/login')
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
})

it('has "Create account" in the header, going to sign up', async () => {
  renderAt('/')
  await userEvent.click(within(header()).getByRole('link', { name: 'Create account' }))
  expect(currentLocation()).toBe('/login?mode=signup')
})

it('takes a signed-in person to their board instead', () => {
  renderAt('/', { user: 'alice' })
  expect(within(hero()).getByRole('link', { name: 'My board' })).toHaveAttribute('href', '/board')
  expect(screen.queryByRole('link', { name: /create/i })).not.toBeInTheDocument()
})

it('speaks Brazilian Portuguese', () => {
  renderAt('/', { locale: 'pt-BR' })
  expect(within(hero()).getByRole('link', { name: 'Criar conta grátis' })).toHaveAttribute('href', '/login?mode=signup')
  expect(within(hero()).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
  expect(within(header()).getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/login?mode=signup')
  expect(screen.getByText('Sim, para manter um board: cadastre-se de graça com e-mail e senha.')).toBeInTheDocument()
})

// The landing never offers the demo, whatever the build: it only lives on the login page in development.
describe.each([
  ['development', () => {}],
  [
    'a production build',
    () => {
      vi.stubEnv('DEV', false)
      vi.stubEnv('VITE_DEMO_LOGIN', '')
    },
  ],
])('in %s', (_name, setup) => {
  it.each(['en', 'pt-BR'])('shows the account links and no demo (%s)', (locale) => {
    setup()
    renderAt('/', { locale })
    expect(within(hero()).getAllByRole('link')).toHaveLength(2)
    expect(within(hero()).getAllByRole('link')[0]).toHaveAttribute('href', '/login?mode=signup')
    expect(document.body).not.toHaveTextContent(/demo/i)
  })
})
