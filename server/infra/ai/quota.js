import { AppError } from '../../core/errors.js'
import { spendUsage } from '../../core/usage.js'
import { assertAiAllowed } from './guard/strikes.js'

// Per account and day. Anyone can open a demo account, so demos get the smaller share.
export const DAILY_AI_LIMIT = { user: 30, demo: 20 }

// Every account together, per day: what really caps the AI bill. The daily cron doesn't count
// (it makes a fixed, small number of calls). AI_DAILY_GLOBAL_LIMIT changes it.
export const GLOBAL_AI_KEY = 'ai:all'
export const DEFAULT_GLOBAL_AI_LIMIT = 400
// Demo accounts cost nothing to make, so all of them together get their own, smaller bucket inside
// the global one: a script opening demos runs dry here and leaves the rest to signed-up accounts.
// AI_DAILY_DEMO_LIMIT changes it.
export const DEMO_AI_KEY = 'ai:demo'
export const DEFAULT_DEMO_AI_LIMIT = 120

const envLimit = (name, fallback) => {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

// Spends one AI call and returns true, or returns false once the account's, the demos' or
// everyone's limit for today is used up. The account's counter goes first, so an account past its
// own limit never touches the shared ones.
export async function takeAiCall(store, user, now = new Date()) {
  const day = now.toISOString().slice(0, 10)
  if (!(await spendUsage(store, user.id, day, user.isDemo ? DAILY_AI_LIMIT.demo : DAILY_AI_LIMIT.user))) return false
  if (user.isDemo && !(await spendUsage(store, DEMO_AI_KEY, day, envLimit('AI_DAILY_DEMO_LIMIT', DEFAULT_DEMO_AI_LIMIT)))) return false
  return spendUsage(store, GLOBAL_AI_KEY, day, envLimit('AI_DAILY_GLOBAL_LIMIT', DEFAULT_GLOBAL_AI_LIMIT))
}

export const dailyLimitReached = () => new AppError(429, 'Daily limit reached. Come back tomorrow.', 'DAILY_LIMIT')

// takeAiCall for a service: counts the call, or throws the 429 once today's limit is used up, or
// once the account was blocked too often today (the guard's strikes), so no AI feature slips past it.
export async function spendAiCall(store, user) {
  await assertAiAllowed(store, user)
  if (!(await takeAiCall(store, user))) throw dailyLimitReached()
}
