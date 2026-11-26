// @vitest-environment node
import { expect, it } from 'vitest'
import { AppError, badRequest, codedConflict, detailedBadRequest } from '../../server/core/errors.js'
import { errorHandler } from '../../server/core/middlewares/error-handler.js'

// A response double: remembers the status and the body.
function answer(err) {
  const res = {
    headersSent: false,
    status(code) {
      this.code = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
  errorHandler(err, {}, res, () => {})
  return res
}

it('answers a plain AppError with exactly { message }', () => {
  const res = answer(new AppError(404, 'Not found.'))
  expect(res.code).toBe(404)
  expect(res.body).toStrictEqual({ message: 'Not found.' })
  expect(answer(badRequest()).body).toStrictEqual({ message: 'Invalid request.' })
})

it('keeps a code that was not asked to be sent out of the body', () => {
  expect(answer(new AppError(409, 'Taken.', 'SOME_CODE')).body).toStrictEqual({ message: 'Taken.' })
})

it('sends the code only for a coded conflict, and details next to the message', () => {
  expect(answer(codedConflict('Busy.', 'GAME_CONFLICT')).body).toStrictEqual({ message: 'Busy.', code: 'GAME_CONFLICT' })
  expect(answer(detailedBadRequest('Refused.', { reason: 'x', message: 'ignored' })).body).toStrictEqual({ reason: 'x', message: 'Refused.' })
})
