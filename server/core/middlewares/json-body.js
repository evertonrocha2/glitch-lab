import express from 'express'

export const MAX_BODY = '1mb'

// Read as text whatever the Content-Type says (the API never cared), then parsed here so a body
// that's missing, isn't JSON or isn't an object becomes null. Each route decides what null means:
// most answer "Invalid request.", a few go on with defaults.
const readText = express.text({ type: () => true, limit: MAX_BODY })

function parse(text) {
  if (typeof text !== 'string' || text === '') return null
  try {
    const body = JSON.parse(text)
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}

export function jsonBody(req, res, next) {
  readText(req, res, (err) => {
    if (err) return next(err)
    req.body = parse(req.body)
    next()
  })
}
