import { createHash, timingSafeEqual } from 'node:crypto'
import { env, isProduction } from '../../config/env.js'
import { runCron } from '../daily/daily-set.js'
import { runRiddleCron } from '../glitchdle/riddle-daily.js'
import { runHuntCron } from '../hunt/hunt-daily.js'

const digest = (text) => createHash('sha256').update(text).digest()

// The cron sends "Authorization: Bearer <CRON_SECRET>". Compared in constant time (hashing first
// makes the lengths equal). With no secret set, only local development may run it.
export function cronAllowed(authorization) {
  const secret = env.cronSecret
  if (!secret) return !isProduction()
  return timingSafeEqual(digest(authorization ?? ''), digest(`Bearer ${secret}`))
}

// Writes today's and tomorrow's puzzles, Glitchdle riddles and line hunt. Reports titles and modes
// only, never solutions or answers. A Glitchdle or hunt failure never costs the puzzles their run.
export async function runDaily(store, now = new Date()) {
  const [puzzles, riddle, hunt] = await Promise.all([
    runCron(store, now),
    runRiddleCron(store, now).catch((err) => {
      console.error('Glitchdle cron failed:', err)
      return { failed: true }
    }),
    // Line hunt: a few fresh AI snippets a day, the rest from the pool.
    runHuntCron(store, now).catch((err) => {
      console.error('Line hunt cron failed:', err)
      return { failed: true }
    }),
  ])
  return { ...puzzles, riddle, hunt }
}
