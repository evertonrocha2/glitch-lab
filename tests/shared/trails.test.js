// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MISSION_XP, missionDone, TRAIL_BONUS_XP, TRAIL_KINDS, trailSummary, trailView, trailXp } from '../../shared/trails.js'

const START = '2026-10-20T12:00:00.000Z'
const BEFORE = '2026-10-19T09:00:00.000Z'
const AFTER = '2026-10-21T09:00:00.000Z'

const mission = (kind, fields = {}) => ({ id: `m-${kind}`, kind, title: kind, description: `Do ${kind}`, xp: MISSION_XP[kind], ...fields })
const trailWith = (missions, done = []) => ({ id: 't1', userId: 'alice', title: 'Trail', summary: 'Why', missions, done, createdAt: START })
const none = { cases: [], challenges: [], notes: [], study: [] }

describe('missionDone', () => {
  it('counts a train mission once a challenge on that case passes after the trail started', () => {
    const train = mission('train', { caseId: 'c1' })
    const trail = trailWith([train])
    const challenge = (fields) => ({ id: 'ch', caseId: 'c1', status: 'passed', createdAt: AFTER, ...fields })
    expect(missionDone(train, trail, none)).toBe(false)
    expect(missionDone(train, trail, { ...none, challenges: [challenge()] })).toBe(true)
    expect(missionDone(train, trail, { ...none, challenges: [challenge({ status: 'open' })] })).toBe(false)
    expect(missionDone(train, trail, { ...none, challenges: [challenge({ createdAt: BEFORE })] })).toBe(false)
    expect(missionDone(train, trail, { ...none, challenges: [challenge({ caseId: 'c2' })] })).toBe(false)
  })

  it('counts a note mission once a note mentioning the case is written after the trail started', () => {
    const note = mission('note', { caseId: 'c1' })
    const trail = trailWith([note])
    const written = (fields) => ({ id: 'n1', blocks: [{ type: 'text', text: 'hi' }, { type: 'case', caseId: 'c1' }], updatedAt: AFTER, ...fields })
    expect(missionDone(note, trail, { ...none, notes: [written()] })).toBe(true)
    expect(missionDone(note, trail, { ...none, notes: [written({ updatedAt: BEFORE })] })).toBe(false)
    expect(missionDone(note, trail, { ...none, notes: [written({ blocks: [{ type: 'case', caseId: 'c2' }] })] })).toBe(false)
    expect(missionDone(note, trail, { ...none, notes: [written({ blocks: [{ type: 'text', text: 'c1' }] })] })).toBe(false)
  })

  it('counts study time from the day the trail started', () => {
    const study = mission('study', { minutes: 20 })
    const trail = trailWith([study])
    expect(missionDone(study, trail, { ...none, study: [{ day: '2026-10-19', seconds: 3600 }] })).toBe(false)
    expect(missionDone(study, trail, { ...none, study: [{ day: '2026-10-20', seconds: 600 }, { day: '2026-10-21', seconds: 599 }] })).toBe(false)
    expect(missionDone(study, trail, { ...none, study: [{ day: '2026-10-20', seconds: 600 }, { day: '2026-10-21', seconds: 600 }] })).toBe(true)
  })

  it('gives each study mission its own minutes, in trail order', () => {
    const first = mission('study', { id: 's1', minutes: 10 })
    const second = mission('study', { id: 's2', minutes: 15 })
    const trail = trailWith([first, second])
    const data = { ...none, study: [{ day: '2026-10-21', seconds: 20 * 60 }] }
    expect(missionDone(first, trail, data)).toBe(true)
    // 20 minutes covers the first 10, but not 10 + 15.
    expect(missionDone(second, trail, data)).toBe(false)
    expect(missionDone(second, trail, { ...none, study: [{ day: '2026-10-21', seconds: 25 * 60 }] })).toBe(true)
  })

  it('counts an investigate mission for a new case, of the concept when one is given', () => {
    const any = mission('investigate')
    const typed = mission('investigate', { id: 'i2', concept: 'off-by-one' })
    const trail = trailWith([any, typed])
    const kase = (fields) => ({ id: 'c9', concept: 'undefined-access', createdAt: AFTER, ...fields })
    expect(missionDone(any, trail, { ...none, cases: [kase({ createdAt: BEFORE })] })).toBe(false)
    expect(missionDone(any, trail, { ...none, cases: [kase()] })).toBe(true)
    expect(missionDone(typed, trail, { ...none, cases: [kase()] })).toBe(false)
    expect(missionDone(typed, trail, { ...none, cases: [kase({ concept: 'off-by-one' })] })).toBe(true)
  })

  it('counts a reflect mission only when ticked by hand', () => {
    const reflect = mission('reflect')
    expect(missionDone(reflect, trailWith([reflect]), none)).toBe(false)
    expect(missionDone(reflect, trailWith([reflect], [reflect.id]), none)).toBe(true)
  })

  it('never counts the done list for missions the data completes', () => {
    const train = mission('train', { caseId: 'c1' })
    expect(missionDone(train, trailWith([train], [train.id]), none)).toBe(false)
  })

  it('knows nothing about unknown kinds', () => {
    const odd = { id: 'x', kind: 'dance', title: 'x', description: 'x' }
    expect(missionDone(odd, trailWith([odd], ['x']), none)).toBe(false)
  })
})

describe('trailView', () => {
  const missions = [
    mission('train', { caseId: 'c1' }),
    mission('reflect'),
    mission('study', { minutes: 10 }),
    mission('investigate'),
  ]

  it('marks done missions, the first open one as next, and the rest to do', () => {
    const trail = trailWith(missions, ['m-reflect'])
    const data = { ...none, study: [{ day: '2026-10-21', seconds: 300 }] }
    const view = trailView(trail, data)
    expect(view.missions.map((item) => item.status)).toEqual(['next', 'done', 'todo', 'todo'])
    expect(view).toMatchObject({ id: 't1', title: 'Trail', summary: 'Why', createdAt: START, doneCount: 1, total: 4, complete: false })
    expect(view.xp).toBe(MISSION_XP.reflect)
    expect(view.xpTotal).toBe(40 + 10 + 20 + 15 + TRAIL_BONUS_XP)
    expect(view).not.toHaveProperty('userId')
  })

  it('shows minutes studied so far on study missions, capped at the goal', () => {
    const view = trailView(trailWith(missions), { ...none, study: [{ day: '2026-10-21', seconds: 300 }] })
    expect(view.missions[2]).toMatchObject({ minutes: 10, studiedMinutes: 5 })
    const more = trailView(trailWith(missions), { ...none, study: [{ day: '2026-10-21', seconds: 3600 }] })
    expect(more.missions[2].studiedMinutes).toBe(10)
  })

  it('uses the fixed xp for each kind, whatever the stored mission says', () => {
    const greedy = mission('reflect', { xp: 9999 })
    expect(trailView(trailWith([greedy], [greedy.id]), none).missions[0].xp).toBe(MISSION_XP.reflect)
  })

  it('adds the completion bonus when every mission is done', () => {
    const reflect = mission('reflect')
    const view = trailView(trailWith([reflect], [reflect.id]), none)
    expect(view).toMatchObject({ complete: true, doneCount: 1, xp: MISSION_XP.reflect + TRAIL_BONUS_XP })
    expect(view.missions[0].status).toBe('done')
  })
})

it('adds up trail xp the same way as the view', () => {
  const reflect = mission('reflect')
  const train = mission('train', { caseId: 'c1' })
  expect(trailXp(trailWith([reflect, train], [reflect.id]), none)).toBe(10)
  expect(trailXp(trailWith([reflect], [reflect.id]), none)).toBe(10 + TRAIL_BONUS_XP)
  expect(trailXp(trailWith([]), none)).toBe(0)
})

it('summarizes a trail for the history list', () => {
  const reflect = mission('reflect')
  expect(trailSummary(trailView(trailWith([reflect, mission('investigate')], [reflect.id]), none))).toEqual({
    id: 't1',
    title: 'Trail',
    createdAt: START,
    doneCount: 1,
    total: 2,
    complete: false,
  })
})

it('lists every kind with its xp', () => {
  expect(TRAIL_KINDS.map((kind) => kind.id)).toEqual(['train', 'note', 'study', 'investigate', 'reflect'])
  expect(MISSION_XP).toEqual({ train: 40, note: 15, study: 20, investigate: 15, reflect: 10 })
  expect(TRAIL_BONUS_XP).toBe(100)
})
