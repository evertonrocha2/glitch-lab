// @vitest-environment node
// Balance pins for the NPC economy (fase 3), against the hunt sim: a hero with no gear hunting the
// zone that fits its level (as the XP balance test in game-xp.test.js does).
import { describe, expect, it } from 'vitest'
import { REF_KILLS_PER_HOUR, refGold } from '../../shared/game/economy.js'
import { ELIXIRS, ELIXIR_MS, buffFighter, elixirPrice } from '../../shared/game/elixirs.js'
import { DAILY_CAPS } from '../../shared/game/fuel.js'
import { settleHunt } from '../../shared/game/hunt.js'
import { QUEST_REWARDS, dailyQuests } from '../../shared/game/quests.js'
import { buyPrice, marketStock, sellValue } from '../../shared/game/shop.js'
import { heroStats } from '../../shared/game/stats.js'
import { ZONES } from '../../shared/game/zones.js'

const HOUR = 3_600_000
const FOREST = ZONES['floresta-js']
const SPOTS = [
  { level: 3, zone: FOREST.z1 },
  { level: 10, zone: FOREST.z2 },
  { level: 16, zone: FOREST.z3 },
]
const SEEDS = ['eco:a', 'eco:b', 'eco:c']

const fighter = (level) => ({
  stats: heroStats({ level }), skills: [{ id: 'golpe', level: 1 }], potions: { hp: 0, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 },
})

// An hour of hunting, averaged over a few seeds: kills, gold, xp, drops and what selling them all pays.
function hour({ level, zone }, { damage = 0, dropLuck = 0 } = {}) {
  const total = { kills: 0, gold: 0, xp: 0, drops: 0, sell: 0 }
  for (const seed of SEEDS) {
    const r = settleHunt({
      hero: buffFighter(fighter(level), damage), zone, difficulty: 'normal', startedAt: 0, now: HOUR, seed, bagFree: 10_000, dropLuck,
    })
    total.kills += r.kills
    total.gold += r.gold
    total.xp += r.xp
    total.drops += r.items.length
    total.sell += r.items.reduce((sum, item) => sum + sellValue(item), 0)
  }
  return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, value / SEEDS.length]))
}

describe('the economy against an hour of hunting', () => {
  const hours = SPOTS.map((spot) => ({ spot, plain: hour(spot) }))

  it('kills about REF_KILLS_PER_HOUR an hour where the hero fits', () => {
    for (const { plain } of hours) {
      expect(plain.kills).toBeGreaterThan(REF_KILLS_PER_HOUR * 0.8)
      expect(plain.kills).toBeLessThan(REF_KILLS_PER_HOUR * 1.25)
    }
  })

  it('lets selling every drop add something, but well under the hunt gold itself', () => {
    for (const { plain } of hours) {
      expect(plain.sell).toBeGreaterThan(plain.gold * 0.2)
      expect(plain.sell).toBeLessThan(plain.gold * 0.55)
    }
  })

  it('sells merchant pieces for a good part of an hour, and never buys them back near their price', () => {
    for (const { spot, plain } of hours) {
      const stock = marketStock({ userId: 'eco', day: '2026-11-26', tier: 1, level: spot.level })
      for (const item of stock) {
        expect(sellValue(item)).toBeLessThan(buyPrice(item) / 4)
        // No piece is pocket change, and a rare or better costs a good part of an hour.
        expect(buyPrice(item)).toBeGreaterThan(plain.gold * 0.05)
        if (item.rarity !== 'uncommon') expect(buyPrice(item)).toBeGreaterThan(plain.gold * 0.15)
      }
    }
  })

  it('keeps an XP elixir up all hour for about a third of the hunt gold', () => {
    for (const { spot, plain } of hours) {
      const perHour = elixirPrice('xp', spot.level).gold * (HOUR / ELIXIR_MS)
      expect(perHour).toBeGreaterThan(plain.gold * 0.15)
      expect(perHour).toBeLessThan(plain.gold * 0.5)
    }
  })

  it('never pays back a damage elixir in gold', () => {
    for (const { spot, plain } of hours) {
      const buffed = hour(spot, { damage: ELIXIRS.damage.bonus })
      expect(buffed.kills).toBeGreaterThanOrEqual(plain.kills)
      const extraPerElixir = (buffed.gold - plain.gold) * (ELIXIR_MS / HOUR)
      expect(extraPerElixir).toBeLessThan(elixirPrice('damage', spot.level).gold)
    }
  })

  it('never pays back a luck elixir by selling the extra drops', () => {
    for (const { spot, plain } of hours) {
      const lucky = hour(spot, { dropLuck: ELIXIRS.luck.bonus })
      expect(lucky.drops).toBeGreaterThan(plain.drops)
      const extraPerElixir = (lucky.sell - plain.sell) * (ELIXIR_MS / HOUR)
      expect(extraPerElixir).toBeLessThan(elixirPrice('luck', spot.level).gold)
    }
  })

  it('pays a full day of quests under half an hour of hunting gold, under an hour of xp, and a fraction of the study fragments', () => {
    const all = Object.keys(QUEST_REWARDS)
    for (const { spot, plain } of hours) {
      const kinds = all.map((kind) => QUEST_REWARDS[kind])
      const gold = kinds.reduce((sum, reward) => sum + Math.ceil(refGold(spot.level) * reward.goldKills), 0)
      expect(gold).toBeLessThan(plain.gold * 0.5)
      expect(gold).toBeGreaterThan(plain.gold * 0.1)
      const xp = dailyQuests({ userId: 'eco', day: '2026-11-26', level: spot.level }).reduce((sum, quest) => sum + quest.reward.xp, 0)
      expect(xp).toBeLessThan(plain.xp)
    }
    const fragments = Object.values(QUEST_REWARDS).reduce((sum, reward) => sum + reward.fragments, 0)
    expect(fragments).toBeLessThanOrEqual(DAILY_CAPS.fragments / 2)
  })
})
