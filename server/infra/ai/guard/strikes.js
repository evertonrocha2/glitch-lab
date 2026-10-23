import { createHash } from 'node:crypto'
import { AppError } from '../../../core/errors.js'
import { LOCKED_MESSAGE } from './messages.js'

// Blocked injection attempts per account and day, in the usage table under their own key (so they
// never count as AI calls). Past STRIKE_LIMIT the AI features answer 429 for the rest of the day.
export const STRIKE_LIMIT = 5
export const strikeKey = (userId) => `ai-guard:${userId}`

const dayOf = (now) => now.toISOString().slice(0, 10)

// A short hash: enough to tell repeated attempts apart in the logs, nothing to read back.
export const shortHash = (text) => createHash('sha256').update(String(text ?? '')).digest('hex').slice(0, 12)

export const lockedOut = () => new AppError(429, LOCKED_MESSAGE, 'AI_LOCKED')

export const strikesToday = (store, user, now = new Date()) => store.countUsage(strikeKey(user.id), dayOf(now))

// Throws the 429 once today's strikes are used up.
export async function assertAiAllowed(store, user, now = new Date()) {
  if ((await strikesToday(store, user, now)) >= STRIKE_LIMIT) throw lockedOut()
}

// Counts one blocked attempt and logs it without its content or who sent it: the rule, the count,
// and hashes of the user id and the text. Returns today's count.
export async function recordStrike(store, user, { rule, text, feature }, now = new Date()) {
  const count = await store.addUsage(strikeKey(user.id), dayOf(now))
  console.warn(`AI guard blocked ${rule} in ${feature ?? 'ai'}: strike ${count}/${STRIKE_LIMIT}, user ${shortHash(user.id)}, input ${shortHash(text)}`)
  return count
}
