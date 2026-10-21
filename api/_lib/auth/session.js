import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_DAYS = 7
const DEV_SECRET = 'glitch-detective-local-dev-secret'

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is not set')
  }
  return DEV_SECRET
}

const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url')

// A signed, expiring session: "<payload>.<signature>". Anyone can read it; nobody can change it without the secret.
export function createToken(user, now = new Date()) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      demo: Boolean(user.isDemo),
      exp: now.getTime() + SESSION_DAYS * 24 * 3_600_000,
    }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

// Returns { id, email, isDemo } for a valid, unexpired token; null for anything else.
export function verifyToken(token, now = new Date()) {
  const [payload, signature] = typeof token === 'string' ? token.split('.') : []
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof data.sub !== 'string' || typeof data.exp !== 'number' || data.exp <= now.getTime()) return null
    return { id: data.sub, email: data.email ?? '', isDemo: data.demo === true }
  } catch {
    return null
  }
}
