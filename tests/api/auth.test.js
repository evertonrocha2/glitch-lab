// @vitest-environment node
import { expect, it } from 'vitest'
import { getUser } from '../../api/_lib/auth.js'
import { createToken } from '../../api/_lib/auth/session.js'
import { requireUser } from '../../api/_lib/http.js'

const withToken = (token) =>
  new Request('http://localhost/api/cases', { headers: token ? { Authorization: `Bearer ${token}` } : {} })

it('accepts a signed session', async () => {
  const token = createToken({ id: 'u1', email: 'ada@example.com', isDemo: false })
  expect(await getUser(withToken(token))).toEqual({ id: 'u1', email: 'ada@example.com', isDemo: false })
})

it('marks demo sessions', async () => {
  const token = createToken({ id: 'd1', email: 'demo-1@demo.glitch', isDemo: true })
  expect((await getUser(withToken(token))).isDemo).toBe(true)
})

it('rejects a missing, made-up or old dev token', async () => {
  expect(await getUser(withToken())).toBeNull()
  expect(await getUser(withToken('dev:alice'))).toBeNull()
  expect(await getUser(withToken('abc.def'))).toBeNull()
})

it('requireUser answers 401 without a valid session', async () => {
  const result = await requireUser(withToken('dev:alice'))
  expect(result.response.status).toBe(401)
  expect(await result.response.json()).toEqual({ message: 'Sign in to continue.' })
  const token = createToken({ id: 'u1', email: 'ada@example.com', isDemo: false })
  expect((await requireUser(withToken(token))).user.id).toBe('u1')
})
