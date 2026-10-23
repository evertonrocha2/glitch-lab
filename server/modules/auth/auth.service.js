import { serverDay } from '../../core/days.js'
import { AppError, badRequest } from '../../core/errors.js'
import { spendUsage } from '../../core/usage.js'
import { hashPassword, verifyPassword } from '../../infra/security/password.js'
import { seedDemo } from '../demo/demo.seed.js'
import { credentialsProblem, LOGIN_LIMITS, SIGNUP_LIMITS, sessionFor } from './credentials.js'

const WRONG = 'Wrong email or password.'
const TOO_MANY_WRONG = 'Too many wrong passwords for this email. Try again tomorrow.'
const TOO_MANY_HERE = 'Too many tries from your network today. Try again tomorrow.'

// ip: the visitor's address (req.ip). Every counter is spent before the password is checked, so a
// burst of guesses sent at once can't all read the same old count.
export async function login(store, body, { ip = 'unknown' } = {}) {
  if (typeof body?.email !== 'string' || typeof body.password !== 'string') throw badRequest()

  const email = body.email.trim().toLowerCase()
  const day = serverDay()
  // Tries per email and network: the brute-force lock. Per email from anywhere: the ceiling when the
  // guesses come from many networks, high enough that a stranger can't lock someone out alone.
  // Per network over every email: credential stuffing.
  if (!(await spendUsage(store, `login-try:${ip}`, day, LOGIN_LIMITS.perNetwork))) throw new AppError(429, TOO_MANY_HERE)
  if (!(await spendUsage(store, `login-try:${email}:${ip}`, day, LOGIN_LIMITS.perEmailAndNetwork))) throw new AppError(429, TOO_MANY_WRONG)
  if (!(await spendUsage(store, `login-try:${email}`, day, LOGIN_LIMITS.perEmail))) throw new AppError(429, TOO_MANY_WRONG)

  const user = await store.findUserByEmail(email)
  // Same answer for an unknown email and a wrong password: don't reveal who has an account.
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) throw new AppError(401, WRONG)
  return sessionFor(user)
}

// Sign up says when an email is taken (there's no email confirmation to hide it behind), so it's
// limited per network: nobody can make accounts in bulk or test many emails quickly.
export async function register(store, body, { ip = 'unknown' } = {}) {
  if (!body) throw badRequest()
  const problem = credentialsProblem(body)
  if (problem) throw badRequest(problem)
  if (!(await spendUsage(store, `signup:${ip}`, serverDay(), SIGNUP_LIMITS.perNetwork))) throw new AppError(429, TOO_MANY_HERE)

  const user = await store.createUser({ email: body.email, passwordHash: await hashPassword(body.password), isDemo: false })
  if (!user) throw new AppError(409, 'An account with this email already exists. Sign in instead.')
  return sessionFor(user)
}

// One click for judges: a brand-new demo account (no password, so nobody can take it over)
// with the sample board already filled in, in the visitor's language.
export async function startDemo(store, { today, locale, ip = 'unknown' }) {
  if (!(await spendUsage(store, `demo:${ip}`, serverDay(), SIGNUP_LIMITS.demosPerNetwork))) throw new AppError(429, TOO_MANY_HERE)
  const user = await store.createUser({ email: `demo-${crypto.randomUUID()}@demo.glitch`, passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, today, locale)
  return sessionFor(user)
}
