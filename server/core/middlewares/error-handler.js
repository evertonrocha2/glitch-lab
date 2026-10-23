import { AppError } from '../errors.js'

// Last stop for every /api error: an AppError keeps its status and message, a body over the limit
// is a 413, and anything else is logged and answered with a plain 500.
export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err)
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message })
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large.' })
  console.error(err)
  res.status(500).json({ message: 'Server error.' })
}
