import { describe, expect, it } from 'vitest'
import { DIFFICULTIES } from '../../shared/game/enemies.js'
import { RARITIES, salvageValue } from '../../shared/game/items.js'
import { maxDropIlvl, refGold, refXp } from '../../shared/game/economy.js'
import {
  MAX_MARKET_TIER, SCRAP_GOLD, STOCK_SIZE, buyPrice, marketDay, marketIlvl, marketRerollCost, marketState, marketStock,
  marketTierOf, marketView, sellValue,
} from '../../shared/game/shop.js'
import { ZONES } from '../../shared/game/zones.js'

const gear = (patch = {}) => ({
  id: 'item00000001', kind: 'gear', base: 'espada', slot: 'weapon', rarity: 'common', ilvl: 1, affixes: [], sockets: [], upgrade: 0, rerolls: 0, equipped: null, ...patch,
})
const stockOf = (patch = {}) => marketStock({ userId: 'alice', day: '2026-11-26', tier: 1, rerolls: 0, level: 5, ...patch })

describe('the economy yardstick', () => {
  const z = ZONES['floresta-js']
  it('reads the gold and xp a plain kill pays where an item level drops', () => {
    expect(refGold(1)).toBe(z.z1.gold)
    expect(refGold(z.z2.ilvl)).toBe(z.z2.gold)
    expect(refGold(z.z3.ilvl + DIFFICULTIES.pesadelo.ilvl)).toBe(z.z3.gold * DIFFICULTIES.pesadelo.mult)
    expect(refXp(1)).toBe(z.z1.xp)
    // Below every zone: the lowest one.
    expect(refGold(0)).toBe(z.z1.gold)
  })
  it('never goes down as the item level goes up', () => {
    for (let ilvl = 1; ilvl < 70; ilvl++) {
      expect(refGold(ilvl + 1)).toBeGreaterThanOrEqual(refGold(ilvl))
      expect(refXp(ilvl + 1)).toBeGreaterThanOrEqual(refXp(ilvl))
    }
  })
  it('knows the highest item level a hunt drops', () => {
    expect(maxDropIlvl()).toBe(z.z3.ilvl + DIFFICULTIES.inferno.ilvl)
  })
})

describe('the merchant stock', () => {
  it('is the same for one user and day, and new for another day, user or reroll', () => {
    const ids = (stock) => stock.map((item) => item.id).join()
    expect(stockOf()).toEqual(stockOf())
    expect(ids(stockOf({ day: '2026-11-27' }))).not.toBe(ids(stockOf()))
    expect(ids(stockOf({ userId: 'bob' }))).not.toBe(ids(stockOf()))
    expect(ids(stockOf({ rerolls: 1 }))).not.toBe(ids(stockOf()))
    expect(ids(stockOf({ tier: 2 }))).not.toBe(ids(stockOf()))
  })

  it('holds STOCK_SIZE gear pieces of different slots, uncommon or better, at the market item level', () => {
    for (const day of ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']) {
      const stock = stockOf({ day, level: 12, tier: 2 })
      expect(stock).toHaveLength(STOCK_SIZE)
      expect(new Set(stock.map((item) => item.slot)).size).toBe(STOCK_SIZE)
      for (const item of stock) {
        expect(item.kind).toBe('gear')
        expect(item.equipped).toBeNull()
        expect(item.rarity).not.toBe('common')
        expect(item.ilvl).toBe(12)
      }
    }
  })

  it('ties the item level to the hero level, inside the market tier band, never above what hunts drop', () => {
    expect(marketTierOf(1)).toBe(1)
    expect(marketTierOf(10)).toBe(1)
    expect(marketTierOf(11)).toBe(2)
    expect(marketTierOf(60)).toBe(MAX_MARKET_TIER)
    expect(marketIlvl(7)).toBe(7)
    expect(marketIlvl(7, 3)).toBe(21)
    expect(marketIlvl(35, 2)).toBe(20)
    expect(marketIlvl(60)).toBe(maxDropIlvl())
  })

  it('prices by rarity and item level, and buys back for less than any sale, but more than salvage scrap is worth', () => {
    for (const ilvl of [1, 8, 14, 29, 44]) {
      let last = 0
      for (const rarity of RARITIES) {
        for (const upgrade of [0, 5, 10]) {
          const item = gear({ ilvl, rarity, upgrade })
          expect(sellValue(item), `${rarity} ${ilvl} +${upgrade}`).toBeLessThan(buyPrice(item))
          expect(sellValue(item)).toBeGreaterThan(salvageValue(item).scrap * SCRAP_GOLD)
        }
        expect(buyPrice(gear({ ilvl, rarity }))).toBeGreaterThan(last)
        last = buyPrice(gear({ ilvl, rarity }))
      }
    }
    expect(buyPrice(gear({ ilvl: 14, rarity: 'rare' }))).toBeGreaterThan(buyPrice(gear({ ilvl: 1, rarity: 'rare' })))
  })

  it('pays an upgrade far less back than the forge charged for it', () => {
    const plain = gear({ rarity: 'rare', ilvl: 8 })
    // A +1 costs at least 50 gold x the rarity factor (items.js upgradeCost).
    expect(sellValue({ ...plain, upgrade: 1 }) - sellValue(plain)).toBeLessThan(50)
  })

  it('rerolls for fragments, doubling each time that day', () => {
    expect(marketRerollCost(0).fragments).toBeGreaterThan(0)
    expect(marketRerollCost(1).fragments).toBe(2 * marketRerollCost(0).fragments)
  })
})

describe('the market state', () => {
  it('restocks on a new day, freezing the hero level it opened at', () => {
    const fresh = marketState(null, '2026-11-26', 7)
    expect(fresh).toEqual({ day: '2026-11-26', level: 7, rerolls: {}, bought: [] })
    const used = { ...fresh, rerolls: { 1: 2 }, bought: ['abc'] }
    expect(marketState(used, '2026-11-26', 9)).toBe(used)
    expect(marketState(used, '2026-11-27', 9)).toEqual({ day: '2026-11-27', level: 9, rerolls: {}, bought: [] })
  })
  it('never goes back a day, so flipping the client date cannot restock', () => {
    const used = { day: '2026-11-27', level: 7, rerolls: {}, bought: ['abc'] }
    expect(marketState(used, '2026-11-26', 9)).toBe(used)
    expect(marketDay(used, '2026-11-26')).toBe('2026-11-27')
  })
  it('shows the stock without what was bought, its prices, the reroll cost and the bag sell values', () => {
    const market = marketState(null, '2026-11-26', 5)
    const stock = marketStock({ userId: 'alice', day: '2026-11-26', tier: 1, rerolls: 0, level: 5 })
    market.bought.push(stock[0].id)
    const worn = gear({ id: 'worn00000001', equipped: 'weapon' })
    const bag = [gear({ id: 'bag000000001' }), worn, { id: 'gem000000001', kind: 'gem', gem: 'logica' }]
    const view = marketView({ userId: 'alice', market, today: '2026-11-26', level: 30, items: bag })
    expect(view.tier).toBe(1)
    expect(view.ilvl).toBe(5)
    expect(view.stock.map((entry) => entry.item.id)).toEqual(stock.slice(1).map((item) => item.id))
    for (const entry of view.stock) expect(entry.price).toBe(buyPrice(entry.item))
    expect(view.reroll).toEqual(marketRerollCost(0))
    expect(view.sell).toEqual({ bag000000001: sellValue(bag[0]) })
  })
})
