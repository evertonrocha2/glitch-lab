// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { hashPassword, verifyPassword } from '../../server/infra/security/password.js'
import { createToken, SESSION_DAYS, verifyToken } from '../../server/infra/security/session.js'
import { credentialsProblem } from '../../server/modules/auth/credentials.js'

const ALICE = { id: 'alice', email: 'alice@test.dev', isDemo: false }

afterEach(() => {
  vi.unstubAllEnvs()
})

it('hashes a password so it can be checked but not read back', async () => {
  const stored = await hashPassword('correct horse battery')
  expect(stored).not.toContain('correct horse battery')
  expect(await verifyPassword('correct horse battery', stored)).toBe(true)
  expect(await verifyPassword('wrong password', stored)).toBe(false)
})

it('salts every hash differently', async () => {
  expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'))
})

it('rejects a missing or broken stored hash', async () => {
  expect(await verifyPassword('anything', null)).toBe(false)
  expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
})

it('signs a session the server can read back', () => {
  expect(verifyToken(createToken(ALICE))).toEqual(ALICE)
})

it('rejects a tampered session', () => {
  const token = createToken(ALICE)
  const [payload, signature] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: 'bob' })).toString('base64url')
  expect(verifyToken(`${forged}.${signature}`)).toBeNull()
  expect(verifyToken('garbage')).toBeNull()
  expect(verifyToken('')).toBeNull()
})

it('rejects an expired session', () => {
  const issued = new Date('2026-10-01T00:00:00Z')
  const token = createToken(ALICE, issued)
  const afterExpiry = new Date(issued.getTime() + (SESSION_DAYS * 24 + 1) * 3_600_000)
  expect(verifyToken(token, afterExpiry)).toBeNull()
})

it('rejects a session signed with another secret', () => {
  vi.stubEnv('AUTH_SECRET', 'one-secret')
  const token = createToken(ALICE)
  vi.stubEnv('AUTH_SECRET', 'another-secret')
  expect(verifyToken(token)).toBeNull()
})

it('refuses to sign sessions in production without a secret', () => {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('AUTH_SECRET', '')
  expect(() => createToken(ALICE)).toThrow(/AUTH_SECRET/)
})

it("won't let anyone sign up with the app's own demo or sample domains", () => {
  expect(credentialsProblem({ email: 'team@sample.glitch', password: 'correct horse' })).toBe('Enter a valid email.')
  expect(credentialsProblem({ email: 'x@DEMO.glitch', password: 'correct horse' })).toBe('Enter a valid email.')
})
