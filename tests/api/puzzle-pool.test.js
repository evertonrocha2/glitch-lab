// @vitest-environment node
import { expect, it } from 'vitest'
import { CONCEPTS } from '../../shared/concepts.js'
import { pickFromPool, POOL } from '../../api/_lib/puzzles/pool.js'

const filled = (value) => typeof value === 'string' && value.trim() !== ''

it('has at least 12 complete puzzles across JavaScript, Python and several concepts', () => {
  expect(POOL.length).toBeGreaterThanOrEqual(12)
  expect(new Set(POOL.map((entry) => entry.language))).toEqual(new Set(['javascript', 'python']))
  expect(new Set(POOL.map((entry) => entry.concept)).size).toBeGreaterThanOrEqual(6)
  for (const entry of POOL) {
    expect(['daily', 'global']).toContain(entry.kind)
    expect(['easy', 'medium', 'hard']).toContain(entry.difficulty)
    expect(CONCEPTS.map((concept) => concept.id)).toContain(entry.concept)
    for (const field of ['title', 'brokenCode', 'symptom', 'solution', 'bugExplanation']) expect(filled(entry[field])).toBe(true)
    expect(entry.hints).toHaveLength(3)
    expect(entry.hints.every(filled)).toBe(true)
    expect(entry.solution.trim()).not.toBe(entry.brokenCode.trim())
  }
  expect(new Set(POOL.map((entry) => entry.title)).size).toBe(POOL.length)
})

it('has at least two puzzles for every daily difficulty and for the global slot', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    expect(POOL.filter((entry) => entry.kind === 'daily' && entry.difficulty === difficulty).length).toBeGreaterThanOrEqual(2)
  }
  const globals = POOL.filter((entry) => entry.kind === 'global')
  expect(globals.length).toBeGreaterThanOrEqual(2)
  expect(globals.every((entry) => entry.difficulty === 'hard')).toBe(true)
})

it('uses no em dashes', () => {
  expect(JSON.stringify(POOL)).not.toContain('—')
})

it('picks the same puzzle for the same slot, and changes it the next day', () => {
  const slot = { kind: 'daily', day: '2026-10-22', difficulty: 'medium' }
  const first = pickFromPool(slot)
  expect(pickFromPool({ ...slot })).toEqual(first)
  expect(first).toMatchObject({ puzzle: { ...slot, title: expect.any(String) }, secret: { solution: expect.any(String) } })
  expect(first.puzzle).not.toHaveProperty('solution')
  expect(pickFromPool({ ...slot, day: '2026-10-23' }).puzzle.title).not.toBe(first.puzzle.title)
})

it('gives the global slot a global puzzle, changing week to week', () => {
  const week = pickFromPool({ kind: 'global', day: '2026-10-19', difficulty: 'hard' })
  expect(POOL.find((entry) => entry.title === week.puzzle.title).kind).toBe('global')
  expect(pickFromPool({ kind: 'global', day: '2026-10-26', difficulty: 'hard' }).puzzle.title).not.toBe(week.puzzle.title)
})
