import { closedRounds, scoreRound, timeline } from './clock.js'
// A duel against the bot or with a demo account in it pays like a bot game and never earns the
// duelist badge: anyone can open a passwordless demo in a second tab and lose to themselves.
const practice = (duel) => duel.kind === 'bot' || duel.players.some((player) => player.bot || player.isDemo)

// computeProgress's `duel` input: { results: [{ day, outcome, vsBot, early, fastestMs, correct }] }, one per
// finished duel. For XP, the duelist and speed-demon badges and the activity graph.
// Rounds this player answered right among the ones that closed, scored the same way the result is
// (not the duel points: those add up to hundreds per duel and would flood the acerto count).
const correctRounds = (duel, userId) => {
  const closedAt = Date.parse(duel.finishedAt)
  return closedRounds(timeline(duel, closedAt), closedAt).filter((round) => scoreRound(duel, round, userId).correct).length
}

export async function loadDuel(store, userId) {
  const finished = await store.listDuels(userId, { status: 'finished' })
  const results = await Promise.all(
    finished.map(async (summary) => {
      const mine = summary.result?.players?.find((item) => item.userId === userId)
      if (!mine || !summary.finishedAt) return null
      // The list only carries summaries; the rounds and answers live on the full duel.
      const duel = await store.getDuel(summary.id)
      if (!duel) return null
      return {
        day: summary.finishedAt.slice(0, 10), outcome: mine.outcome, vsBot: practice(summary), early: Boolean(summary.result.early),
        fastestMs: mine.fastestMs ?? null, correct: correctRounds(duel, userId),
      }
    }),
  )
  return { results: results.filter(Boolean) }
}
