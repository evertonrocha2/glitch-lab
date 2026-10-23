import { notFound as notFoundError } from '../errors.js'

// An /api path no module answers.
export function notFound(_req, _res, next) {
  next(notFoundError())
}
