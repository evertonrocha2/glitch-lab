// Offline hunt settlement. A handful of seeded sample fights stand in for the whole trip:
// their averages say how many fights fit in the time away, how many are won and what they cost.
import { simulateFight } from './combat.js'
import { DIFFICULTIES, enemyFor } from './enemies.js'
import { BAG_SIZE, rollGem, rollItem, salvageValue } from './items.js'
import { createRng } from './rng.js'

export { BAG_SIZE }
export const MAX_HUNT_MS = 8 * 3600_000
export const WALK_MS = 1500
export const RESPAWN_MS = 10000
export const SAMPLE_FIGHTS = 12
export const ELITE_RATE = 0.1
export const DROP_CHANCE = 0.12
export const GEM_CHANCE = 0.01
const ELITE_GOLD = 3
const ELITE_EVERY = Math.round(1 / ELITE_RATE)
const SHOWN_SAMPLES = 3

const mean = (list, pick) => list.reduce((sum, item) => sum + pick(item), 0) / list.length

// Runs the sample fights with a given potion stock and summarizes them.
function sample({ hero, zone, difficulty, seed, tag, potions }) {
  const root = createRng(seed)
  const fighter = { ...hero, potions }
  const results = []
  for (let i = 0; i < SAMPLE_FIGHTS; i++) {
    const elite = i % ELITE_EVERY === ELITE_EVERY - 1
    const enemy = enemyFor(zone, difficulty, root.fork(`enemy:${i}`), { elite })
    results.push(simulateFight({ hero: fighter, enemy, seed: `${seed}:${tag}${i}` }))
  }
  return {
    results,
    cycle: mean(results, (r) => r.ms + WALK_MS + (r.won ? 0 : RESPAWN_MS)),
    winRate: results.filter((r) => r.won).length / results.length,
    perFight: { hp: mean(results, (r) => r.potionsUsed.hp), mp: mean(results, (r) => r.potionsUsed.mp) },
  }
}

// How many fights the potion stock can feed, by the scarcer potion.
const potionFights = (perFight, stock) => {
  let fights = Infinity
  for (const kind of ['hp', 'mp']) {
    if (perFight[kind] > 0) fights = Math.min(fights, Math.floor(stock[kind] / perFight[kind]))
  }
  return fights
}

export function settleHunt({ hero, zone, difficulty, startedAt, now, seed, bagFree }) {
  const elapsedMs = Math.min(Math.max(now - startedAt, 0), MAX_HUNT_MS)
  const diff = DIFFICULTIES[difficulty]
  const stock = { hp: hero.potions?.hp ?? 0, mp: hero.potions?.mp ?? 0 }
  const withPotions = sample({ hero, zone, difficulty, seed, tag: 's', potions: stock })

  const limit = potionFights(withPotions.perFight, stock)
  const wanted = Math.floor(elapsedMs / withPotions.cycle)
  const fightsA = Math.min(wanted, limit)
  let kills = Math.floor(fightsA * withPotions.winRate)
  let fights = fightsA

  if (fightsA < wanted) {
    // Potions ran out: the rest of the time is spent without them.
    const dry = sample({ hero, zone, difficulty, seed, tag: 'n', potions: { hp: 0, mp: 0 } })
    const fightsB = Math.floor((elapsedMs - fightsA * withPotions.cycle) / dry.cycle)
    kills += Math.floor(fightsB * dry.winRate)
    fights += fightsB
  }

  const potionsUsed = {
    hp: Math.min(stock.hp, Math.round(fightsA * withPotions.perFight.hp)),
    mp: Math.min(stock.mp, Math.round(fightsA * withPotions.perFight.mp)),
  }
  const elites = Math.floor(kills * ELITE_RATE)
  const gold = Math.floor((kills - elites + elites * ELITE_GOLD) * zone.gold * diff.mult)

  const rng = createRng(seed).fork('drops')
  const ilvl = zone.ilvl + diff.ilvl
  const items = []
  const gems = []
  let scrapFromOverflow = 0
  for (let k = 0; k < kills; k++) {
    const elite = k < elites
    if (elite || rng.chance(DROP_CHANCE)) {
      const item = rollItem(rng, { ilvl, rarityBoost: diff.rarityBoost })
      if (items.length < bagFree) items.push(item)
      else scrapFromOverflow += salvageValue(item).scrap
    }
    if (rng.chance(GEM_CHANCE)) gems.push(rollGem(rng))
  }

  return {
    elapsedMs,
    kills,
    elites,
    deaths: fights - kills,
    gold,
    items,
    gems,
    scrapFromOverflow,
    potionsUsed,
    samples: withPotions.results.slice(0, SHOWN_SAMPLES),
  }
}
