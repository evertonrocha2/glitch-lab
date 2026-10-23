import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codeKey, huntSnippetProblem } from '../../api/_lib/hunt/daily.js'
import { CONCEPTS } from '../../shared/concepts.js'
import { BASE_POINTS, compareRuns, HUNT_ROUNDS, huntSummary, huntXp, MAX_HUNT_XP, MAX_SCORE, ROUND_MS, roundPoints, SPEED_POINTS } from '../../shared/hunt/game.js'
import { HUNT_POOL } from '../../shared/hunt/snippets.js'

describe('round points', () => {
  it('pays nothing for a wrong line or a timeout', () => {
    expect(roundPoints(false, 1000)).toBe(0)
    expect(roundPoints(false, ROUND_MS)).toBe(0)
  })

  it('pays the base plus a speed bonus that shrinks with time', () => {
    expect(roundPoints(true, 0)).toBe(BASE_POINTS + SPEED_POINTS)
    expect(roundPoints(true, ROUND_MS / 2)).toBe(BASE_POINTS + SPEED_POINTS / 2)
    expect(roundPoints(true, ROUND_MS)).toBe(BASE_POINTS)
    // An answer that came in during the grace time keeps the base, never less.
    expect(roundPoints(true, ROUND_MS + 1500)).toBe(BASE_POINTS)
    expect(roundPoints(true, 4000)).toBeGreaterThan(roundPoints(true, 9000))
    expect(MAX_SCORE).toBe(HUNT_ROUNDS * (BASE_POINTS + SPEED_POINTS))
  })
})

describe('XP and summary', () => {
  it('pays 5 per right line and 10 more for a perfect run, capped', () => {
    expect(huntXp(0)).toBe(0)
    expect(huntXp(3)).toBe(15)
    expect(huntXp(7)).toBe(35)
    expect(huntXp(HUNT_ROUNDS)).toBe(MAX_HUNT_XP)
    expect(huntXp(99)).toBe(MAX_HUNT_XP)
  })

  it('sums XP over runs, counts perfect runs and the days played', () => {
    const summary = huntSummary([
      { day: '2026-10-20', correct: 8, answered: 8 },
      { day: '2026-10-21', correct: 2, answered: 3 },
      // Started but nothing answered yet: no XP, no activity.
      { day: '2026-10-22', correct: 0, answered: 0 },
    ])
    expect(summary).toEqual({ xp: 60, perfectRuns: 1, days: ['2026-10-20', '2026-10-21'] })
    expect(huntSummary()).toEqual({ xp: 0, perfectRuns: 0, days: [] })
  })

  it('ranks more points first, then more right lines, then less time, then who finished first', () => {
    const run = (score, correct, ms, finishedAt) => ({ score, correct, ms, finishedAt })
    const list = [run(500, 4, 9000, 'b'), run(900, 7, 30000, 'c'), run(500, 5, 9000, 'd'), run(500, 4, 7000, 'e'), run(500, 4, 7000, 'a')]
    expect(list.sort(compareRuns).map((item) => item.finishedAt)).toEqual(['c', 'd', 'a', 'e', 'b'])
  })
})

describe('the snippet pool', () => {
  it('has at least 30 snippets, with unique ids, across several languages and every bug type', () => {
    expect(HUNT_POOL.length).toBeGreaterThanOrEqual(30)
    expect(new Set(HUNT_POOL.map((item) => item.id)).size).toBe(HUNT_POOL.length)
    expect(new Set(HUNT_POOL.map((item) => item.language)).size).toBeGreaterThanOrEqual(8)
    const used = new Set(HUNT_POOL.map((item) => item.concept))
    for (const concept of CONCEPTS.filter((item) => item.id !== 'other')) expect(used, concept.id).toContain(concept.id)
  })

  it('passes the same check as an AI snippet (apart from being in the pool)', () => {
    for (const item of HUNT_POOL) {
      const others = new Set(HUNT_POOL.filter((other) => other !== item).map((other) => codeKey(other.code)))
      expect(huntSnippetProblem(item, others), item.id).toBeNull()
    }
  })

  it('writes no em dashes, and every explanation starts with a capital and ends with a period', () => {
    for (const item of HUNT_POOL) {
      expect(JSON.stringify(item), item.id).not.toContain('—')
      for (const text of [item.explanation.en, item.explanation.pt]) {
        expect(text, item.id).toMatch(/^[A-ZÀ-Ú]/)
        expect(text, item.id).toMatch(/\.$/)
      }
    }
  })

  it('never ships to the browser: nothing under src/ imports it', () => {
    const files = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]))
    const offenders = files('src').filter((file) => /\.(js|jsx)$/.test(file) && /hunt\/snippets/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})

describe('the snippet check', () => {
  const good = () => ({ ...HUNT_POOL[0], code: [...HUNT_POOL[0].code, '// one more line'] })

  it('accepts a new snippet and refuses one the pool already has', () => {
    expect(huntSnippetProblem(good())).toBeNull()
    expect(huntSnippetProblem(HUNT_POOL[0])).toBe('same code as another snippet')
    // Indentation and blank lines don't make it new.
    expect(huntSnippetProblem({ ...HUNT_POOL[0], code: ['', ...HUNT_POOL[0].code.map((line) => `  ${line}`)], line: HUNT_POOL[0].line + 1 })).toBe('same code as another snippet')
  })

  it('refuses a line that does not exist or is blank', () => {
    expect(huntSnippetProblem({ ...good(), line: 0 })).toBe('bug line does not exist')
    expect(huntSnippetProblem({ ...good(), line: 99 })).toBe('bug line does not exist')
    expect(huntSnippetProblem({ ...good(), line: 2.5 })).toBe('bug line does not exist')
    expect(huntSnippetProblem({ ...good(), line: 8 })).toBe('bug line is blank')
  })

  it('refuses an empty explanation or symptom, an unknown language or bug type, and bad sizes', () => {
    expect(huntSnippetProblem({ ...good(), explanation: { en: 'Fine.', pt: ' ' } })).toBe('no explanation')
    expect(huntSnippetProblem({ ...good(), symptom: { en: '', pt: 'x' } })).toBe('no symptom')
    expect(huntSnippetProblem({ ...good(), language: 'brainfuck' })).toBe('unknown language')
    expect(huntSnippetProblem({ ...good(), concept: 'vibes' })).toBe('unknown concept')
    expect(huntSnippetProblem({ ...good(), code: ['a', 'b'], line: 1 })).toBe('too short')
    expect(huntSnippetProblem({ ...good(), code: Array(16).fill('x = 1'), line: 1 })).toBe('too long')
    expect(huntSnippetProblem({ ...good(), code: [...good().code, '```'] })).toBe('not plain code')
  })
})
