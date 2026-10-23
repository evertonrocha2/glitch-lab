// The one error type services throw. The error handler turns it into { message } with its status;
// the message text is part of the API (the client translates server messages by exact text).
export class AppError extends Error {
  constructor(status, message, code = undefined) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
  }
}

export const INVALID_REQUEST = 'Invalid request.'

export const badRequest = (message = INVALID_REQUEST) => new AppError(400, message)
export const unauthorized = (message = 'Sign in to continue.') => new AppError(401, message)
export const forbidden = (message) => new AppError(403, message)
export const notFound = (message = 'Not found.') => new AppError(404, message)
export const conflict = (message) => new AppError(409, message)
export const tooLarge = (message) => new AppError(413, message)
export const tooMany = (message) => new AppError(429, message)

// The parsers answer { value } or { status, message }: this throws the second kind.
export function valueOrThrow(parsed) {
  if (parsed.value === undefined) throw new AppError(parsed.status, parsed.message)
  return parsed.value
}
