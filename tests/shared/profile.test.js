// @vitest-environment node
import { expect, it } from 'vitest'
import { AVATAR_COLORS, defaultDisplayName, handleProblem, normalizeHandle, PROFILE_LIMITS } from '../../shared/profile.js'

it('accepts handles of 3 to 20 lowercase letters, numbers, _ and -', () => {
  for (const handle of ['ada', 'bug_hunter-42', 'a'.repeat(20)]) expect(handleProblem(handle)).toBeNull()
})

it('explains what is wrong with a handle', () => {
  expect(handleProblem('ab')).toMatch(/at least 3/)
  expect(handleProblem('a'.repeat(21))).toMatch(/up to 20/)
  expect(handleProblem('ada lovelace')).toMatch(/letters, numbers/)
  expect(handleProblem('Ada')).toMatch(/letters, numbers/)
  expect(handleProblem('ada!')).toMatch(/letters, numbers/)
})

it('normalizes a typed handle to trimmed lowercase', () => {
  expect(normalizeHandle('  Ada_Dev ')).toBe('ada_dev')
})

it('names people after their email until they pick a name', () => {
  expect(defaultDisplayName({ email: 'ada.lovelace@example.com', isDemo: false })).toBe('ada.lovelace')
  expect(defaultDisplayName({ email: 'demo-123@demo.glitch', isDemo: true })).toBe('Demo Detective')
  expect(defaultDisplayName({ email: '', isDemo: false })).toBe('Detective')
  expect(defaultDisplayName({ email: `${'x'.repeat(60)}@example.com`, isDemo: false })).toHaveLength(PROFILE_LIMITS.displayName)
})

it('has a small palette of unique color ids', () => {
  const ids = AVATAR_COLORS.map((color) => color.id)
  expect(ids.length).toBeGreaterThanOrEqual(4)
  expect(new Set(ids).size).toBe(ids.length)
})
