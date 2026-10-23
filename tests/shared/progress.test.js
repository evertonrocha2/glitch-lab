// @vitest-environment node
import { expect, it } from 'vitest'
import { BADGES } from '../../shared/badges.js'
import { COMMUNITY_XP, COMMUNITY_XP_CAPS, computeProgress, STUDY_DAY_SECONDS } from '../../shared/progress.js'
import { MISSION_XP, TRAIL_BONUS_XP } from '../../shared/trails.js'

const kase = (fields = {}) => ({ id: crypto.randomUUID(), status: 'new', language: 'javascript', ...fields })
const passed = (fields = {}) => ({ id: crypto.randomUUID(), status: 'passed', hintsRevealed: 1, ...fields })
const empty = { cases: [], challenges: [], notes: [], study: [], today: '2026-10-22' }
const earned = (progress) => progress.badges.filter((badge) => badge.earned).map((badge) => badge.id)

it('starts a new account at level 1 with nothing earned', () => {
  const progress = computeProgress(empty)
  expect(progress).toMatchObject({ xp: 0, level: 1, title: 'Rookie', levelXp: 0, nextLevelXp: 100, streak: 0, todaySeconds: 0, totalSeconds: 0 })
  expect(progress.badges).toHaveLength(BADGES.length)
  expect(earned(progress)).toEqual([])
})

it('adds up xp from cases, passes, solved cases, notes and study minutes', () => {
  const progress = computeProgress({
    ...empty,
    cases: [kase(), kase({ status: 'solved' })],
    challenges: [passed(), passed({ hintsRevealed: 0 }), { id: 'x', status: 'open', hintsRevealed: 0 }],
    notes: [{ id: 'n1', blocks: [] }],
    study: [{ day: '2026-10-22', seconds: 600 }],
  })
  // cases 2*10 + passes 2*30 + clean pass 15 + solved 50 + note 5 + 10 minutes
  expect(progress.xp).toBe(20 + 60 + 15 + 50 + 5 + 10)
  expect(progress).toMatchObject({ level: 2, title: 'Junior Detective', levelXp: 100, nextLevelXp: 300 })
})

it('counts at most 20 notes toward xp', () => {
  const notes = Array.from({ length: 30 }, (_, index) => ({ id: `n${index}`, blocks: [] }))
  expect(computeProgress({ ...empty, notes }).xp).toBe(100)
})

it('has no next level at the top', () => {
  const study = [{ day: '2026-10-22', seconds: 2000 * 60 }]
  expect(computeProgress({ ...empty, study })).toMatchObject({ title: 'Bug Whisperer', nextLevelXp: null })
})

it('counts the study streak up to today or yesterday', () => {
  const day = (d, seconds = STUDY_DAY_SECONDS) => ({ day: d, seconds })
  const study = [day('2026-10-19'), day('2026-10-20'), day('2026-10-21')]
  expect(computeProgress({ ...empty, study }).streak).toBe(3)
  expect(computeProgress({ ...empty, study: [...study, day('2026-10-22')] }).streak).toBe(4)
  expect(computeProgress({ ...empty, study, today: '2026-10-23' }).streak).toBe(0)
  // A day with less than five minutes breaks it.
  expect(computeProgress({ ...empty, study: [day('2026-10-20'), day('2026-10-21', 60)] }).streak).toBe(0)
})

it("reports today's and total study time", () => {
  const study = [
    { day: '2026-10-21', seconds: 100 },
    { day: '2026-10-22', seconds: 50 },
  ]
  expect(computeProgress({ ...empty, study })).toMatchObject({ todaySeconds: 50, totalSeconds: 150 })
})

it('earns the case and gym badges', () => {
  const cases = [kase({ status: 'solved' }), kase({ language: 'python' }), kase({ language: 'java' })]
  const challenges = [passed({ hintsRevealed: 0 })]
  expect(earned(computeProgress({ ...empty, cases, challenges }))).toEqual(['first-clue', 'fixed-it', 'case-closed', 'sharp-eye', 'polyglot'])
})

it('earns bug hunter and collector with enough cases', () => {
  const cases = [...Array.from({ length: 5 }, () => kase({ status: 'solved' })), ...Array.from({ length: 5 }, () => kase())]
  expect(earned(computeProgress({ ...empty, cases }))).toEqual(expect.arrayContaining(['bug-hunter', 'collector']))
})

it('earns note taker only for a note that mentions a case', () => {
  const plain = [{ id: 'n1', blocks: [{ type: 'text', text: 'hi' }] }]
  expect(earned(computeProgress({ ...empty, notes: plain }))).not.toContain('note-taker')
  const linked = [{ id: 'n2', blocks: [{ type: 'case', caseId: 'c1' }] }]
  expect(earned(computeProgress({ ...empty, notes: linked }))).toContain('note-taker')
})

it('keeps streak badges after the streak ends', () => {
  const study = ['2026-10-01', '2026-10-02', '2026-10-03'].map((day) => ({ day, seconds: 25 * 60 }))
  const progress = computeProgress({ ...empty, study })
  expect(progress.streak).toBe(0)
  expect(earned(progress)).toEqual(['deep-focus', 'on-a-roll'])
})

it('earns marathon at five hours in total', () => {
  const study = Array.from({ length: 5 }, (_, index) => ({ day: `2026-09-0${index + 1}`, seconds: 3600 }))
  expect(earned(computeProgress({ ...empty, study }))).toContain('marathon')
})

it('adds xp for trail missions and a bonus for a finished trail, and earns trailblazer', () => {
  const reflect = (id) => ({ id, kind: 'reflect', title: 'Think', description: 'Why?' })
  const trail = (done) => ({ id: 't1', title: 'T', summary: '', missions: [reflect('m1'), reflect('m2')], done, createdAt: '2026-10-20T00:00:00.000Z' })
  expect(computeProgress({ ...empty, trails: [trail(['m1'])] }).xp).toBe(MISSION_XP.reflect)
  expect(earned(computeProgress({ ...empty, trails: [trail(['m1'])] }))).not.toContain('trailblazer')

  const finished = computeProgress({ ...empty, trails: [trail(['m1', 'm2'])] })
  expect(finished.xp).toBe(2 * MISSION_XP.reflect + TRAIL_BONUS_XP)
  expect(earned(finished)).toEqual(['trailblazer'])
})

it('reads trail missions against the same cases, gym, notes and study time', () => {
  const trail = {
    id: 't1',
    title: 'T',
    summary: '',
    missions: [{ id: 'm1', kind: 'study', title: 'Study', description: 'Focus', minutes: 10 }],
    done: [],
    createdAt: '2026-10-20T00:00:00.000Z',
  }
  const study = [{ day: '2026-10-21', seconds: 600 }]
  // 10 study minutes, the study mission and the finished-trail bonus.
  expect(computeProgress({ ...empty, study, trails: [trail] }).xp).toBe(10 + MISSION_XP.study + TRAIL_BONUS_XP)
})

// Daily and global challenges.
const solvedDaily = (day, difficulty = 'easy') => ({ kind: 'daily', day, difficulty })
const daysFrom = (start, length) => Array.from({ length }, (_, index) => solvedDaily(`2026-10-${String(start + index).padStart(2, '0')}`))

it('adds daily and global xp and reports the daily streak', () => {
  const daily = { solved: [solvedDaily('2026-10-21', 'medium'), solvedDaily('2026-10-22', 'hard'), { kind: 'global', day: '2026-10-19', difficulty: 'hard' }] }
  const progress = computeProgress({ ...empty, daily })
  expect(progress.xp).toBe(35 + 50 + 100)
  expect(progress.dailyStreak).toBe(2)
  expect(earned(progress)).toEqual(['global-ace'])
})

it('pays a puzzle only its daily xp, not gym xp on top', () => {
  const challenges = [passed({ hintsRevealed: 0, puzzleId: 'p1' })]
  const progress = computeProgress({ ...empty, challenges, daily: { solved: [solvedDaily('2026-10-22')] } })
  expect(progress.xp).toBe(20)
  expect(earned(progress)).not.toContain('fixed-it')
})

it('earns daily grinder for a 7-day daily streak, and keeps it', () => {
  expect(earned(computeProgress({ ...empty, daily: { solved: daysFrom(10, 6) } }))).not.toContain('daily-grinder')
  const progress = computeProgress({ ...empty, daily: { solved: daysFrom(10, 7) } })
  expect(progress.dailyStreak).toBe(0)
  expect(earned(progress)).toContain('daily-grinder')
})

it('works without any daily input', () => {
  expect(computeProgress(empty)).toMatchObject({ xp: 0, dailyStreak: 0 })
})

const community = (fields = {}) => ({ articles: 0, likesReceived: 0, validReceived: 0, comments: 0, ...fields })

it('adds xp for community articles, likes, valid ratings and comments', () => {
  const progress = computeProgress({ ...empty, community: community({ articles: 2, likesReceived: 3, validReceived: 1, comments: 4 }) })
  expect(progress.xp).toBe(2 * COMMUNITY_XP.article + 3 * COMMUNITY_XP.likeReceived + COMMUNITY_XP.validReceived + 4 * COMMUNITY_XP.comment)
})

it('caps community xp so nobody can farm it', () => {
  const lots = community({ articles: 500, likesReceived: 5000, validReceived: 5000, comments: 5000 })
  const max = COMMUNITY_XP_CAPS
  expect(computeProgress({ ...empty, community: lots }).xp).toBe(
    max.articles * COMMUNITY_XP.article + max.likes * COMMUNITY_XP.likeReceived + max.valid * COMMUNITY_XP.validReceived + max.comments * COMMUNITY_XP.comment,
  )
})

it('earns author for an article and trusted for 5 valid ratings', () => {
  expect(earned(computeProgress({ ...empty, community: community({ articles: 1 }) }))).toEqual(['author'])
  expect(earned(computeProgress({ ...empty, community: community({ articles: 1, validReceived: 4 }) }))).toEqual(['author'])
  expect(earned(computeProgress({ ...empty, community: community({ articles: 1, validReceived: 5 }) }))).toEqual(['author', 'trusted'])
  // Without community numbers nothing changes.
  expect(computeProgress(empty).xp).toBe(0)
})

const riddleResult = (day, mode, guessCount, solved = true) => ({ day, mode, guessCount, solved })

it('adds Glitchdle xp per solved mode, more for fewer guesses', () => {
  const riddle = {
    results: [riddleResult('2026-10-21', 'classic', 2), riddleResult('2026-10-21', 'error', 9), riddleResult('2026-10-22', 'snippet', 4, false)],
  }
  expect(computeProgress({ ...empty, riddle }).xp).toBe(25 + 10)
  expect(computeProgress(empty).xp).toBe(0)
})

it('earns lingo master for solving all three Glitchdle modes in one day', () => {
  const day = (date, modes) => modes.map((mode) => riddleResult(date, mode, 3))
  const split = { results: [...day('2026-10-21', ['classic', 'error']), ...day('2026-10-22', ['snippet'])] }
  expect(earned(computeProgress({ ...empty, riddle: split }))).not.toContain('lingo-master')
  expect(earned(computeProgress({ ...empty, riddle: { results: day('2026-10-21', ['classic', 'error', 'snippet']) } }))).toEqual(['lingo-master'])
})

it('adds duel xp, and the duelist and speed-demon badges', () => {
  const result = (fields) => ({ day: '2026-10-22', outcome: 'win', vsBot: false, fastestMs: null, ...fields })
  // A bot win pays half; the duelist badge needs a person.
  const botOnly = computeProgress({ ...empty, duel: { results: [result({ vsBot: true, fastestMs: 2500 })] } })
  expect(botOnly.xp).toBe(20)
  expect(earned(botOnly)).toEqual([])
  const fast = computeProgress({ ...empty, duel: { results: [result({ vsBot: true, fastestMs: 1900 }), result({ outcome: 'loss' })] } })
  expect(fast.xp).toBe(20 + 10)
  expect(earned(fast)).toEqual(['speed-demon'])
  expect(earned(computeProgress({ ...empty, duel: { results: [result({})] } }))).toEqual(['duelist'])
})
