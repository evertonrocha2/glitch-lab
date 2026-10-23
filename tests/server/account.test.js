// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SIGNUP_LIMITS } from '../../server/modules/auth/credentials.js'
import { api, useTempStore } from './helpers.js'

const send = (path, body, options = {}) => api(path, { body, token: null, ...options })
const signUp = (body) => send('/api/auth/register', body)
const signIn = (body) => send('/api/auth/login', body)
const demo = (body, options) => send('/api/auth/demo', body, options)
const casesWith = (token) => api('/api/cases', { method: 'GET', token })

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

it('lets no more than the limit of guesses through when they arrive all at once', async () => {
  await signUp({ email: 'ada@example.com', password: 'correct horse' })
  const answers = await Promise.all(Array.from({ length: 30 }, (_, i) => signIn({ email: 'ada@example.com', password: `guess ${i}` })))
  expect(answers.filter((res) => res.status === 401)).toHaveLength(10)
  expect(answers.filter((res) => res.status === 429)).toHaveLength(20)
})

it('limits new accounts and demos from one network', async () => {
  for (let i = 0; i < SIGNUP_LIMITS.perNetwork; i++) expect((await signUp({ email: `user${i}@example.com`, password: 'correct horse' })).status).toBe(201)
  const refused = await signUp({ email: 'one-more@example.com', password: 'correct horse' })
  expect(refused.status).toBe(429)
  expect(await refused.json()).toEqual({ message: 'Too many tries from your network today. Try again tomorrow.' })
  for (let i = 0; i < SIGNUP_LIMITS.demosPerNetwork; i++) expect((await demo()).status).toBe(201)
  expect((await demo()).status).toBe(429)
}, 30_000)

it('gives each demo visitor their own seeded account', async () => {
  const first = await (await demo()).json()
  const second = await (await demo()).json()
  expect(first.user.isDemo).toBe(true)
  expect(first.user.id).not.toBe(second.user.id)
  const { cases } = await (await casesWith(first.token)).json()
  expect(cases.map((item) => item.status).sort()).toEqual(['new', 'new', 'solved', 'training'])
})

it('does not let anyone sign in to a demo account with a password', async () => {
  const { user } = await (await demo()).json()
  expect((await signIn({ email: user.email, password: 'anything at all' })).status).toBe(401)
})

it("lines the demo's study streak up with the visitor's own date", async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T01:30:00Z'))
  try {
    // 22:30 on the 22nd in Brazil, already the 23rd in UTC.
    const { user } = await (await demo({ today: '2026-10-22' })).json()
    // The last three study days run up to yesterday on the visitor's clock (older history comes before).
    expect((await store.listStudyTime(user.id)).map((entry) => entry.day).slice(-3)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21'])
    const fallback = await (await demo({ today: 'yesterday' })).json()
    expect((await store.listStudyTime(fallback.user.id)).at(-1).day).toBe('2026-10-22')
  } finally {
    vi.useRealTimers()
  }
})

it('routes sign in, sign up and demo under /api/auth', async () => {
  const call = (action, body) => send(`/api/auth/${action}`, body)
  expect((await call('register', { email: 'one@example.com', password: 'correct horse' })).status).toBe(201)
  expect((await call('login', { email: 'one@example.com', password: 'correct horse' })).status).toBe(200)
  expect((await call('demo', {})).status).toBe(201)
  const unknown = await call('nope', {})
  expect(unknown.status).toBe(404)
  expect(await unknown.json()).toEqual({ message: 'Not found.' })
})

it("seeds the demo in the visitor's language", async () => {
  const { token } = await (await demo({}, { locale: 'pt-BR' })).json()
  const { cases } = await (await casesWith(token)).json()
  expect(cases.find((item) => item.concept === 'index-out-of-range').analysis.explicacao).toBe(
    'Você pediu a posição 3 de uma lista que só tem as posições 0, 1 e 2.',
  )
})
