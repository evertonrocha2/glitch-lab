// What an hour of hunting a zone pays a hero, for the world tab and the zone label (fase 3): the same
// settleHunt the server pays with, for one hour, so the estimate is the real rule, not a guess. It
// fights a dozen sample packs (a few ms), so answers are kept per hero build and zone.
import { settleHunt } from './hunt.js'

const HOUR = 3600_000
const MAX_KEPT = 200
const kept = new Map()

// The build parts that change a hunt's outcome.
const buildKey = (fighter) =>
  JSON.stringify([fighter.stats, fighter.skills, fighter.supports ?? [], fighter.potions, fighter.thresholds])

// { xp, gold, kills, deaths } per hour for `fighter` ({ stats, skills, supports?, potions, thresholds })
// hunting `zone` on a difficulty, at a study multiplier. Deterministic: the seed is the zone's.
export function zoneRates({ fighter, zone, difficulty = 'normal', multiplier = 1 }) {
  const key = `${zone.world}:${zone.id}:${difficulty}:${multiplier}:${buildKey(fighter)}`
  if (kept.has(key)) return kept.get(key)
  const result = settleHunt({
    hero: fighter,
    zone,
    difficulty,
    startedAt: 0,
    now: HOUR,
    seed: `rates:${zone.world}:${zone.id}:${difficulty}`,
    bagFree: 0,
    xpMultiplier: multiplier,
  })
  const rates = { xp: result.xp, gold: result.gold, kills: result.kills, deaths: result.deaths }
  if (kept.size >= MAX_KEPT) kept.delete(kept.keys().next().value)
  kept.set(key, rates)
  return rates
}
