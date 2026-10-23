import { verifyToken } from '../../infra/security/session.js'
import { unauthorized } from '../errors.js'

function bearerToken(header) {
  const value = typeof header === 'string' ? header : ''
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : ''
}

// { id, email, isDemo } for a valid signed session in an Authorization header, or null.
export function userFromHeader(header) {
  const token = bearerToken(header)
  return token ? verifyToken(token) : null
}

// The route needs a signed-in user: req.user, or a 401.
export function requireAuth(req, _res, next) {
  req.user = userFromHeader(req.get('authorization'))
  next(req.user ? undefined : unauthorized())
}

// Public routes that show a bit more to a signed-in reader: req.user, or null.
export function optionalAuth(req, _res, next) {
  req.user = userFromHeader(req.get('authorization'))
  next()
}
