import { createToken } from '../../infra/security/session.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8
// Sign-in tries a day (right or wrong): see login in auth.service.js.
export const LOGIN_LIMITS = { perEmailAndNetwork: 10, perEmail: 100, perNetwork: 200 }
// New accounts a day from one network. Demos are higher: a class or an event may share one network.
export const SIGNUP_LIMITS = { perNetwork: 10, demosPerNetwork: 30 }
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
export function sessionFor(user) {
  return { token: createToken(publicUser(user)), user: publicUser(user) }
}
