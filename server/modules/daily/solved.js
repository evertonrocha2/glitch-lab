// The daily and global puzzles a student passed, as computeProgress's `daily` input:
// { solved: [{ kind, day, difficulty }] }. Pass `challenges` when they're already loaded.
export async function loadDaily(store, userId, challenges) {
  const list = challenges ?? (await store.listChallenges(userId))
  const ids = [...new Set(list.filter((item) => item.puzzleId && item.status === 'passed').map((item) => item.puzzleId))]
  if (ids.length === 0) return { solved: [] }
  const puzzles = await store.listPuzzles({ ids })
  return { solved: puzzles.map(({ kind, day, difficulty }) => ({ kind, day, difficulty })) }
}
