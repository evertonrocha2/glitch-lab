// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET as listCases } from '../../api/cases.js'
import { POST as auth } from '../../api/auth.js'
import { POST as demo } from '../../api/_lib/handlers/demo.js'
import { POST as login } from '../../api/_lib/handlers/login.js'
import { POST as register } from '../../api/_lib/handlers/register.js'
import { apiRequest, useTempStore } from './helpers.js'

const send = (handler, path, body) => handler(apiRequest(path, { body, token: null }))
const signUp = (body) => send(register, '/api/register', body)
const signIn = (body) => send(login, '/api/login', body)
const casesWith = (token) => listCases(apiRequest('/api/cases', { method: 'GET', token }))

let store

beforeEach(async () => {
  store = await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

it('creates an account and signs it in', async () => {
  const res = await signUp({ email: 'Ada@Example.com', password: 'correct horse' })
  expect(res.status).toBe(201)
  const { token, user } = await res.json()
  expect(user).toEqual({ id: expect.any(String), email: 'ada@example.com', isDemo: false })
  expect((await casesWith(token)).status).toBe(200)
})

it('never stores the password itself', async () => {
  await signUp({ email: 'ada@example.com', password: 'correct horse' })
  const saved = await store.findUserByEmail('ada@example.com')
  expect(saved.passwordHash).toMatch(/^scrypt\$/)
  expect(saved.passwordHash).not.toContain('correct horse')
})

it('refuses an email that already has an account', async () => {
  await signUp({ email: 'ada@example.com', password: 'correct horse' })
  const res = await signUp({ email: 'ADA@example.com', password: 'another one' })
  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ message: 'An account with this email already exists. Sign in instead.' })
})

it('asks for a real email and a long enough password', async () => {
  const badEmail = await signUp({ email: 'not-an-email', password: 'correct horse' })
  expect(badEmail.status).toBe(400)
  expect(await badEmail.json()).toEqual({ message: 'Enter a valid email.' })
  const shortPassword = await signUp({ email: 'ada@example.com', password: 'short' })
  expect(shortPassword.status).toBe(400)
  expect(await shortPassword.json()).toEqual({ message: 'Use a password with at least 8 characters.' })
})

it('signs in with the right password, in any email case', async () => {
  await signUp({ email: 'ada@example.com', password: 'correct horse' })
  const res = await signIn({ email: ' ADA@example.com ', password: 'correct horse' })
  expect(res.status).toBe(200)
  const { token, user } = await res.json()
  expect(user.email).toBe('ada@example.com')
  expect((await casesWith(token)).status).toBe(200)
})

it('says the same thing for a wrong password and an unknown email', async () => {
  await signUp({ email: 'ada@example.com', password: 'correct horse' })
  for (const attempt of [
    { email: 'ada@example.com', password: 'wrong horse' },
    { email: 'nobody@example.com', password: 'correct horse' },
  ]) {
    const res = await signIn(attempt)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'Wrong email or password.' })
  }
})

it('locks an email after too many wrong passwords', async () => {
  await signUp({ email: 'ada@example.com', password: 'correct horse' })
  for (let i = 0; i < 10; i++) await signIn({ email: 'ada@example.com', password: `guess ${i}` })
  const res = await signIn({ email: 'ada@example.com', password: 'correct horse' })
  expect(res.status).toBe(429)
  expect(await res.json()).toEqual({ message: 'Too many wrong passwords for this email. Try again tomorrow.' })
})

it('gives each demo visitor their own seeded account', async () => {
  const first = await (await demo(apiRequest('/api/demo', { token: null }))).json()
  const second = await (await demo(apiRequest('/api/demo', { token: null }))).json()
  expect(first.user.isDemo).toBe(true)
  expect(first.user.id).not.toBe(second.user.id)
  const { cases } = await (await casesWith(first.token)).json()
  expect(cases.map((item) => item.status).sort()).toEqual(['new', 'new', 'solved', 'training'])
})

it('does not let anyone sign in to a demo account with a password', async () => {
  const { user } = await (await demo(apiRequest('/api/demo', { token: null }))).json()
  expect((await signIn({ email: user.email, password: 'anything at all' })).status).toBe(401)
})

it("lines the demo's study streak up with the visitor's own date", async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T01:30:00Z'))
  try {
    // 22:30 on the 22nd in Brazil, already the 23rd in UTC.
    const { user } = await (await send(demo, '/api/demo', { today: '2026-10-22' })).json()
    // The last three study days run up to yesterday on the visitor's clock (older history comes before).
    expect((await store.listStudyTime(user.id)).map((entry) => entry.day).slice(-3)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21'])
    const fallback = await (await send(demo, '/api/demo', { today: 'yesterday' })).json()
    expect((await store.listStudyTime(fallback.user.id)).at(-1).day).toBe('2026-10-22')
  } finally {
    vi.useRealTimers()
  }
})

it('routes sign in, sign up and demo through one auth function', async () => {
  const call = (action, body) => auth(apiRequest(`/api/auth?action=${action}`, { body, token: null }))
  expect((await call('register', { email: 'one@example.com', password: 'correct horse' })).status).toBe(201)
  expect((await call('login', { email: 'one@example.com', password: 'correct horse' })).status).toBe(200)
  expect((await call('demo', {})).status).toBe(201)
  expect((await call('nope', {})).status).toBe(404)
})
