import { badRequest } from './errors.js'

export const isText = (value) => typeof value === 'string'

// Ids come from the client (paths, bodies): a non-empty string no longer than the store's ids.
export const isId = (value, max = 64) => isText(value) && value.length > 0 && value.length <= max

// The parsed JSON body, or a 400 when it was missing, not JSON or not an object.
export function requireBody(req) {
  if (!req.body) throw badRequest()
  return req.body
}

// An id from the path, or a 400 when it's too long to be one.
export function idParam(req, name = 'id') {
  const value = req.params[name]
  if (!isId(value)) throw badRequest()
  return value
}

// A page number from the query: 1 or more, at most `max`; anything else is page 1.
export function pageOf(value, max) {
  return Math.min(Math.max(Number.parseInt(value ?? '1', 10) || 1, 1), max)
}

// One query value as a string, or null when it's missing (Express gives arrays for repeated keys).
export function queryText(req, name) {
  const value = req.query[name]
  if (Array.isArray(value)) return isText(value[0]) ? value[0] : null
  return isText(value) ? value : null
}
