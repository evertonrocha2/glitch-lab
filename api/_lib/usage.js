// The demo login is public, so it gets more room; everyone gets a cap so nobody burns the free quota.
export const DAILY_AI_LIMIT = { user: 30, demo: 80 }

// Counts one AI call and returns true, or returns false (counting nothing) once today's limit is used up.
export async function takeAiCall(store, user, now = new Date()) {
  const day = now.toISOString().slice(0, 10)
  const limit = user.isDemo ? DAILY_AI_LIMIT.demo : DAILY_AI_LIMIT.user
  if ((await store.countUsage(user.id, day)) >= limit) return false
  await store.addUsage(user.id, day)
  return true
}
