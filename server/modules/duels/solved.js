// A duel against the bot or with a demo account in it pays like a bot game and never earns the
// duelist badge: anyone can open a passwordless demo in a second tab and lose to themselves.
const practice = (duel) => duel.kind === 'bot' || duel.players.some((player) => player.bot || player.isDemo)

// The result stores how many rounds each player answered right. Duels finished before that was
// stored only have points: a right round is worth 100 to 200, so score / 200 rounded down never
// overstates it. No per-duel read: progress is loaded often.
const correctOf = (mine) => mine.correct ?? Math.floor((mine.score ?? 0) / 200)

// computeProgress's `duel` input: { results: [{ day, outcome, vsBot, early, fastestMs, correct }] }, one per
// finished duel. For XP, the duelist and speed-demon badges and the activity graph.
export async function loadDuel(store, userId) {
  const finished = await store.listDuels(userId, { status: 'finished' })
  const results = finished
    .map((duel) => {
      const mine = duel.result?.players?.find((item) => item.userId === userId)
      if (!mine || !duel.finishedAt) return null
      return { day: duel.finishedAt.slice(0, 10), outcome: mine.outcome, vsBot: practice(duel), early: Boolean(duel.result.early), fastestMs: mine.fastestMs ?? null, correct: correctOf(mine) }
    })
    .filter(Boolean)
  return { results }
}
