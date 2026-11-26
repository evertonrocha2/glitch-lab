// Offline hunt settlement. A handful of seeded sample pack fights stand in for the whole trip:
// their averages say how many packs fit in the time away, how many foes die and what they cost.
// The samples run back to back like the hunt does: each pack starts with the skill cooldowns the last
// one left (minus the walk between them), so every equipped skill gets its turn.
import { simulateFight } from './combat.js'
import { DIFFICULTIES, packFor } from './enemies.js'
import { BAG_SIZE, SUPPORT_SALVAGE_SCRAP, rollGem, rollItem, rollSupport, salvageValue } from './items.js'
import { createRng } from './rng.js'
import { huntXp } from './xp.js'

export { BAG_SIZE }
export const MAX_HUNT_MS = 8 * 3600_000
// The walk between two packs in the samples (their cooldowns tick down meanwhile). The time a hunt
// spends finding the next pack is zone.spawnMs (zones.js).
export const WALK_MS = 1500
export const RESPAWN_MS = 10000
export const SAMPLE_FIGHTS = 12
export const DROP_CHANCE = 0.12
export const GEM_CHANCE = 0.01
export const GEM_SALVAGE_SCRAP = 10
// Support gems (fase 2c): about one an hour. Rolled from their own stream after the items and gems,
// so those stay exactly what they were, and they only take the bag room the items and gems left.
export const SUPPORT_CHANCE = 0.0015
const ELITE_GOLD = 3
const SHOWN_SAMPLES = 3

const mean = (list, pick) => list.reduce((sum, item) => sum + pick(item), 0) / list.length

// What the leader of a pack looks like, for a client that draws one foe.
const foeOf = (enemy) => ({ id: enemy.id, sprite: enemy.sprite, elite: Boolean(enemy.elite) })

// Cooldowns after the walk to the next pack.
const afterWalk = (cooldowns) => Object.fromEntries(Object.entries(cooldowns).map(([id, ms]) => [id, Math.max(0, ms - WALK_MS)]))

// Runs the sample pack fights with a given potion stock and summarizes them (per pack).
function sample({ hero, zone, difficulty, seed, tag, potions }) {
  const root = createRng(seed)
  const fighter = { ...hero, potions }
  const results = []
  let cooldowns = {}
  for (let i = 0; i < SAMPLE_FIGHTS; i++) {
    const elite = i % zone.elitePacks === zone.elitePacks - 1
    const pack = packFor(zone, difficulty, root.fork(`pack:${i}`), { elite })
    const result = simulateFight({ hero: fighter, enemies: pack, seed: `${seed}:${tag}${i}`, cooldowns })
    cooldowns = afterWalk(result.cooldowns)
    // The leader rides along for a client that draws one foe; the log's spawn events have the whole pack.
    results.push({ ...result, enemy: foeOf(pack[0]) })
  }
  return {
    results,
    cycle: mean(results, (r) => r.ms + zone.spawnMs + (r.won ? 0 : RESPAWN_MS)),
    winRate: results.filter((r) => r.won).length / results.length,
    kills: mean(results, (r) => r.kills),
    elites: mean(results, (r) => r.elites),
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

// xpMultiplier: the study multiplier that held for this stretch (1 without study).
export function settleHunt({ hero, zone, difficulty, startedAt, now, seed, bagFree, xpMultiplier = 1 }) {
  const elapsedMs = Math.min(Math.max(now - startedAt, 0), MAX_HUNT_MS)
  const diff = DIFFICULTIES[difficulty]
  const stock = { hp: hero.potions?.hp ?? 0, mp: hero.potions?.mp ?? 0 }
  const withPotions = sample({ hero, zone, difficulty, seed, tag: 's', potions: stock })

  const limit = potionFights(withPotions.perFight, stock)
  const wanted = Math.floor(elapsedMs / withPotions.cycle)
  const fightsA = Math.min(wanted, limit)
  let fights = fightsA
  let killed = fightsA * withPotions.kills
  let eliteKills = fightsA * withPotions.elites
  let won = fightsA * withPotions.winRate

  if (fightsA < wanted) {
    // Potions ran out: the rest of the time is spent without them.
    const dry = sample({ hero, zone, difficulty, seed, tag: 'n', potions: { hp: 0, mp: 0 } })
    const fightsB = Math.floor((elapsedMs - fightsA * withPotions.cycle) / dry.cycle)
    fights += fightsB
    killed += fightsB * dry.kills
    eliteKills += fightsB * dry.elites
    won += fightsB * dry.winRate
  }

  const potionsUsed = {
    hp: Math.min(stock.hp, Math.round(fightsA * withPotions.perFight.hp)),
    mp: Math.min(stock.mp, Math.round(fightsA * withPotions.perFight.mp)),
  }
  const kills = Math.floor(killed + 1e-9)
  const elites = Math.min(kills, Math.floor(eliteKills + 1e-9))
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
      if (items.length + gems.length < bagFree) items.push(item)
      else scrapFromOverflow += salvageValue(item).scrap
    }
    if (rng.chance(GEM_CHANCE)) {
      const gem = rollGem(rng)
      if (items.length + gems.length < bagFree) gems.push(gem)
      else scrapFromOverflow += GEM_SALVAGE_SCRAP
    }
  }

  const supportRng = createRng(seed).fork('supports')
  const supports = []
  for (let k = 0; k < kills; k++) {
    if (!supportRng.chance(SUPPORT_CHANCE)) continue
    const gem = rollSupport(supportRng)
    if (items.length + gems.length + supports.length < bagFree) supports.push(gem)
    else scrapFromOverflow += SUPPORT_SALVAGE_SCRAP
  }

  return {
    elapsedMs,
    kills,
    elites,
    // Packs the hero fell (or ran out of time) in.
    deaths: fights - Math.floor(won + 1e-9),
    gold,
    xp: huntXp({ kills, elites, zone, difficulty, multiplier: xpMultiplier }),
    items,
    gems,
    supports,
    scrapFromOverflow,
    potionsUsed,
    samples: withPotions.results.slice(0, SHOWN_SAMPLES),
  }
}
