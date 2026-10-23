// computeProgress's `duel` input: { results: [{ day, outcome, vsBot, fastestMs }] }, one per finished
// duel. For XP, the duelist and speed-demon badges and the activity graph.
export async function loadDuel(store, userId) {
  const finished = await store.listDuels(userId, { status: 'finished' })
  const results = finished
    .map((duel) => {
      const mine = duel.result?.players?.find((item) => item.userId === userId)
      if (!mine || !duel.finishedAt) return null
      return { day: duel.finishedAt.slice(0, 10), outcome: mine.outcome, vsBot: duel.kind === 'bot', fastestMs: mine.fastestMs ?? null }
    })
    .filter(Boolean)
  return { results }
}
