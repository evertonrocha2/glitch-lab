// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MAX_FOCUS_EVENTS } from '../../server/modules/duels/duels.service.js'
import { GET, POST } from '../../api/challenge.js'
import { GET as PROGRESS } from '../../api/progress.js'
import { COUNTDOWN_MS, DUEL_ROUNDS, REVEAL_MS, ROUND_MS, STALE_MS } from '../../shared/duel.js'
import { apiRequest, useTempStore } from './helpers.js'

const START = Date.parse('2026-10-22T15:00:00.000Z')
const OPEN0 = START + COUNTDOWN_MS
let store

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(START)
  store = await useTempStore()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const json = async (res) => ({ status: res.status, body: await res.json() })
const act = async (action, fields = {}, token = 'dev:alice') => json(await POST(apiRequest('/api/challenge', { body: { duel: action, ...fields }, token })))
const state = async (id, token = 'dev:alice') => json(await GET(apiRequest(`/api/challenge?duel=${id}`, { method: 'GET', token })))
const at = (time) => vi.setSystemTime(time)
const secret = async (id) => store.getDuel(id)
// A right and a wrong option id for round `index`.
async function choices(id, index) {
  const { rounds } = await secret(id)
  const round = rounds[index]
  return { right: round.answer, wrong: round.options.find((option) => option.id !== round.answer).id }
}
// When round `index` opens, as the server sees it now.
const openAtOf = async (id, index, token = 'dev:alice') => {
  const { body } = await state(id, token)
  if (body.duel.current?.index === index) return Date.parse(body.duel.current.openAt)
  return Date.parse(body.duel.next.openAt)
}

// Alice opens a private duel and Bob joins with its code: the duel starts at START.
async function privateDuel(bob = 'dev:bob') {
  const created = await act('create')
  const joined = await act('join', { code: created.body.duel.code.toLowerCase() }, bob)
  return { id: created.body.duel.id, created, joined }
}

// No round's answer, anyone's points or the other player's pick while that round is open.
function expectNoLeak(duel) {
  const text = JSON.stringify(duel)
  expect(text).not.toContain('delayMs')
  expect(text).not.toContain('botPlan')
  expect(text).not.toMatch(/userId/)
  if (duel.current) {
    expect(duel.current).not.toHaveProperty('answer')
    expect(Object.keys(duel.current).sort()).toEqual(['answered', 'deadline', 'index', 'left', 'myChoice', 'openAt', 'options', 'prompt', 'type'])
    for (const round of duel.rounds) expect(round.index).toBeLessThan(duel.current.index)
  }
}

it('asks for sign in', async () => {
  expect((await state('lobby', null)).status).toBe(401)
  expect((await act('create', {}, null)).status).toBe(401)
})

it('opens a private duel with a code and a link; a friend joins with the code and the countdown starts', async () => {
  const { id, created, joined } = await privateDuel()
  expect(created.status).toBe(201)
  expect(created.body.duel).toMatchObject({ kind: 'private', status: 'waiting', you: 0, joinable: false, roundCount: DUEL_ROUNDS })
  expect(created.body.duel.code).toMatch(/^[A-Z2-9]{6}$/)
  expect(created.body.duel.players).toEqual([{ name: 'Anonymous detective', handle: null, avatar: null, bot: false, you: true }])

  expect(joined.status).toBe(200)
  expect(joined.body.duel).toMatchObject({ id, status: 'active', phase: 'countdown', you: 1, scores: [0, 0], rounds: [], next: { index: 0, openAt: new Date(OPEN0).toISOString() } })
  expect(joined.body.duel.startAt).toBe(new Date(START).toISOString())
  expectNoLeak(joined.body.duel)

  // A third person can't take a seat.
  const full = await act('join', { id }, 'dev:carol')
  expect(full).toEqual({ status: 409, body: { message: 'This duel is already full.' } })
  // And only sees who plays.
  const spectator = await state(id, 'dev:carol')
  expect(spectator.body.duel).toMatchObject({ status: 'active', spectator: true, you: null })
  expect(spectator.body.duel).not.toHaveProperty('current')
})

it('lets a friend see the invitation before joining, and refuses bad or stale codes', async () => {
  const created = await act('create')
  const invite = await state(created.body.duel.id, 'dev:bob')
  expect(invite.body.duel).toMatchObject({ status: 'waiting', joinable: true, you: null })
  expect(await act('join', { code: 'zzzzzz' }, 'dev:bob')).toEqual({ status: 404, body: { message: 'No duel has that code.' } })
  expect(await act('join', { code: 'abc' }, 'dev:bob')).toEqual({ status: 400, body: { message: 'Type the 6-character duel code.' } })
  at(START + STALE_MS + 1)
  expect(await act('join', { id: created.body.duel.id }, 'dev:bob')).toEqual({ status: 410, body: { message: 'This duel expired. Ask for a new link.' } })
})

it('times answers on the server, scores speed, and never shows an answer before its round closes', async () => {
  const { id } = await privateDuel()
  const { right, wrong } = await choices(id, 0)

  at(OPEN0 - 1)
  expect(await act('answer', { id, round: 0, choice: right })).toEqual({ status: 409, body: { message: 'This round is not open.' } })

  at(OPEN0 + 3000)
  const open = await state(id)
  expect(open.body.duel).toMatchObject({ phase: 'round', current: { index: 0, answered: [false, false], left: [false, false], myChoice: null } })
  expect(open.body.duel.current.options).toHaveLength(4)
  expectNoLeak(open.body.duel)

  const mine = await act('answer', { id, round: 0, choice: right })
  expect(mine.status).toBe(200)
  // Locked in, but not told whether it was right: Bob hasn't answered yet.
  expect(mine.body.duel).toMatchObject({ phase: 'round', scores: [0, 0], current: { myChoice: right, answered: [true, false] } })
  expectNoLeak(mine.body.duel)
  const bobView = await state(id, 'dev:bob')
  expect(bobView.body.duel.current).toMatchObject({ answered: [true, false], myChoice: null })
  expectNoLeak(bobView.body.duel)

  // One answer per round, only from the options, only for the open round.
  expect(await act('answer', { id, round: 0, choice: wrong })).toEqual({ status: 409, body: { message: 'You already answered this round.' } })
  expect(await act('answer', { id, round: 0, choice: 'cobol-9000' }, 'dev:bob')).toEqual({ status: 400, body: { message: 'Pick one of the options.' } })
  expect(await act('answer', { id, round: 1, choice: right }, 'dev:bob')).toEqual({ status: 409, body: { message: 'This round is not open.' } })
  expect(await act('answer', { id, round: 0, choice: right }, 'dev:carol')).toEqual({ status: 403, body: { message: 'You are not in this duel.' } })

  // Bob answers wrong two seconds later: both are in, so the round closes now.
  at(OPEN0 + 5000)
  const closed = await act('answer', { id, round: 0, choice: wrong }, 'dev:bob')
  expect(closed.body.duel).toMatchObject({ phase: 'reveal', scores: [180, 0], next: { index: 1, openAt: new Date(OPEN0 + 5000 + REVEAL_MS).toISOString() } })
  expect(closed.body.duel.rounds).toEqual([
    {
      index: 0,
      type: expect.any(String),
      answer: { id: right, name: expect.any(String) },
      players: [
        { choice: right, correct: true, ms: 3000, left: false, points: 180 },
        { choice: wrong, correct: false, ms: 5000, left: false, points: 0 },
      ],
    },
  ])
  expect(closed.body.duel.last).toMatchObject({ index: 0, answer: { id: right }, prompt: expect.any(Object) })
  expect(await act('answer', { id, round: 0, choice: right }, 'dev:carol')).toMatchObject({ status: 403 })
})

it('voids the round of a player who leaves the tab, and both players see it', async () => {
  const { id } = await privateDuel()
  const open = await openAtOf(id, 0)
  const { right } = await choices(id, 0)
  at(open + 1000)
  expect(await act('focus', { id, state: 'hidden' }, 'dev:bob')).toEqual({ status: 200, body: { recorded: true } })
  // Bob's page learns it still counts as away (a reload's unload says "hidden"), Alice's doesn't.
  expect((await state(id, 'dev:bob')).body.duel.away).toBe(true)
  expect((await state(id)).body.duel.away).toBe(false)
  at(open + 1500)
  await act('focus', { id, state: 'visible' }, 'dev:bob')
  expect((await state(id, 'dev:bob')).body.duel.away).toBe(false)
  expect((await state(id)).body.duel.current.left).toEqual([false, true])

  at(open + 2000)
  await act('answer', { id, round: 0, choice: right }, 'dev:bob')
  at(open + 4000)
  const done = await act('answer', { id, round: 0, choice: right })
  expect(done.body.duel.rounds[0].players).toEqual([
    { choice: right, correct: true, ms: 4000, left: false, points: 173 },
    { choice: right, correct: true, ms: 2000, left: true, points: 0 },
  ])
  expect((await state(id, 'dev:bob')).body.duel.rounds[0].players[1].left).toBe(true)
  expect((await act('focus', { id, state: 'gone' })).status).toBe(400)
})

it('closes a round at its deadline with nobody answering', async () => {
  const { id } = await privateDuel()
  at(OPEN0 + ROUND_MS - 1)
  expect((await state(id)).body.duel.phase).toBe('round')
  at(OPEN0 + ROUND_MS)
  const after = await state(id)
  expect(after.body.duel).toMatchObject({ phase: 'reveal', scores: [0, 0] })
  expect(after.body.duel.rounds[0].players.map((item) => item.choice)).toEqual([null, null])
  const { right } = await choices(id, 0)
  expect((await act('answer', { id, round: 0, choice: right })).status).toBe(409)
})

// Plays every round: alice right after 1s, bob wrong after 2s. Returns the last state alice saw.
async function playOut(id, { alice = 'right', bob = 'wrong' } = {}) {
  let last
  for (let index = 0; index < DUEL_ROUNDS; index++) {
    const open = await openAtOf(id, index)
    const options = await choices(id, index)
    at(open + 1000)
    await act('answer', { id, round: index, choice: options[alice] })
    at(open + 2000)
    await act('answer', { id, round: index, choice: options[bob] }, 'dev:bob')
    last = await state(id)
  }
  return last
}

it('finishes after the last round with a winner and moves both Elo ratings', async () => {
  const { id } = await privateDuel()
  const end = await playOut(id)
  expect(end.body.duel).toMatchObject({
    status: 'finished',
    phase: 'finished',
    scores: [5 * 193, 0],
    result: { reason: 'score', winner: 0, forfeit: null, scores: [5 * 193, 0], rated: true, rating: { before: 1000, after: 1016 } },
  })
  expect(end.body.duel.rounds).toHaveLength(DUEL_ROUNDS)
  expect((await state(id, 'dev:bob')).body.duel.result.rating).toEqual({ before: 1000, after: 984 })
  expect(await store.getRating('alice')).toMatchObject({ rating: 1016, games: 1, wins: 1, losses: 0 })
  expect(await store.getRating('bob')).toMatchObject({ rating: 984, games: 1, wins: 0, losses: 1 })
  // Reading it again changes nothing.
  await state(id)
  expect((await store.getRating('alice')).games).toBe(1)

  // A finished duel can be shared: anyone signed in sees the result.
  expect((await state(id, 'dev:carol')).body.duel).toMatchObject({ status: 'finished', you: null, result: { winner: 0, rating: null } })

  const lobby = await state('lobby')
  expect(lobby.body).toMatchObject({ rating: { rating: 1016, games: 1, wins: 1 }, active: null })
  expect(lobby.body.recent).toEqual([
    expect.objectContaining({ id, kind: 'private', outcome: 'win', you: 5 * 193, them: 0, rated: true, ratingAfter: 1016, opponent: expect.objectContaining({ name: 'Anonymous detective', bot: false }) }),
  ])
  expect(lobby.body.leaderboard.map((row) => [row.rank, row.rating, row.isYou])).toEqual([
    [1, 1016, true],
    [2, 984, false],
  ])
})

it('shows public names on the leaderboard and keeps the rest anonymous', async () => {
  const ada = await store.createUser({ email: 'ada@test.dev', passwordHash: null, isDemo: false })
  await store.updateProfile(ada.id, { handle: 'ada', displayName: 'Ada', isPublic: true })
  const created = await act('create', {}, `dev:${ada.id}`)
  const id = created.body.duel.id
  await act('join', { id }, 'dev:bob')
  // Bob wins every round.
  for (let index = 0; index < DUEL_ROUNDS; index++) {
    const open = await openAtOf(id, index, 'dev:bob')
    const options = await choices(id, index)
    at(open + 1000)
    await act('answer', { id, round: index, choice: options.right }, 'dev:bob')
    await act('answer', { id, round: index, choice: options.wrong }, `dev:${ada.id}`)
  }
  const board = (await state('lobby', `dev:${ada.id}`)).body.leaderboard
  expect(board[0]).toMatchObject({ name: 'Anonymous detective', handle: null, avatar: null, isYou: false })
  expect(board[1]).toMatchObject({ name: 'Ada', handle: 'ada', avatar: expect.any(Object), isYou: true })
  expect(JSON.stringify(board)).not.toContain(ada.id)
  expect(JSON.stringify(board)).not.toContain('bob')
})

it('ends in a draw on equal scores', async () => {
  const { id } = await privateDuel()
  const end = await playOut(id, { alice: 'right', bob: 'right' })
  // Alice was a second faster every round.
  expect(end.body.duel.result.winner).toBe(0)
  const { id: second } = await privateDuel()
  const tie = await playOut(second, { alice: 'wrong', bob: 'wrong' })
  expect(tie.body.duel.result).toMatchObject({ winner: null, scores: [0, 0] })
})

it('never rates a duel with a demo account', async () => {
  const { id } = await privateDuel('dev:demo')
  // Nobody answers; both pages keep checking in.
  for (let index = 0; index < DUEL_ROUNDS; index++) {
    const open = await openAtOf(id, index)
    await state(id, 'dev:demo')
    at(open + ROUND_MS)
  }
  const end = await state(id)
  expect(end.body.duel.result).toMatchObject({ rated: false, rating: null, winner: null })
  expect(await store.getRating('alice')).toBeNull()
  expect(await store.getRating('demo')).toBeNull()
  expect((await state('lobby')).body.leaderboard).toEqual([])
})

it('pairs two quick-match players, and a newer waiting player joins an older one', async () => {
  const first = await act('queue')
  expect(first.status).toBe(201)
  expect(first.body.duel).toMatchObject({ kind: 'queue', status: 'waiting' })
  // Asking again keeps the same seat.
  expect((await act('queue')).body.duel.id).toBe(first.body.duel.id)
  const paired = await act('queue', {}, 'dev:bob')
  expect(paired.body.duel).toMatchObject({ id: first.body.duel.id, status: 'active', you: 1 })

  // Two players who queued at the same moment each made a duel: the newer one moves over.
  vi.setSystemTime(START + 1000)
  const carol = await act('queue', {}, 'dev:carol')
  vi.setSystemTime(START + 1500)
  const dan = await store.createDuel({ code: 'DAN234', kind: 'queue', status: 'waiting', players: [{ userId: 'dan', isDemo: false, bot: false, joinedAt: new Date(START + 1500).toISOString(), seenAt: new Date(START + 1500).toISOString() }], rounds: (await secret(first.body.duel.id)).rounds })
  vi.setSystemTime(START + 2000)
  const moved = await state(dan.id, 'dev:dan')
  expect(moved.body.duel).toMatchObject({ id: carol.body.duel.id, status: 'active', you: 1 })
  expect((await store.getDuel(dan.id)).status).toBe('cancelled')
})

it('offers the Glitch Bot: it gives up the waiting room and plays from its plan', async () => {
  const waiting = await act('queue')
  at(START + 20_000)
  const game = await act('bot')
  expect(game.status).toBe(201)
  expect((await store.getDuel(waiting.body.duel.id)).status).toBe('cancelled')
  const id = game.body.duel.id
  expect(game.body.duel).toMatchObject({ kind: 'bot', status: 'active', phase: 'countdown', you: 0 })
  expect(game.body.duel.players[1]).toEqual({ name: 'Glitch Bot', handle: null, avatar: null, bot: true, you: false })
  expectNoLeak(game.body.duel)

  const { botPlan, rounds } = await secret(id)
  const open = START + 20_000 + COUNTDOWN_MS
  at(open + botPlan[0].delayMs - 1)
  expect((await state(id)).body.duel.current.answered).toEqual([false, false])
  at(open + botPlan[0].delayMs)
  // The bot's answer closes nothing until I answer too.
  const seen = await state(id)
  expect(seen.body.duel.current.answered).toEqual([false, true])
  expectNoLeak(seen.body.duel)
  const mine = await act('answer', { id, round: 0, choice: rounds[0].answer })
  expect(mine.body.duel.rounds[0].players[1]).toMatchObject({ choice: botPlan[0].choice, correct: botPlan[0].choice === rounds[0].answer, ms: botPlan[0].delayMs })

  for (let index = 1; index < DUEL_ROUNDS; index++) at((await openAtOf(id, index)) + ROUND_MS)
  const end = await state(id)
  expect(end.body.duel).toMatchObject({ status: 'finished', result: { rated: false, rating: null } })
  expect(await store.getRating('alice')).toBeNull()
  expect((await act('rematch', { id })).status).toBe(409)
})

it('forfeits a player whose page stops checking in during the duel', async () => {
  const { id } = await privateDuel()
  // Both pages check in through the first three rounds; then Bob's goes quiet.
  const threeRounds = OPEN0 + 3 * ROUND_MS + 2 * REVEAL_MS
  let time = START
  for (; time <= threeRounds; time += 5000) {
    at(time)
    await state(id, 'dev:bob')
    expect((await state(id)).body.duel.status).toBe('active')
  }
  const bobLastSeen = time - 5000
  for (; time <= bobLastSeen + STALE_MS; time += 5000) {
    at(time)
    expect((await state(id)).body.duel.status).toBe('active')
  }
  at(bobLastSeen + STALE_MS + 1)
  const end = await state(id)
  expect(end.body.duel).toMatchObject({ status: 'finished', result: { reason: 'forfeit', winner: 0, forfeit: 1, rated: true, early: false, rating: { after: 1016 } } })
})

it('makes a forfeit before round 3 unrated, with no XP for either player', async () => {
  const { id } = await privateDuel()
  // Bob's page goes quiet right after joining: he forfeits during round 1.
  for (let time = START; time <= START + STALE_MS; time += 5000) {
    at(time)
    await state(id)
  }
  at(START + STALE_MS + 1)
  const end = await state(id)
  expect(end.body.duel).toMatchObject({ status: 'finished', result: { reason: 'forfeit', winner: 0, forfeit: 1, rated: false, early: true, rating: null } })
  expect(await store.getRating('alice')).toBeNull()
  expect(await store.getRating('bob')).toBeNull()
  const progress = async (token) => (await (await PROGRESS(apiRequest('/api/progress?today=2026-10-22', { method: 'GET', token }))).json()).progress
  expect((await progress('dev:alice')).xp).toBe(0)
  expect((await progress('dev:bob')).xp).toBe(0)
  expect((await progress('dev:alice')).badges.find((badge) => badge.id === 'duelist').earned).toBe(false)
})

it('forfeits a player who comes back after going quiet too long, even against the bot', async () => {
  const game = await act('bot')
  const id = game.body.duel.id
  // Nobody else polls a bot game: Alice's late read must still find her own stored seenAt stale.
  at(START + STALE_MS + 5000)
  const back = await state(id)
  expect(back.body.duel).toMatchObject({ status: 'finished', result: { reason: 'forfeit', forfeit: 0, winner: 1, early: true } })
})

it('fails closed when a player runs out of tab reports: they count as away from then on', async () => {
  const { id } = await privateDuel()
  const open = await openAtOf(id, 0)
  // Bob already sent all but one report (leave, come back, over and over).
  const spam = Array.from({ length: MAX_FOCUS_EVENTS - 1 }, (_, index) => ({ userId: 'bob', state: index % 2 ? 'hidden' : 'visible', at: new Date(START + index).toISOString() }))
  const saved = await secret(id)
  await store.updateDuel(id, { focus: spam }, saved.version)
  at(open + 1000)
  // His last report says "visible", but the last slot is always kept as "hidden".
  expect(await act('focus', { id, state: 'visible' }, 'dev:bob')).toEqual({ status: 200, body: { recorded: true } })
  expect((await secret(id)).focus.at(-1)).toMatchObject({ userId: 'bob', state: 'hidden' })
  // No more reports, so he can't say he's back.
  expect(await act('focus', { id, state: 'visible' }, 'dev:bob')).toEqual({ status: 200, body: { recorded: false } })
  expect((await state(id, 'dev:bob')).body.duel.away).toBe(true)
  expect((await state(id)).body.duel.current.left).toEqual([false, true])
  // The next round is void for him too.
  at(open + ROUND_MS + REVEAL_MS + 1000)
  expect((await state(id)).body.duel.current).toMatchObject({ index: 1, left: [false, true] })
})

it('leaving cancels a waiting room and forfeits a duel in progress', async () => {
  const room = await act('create')
  expect((await act('leave', { id: room.body.duel.id })).body.duel.status).toBe('cancelled')
  expect((await act('join', { id: room.body.duel.id }, 'dev:bob')).status).toBe(410)

  const { id } = await privateDuel()
  at(OPEN0 + 1000)
  const left = await act('leave', { id }, 'dev:bob')
  expect(left.body.duel).toMatchObject({ status: 'finished', result: { reason: 'forfeit', forfeit: 1, winner: 0 } })
  expect((await act('focus', { id, state: 'hidden' })).body).toEqual({ recorded: false })
})

it('rematches: the first to ask opens a private duel, the second joins it', async () => {
  const { id } = await privateDuel()
  await playOut(id)
  const mine = await act('rematch', { id })
  expect(mine.status).toBe(201)
  expect(mine.body.duel).toMatchObject({ kind: 'private', status: 'waiting', you: 0 })
  expect((await state(id, 'dev:bob')).body.duel.rematchId).toBe(mine.body.duel.id)
  const theirs = await act('rematch', { id }, 'dev:bob')
  expect(theirs.body.duel).toMatchObject({ id: mine.body.duel.id, status: 'active', you: 1 })
  expect((await act('rematch', { id }, 'dev:carol')).status).toBe(403)
})

it('gives up every waiting room of mine before a bot game or a quick match, so I sit in one duel at a time', async () => {
  const room = await act('create')
  const queued = await act('queue')
  expect((await store.getDuel(room.body.duel.id)).status).toBe('cancelled')
  expect(queued.body.duel).toMatchObject({ kind: 'queue', status: 'waiting' })
  const another = await act('create')
  const game = await act('bot')
  expect(game.body.duel.kind).toBe('bot')
  expect((await store.getDuel(queued.body.duel.id)).status).toBe('cancelled')
  expect((await store.getDuel(another.body.duel.id)).status).toBe('cancelled')
  expect((await store.listDuels('alice', { status: 'waiting' })).length).toBe(0)
})

it('opens a new rematch when the one linked was given up', async () => {
  const { id } = await privateDuel()
  await playOut(id)
  const first = await act('rematch', { id })
  await act('leave', { id: first.body.duel.id })
  const again = await act('rematch', { id }, 'dev:bob')
  expect(again.status).toBe(201)
  expect(again.body.duel).toMatchObject({ kind: 'private', status: 'waiting', you: 0 })
  expect(again.body.duel.id).not.toBe(first.body.duel.id)
  expect((await state(id)).body.duel.rematchId).toBe(again.body.duel.id)
  // And Alice now joins Bob's.
  expect((await act('rematch', { id })).body.duel).toMatchObject({ id: again.body.duel.id, status: 'active', you: 1 })
})

it('rejects unknown actions and ids', async () => {
  expect((await act('dance')).status).toBe(400)
  expect((await act('answer', { round: 0, choice: 'x' })).status).toBe(400)
  expect((await state('nope')).status).toBe(404)
  expect((await act('answer', { id: crypto.randomUUID(), round: 0, choice: 'x' })).status).toBe(404)
})

it('keeps both answers when they land at the same moment', async () => {
  const { id } = await privateDuel()
  const { right, wrong } = await choices(id, 0)
  at(OPEN0 + 2500)
  const [alice, bob] = await Promise.all([act('answer', { id, round: 0, choice: right }), act('answer', { id, round: 0, choice: wrong }, 'dev:bob')])
  expect([alice.status, bob.status]).toEqual([200, 200])
  const saved = await secret(id)
  expect(saved.answers.map((item) => item.userId).sort()).toEqual(['alice', 'bob'])
  expect((await state(id)).body.duel.rounds[0].players.map((item) => item.points)).toEqual([183, 0])
})

it('shows the version, which goes up with every write (the realtime nudge carries it)', async () => {
  const { id, created, joined } = await privateDuel()
  expect(created.body.duel.version).toBe(0)
  expect(joined.body.duel.version).toBe(1)
  at(OPEN0 + 1000)
  const { right } = await choices(id, 0)
  const answered = await act('answer', { id, round: 0, choice: right })
  expect(answered.body.duel.version).toBeGreaterThan(joined.body.duel.version)
  expectNoLeak(answered.body.duel)
})
