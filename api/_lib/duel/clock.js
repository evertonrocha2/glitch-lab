import { COUNTDOWN_MS, REVEAL_MS, ROUND_MS, roundPoints, STALE_MS } from '../../../shared/duel.js'

// The duel clock, worked out from what's stored: startAt, the answers (with the server time each
// one arrived) and the bot's plan. Nothing here trusts a time sent by the browser.
//
// Round 0 opens COUNTDOWN_MS after startAt. A round closes at its deadline (ROUND_MS after it
// opened) or as soon as both players have answered, and the next one opens REVEAL_MS later.

export const BOT_ID = 'bot'
const ms = (iso) => Date.parse(iso)

// The Glitch Bot's answer to a round, once its moment has come.
function botAnswer(duel, index, openAt, deadline, now) {
  const plan = duel.botPlan?.[index]
  if (!plan || !duel.players.some((player) => player.bot)) return null
  const at = openAt + plan.delayMs
  return at < deadline && at <= now ? { userId: BOT_ID, round: index, choice: plan.choice, at } : null
}

// [{ index, openAt, deadline, closeAt, answers: { userId: { choice, at } } }], times in ms.
// A round still open has closeAt = its deadline; later rounds are only provisional until it closes.
export function timeline(duel, now) {
  const seats = duel.players.map((player) => player.userId)
  const rounds = []
  let openAt = ms(duel.startAt) + COUNTDOWN_MS
  duel.rounds.forEach((_, index) => {
    const deadline = openAt + ROUND_MS
    const answers = {}
    for (const answer of duel.answers) {
      if (answer.round === index && !answers[answer.userId]) answers[answer.userId] = { choice: answer.choice, at: ms(answer.at) }
    }
    const bot = botAnswer(duel, index, openAt, deadline, now)
    if (bot) answers[BOT_ID] = bot
    const everyone = seats.length > 1 && seats.every((id) => answers[id])
    const closeAt = everyone ? Math.min(deadline, Math.max(...seats.map((id) => answers[id].at))) : deadline
    rounds.push({ index, openAt, deadline, closeAt, answers })
    openAt = closeAt + REVEAL_MS
  })
  return rounds
}

// Where the duel stands at `now`: countdown (before round 0), round (one is open), reveal (between
// two rounds) or over (the last one closed). `index` is the open or last closed round, `next` the
// next one to open.
export function phaseAt(rounds, now) {
  if (now < rounds[0].openAt) return { phase: 'countdown', index: null, next: 0 }
  const open = rounds.find((round) => round.openAt <= now && now < round.closeAt)
  if (open) return { phase: 'round', index: open.index, next: null }
  const last = rounds.findLast((round) => round.closeAt <= now)
  if (last.index === rounds.length - 1) return { phase: 'over', index: last.index, next: null }
  return { phase: 'reveal', index: last.index, next: last.index + 1 }
}

// Tab leaving. The page reports when it's hidden or loses focus and when it comes back; the
// server stamps each report. A player "left" a round when they went away while it was open, or
// were still away when it opened. A deterrent, not proof: a second device or a slow report gets
// around it, and a report that never arrives (a crash) counts as staying.
export function leftDuring(focus, userId, openAt, closeAt) {
  const mine = focus
    .filter((event) => event.userId === userId)
    .map((event) => ({ state: event.state, at: ms(event.at) }))
    .sort((a, b) => a.at - b.at)
  const before = mine.filter((event) => event.at < openAt).at(-1)
  if (before?.state === 'hidden') return true
  return mine.some((event) => event.state === 'hidden' && event.at >= openAt && event.at < closeAt)
}

// One player's round: what they picked, if it was right, how long it took, if they left the tab,
// and the points. Only call it for a closed round (or the result would leak the answer).
export function scoreRound(duel, round, userId) {
  const answer = round.answers[userId]
  const left = leftDuring(duel.focus, userId, round.openAt, round.closeAt)
  const correct = Boolean(answer) && answer.choice === duel.rounds[round.index].answer
  const took = answer ? answer.at - round.openAt : null
  return { choice: answer?.choice ?? null, correct, ms: took, left, points: roundPoints({ correct, ms: took, left }) }
}

export const closedRounds = (rounds, now) => rounds.filter((round) => round.closeAt <= now)

// The final result once the duel is over, or null while it goes on. `presentId` is the player
// asking right now (so they count as seen). Forfeit rule: during an active duel, a player whose
// page hasn't checked in for STALE_MS loses, whatever the score; when both went quiet, the one
// gone longer loses. Players who stay but don't answer just score 0 on those rounds.
export function outcomeAt(duel, now, presentId = null) {
  if (duel.status !== 'active') return null
  const rounds = timeline(duel, now)
  const over = now >= rounds.at(-1).closeAt
  let forfeitBy = null
  if (!over) {
    const seenAt = (player) => (player.userId === presentId ? now : ms(player.seenAt))
    const stale = duel.players.filter((player) => !player.bot && now - seenAt(player) > STALE_MS).sort((a, b) => seenAt(a) - seenAt(b))
    if (!stale.length) return null
    forfeitBy = stale[0].userId
  }
  return buildResult(duel, rounds, now, forfeitBy)
}

// { reason, forfeitBy, winner (null for a draw), rated, players: [{ userId, score, fastestMs, outcome }] }.
// Rated: two people, neither of them a demo account, never the bot.
export function buildResult(duel, rounds, now, forfeitBy = null) {
  const closed = closedRounds(rounds, now)
  const players = duel.players.map((player) => {
    const scored = closed.map((round) => scoreRound(duel, round, player.userId))
    const fastest = scored.filter((item) => item.correct && !item.left).map((item) => item.ms)
    return { userId: player.userId, score: scored.reduce((sum, item) => sum + item.points, 0), fastestMs: player.bot || !fastest.length ? null : Math.min(...fastest) }
  })
  let winner = null
  if (forfeitBy) winner = players.find((item) => item.userId !== forfeitBy)?.userId ?? null
  else if (players[0].score !== players[1].score) winner = players[0].score > players[1].score ? players[0].userId : players[1].userId
  const outcome = (userId) => (userId === forfeitBy ? 'forfeit' : winner === null ? 'draw' : winner === userId ? 'win' : 'loss')
  return {
    reason: forfeitBy ? 'forfeit' : 'score',
    forfeitBy,
    winner,
    rated: duel.kind !== 'bot' && duel.players.every((player) => !player.bot && !player.isDemo),
    players: players.map((item) => ({ ...item, outcome: outcome(item.userId) })),
  }
}
