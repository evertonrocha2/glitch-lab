import { AppError, badRequest } from '../../core/errors.js'
import { hashPassword, verifyPassword } from '../../infra/security/password.js'
import { seedDemo } from '../demo/demo.seed.js'
import { credentialsProblem, MAX_WRONG_PASSWORDS_PER_DAY, sessionFor } from './credentials.js'

const WRONG = 'Wrong email or password.'

export async function login(store, body) {
  if (typeof body?.email !== 'string' || typeof body.password !== 'string') throw badRequest()

  const email = body.email.trim().toLowerCase()
  // Wrong guesses are counted per email per day, so nobody can brute-force a password.
  const lockKey = `login-fail:${email}`
  const day = new Date().toISOString().slice(0, 10)
  if ((await store.countUsage(lockKey, day)) >= MAX_WRONG_PASSWORDS_PER_DAY) {
    throw new AppError(429, 'Too many wrong passwords for this email. Try again tomorrow.')
  }

  const user = await store.findUserByEmail(email)
  // Same answer for an unknown email and a wrong password: don't reveal who has an account.
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    await store.addUsage(lockKey, day)
    throw new AppError(401, WRONG)
  }
  return sessionFor(user)
}

export async function register(store, body) {
  if (!body) throw badRequest()
  const problem = credentialsProblem(body)
  if (problem) throw badRequest(problem)

  const user = await store.createUser({ email: body.email, passwordHash: await hashPassword(body.password), isDemo: false })
  if (!user) throw new AppError(409, 'An account with this email already exists. Sign in instead.')
  return sessionFor(user)
}

// One click for judges: a brand-new demo account (no password, so nobody can take it over)
// with the sample board already filled in, in the visitor's language.
export async function startDemo(store, { today, locale }) {
  const user = await store.createUser({ email: `demo-${crypto.randomUUID()}@demo.glitch`, passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, today, locale)
  return sessionFor(user)
}
