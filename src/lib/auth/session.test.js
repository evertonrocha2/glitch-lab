import { expect, it, vi } from 'vitest'
import { createSessionAuth } from './session.js'

vi.mock('../api.js', () => ({ signIn: vi.fn(), signUp: vi.fn(), startDemo: vi.fn() }))

const USER = { id: 'u1', email: 'ada@example.com', isDemo: false }
const tokenExpiringAt = (exp) => `${btoa(JSON.stringify({ sub: 'u1', exp })).replace(/=+$/, '')}.signature`

it('keeps a session that is still valid', async () => {
  const token = tokenExpiringAt(Date.now() + 60_000)
  localStorage.setItem('gd:session', JSON.stringify({ token, user: USER }))
  const auth = createSessionAuth()
  expect(auth.currentUser()).toEqual(USER)
  await expect(auth.getToken()).resolves.toBe(token)
})

it('drops a session whose token has expired', async () => {
  localStorage.setItem('gd:session', JSON.stringify({ token: tokenExpiringAt(Date.now() - 1), user: USER }))
  const auth = createSessionAuth()
  expect(auth.currentUser()).toBeNull()
  await expect(auth.getToken()).resolves.toBeNull()
})

it('signs out', async () => {
  localStorage.setItem('gd:session', JSON.stringify({ token: tokenExpiringAt(Date.now() + 60_000), user: USER }))
  const auth = createSessionAuth()
  const seen = vi.fn()
  auth.subscribe(seen)
  await auth.signOut()
  expect(seen).toHaveBeenCalledWith(null)
  expect(auth.currentUser()).toBeNull()
})
