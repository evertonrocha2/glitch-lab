import { AppError } from '../../core/errors.js'

// Per account and day. Anyone can open a demo account, so demos get the smaller share.
export const DAILY_AI_LIMIT = { user: 30, demo: 20 }

// Every account together, per day. Demo accounts cost nothing to make, so this is what really caps
// the AI bill: a script opening thousands of demos still stops here. The daily cron doesn't count
// (it makes a fixed, small number of calls). AI_DAILY_GLOBAL_LIMIT changes it.
export const GLOBAL_AI_KEY = 'ai:all'
export const DEFAULT_GLOBAL_AI_LIMIT = 400
const globalLimit = () => {
  const value = Number(process.env.AI_DAILY_GLOBAL_LIMIT)
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_GLOBAL_AI_LIMIT
}

// Counts one AI call and returns true, or returns false (counting nothing) once the account's or
// everyone's limit for today is used up.
export async function takeAiCall(store, user, now = new Date()) {
  const day = now.toISOString().slice(0, 10)
  const limit = user.isDemo ? DAILY_AI_LIMIT.demo : DAILY_AI_LIMIT.user
  if ((await store.countUsage(user.id, day)) >= limit) return false
  if ((await store.countUsage(GLOBAL_AI_KEY, day)) >= globalLimit()) return false
  await store.addUsage(user.id, day)
  await store.addUsage(GLOBAL_AI_KEY, day)
  return true
}

export const dailyLimitReached = () => new AppError(429, 'Daily limit reached. Come back tomorrow.', 'DAILY_LIMIT')

// takeAiCall for a service: counts the call, or throws the 429 once today's limit is used up.
export async function spendAiCall(store, user) {
  if (!(await takeAiCall(store, user))) throw dailyLimitReached()
}
