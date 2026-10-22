// @vitest-environment node
import { expect, it } from 'vitest'
import {
  AVATAR_COLORS,
  defaultDisplayName,
  handleProblem,
  LANGUAGES,
  linkProblem,
  normalizeHandle,
  OPEN_TO,
  PROFILE_LIMITS,
  ROLES,
} from '../../shared/profile.js'

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

it('has fixed lists of roles, languages and open-to chips with unique ids', () => {
  for (const list of [ROLES, LANGUAGES, OPEN_TO]) {
    const ids = list.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of list) expect(item.label).toEqual(expect.any(String))
  }
  expect(ROLES.map((role) => role.id)).toEqual(['student', 'developer', 'career-changer', 'teacher', 'other'])
  expect(LANGUAGES.map((language) => language.id)).toEqual(expect.arrayContaining(['javascript', 'python', 'csharp', 'cpp', 'sql']))
  expect(OPEN_TO.map((item) => item.id)).toEqual(['study-buddies', 'mentoring', 'internships', 'jobs'])
  expect(PROFILE_LIMITS.languages).toBe(8)
})

it('accepts https links on the right sites', () => {
  expect(linkProblem('github', 'https://github.com/ada')).toBeNull()
  expect(linkProblem('github', 'https://www.github.com/ada')).toBeNull()
  expect(linkProblem('linkedin', 'https://www.linkedin.com/in/ada')).toBeNull()
  expect(linkProblem('linkedin', 'https://br.linkedin.com/in/ada')).toBeNull()
  expect(linkProblem('website', 'https://ada.dev/blog')).toBeNull()
})

it('explains what is wrong with a link', () => {
  expect(linkProblem('website', 'http://ada.dev')).toMatch(/https/)
  expect(linkProblem('website', 'javascript:alert(1)')).toMatch(/https/)
  expect(linkProblem('website', 'not a link')).toMatch(/https/)
  expect(linkProblem('website', 'https://localhost/x')).toMatch(/https/)
  expect(linkProblem('website', 'https://ada:secret@ada.dev')).toMatch(/https/)
  expect(linkProblem('website', `https://ada.dev/${'x'.repeat(PROFILE_LIMITS.link)}`)).toMatch(/shorter/)
  expect(linkProblem('github', 'https://gitlab.com/ada')).toMatch(/github\.com/)
  expect(linkProblem('github', 'https://github.com.evil.io/ada')).toMatch(/github\.com/)
  expect(linkProblem('linkedin', 'https://notlinkedin.com/in/ada')).toMatch(/linkedin\.com/)
})
