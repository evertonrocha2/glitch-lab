import { DUEL_ROUNDS } from '../../../shared/duel.js'
import { closedRounds, leftDuring, phaseAt, scoreRound, timeline } from './clock.js'
import { optionsFor } from './questions.js'

// What the browser sees of a duel. Built field by field: no user ids, and a round's answer, the
// other player's pick and anyone's points only once that round is closed. The bot's plan never.

const iso = (time) => new Date(time).toISOString()
const seatOf = (duel, userId) => duel.players.findIndex((player) => player.userId === userId)

// The question as a player sees it: their own option order, no answer.
function question(duel, index, viewerId) {
  const round = duel.rounds[index]
  return { index, type: round.type, prompt: round.prompt, options: optionsFor(round, duel.id, viewerId ?? 'spectator', index) }
}

function closedView(duel, round) {
  const answer = duel.rounds[round.index].options.find((option) => option.id === duel.rounds[round.index].answer)
  return {
    index: round.index,
    type: duel.rounds[round.index].type,
    answer,
    players: duel.players.map((player) => scoreRound(duel, round, player.userId)),
  }
}

// people: [{ name, handle, avatar }] in seat order.
export function publicDuel(duel, viewerId, now, people) {
  const seat = seatOf(duel, viewerId)
  const players = duel.players.map((player, index) => ({ ...people[index], bot: Boolean(player.bot), you: index === seat }))
  const base = {
    id: duel.id,
    code: duel.code,
    kind: duel.kind,
    status: duel.status,
    now: iso(now),
    roundCount: DUEL_ROUNDS,
    you: seat === -1 ? null : seat,
    players,
    rematchId: duel.rematchId ?? null,
  }
  if (duel.status === 'waiting' || duel.status === 'cancelled') {
    return { ...base, joinable: duel.status === 'waiting' && seat === -1 && duel.players.length < 2, createdAt: duel.createdAt }
  }
  // Someone else's duel in progress: who plays, nothing more.
  if (seat === -1 && duel.status === 'active') return { ...base, status: 'active', spectator: true }

  // A finished duel stops its clock where it ended (a forfeit can end it mid-round).
  const clock = duel.status === 'finished' ? Math.min(now, Date.parse(duel.finishedAt)) : now
  const rounds = timeline(duel, clock)
  const closed = closedRounds(rounds, clock).map((round) => closedView(duel, round))
  const scores = duel.players.map((_, index) => closed.reduce((sum, round) => sum + round.players[index].points, 0))
  const view = { ...base, startAt: duel.startAt, scores, rounds: closed }

  if (duel.status === 'finished') {
    const { result } = duel
    const seatOfUser = (userId) => (userId ? seatOf(duel, userId) : null)
    return {
      ...view,
      phase: 'finished',
      finishedAt: duel.finishedAt,
      result: {
        reason: result.reason,
        winner: seatOfUser(result.winner),
        forfeit: seatOfUser(result.forfeitBy),
        scores: result.players.map((item) => item.score),
        rated: result.rated,
        rating: seat === -1 ? null : (result.rating?.[viewerId] ?? null),
      },
    }
  }

  const where = phaseAt(rounds, now)
  const at = (index) => rounds[index]
  const nextUp = where.next === null ? null : { index: where.next, openAt: iso(at(where.next).openAt) }
  if (where.phase === 'round') {
    const open = at(where.index)
    const mine = open.answers[viewerId]
    return {
      ...view,
      phase: 'round',
      current: {
        ...question(duel, where.index, viewerId),
        openAt: iso(open.openAt),
        deadline: iso(open.deadline),
        answered: duel.players.map((player) => Boolean(open.answers[player.userId])),
        left: duel.players.map((player) => leftDuring(duel.focus, player.userId, open.openAt, now + 1)),
        myChoice: mine?.choice ?? null,
      },
      next: null,
    }
  }
  // Between rounds: the last one again, now with its answer, for the reveal.
  const last = where.index === null ? null : { ...question(duel, where.index, viewerId), ...closed[where.index] }
  return { ...view, phase: where.phase === 'over' ? 'reveal' : where.phase, last, next: nextUp }
}
