// The Mercador (fase 3): a daily stock of gear per user and day, bought with gold, and buying back the
// player's gear. Pure: the stock comes from a seed (user, day, market tier, rerolls), so the server and a
// test roll the same pieces. Prices are kills of the economy yardstick (economy.js).
//
// Not exploitable: the merchant always buys a piece back for less than he sells it for (a few percent
// for a plain piece), so buy then sell loses gold. Selling still beats salvage: a sale pays the salvage scrap at
// SCRAP_GOLD each on top of the item's own value. Upgrades add only their salvage scrap (3 each, 3 gold),
// far under the 50+ gold a +1 costs at the forge.
import { maxDropIlvl, refGold } from './economy.js'
import { SLOTS, rollItem, salvageValue } from './items.js'
import { createRng } from './rng.js'

export const STOCK_SIZE = 6
// Hero levels per market tier (tier 1: levels 1 to 10). A town of the world may pass its own tier later.
export const MARKET_TIER_LEVELS = 10
export const MAX_MARKET_TIER = 6
// The gold a scrap is worth when the merchant buys an item (a +1 at the forge is 50 gold and 5 scrap
// for a common piece).
export const SCRAP_GOLD = 1
// Kills of the yardstick an item costs, and what the merchant pays back for one (on top of its scrap).
// Selling every drop adds 40 to 50% to the hunting gold (0.2 drops a kill, about 2 kills each plus scrap),
// and the bag (60) caps what a hero away for hours can bring.
export const BUY_KILLS = { common: 30, uncommon: 80, rare: 200, epic: 600, legendary: 2000 }
export const SELL_KILLS = { common: 1, uncommon: 2, rare: 4, epic: 10, legendary: 30 }
// The merchant leans to better pieces than hunts drop, and never stocks commons.
const STOCK_RARITY_BOOST = 1
const STOCK_TRIES = 8
const REROLL_FRAGMENTS = 10

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const isMarketTier = (tier) => Number.isSafeInteger(tier) && tier >= 1 && tier <= MAX_MARKET_TIER
export const marketTierOf = (level) => clamp(Math.ceil(level / MARKET_TIER_LEVELS), 1, MAX_MARKET_TIER)

// The hero level, kept inside the tier's band, never above the best item level hunts drop.
export function marketIlvl(level, tier = marketTierOf(level)) {
  const band = clamp(level, (tier - 1) * MARKET_TIER_LEVELS + 1, tier * MARKET_TIER_LEVELS)
  return Math.max(1, Math.min(band, maxDropIlvl()))
}

// The day's pieces, each in its own slot, uncommon or better (a rare streak of commons keeps the last).
export function marketStock({ userId, day, tier, rerolls = 0, level }) {
  const rng = createRng(`${userId}:market:${day}:${tier}:${rerolls}`)
  const ilvl = marketIlvl(level, tier)
  const slots = [...SLOTS]
  const stock = []
  for (let at = 0; at < STOCK_SIZE; at++) {
    const [slot] = slots.splice(rng.int(slots.length), 1)
    let item
    for (let attempt = 0; attempt < STOCK_TRIES; attempt++) {
      item = rollItem(rng.fork(`item:${at}:${attempt}`), { ilvl, slot, rarityBoost: STOCK_RARITY_BOOST })
      if (item.rarity !== 'common') break
    }
    stock.push(item)
  }
  return stock
}

export const buyPrice = (item) => Math.ceil(refGold(item.ilvl) * BUY_KILLS[item.rarity])
export const sellValue = (item) => Math.floor(refGold(item.ilvl) * SELL_KILLS[item.rarity]) + salvageValue(item).scrap * SCRAP_GOLD
export const marketRerollCost = (rerolls) => ({ fragments: REROLL_FRAGMENTS * 2 ** rerolls })

// The stock's day: today, unless the stored market is already on a later day (the client's date may
// sit a day either side of the server's; going back would restock).
export const marketDay = (market, today) => (market?.day && market.day > today ? market.day : today)

// The stored market on its day, or a fresh one for a new day with the hero level it opens at frozen
// (so leveling mid-day doesn't reshuffle the stock). { day, level, rerolls: { [tier]: n }, bought: [id] }.
export function marketState(market, today, level) {
  if (market?.day && market.day >= today) return market
  return { day: today, level, rerolls: {}, bought: [] }
}

// The market as the panel shows it: the tier's stock minus what was bought, with prices, the next
// reroll's cost, and what the merchant pays for each bag gear piece (worn gear can't be sold).
export function marketView({ userId, market, today, level, items, tier }) {
  const state = marketState(market, today, level)
  const shown = isMarketTier(tier) ? tier : marketTierOf(state.level)
  const rerolls = state.rerolls[shown] ?? 0
  const bought = new Set(state.bought)
  const stock = marketStock({ userId, day: state.day, tier: shown, rerolls, level: state.level }).filter((item) => !bought.has(item.id))
  const sell = Object.fromEntries(items.filter((item) => item.kind === 'gear' && !item.equipped).map((item) => [item.id, sellValue(item)]))
  return {
    day: state.day,
    tier: shown,
    ilvl: marketIlvl(state.level, shown),
    stock: stock.map((item) => ({ item, price: buyPrice(item) })),
    reroll: marketRerollCost(rerolls),
    sell,
  }
}
