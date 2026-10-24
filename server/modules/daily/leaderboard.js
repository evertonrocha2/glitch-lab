import { AVATAR_COLORS } from '../../../shared/profile.js'
import { defaultSeed } from '../profile/profile.model.js'

export const LEADERBOARD_SIZE = 10
export const ANONYMOUS = 'Anonymous player'

// Only a public profile shows a name and picture. Built field by field: no email, no account id,
// and a private profile's name stays private even when it has one.
export function who(profile, userId) {
  if (!profile?.isPublic || !profile.handle) return { name: ANONYMOUS, handle: null, avatar: null }
  return {
    name: profile.displayName ?? profile.handle,
    handle: profile.handle,
    avatar: profile.avatar ?? { seed: defaultSeed(userId), color: AVATAR_COLORS[0].id },
  }
}

const secondsBetween = (from, to) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))

// Fastest from start to pass first, then fewer attempts, then whoever passed earlier.
// The first person to pass at all gets the firstSolver mark. switchedTo: the programming language
// a solver switched the puzzle to (null when they solved it in the puzzle's own). A switch keeps the
// challenge's start, so the clock never restarts.
export async function leaderboard(store, puzzle, userId) {
  const solves = await store.puzzleSolves(puzzle.id)
  const firstUser = solves.reduce((first, item) => (!first || item.passedAt < first.passedAt ? item : first), null)?.userId
  const ranked = solves
    .map((item) => ({ ...item, seconds: secondsBetween(item.startedAt, item.passedAt) }))
    .sort((a, b) => a.seconds - b.seconds || a.attempts - b.attempts || a.passedAt.localeCompare(b.passedAt))
  const top = ranked.slice(0, LEADERBOARD_SIZE)
  const profiles = await Promise.all(top.map((item) => store.getProfile(item.userId)))
  const mine = ranked.findIndex((item) => item.userId === userId)
  return {
    solvedCount: solves.length,
    leaderboard: top.map((item, index) => ({
      rank: index + 1,
      ...who(profiles[index], item.userId),
      seconds: item.seconds,
      attempts: item.attempts,
      switchedTo: item.language && item.language !== puzzle.language ? item.language : null,
      firstSolver: item.userId === firstUser,
      isYou: item.userId === userId,
    })),
    you: mine === -1 ? null : { rank: mine + 1, seconds: ranked[mine].seconds, attempts: ranked[mine].attempts },
  }
}
