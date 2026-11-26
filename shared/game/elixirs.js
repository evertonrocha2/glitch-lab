// Elixirs (fase 3, the Alquimista): timed buffs stored on the hero as { [type]: { startedAt, expiresAt } }.
// Drinking one already active refreshes it to a full duration (never stacks). The hunt settlement reads
// the share of each stretch an elixir covered (xp and drop luck scale by it, and the sample fights hit
// harder by it), and a boss fight reads whether it is active right then. Pure and deterministic.
import { refGold } from './economy.js'
import { MAX_POTION_BUY, POTION_PRICE } from './items.js'

export const ELIXIR_MS = 30 * 60_000

// bonus: +50% hunt XP, +20% damage, +30% drop chance. goldKills: the gold price in kills of the
// yardstick at the hero's level (a 30 minute hunt is about 300 kills, 360 in gold with elites), so
// keeping one up all the time costs about a third of the hunting gold. Pinned in game-economy.test.js:
// neither damage nor luck pays back its gold price in gold.
export const ELIXIRS = {
  xp: { bonus: 0.5, fragments: 40, goldKills: 120 },
  damage: { bonus: 0.2, fragments: 25, goldKills: 100 },
  luck: { bonus: 0.3, fragments: 25, goldKills: 100 },
}
export const ELIXIR_TYPES = Object.keys(ELIXIRS)

export const elixirPrice = (type, level) => ({
  gold: Math.ceil(refGold(level) * ELIXIRS[type].goldKills),
  fragments: ELIXIRS[type].fragments,
})

const isEntry = (entry) => Number.isFinite(entry?.startedAt) && Number.isFinite(entry?.expiresAt)

// The elixirs after drinking one at now: that type runs a full ELIXIR_MS from now, and the ones that
// already ran out are dropped (the settlement before the drink paid their share).
export function drinkElixir(elixirs, type, now) {
  const kept = Object.entries(elixirs ?? {}).filter(([id, entry]) => id !== type && isEntry(entry) && entry.expiresAt > now)
  return { ...Object.fromEntries(kept), [type]: { startedAt: now, expiresAt: now + ELIXIR_MS } }
}

// The share of [from, to] the elixir covered, 0 to 1. An instant (from = to) is 1 when active then.
export function elixirShare(entry, from, to) {
  if (!isEntry(entry)) return 0
  if (to <= from) return entry.startedAt <= from && from < entry.expiresAt ? 1 : 0
  const covered = Math.min(to, entry.expiresAt) - Math.max(from, entry.startedAt)
  return Math.max(0, covered) / (to - from)
}

// { xp, damage, luck }: each elixir's bonus times the share of [from, to] it covered.
export const elixirEffects = (elixirs, from, to) =>
  Object.fromEntries(ELIXIR_TYPES.map((type) => [type, ELIXIRS[type].bonus * elixirShare(elixirs?.[type], from, to)]))

// The fighter with its attack raised by the damage bonus (every hit, skill and dot reads attack).
export const buffFighter = (fighter, damage) =>
  damage > 0 ? { ...fighter, stats: { ...fighter.stats, attack: fighter.stats.attack * (1 + damage) } } : fighter

// What the alchemist sells at this hero level: the potions (moved here from the old shop) and elixirs.
export const alchemistView = (level) => ({
  potions: { gold: POTION_PRICE, max: MAX_POTION_BUY },
  elixirs: ELIXIR_TYPES.map((type) => ({ type, bonus: ELIXIRS[type].bonus, ms: ELIXIR_MS, ...elixirPrice(type, level) })),
})
