// A player's Glitchdle results in the shape shared/riddle/game.js reads: [{ day, mode, guessCount, solved }].
export const toResults = (list) => list.map(({ day, mode, guesses, solved }) => ({ day, mode, guessCount: guesses.length, solved }))

// computeProgress's `riddle` input: { results }. For XP, the lingo-master badge and the activity graph.
export async function loadRiddle(store, userId) {
  return { results: toResults(await store.listRiddleResults(userId)) }
}
