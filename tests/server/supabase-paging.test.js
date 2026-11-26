// @vitest-environment node
import { expect, it } from 'vitest'
import { createSupabaseExams } from '../../server/infra/database/supabase/exams.js'
import { pageAll } from '../../server/infra/database/supabase/paging.js'

it('pageAll reads every page until a short one', async () => {
  const calls = []
  const rows = await pageAll(async (from, to) => {
    calls.push([from, to])
    return Array.from({ length: Math.max(0, Math.min(to + 1, 2350) - from) }, (_, i) => from + i)
  })
  expect(rows).toHaveLength(2350)
  expect(calls).toEqual([
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ])
})

it('pageAll asks once more after an exactly full page', async () => {
  const calls = []
  const rows = await pageAll(async (from) => {
    calls.push(from)
    return from === 0 ? Array.from({ length: 1000 }, (_, i) => i) : []
  })
  expect(rows).toHaveLength(1000)
  expect(calls).toEqual([0, 1000])
})

it('examAttemptDays pages the RPC so heavy students keep their newest days', async () => {
  const total = 1000 + 37
  const all = Array.from({ length: total }, (_, i) => ({
    day: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    topic: `t${i}`,
    answered: '2',
    correct: '1',
  }))
  const ranges = []
  const db = {
    // Like PostgREST: an unpaged call is cut at 1000 rows.
    rpc: () => ({
      range: async (from, to) => {
        ranges.push([from, to])
        return { data: all.slice(from, to + 1), error: null }
      },
      then: (resolve) => resolve({ data: all.slice(0, 1000), error: null }),
    }),
  }
  const days = await createSupabaseExams(db).examAttemptDays('u1', 'enem')
  expect(days).toHaveLength(total)
  expect(days.at(-1)).toMatchObject({ topic: `t${total - 1}`, answered: 2, correct: 1 })
  expect(ranges).toEqual([
    [0, 999],
    [1000, 1999],
  ])
})
