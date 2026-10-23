import { eloRating, START_RATING } from '../../../shared/duel.js'
import { who } from '../daily/leaderboard.js'

export const DUEL_LEADERBOARD_SIZE = 20
const NEW_PLAYER = { rating: START_RATING, games: 0, wins: 0, losses: 0, draws: 0 }

export async function ratingOf(store, userId) {
  const stored = await store.getRating(userId)
  return stored ? { rating: stored.rating, games: stored.games, wins: stored.wins, losses: stored.losses, draws: stored.draws } : { ...NEW_PLAYER }
}

const scoreFor = (result, userId) => (result.winner === null ? 0.5 : result.winner === userId ? 1 : 0)

// { userId: { before, after } } for a rated result, from both players' current ratings; null otherwise.
export async function ratingChanges(store, duel, result) {
  if (!result.rated) return null
  const [first, second] = duel.players
  const [a, b] = await Promise.all([ratingOf(store, first.userId), ratingOf(store, second.userId)])
  return {
    [first.userId]: { before: a.rating, after: eloRating(a.rating, b.rating, scoreFor(result, first.userId)) },
    [second.userId]: { before: b.rating, after: eloRating(b.rating, a.rating, scoreFor(result, second.userId)) },
  }
}

// Saves each player's new rating and record. A rating changed by another duel in between (games
// moved on) gets the same change on top of its new value, so no game is ever lost.
export async function saveRatings(store, duel) {
  const { result } = duel
  if (!result?.rated || !result.rating) return
  for (const player of duel.players) {
    const change = result.rating[player.userId]
    const score = scoreFor(result, player.userId)
    for (let tries = 0; tries < 5; tries++) {
      const current = await ratingOf(store, player.userId)
      const next = {
        rating: current.rating + (change.after - change.before),
        games: current.games + 1,
        wins: current.wins + (score === 1 ? 1 : 0),
        losses: current.losses + (score === 0 ? 1 : 0),
        draws: current.draws + (score === 0.5 ? 1 : 0),
      }
      if (await store.saveRating(player.userId, next, current.games)) break
    }
  }
}

// The top players by rating: public profiles show their name and picture, others stay anonymous.
export async function duelLeaderboard(store, userId) {
  const top = await store.topRatings(DUEL_LEADERBOARD_SIZE)
  const profiles = await Promise.all(top.map((item) => store.getProfile(item.userId)))
  return top.map((item, index) => ({
    rank: index + 1,
    ...who(profiles[index], item.userId),
    rating: item.rating,
    games: item.games,
    wins: item.wins,
    isYou: item.userId === userId,
  }))
}
