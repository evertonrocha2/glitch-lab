import { randomInt } from 'node:crypto'
import { STALE_MS } from '../../../shared/duel.js'
import { fail, ok } from '../http.js'
import { who } from '../puzzles/leaderboard.js'
import { getStore } from '../store/index.js'
import { BOT_ID, outcomeAt, phaseAt, timeline } from './clock.js'
import { botPlan, buildRounds } from './questions.js'
import { duelLeaderboard, ratingChanges, ratingOf, saveRatings } from './rating.js'
import { publicDuel } from './view.js'

// Duel, served from /api/challenge to stay under Vercel's free-plan function limit.
// GET ?duel=lobby: my rating, recent duels and the leaderboard. GET ?duel=<id>: one duel's state.
// POST { duel: 'create' | 'join' | 'queue' | 'bot' | 'answer' | 'focus' | 'leave' | 'rematch', ... }.
// The server owns the clock: every time is stamped here when a request arrives.

// A quick-match duel only pairs with a waiting player whose page checked in this recently.
export const QUEUE_FRESH_MS = 12_000
// How often a player's "still here" time is written (each poll would be one write a second).
export const SEEN_EVERY_MS = 5_000
// A player reports leaving and coming back at most this many times per duel. The last report kept
// is always "hidden", so a player who uses them all up counts as away from then on (fails closed).
export const MAX_FOCUS_EVENTS = 120
const RECENT_DUELS = 10
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const BOT_PERSON = { name: 'Glitch Bot', handle: null, avatar: null }
const ACTIONS = ['create', 'join', 'queue', 'bot', 'answer', 'focus', 'leave', 'rematch']

const iso = (time) => new Date(time).toISOString()
const isPlayer = (duel, userId) => duel.players.some((player) => player.userId === userId)
const seatFor = (user, now) => ({ userId: user.id, isDemo: Boolean(user.isDemo), bot: false, joinedAt: iso(now), seenAt: iso(now) })
const BOT_SEAT = (now) => ({ userId: BOT_ID, isDemo: false, bot: true, joinedAt: iso(now), seenAt: iso(now) })
const touch = (players, userId, now) => players.map((player) => (player.userId === userId ? { ...player, seenAt: iso(now) } : player))
export const normalizeCode = (code) => (typeof code === 'string' ? code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '')
const isId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 64

function newCode() {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
}

// A new duel with a code nobody has (tries again on the rare clash).
async function createWithCode(store, fields) {
  for (let tries = 0; tries < 5; tries++) {
    const created = await store.createDuel({ ...fields, code: newCode() })
    if (created) return created
  }
  throw new Error('Could not find a free duel code')
}

// Names and pictures in seat order: public profiles only, the rest "Anonymous detective".
async function peopleOf(store, duel) {
  return Promise.all(duel.players.map(async (player) => (player.bot ? BOT_PERSON : who(await store.getProfile(player.userId), player.userId))))
}

async function respond(store, duel, userId, now, status = 200) {
  return ok({ duel: publicDuel(duel, userId, now, await peopleOf(store, duel)) }, status)
}

// The fields that finish an active duel now, or null while it goes on. `leavingId` forfeits on purpose.
async function finishFields(store, duel, now, leavingId = null) {
  const result = outcomeAt(duel, now, leavingId)
  if (!result) return null
  return { status: 'finished', finishedAt: iso(now), result: { ...result, rating: await ratingChanges(store, duel, result) } }
}

// Reads, changes and writes a duel with the version check, retrying when another write landed
// first. change(duel) returns { fields } to write, { error } to answer with, or {} for nothing.
async function mutate(store, id, change, tries = 6) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const duel = await store.getDuel(id)
    if (!duel) return { error: fail(404, 'Duel not found.') }
    const outcome = await change(duel)
    if (outcome.error) return outcome
    if (!outcome.fields) return { duel, extra: outcome.extra }
    const saved = await store.updateDuel(id, outcome.fields, duel.version)
    if (saved) {
      if (outcome.fields.status === 'finished') await saveRatings(store, saved)
      return { duel: saved, written: true, extra: outcome.extra }
    }
  }
  return { error: fail(409, 'Another move landed at the same time. Try again.') }
}

// Every read by a player: marks them as still here (every few seconds), and finishes the duel
// when its last round closed or a player went quiet (the forfeit rule in clock.js). The forfeit
// check reads the seenAt stored before this visit, so coming back late doesn't undo going quiet.
async function settle(store, duel, userId, now) {
  if (!isPlayer(duel, userId) || (duel.status !== 'active' && duel.status !== 'waiting')) return duel
  const { duel: settled } = await mutate(store, duel.id, async (current) => {
    if (current.status !== 'active' && current.status !== 'waiting') return {}
    const fields = current.status === 'active' ? ((await finishFields(store, current, now)) ?? {}) : {}
    const me = current.players.find((player) => player.userId === userId)
    if (me && now - Date.parse(me.seenAt) >= SEEN_EVERY_MS) fields.players = touch(current.players, userId, now)
    return Object.keys(fields).length ? { fields } : {}
  }, 3)
  return settled ?? duel
}

// Gives up a waiting room of mine. Returns the duel as it is now: cancelled, or already active
// when someone took the other seat first.
async function cancelRoom(store, id, userId) {
  const { duel } = await mutate(store, id, (current) => (current.status === 'waiting' && isPlayer(current, userId) ? { fields: { status: 'cancelled' } } : {}), 3)
  return duel
}

// Gives up every waiting room of mine before I start or join another duel, so nobody sits in
// several at once. Returns a room that someone joined in the meantime (I'm playing that one), or null.
async function cancelWaiting(store, userId) {
  const rooms = await store.listDuels(userId, { status: 'waiting' })
  const after = await Promise.all(rooms.map((room) => cancelRoom(store, room.id, userId)))
  return after.find((duel) => duel?.status === 'active') ?? null
}

// Quick match, second half: a waiting player whose duel is newer than another waiting one joins
// the older one, so two people who queued at the same moment still meet. Their own room is given
// up first (if someone took that seat meanwhile, they stay there), and opened again when no older
// duel could be joined after all.
async function joinOlderQueue(store, duel, user, now) {
  if (duel.kind !== 'queue' || duel.status !== 'waiting' || duel.players[0].userId !== user.id) return null
  const older = (await store.findQueueDuels(user.id, iso(now - QUEUE_FRESH_MS))).filter((item) => item.createdAt < duel.createdAt || (item.createdAt === duel.createdAt && item.id < duel.id))
  if (!older.length) return null
  const mine = await cancelRoom(store, duel.id, user.id)
  if (mine?.status !== 'cancelled') return null
  for (const candidate of older) {
    const joined = await store.updateDuel(candidate.id, { players: [...candidate.players, seatFor(user, now)], status: 'active', startAt: iso(now) }, candidate.version)
    if (joined) return joined
  }
  await mutate(store, duel.id, (current) => (current.status === 'cancelled' ? { fields: { status: 'waiting' } } : {}), 3)
  return null
}

// GET ?duel=<id>
export async function getDuel(user, id, now = Date.now()) {
  if (id === 'lobby') return getLobby(user)
  if (!isId(id)) return fail(400, 'Invalid request.')
  const store = getStore()
  let duel = await store.getDuel(id)
  if (!duel) return fail(404, 'Duel not found.')
  duel = (await joinOlderQueue(store, duel, user, now)) ?? (await settle(store, duel, user.id, now))
  return respond(store, duel, user.id, now)
}

// GET ?duel=lobby: my rating, my recent duels, a duel I can go back to, and the leaderboard.
async function getLobby(user) {
  const store = getStore()
  const [rating, finished, ongoing, leaderboard] = await Promise.all([
    ratingOf(store, user.id),
    store.listDuels(user.id, { status: 'finished', limit: RECENT_DUELS }),
    store.listDuels(user.id, { status: 'active', limit: 1 }),
    duelLeaderboard(store, user.id),
  ])
  const recent = await Promise.all(
    finished.map(async (duel) => {
      const opponent = duel.players.find((player) => player.userId !== user.id)
      const mine = duel.result?.players.find((item) => item.userId === user.id)
      const theirs = duel.result?.players.find((item) => item.userId !== user.id)
      return {
        id: duel.id,
        kind: duel.kind,
        finishedAt: duel.finishedAt,
        outcome: mine?.outcome ?? 'draw',
        you: mine?.score ?? 0,
        them: theirs?.score ?? 0,
        rated: Boolean(duel.result?.rated),
        ratingAfter: duel.result?.rating?.[user.id]?.after ?? null,
        opponent: opponent?.bot ? { ...BOT_PERSON, bot: true } : { ...who(await store.getProfile(opponent?.userId), opponent?.userId ?? ''), bot: false },
      }
    }),
  )
  // Only a duel I'm still in, and that hasn't gone quiet, is worth going back to.
  const active = ongoing.find((duel) => Date.now() - Date.parse(duel.players.find((p) => p.userId === user.id)?.seenAt ?? 0) < STALE_MS)
  return ok({ rating, recent, leaderboard, active: active ? { id: active.id, kind: active.kind } : null, isDemo: Boolean(user.isDemo) })
}

// POST { duel: action, ... }
export async function duelAction(user, body, now = Date.now()) {
  const action = body.duel
  if (!ACTIONS.includes(action)) return fail(400, 'Invalid request.')
  const store = getStore()
  if (action === 'create') {
    const duel = await createWithCode(store, { kind: 'private', status: 'waiting', players: [seatFor(user, now)], rounds: buildRounds() })
    return respond(store, duel, user.id, now, 201)
  }
  if (action === 'queue') return queue(store, user, now)
  if (action === 'bot') return playBot(store, user, now)
  if (action === 'join') return join(store, user, body, now)
  if (!isId(body.id)) return fail(400, 'Invalid request.')
  if (action === 'answer') return answer(store, user, body, now)
  if (action === 'focus') return focus(store, user, body, now)
  if (action === 'leave') return leave(store, user, body, now)
  return rematch(store, user, body, now)
}

function joinFields(duel, user, now) {
  if (isPlayer(duel, user.id)) return {}
  if (duel.status === 'finished' || duel.status === 'cancelled') return { error: fail(410, 'This duel is over.') }
  if (duel.status !== 'waiting' || duel.players.length >= 2) return { error: fail(409, 'This duel is already full.') }
  // The host closed the page a while ago: starting now would only make them forfeit.
  if (now - Date.parse(duel.players[0].seenAt) > STALE_MS) return { error: fail(410, 'This duel expired. Ask for a new link.') }
  return { fields: { players: [...duel.players, seatFor(user, now)], status: 'active', startAt: iso(now) } }
}

async function join(store, user, body, now) {
  let id = body.id
  if (!isId(id)) {
    const code = normalizeCode(body.code)
    if (code.length !== CODE_LENGTH) return fail(400, 'Type the 6-character duel code.')
    const found = await store.findDuelByCode(code)
    if (!found) return fail(404, 'No duel has that code.')
    id = found.id
  }
  const { duel, error } = await mutate(store, id, (current) => joinFields(current, user, now))
  if (error) return error
  return respond(store, duel, user.id, now)
}

async function queue(store, user, now) {
  const waiting = await store.listDuels(user.id, { status: 'waiting' })
  const own = waiting.find((duel) => duel.kind === 'queue')
  if (own) return respond(store, await settle(store, await store.getDuel(own.id), user.id, now), user.id, now)
  // A private room I left open: given up, since I'm looking for someone else now.
  const taken = await cancelWaiting(store, user.id)
  if (taken) return respond(store, taken, user.id, now)
  for (const candidate of await store.findQueueDuels(user.id, iso(now - QUEUE_FRESH_MS))) {
    const outcome = joinFields(candidate, user, now)
    if (!outcome.fields) continue
    const joined = await store.updateDuel(candidate.id, outcome.fields, candidate.version)
    if (joined) return respond(store, joined, user.id, now)
  }
  const duel = await createWithCode(store, { kind: 'queue', status: 'waiting', players: [seatFor(user, now)], rounds: buildRounds() })
  return respond(store, duel, user.id, now, 201)
}

// The Glitch Bot, for when nobody else is around. Every waiting room of mine is given up first
// (the client still sends the one it showed as `from`); if someone just took a seat in one, I play
// that duel instead.
async function playBot(store, user, now) {
  const taken = await cancelWaiting(store, user.id)
  if (taken) return respond(store, taken, user.id, now)
  const rounds = buildRounds()
  const duel = await createWithCode(store, {
    kind: 'bot',
    status: 'active',
    players: [seatFor(user, now), BOT_SEAT(now)],
    rounds,
    botPlan: botPlan(rounds),
    startAt: iso(now),
  })
  return respond(store, duel, user.id, now, 201)
}

// One answer per round, only while that round is open, timed by the server when it arrives.
async function answer(store, user, body, now) {
  const { round, choice } = body
  if (!Number.isInteger(round) || typeof choice !== 'string') return fail(400, 'Invalid request.')
  const { duel, error } = await mutate(store, body.id, (current) => {
    if (!isPlayer(current, user.id)) return { error: fail(403, 'You are not in this duel.') }
    if (current.status !== 'active') return { error: fail(409, 'This duel is over.') }
    const rounds = timeline(current, now)
    const where = phaseAt(rounds, now)
    if (where.phase !== 'round' || where.index !== round) return { error: fail(409, 'This round is not open.') }
    if (rounds[round].answers[user.id]) return { error: fail(409, 'You already answered this round.') }
    if (!current.rounds[round].options.some((option) => option.id === choice)) return { error: fail(400, 'Pick one of the options.') }
    return { fields: { answers: [...current.answers, { userId: user.id, round, choice, at: iso(now) }], players: touch(current.players, user.id, now) } }
  })
  if (error) return error
  // The last answer of the last round ends the duel right away.
  return respond(store, await settle(store, duel, user.id, now), user.id, now)
}

// The page went away (hidden tab, lost focus) or came back. Recorded with the server's time while
// the duel is on; leaving during an open round voids that round (see leftDuring in clock.js).
async function focus(store, user, body, now) {
  if (body.state !== 'hidden' && body.state !== 'visible') return fail(400, 'Invalid request.')
  const { error, written } = await mutate(store, body.id, (current) => {
    if (!isPlayer(current, user.id)) return { error: fail(403, 'You are not in this duel.') }
    if (current.status !== 'active') return {}
    const count = current.focus.filter((event) => event.userId === user.id).length
    if (count >= MAX_FOCUS_EVENTS) return {}
    // Out of reports: spamming them and then leaving for free doesn't work, the last one says hidden.
    const state = count === MAX_FOCUS_EVENTS - 1 ? 'hidden' : body.state
    return { fields: { focus: [...current.focus, { userId: user.id, state, at: iso(now) }] } }
  })
  if (error) return error
  return ok({ recorded: Boolean(written) })
}

// Leaving a waiting room cancels it; leaving a duel in progress forfeits it.
async function leave(store, user, body, now) {
  const { duel, error } = await mutate(store, body.id, async (current) => {
    if (!isPlayer(current, user.id)) return { error: fail(403, 'You are not in this duel.') }
    if (current.status === 'waiting') return { fields: { status: 'cancelled' } }
    if (current.status === 'active') return { fields: await finishFields(store, current, now, user.id) }
    return {}
  })
  if (error) return error
  return respond(store, duel, user.id, now)
}

// Another round with the same person: the first to ask opens a private duel, the second joins it.
async function rematch(store, user, body, now) {
  const old = await store.getDuel(body.id)
  if (!old) return fail(404, 'Duel not found.')
  if (!isPlayer(old, user.id)) return fail(403, 'You are not in this duel.')
  if (old.status !== 'finished' || old.kind === 'bot') return fail(409, 'Invalid request.')
  if (old.rematchId) return join(store, user, { id: old.rematchId }, now)

  const fresh = await createWithCode(store, { kind: 'private', status: 'waiting', players: [seatFor(user, now)], rounds: buildRounds(), rematchOf: old.id })
  const { duel: linked } = await mutate(store, old.id, (current) => (current.rematchId ? {} : { fields: { rematchId: fresh.id } }))
  if (linked?.rematchId && linked.rematchId !== fresh.id) {
    // The other player asked at the same moment: drop mine and join theirs.
    await mutate(store, fresh.id, () => ({ fields: { status: 'cancelled' } }))
    return join(store, user, { id: linked.rematchId }, now)
  }
  return respond(store, fresh, user.id, now, 201)
}
