// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { userFromHeader } from '../../server/core/middlewares/auth.js'
import { createToken } from '../../server/infra/security/session.js'
import { api, useTempStore } from './helpers.js'

const bearer = (token) => (token ? `Bearer ${token}` : undefined)

beforeEach(async () => {
  await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

it('accepts a signed session', () => {
  const token = createToken({ id: 'u1', email: 'ada@example.com', isDemo: false })
  expect(userFromHeader(bearer(token))).toEqual({ id: 'u1', email: 'ada@example.com', isDemo: false })
})

it('marks demo sessions', () => {
  const token = createToken({ id: 'd1', email: 'demo-1@demo.glitch', isDemo: true })
  expect(userFromHeader(bearer(token)).isDemo).toBe(true)
})

it('rejects a missing, made-up or old dev token', () => {
  expect(userFromHeader(bearer())).toBeNull()
  expect(userFromHeader(bearer('dev:alice'))).toBeNull()
  expect(userFromHeader(bearer('abc.def'))).toBeNull()
})

it('requireAuth answers 401 without a valid session', async () => {
  const res = await api('/api/cases', { method: 'GET', token: 'not.valid' })
  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ message: 'Sign in to continue.' })
  const token = createToken({ id: 'u1', email: 'ada@example.com', isDemo: false })
  expect((await api('/api/cases', { method: 'GET', token })).status).toBe(200)
})
