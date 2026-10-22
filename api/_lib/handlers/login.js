import { MAX_WRONG_PASSWORDS_PER_DAY, sessionResponse } from '../accounts.js'
import { verifyPassword } from '../auth/password.js'
import { fail, readJson } from '../http.js'
import { getStore } from '../store/index.js'

const WRONG = 'Wrong email or password.'

export async function POST(request) {
  const body = await readJson(request)
  if (typeof body?.email !== 'string' || typeof body.password !== 'string') return fail(400, 'Invalid request.')

  const store = getStore()
  const email = body.email.trim().toLowerCase()
  // Wrong guesses are counted per email per day, so nobody can brute-force a password.
  const lockKey = `login-fail:${email}`
  const day = new Date().toISOString().slice(0, 10)
  if ((await store.countUsage(lockKey, day)) >= MAX_WRONG_PASSWORDS_PER_DAY) {
    return fail(429, 'Too many wrong passwords for this email. Try again tomorrow.')
  }

  const user = await store.findUserByEmail(email)
  // Same answer for an unknown email and a wrong password: don't reveal who has an account.
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    await store.addUsage(lockKey, day)
    return fail(401, WRONG)
  }
  return sessionResponse(user)
}
