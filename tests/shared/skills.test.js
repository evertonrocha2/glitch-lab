// @vitest-environment node
import { expect, it } from 'vitest'
import { REVIEW_CONCEPTS } from '../../shared/review.js'
import { masteryLevel, skillMap } from '../../shared/skills.js'

const byConcept = (map) => Object.fromEntries(map.concepts.map((item) => [item.concept, item]))

it('lists every concept, unmet ones at 0 and level 0', () => {
  const map = skillMap({})
  expect(map.concepts.map((item) => item.concept)).toEqual(REVIEW_CONCEPTS)
  expect(map.concepts.every((item) => !item.met && item.mastery === 0 && item.level === 0)).toBe(true)
  expect(map).toMatchObject({ weakest: null, trainCaseId: null })
})

it('mixes the review box with cases solved and challenges passed', () => {
  const cases = [
    { id: 'c1', concept: 'off-by-one', status: 'solved' },
    { id: 'c2', concept: 'off-by-one', status: 'solved' },
    { id: 'c3', concept: 'off-by-one', status: 'solved' },
    { id: 'c4', concept: 'key-error', status: 'new' },
    { id: 'c5', concept: 'key-error', status: 'training' },
  ]
  const challenges = [
    { caseId: 'c1', status: 'passed' },
    { caseId: 'c2', status: 'passed' },
    { caseId: 'c4', status: 'open' },
  ]
  const items = [
    { concept: 'off-by-one', box: 5, dueDay: '2026-11-20' },
    { concept: 'key-error', box: 2, dueDay: '2026-10-24' },
    { concept: 'async-await', box: 1, dueDay: '2026-10-22' },
  ]
  const map = skillMap({ cases, challenges, items, puzzleConcepts: ['wrong-comparison'] })
  const concepts = byConcept(map)
  // Box 5 is the full half; two solved (cap) and two passes.
  expect(concepts['off-by-one']).toMatchObject({ met: true, mastery: 50 + 30 + 20, level: 4, box: 5, cases: 3, solved: 3, passes: 2 })
  expect(concepts['key-error']).toMatchObject({ met: true, mastery: 13, level: 1, box: 2, solved: 0, passes: 0 })
  expect(concepts['wrong-comparison']).toMatchObject({ met: true, mastery: 10, passes: 1, box: null })
  expect(concepts['async-await']).toMatchObject({ met: true, mastery: 0, level: 1 })
  // The weakest met concept, and an unsolved case to train it on (none for async-await).
  expect(map.weakest).toBe('async-await')
  expect(map.trainCaseId).toBeNull()

  const again = skillMap({ cases, challenges, items: items.slice(0, 2) })
  expect(again.weakest).toBe('key-error')
  expect(again.trainCaseId).toBe('c4')
})

it('turns mastery into the five color steps', () => {
  expect([masteryLevel(0, false), masteryLevel(0, true), masteryLevel(30, true), masteryLevel(60, true), masteryLevel(90, true)]).toEqual([0, 1, 2, 3, 4])
})

it('counts a question card toward its concept, and can point at it to train', () => {
  const map = skillMap({
    cases: [{ id: 'q1', kind: 'question', concept: 'off-by-one', status: 'solved' }],
    challenges: [{ id: 'g1', caseId: 'q1', status: 'passed' }],
  })
  expect(byConcept(map)['off-by-one']).toMatchObject({ met: true, cases: 1, solved: 1, passes: 1, mastery: 25 })
  expect(map).toMatchObject({ weakest: 'off-by-one', trainCaseId: 'q1' })
})
