// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildResult, leftDuring, outcomeAt, phaseAt, scoreRound, timeline } from '../../api/_lib/duel/clock.js'
import { DUEL_BUGS } from '../../api/_lib/duel/bugs.js'
import { botPlan, buildRounds, OPTION_COUNT, optionsFor } from '../../api/_lib/duel/questions.js'
import { POOL } from '../../api/_lib/puzzles/pool.js'
import { CONCEPTS } from '../../shared/concepts.js'
import { COUNTDOWN_MS, DUEL_ROUNDS, REVEAL_MS, ROUND_MS, STALE_MS } from '../../shared/duel.js'
import { languageById } from '../../shared/riddle/languages.js'

// A seeded stand-in for crypto's randomInt, so a test can build the same duel twice.
function seeded(seed = 1) {
  let state = seed
  return (count) => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state % count
  }
}

describe('questions', () => {
  it('builds five rounds of four options, the answer among them, no language twice', () => {
    for (let seed = 1; seed < 40; seed++) {
      const rounds = buildRounds(seeded(seed))
      expect(rounds).toHaveLength(DUEL_ROUNDS)
      expect(rounds.map((round) => round.type).sort()).toEqual(['bug', 'error', 'error', 'snippet', 'snippet'])
      for (const round of rounds) {
        expect(round.options).toHaveLength(OPTION_COUNT)
        expect(new Set(round.options.map((option) => option.id)).size).toBe(OPTION_COUNT)
        expect(round.options.map((option) => option.id)).toContain(round.answer)
        for (const option of round.options) expect(option.name).toEqual(expect.any(String))
      }
      const languages = rounds.filter((round) => round.type !== 'bug').map((round) => round.answer)
      expect(new Set(languages).size).toBe(languages.length)
      for (const id of languages) expect(languageById(id)).not.toBeNull()
    }
  })

  it('shows an error, a snippet, or broken code with its symptom', () => {
    const rounds = buildRounds(seeded(7))
    const byType = Object.fromEntries(rounds.map((round) => [round.type, round]))
    expect(byType.error.prompt).toEqual({ text: expect.any(String) })
    expect(byType.snippet.prompt).toEqual({ code: expect.any(String) })
    expect(byType.bug.prompt).toEqual({ code: expect.any(String), symptom: expect.any(String), language: expect.any(String) })
    expect(CONCEPTS.map((item) => item.id)).toContain(byType.bug.answer)
    expect(byType.bug.answer).not.toBe('other')
  })

  it('draws bug rounds from the duel set only, never the daily challenge pool', () => {
    const duelCodes = new Set(DUEL_BUGS.map((bug) => bug.code))
    const poolCodes = new Set(POOL.map((puzzle) => puzzle.brokenCode))
    for (const bug of DUEL_BUGS) {
      expect(poolCodes.has(bug.code)).toBe(false)
      expect(languageById(bug.language)).not.toBeNull()
      expect(CONCEPTS.map((item) => item.id)).toContain(bug.concept)
      expect(bug.concept).not.toBe('other')
      expect(bug.symptom).toEqual(expect.any(String))
    }
    expect(DUEL_BUGS.length).toBeGreaterThanOrEqual(DUEL_ROUNDS)
    for (let seed = 1; seed < 40; seed++) {
      const bug = buildRounds(seeded(seed)).find((round) => round.type === 'bug')
      expect(duelCodes.has(bug.prompt.code)).toBe(true)
      expect(poolCodes.has(bug.prompt.code)).toBe(false)
    }
  })

  it("shuffles each player's options the same way every time, and differently per player", () => {
    const [round] = buildRounds(seeded(3))
    const alice = optionsFor(round, 'duel-1', 'alice', 0)
    expect(optionsFor(round, 'duel-1', 'alice', 0)).toEqual(alice)
    expect([...alice].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...round.options].sort((a, b) => a.id.localeCompare(b.id)))
    const orders = new Set(['bob', 'carol', 'dan', 'erin', 'frank'].map((id) => optionsFor(round, 'duel-1', id, 0).map((option) => option.id).join()))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('plans a believable bot: mostly right, answering within the round', () => {
    const plans = Array.from({ length: 60 }, (_, seed) => {
      const rounds = buildRounds(seeded(seed + 1))
      return botPlan(rounds, seeded(seed + 100)).map((plan, index) => ({ ...plan, round: rounds[index] }))
    }).flat()
    for (const plan of plans) {
      expect(plan.delayMs).toBeGreaterThanOrEqual(2500)
      expect(plan.delayMs).toBeLessThan(ROUND_MS)
      expect(plan.round.options.map((option) => option.id)).toContain(plan.choice)
    }
    const right = plans.filter((plan) => plan.choice === plan.round.answer).length / plans.length
    expect(right).toBeGreaterThan(0.55)
    expect(right).toBeLessThan(0.85)
  })
})

describe('clock and scoring', () => {
  const START = Date.parse('2026-10-22T15:00:00.000Z')
  const iso = (time) => new Date(time).toISOString()
  const round = (answer) => ({ type: 'error', prompt: { text: 'x' }, options: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id })), answer })
  const duel = (fields = {}) => ({
    id: 'd1',
    kind: 'private',
    status: 'active',
    startAt: iso(START),
    players: [
      { userId: 'alice', isDemo: false, bot: false, seenAt: iso(START) },
      { userId: 'bob', isDemo: false, bot: false, seenAt: iso(START) },
    ],
    rounds: Array.from({ length: DUEL_ROUNDS }, () => round('a')),
    answers: [],
    focus: [],
    botPlan: null,
    ...fields,
  })
  const OPEN0 = START + COUNTDOWN_MS
  const answer = (userId, roundIndex, choice, at) => ({ userId, round: roundIndex, choice, at: iso(at) })

  it('opens round 0 after the countdown and runs each round to its deadline', () => {
    const rounds = timeline(duel(), OPEN0 + 1000)
    expect(rounds[0]).toMatchObject({ index: 0, openAt: OPEN0, deadline: OPEN0 + ROUND_MS, closeAt: OPEN0 + ROUND_MS })
    expect(rounds[1].openAt).toBe(OPEN0 + ROUND_MS + REVEAL_MS)
    expect(phaseAt(rounds, START)).toEqual({ phase: 'countdown', index: null, next: 0 })
    expect(phaseAt(rounds, OPEN0)).toMatchObject({ phase: 'round', index: 0 })
    expect(phaseAt(rounds, OPEN0 + ROUND_MS)).toEqual({ phase: 'reveal', index: 0, next: 1 })
    expect(phaseAt(rounds, rounds.at(-1).closeAt)).toMatchObject({ phase: 'over', index: DUEL_ROUNDS - 1 })
  })

  it('closes a round as soon as both have answered', () => {
    const answers = [answer('alice', 0, 'a', OPEN0 + 2000), answer('bob', 0, 'b', OPEN0 + 5000)]
    const rounds = timeline(duel({ answers }), OPEN0 + 6000)
    expect(rounds[0].closeAt).toBe(OPEN0 + 5000)
    expect(rounds[1].openAt).toBe(OPEN0 + 5000 + REVEAL_MS)
    expect(phaseAt(rounds, OPEN0 + 6000)).toEqual({ phase: 'reveal', index: 0, next: 1 })
    // Only one answer: the round stays open to its deadline.
    expect(timeline(duel({ answers: answers.slice(0, 1) }), OPEN0 + 6000)[0].closeAt).toBe(OPEN0 + ROUND_MS)
  })

  it('scores the right and fast answer higher, and wrong answers 0', () => {
    const answers = [answer('alice', 0, 'a', OPEN0 + 3000), answer('bob', 0, 'b', OPEN0 + 1000)]
    const d = duel({ answers })
    const [first] = timeline(d, OPEN0 + 4000)
    expect(scoreRound(d, first, 'alice')).toEqual({ choice: 'a', correct: true, ms: 3000, left: false, points: 180 })
    expect(scoreRound(d, first, 'bob')).toEqual({ choice: 'b', correct: false, ms: 1000, left: false, points: 0 })
  })

  it('voids a round when the player left the tab while it was open, or was away when it opened', () => {
    const focus = (userId, state, at) => ({ userId, state, at: iso(at) })
    expect(leftDuring([focus('alice', 'hidden', OPEN0 + 500), focus('alice', 'visible', OPEN0 + 900)], 'alice', OPEN0, OPEN0 + ROUND_MS)).toBe(true)
    // Away before the round and back before it opened: fine.
    expect(leftDuring([focus('alice', 'hidden', START), focus('alice', 'visible', START + 1000)], 'alice', OPEN0, OPEN0 + ROUND_MS)).toBe(false)
    // Still away when it opened: voided.
    expect(leftDuring([focus('alice', 'hidden', START)], 'alice', OPEN0, OPEN0 + ROUND_MS)).toBe(true)
    // Someone else leaving doesn't count against me.
    expect(leftDuring([focus('bob', 'hidden', OPEN0 + 100)], 'alice', OPEN0, OPEN0 + ROUND_MS)).toBe(false)

    const d = duel({ answers: [answer('alice', 0, 'a', OPEN0 + 2000)], focus: [focus('alice', 'hidden', OPEN0 + 500), focus('alice', 'visible', OPEN0 + 1500)] })
    const [first] = timeline(d, OPEN0 + ROUND_MS)
    expect(scoreRound(d, first, 'alice')).toMatchObject({ correct: true, left: true, points: 0 })
  })

  it('plays the bot from its plan once its moment comes', () => {
    const players = [
      { userId: 'alice', isDemo: false, bot: false, seenAt: iso(START) },
      { userId: 'bot', bot: true, seenAt: iso(START) },
    ]
    const plan = Array.from({ length: DUEL_ROUNDS }, () => ({ choice: 'a', delayMs: 4000 }))
    const d = duel({ kind: 'bot', players, botPlan: plan, answers: [answer('alice', 0, 'a', OPEN0 + 1000)] })
    expect(timeline(d, OPEN0 + 3999)[0].answers.bot).toBeUndefined()
    const rounds = timeline(d, OPEN0 + 4000)
    expect(rounds[0].answers.bot).toMatchObject({ choice: 'a', at: OPEN0 + 4000 })
    expect(rounds[0].closeAt).toBe(OPEN0 + 4000)
  })

  it('finishes when the last round closes, with a winner, a draw, or a forfeit', () => {
    const all = (userId, choice, delay) => Array.from({ length: DUEL_ROUNDS }, (_, index) => ({ userId, round: index, choice, delay }))
    // Both answer every round instantly enough: alice right, bob wrong.
    const play = (rows) => {
      const answers = []
      let d = duel()
      for (let index = 0; index < DUEL_ROUNDS; index++) {
        const openAt = timeline({ ...d, answers }, Number.MAX_SAFE_INTEGER)[index].openAt
        for (const row of rows.filter((item) => item.round === index)) answers.push(answer(row.userId, index, row.choice, openAt + row.delay))
        d = { ...d, answers: [...answers] }
      }
      return d
    }
    const won = play([...all('alice', 'a', 1000), ...all('bob', 'b', 500)])
    const end = timeline(won, Number.MAX_SAFE_INTEGER).at(-1).closeAt
    expect(outcomeAt(won, end - 1)).toBeNull()
    const result = outcomeAt({ ...won, players: won.players.map((p) => ({ ...p, seenAt: iso(end) })) }, end)
    expect(result).toMatchObject({ reason: 'score', forfeitBy: null, winner: 'alice', rated: true })
    expect(result.players).toEqual([
      { userId: 'alice', score: 5 * 193, fastestMs: 1000, outcome: 'win' },
      { userId: 'bob', score: 0, fastestMs: null, outcome: 'loss' },
    ])

    const tied = play([...all('alice', 'a', 1000), ...all('bob', 'a', 1000)])
    const tiedEnd = timeline(tied, Number.MAX_SAFE_INTEGER).at(-1).closeAt
    expect(buildResult(tied, timeline(tied, tiedEnd), tiedEnd)).toMatchObject({ winner: null, players: [{ outcome: 'draw' }, { outcome: 'draw' }] })

    // Bob's page stops checking in: after STALE_MS he forfeits, whatever the score.
    const quiet = duel({ players: [{ userId: 'alice', seenAt: iso(OPEN0 + 20_000) }, { userId: 'bob', seenAt: iso(START) }] })
    expect(outcomeAt(quiet, START + STALE_MS)).toBeNull()
    expect(outcomeAt(quiet, START + STALE_MS + 1, 'alice')).toMatchObject({ reason: 'forfeit', forfeitBy: 'bob', winner: 'alice', players: [{ outcome: 'win' }, { outcome: 'forfeit' }] })
  })

  it('never rates bot games or demo accounts', () => {
    const at = START + 200_000
    expect(buildResult(duel({ kind: 'bot', players: [{ userId: 'alice' }, { userId: 'bot', bot: true }] }), timeline(duel(), at), at).rated).toBe(false)
    expect(buildResult(duel({ players: [{ userId: 'alice' }, { userId: 'demo', isDemo: true }] }), timeline(duel(), at), at).rated).toBe(false)
    expect(buildResult(duel(), timeline(duel(), at), at).rated).toBe(true)
  })
})
