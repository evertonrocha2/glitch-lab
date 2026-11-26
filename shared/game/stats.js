// Hero stats and power. Combat and the server read the hero from here.
// Rule for attackSpeed: base 1.0 attacks per second. Items, sets and talents give attackSpeed as a percent
// (martelo -5, tipagem-forte -15), summed, then applied as 1 * (1 + sum / 100). So -15 means 15% slower.
import { GEMS, STATS_KEYS, itemStats, setBonuses } from './items.js'
import { talentStats } from './talents.js'

export const CAPS = { dodge: 50, critChance: 100, resFire: 75, resIce: 75, resLightning: 75, resPoison: 75 }
const MIN_ATTACK_SPEED = 0.1

export const baseStats = (level) => ({
  hp: 200 + 40 * level,
  mana: 80 + 4 * level,
  attack: 10 + 3 * level,
  armor: 5 + 2 * level,
  critChance: 5,
  critDamage: 150,
  attackSpeed: 1,
  dodge: 3,
  magicPct: 0,
  resFire: 0,
  resIce: 0,
  resLightning: 0,
  resPoison: 0,
  attackPct: 0,
  hpPct: 0,
})

// items: equipped gear (gems live in each item's sockets). gems and bases override the default tables.
export function heroStats({ level, items = [], talents = [], gems = GEMS, bases } = {}) {
  const total = baseStats(level)
  const effects = []
  let speedPct = 0
  const add = (stats) => {
    for (const key of STATS_KEYS) {
      const value = stats[key]
      if (!value) continue
      if (key === 'attackSpeed') speedPct += value
      else total[key] += value
    }
    effects.push(...(stats.effects ?? []))
  }
  for (const item of items) add(itemStats(item, gems, bases))
  add(setBonuses(items))
  add(talentStats(talents))
  // The percent stats are folded into attack and hp, so they read 0 afterwards.
  total.attack = Math.round(total.attack * (1 + total.attackPct / 100))
  total.hp = Math.round(total.hp * (1 + total.hpPct / 100))
  total.attackPct = 0
  total.hpPct = 0
  total.attackSpeed = Math.max(MIN_ATTACK_SPEED, total.attackSpeed * (1 + speedPct / 100))
  for (const [key, cap] of Object.entries(CAPS)) total[key] = Math.min(cap, total[key])
  const all = [...new Set(effects)]
  if (all.includes('bruteForce')) total.critChance = 0
  return { ...total, effects: all }
}

export function power(stats) {
  const crit = 1 + (stats.critChance / 100) * (stats.critDamage / 100 - 1)
  const dps = stats.attack * stats.attackSpeed * crit * (1 + stats.magicPct / 100)
  const ehp = (stats.hp * (1 + stats.armor / 100)) / (1 - stats.dodge / 100)
  return Math.round(Math.sqrt(dps * ehp))
}
