// computeProgress's and activityCalendar's `hunt` input: { runs: [{ day, correct, answered }] }, one
// per daily line hunt played. For XP, the eagle-eye badge and the activity graph. Practice isn't saved.
export async function loadHunt(store, userId) {
  const runs = await store.listHuntRuns(userId)
  return { runs: runs.map(({ day, correct, rounds }) => ({ day, correct, answered: rounds.filter((round) => round.answeredAt).length })) }
}
