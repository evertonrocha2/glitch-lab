import { expect, it } from 'vitest'
import { makeCase } from '../test/fixtures.js'
import { splitError, timeAgo, weakSpot } from './caseInfo.js'

it('splits the error type from its message', () => {
  expect(splitError("TypeError: Cannot read properties of undefined (reading 'length')\n    at cart.js:2")).toEqual({
    type: 'TypeError',
    message: "Cannot read properties of undefined (reading 'length')",
  })
  expect(splitError("KeyError: 'email'")).toEqual({ type: 'KeyError', message: "'email'" })
  expect(splitError('java.lang.NullPointerException: name is null').type).toBe('java.lang.NullPointerException')
})

it('falls back to a generic type when the error has no prefix', () => {
  expect(splitError('Segmentation fault (core dumped)')).toEqual({ type: 'Error', message: 'Segmentation fault (core dumped)' })
})

it('says how long ago a case was opened', () => {
  const now = new Date('2026-10-21T12:00:00Z')
  expect(timeAgo('2026-10-21T11:59:30Z', now)).toBe('just now')
  expect(timeAgo('2026-10-21T11:15:00Z', now)).toBe('45m ago')
  expect(timeAgo('2026-10-21T09:00:00Z', now)).toBe('3h ago')
  expect(timeAgo('2026-10-18T12:00:00Z', now)).toBe('3d ago')
})

it('finds the bug type you hit most among unsolved cases', () => {
  const cases = [
    makeCase({ id: '1', concept: 'index-out-of-range', status: 'new' }),
    makeCase({ id: '2', concept: 'undefined-access', status: 'training' }),
    makeCase({ id: '3', concept: 'undefined-access', status: 'new' }),
    makeCase({ id: '4', concept: 'index-out-of-range', status: 'solved' }),
  ]
  expect(weakSpot(cases)).toEqual({ concept: 'undefined-access', count: 2 })
  expect(weakSpot([makeCase({ status: 'solved' })])).toBeNull()
})
