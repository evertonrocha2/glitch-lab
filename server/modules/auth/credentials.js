import { createToken } from '../../infra/security/session.js'
import { ok } from '../../core/http.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8
export const MAX_WRONG_PASSWORDS_PER_DAY = 10
// The app makes accounts on these domains itself (demo visitors, sample community authors).
const RESERVED_DOMAINS = ['demo.glitch', 'sample.glitch']

// Returns an error message, or null when the credentials are well formed.
export function credentialsProblem({ email, password }) {
  if (typeof email !== 'string' || email.trim().length > 254 || !EMAIL.test(email.trim())) return 'Enter a valid email.'
  const domain = email.trim().toLowerCase().split('@').pop()
  if (RESERVED_DOMAINS.includes(domain)) return 'Enter a valid email.'
  if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > 200) {
    return `Use a password with at least ${MIN_PASSWORD} characters.`
  }
  return null
}

const publicUser = (user) => ({ id: user.id, email: user.email, isDemo: user.isDemo })

// What sign up, sign in and demo all answer with: a fresh session plus who it belongs to.
export function sessionResponse(user, status = 200) {
  return ok({ token: createToken(publicUser(user)), user: publicUser(user) }, status)
}
