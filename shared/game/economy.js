// The yardstick the NPC economy (fase 3) prices with: what a plain kill pays where an item level drops.
// Shop prices, sell values, elixir gold prices and quest rewards are all "so many kills" of it, so they
// follow the zone table (and any region the world adds to it) instead of fixed numbers. Pure.
import { DIFFICULTIES } from './enemies.js'
import { ZONES } from './zones.js'

// About what a hero hunting the zone that fits its level kills in an hour (600 to 630 in the sim,
// pinned in tests/shared/game-economy.test.js). Elites pay 3x, so gold per hour is about 1.2x this in
// plain kills.
export const REF_KILLS_PER_HOUR = 600

// Every (zone, difficulty) pair a hunt can run: its item level, and the gold and xp a plain kill pays.
export function huntSpots(zones = ZONES) {
  const spots = []
  for (const world of Object.values(zones)) {
    for (const zone of Object.values(world)) {
      if (!Number.isFinite(zone?.ilvl) || !Number.isFinite(zone?.gold) || !Number.isFinite(zone?.xp)) continue
      for (const diff of Object.values(DIFFICULTIES)) {
        spots.push({ ilvl: zone.ilvl + diff.ilvl, gold: zone.gold * diff.mult, xp: zone.xp * diff.mult })
      }
    }
  }
  return spots
}

// The best pay among the spots that drop this item level or lower (the lowest spot below them all),
// so it never goes down as the level goes up.
function bestAt(ilvl, field) {
  const spots = huntSpots()
  const open = spots.filter((spot) => spot.ilvl <= ilvl)
  if (open.length === 0) return Math.min(...spots.map((spot) => spot[field]))
  return Math.max(...open.map((spot) => spot[field]))
}

export const refGold = (ilvl) => bestAt(ilvl, 'gold')
export const refXp = (ilvl) => bestAt(ilvl, 'xp')

export const maxDropIlvl = () => Math.max(...huntSpots().map((spot) => spot.ilvl))
