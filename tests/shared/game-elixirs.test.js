import { describe, expect, it } from 'vitest'
import { refGold } from '../../shared/game/economy.js'
import {
  ELIXIRS, ELIXIR_MS, alchemistView, buffFighter, drinkElixir, elixirEffects, elixirPrice, elixirShare,
} from '../../shared/game/elixirs.js'
import { settleHunt } from '../../shared/game/hunt.js'
import { MAX_POTION_BUY, POTION_PRICE } from '../../shared/game/items.js'
import { heroStats } from '../../shared/game/stats.js'
import { ZONES } from '../../shared/game/zones.js'

const MIN = 60_000
const T0 = Date.UTC(2026, 10, 26, 12)

describe('elixirs', () => {
  it('are XP +50%, damage +20% and drop luck +30%, for 30 minutes', () => {
    expect(ELIXIR_MS).toBe(30 * MIN)
    expect(ELIXIRS.xp.bonus).toBe(0.5)
    expect(ELIXIRS.damage.bonus).toBe(0.2)
    expect(ELIXIRS.luck.bonus).toBe(0.3)
  })

  it('cost fragments, or gold that grows with the hero level', () => {
    for (const type of Object.keys(ELIXIRS)) {
      expect(elixirPrice(type, 1).fragments).toBeGreaterThan(0)
      expect(elixirPrice(type, 1).fragments).toBe(elixirPrice(type, 40).fragments)
      expect(elixirPrice(type, 1).gold).toBe(Math.ceil(refGold(1) * ELIXIRS[type].goldKills))
      expect(elixirPrice(type, 30).gold).toBeGreaterThan(elixirPrice(type, 1).gold)
    }
  })

  it('refreshes the same type instead of stacking it, and drops the ones that ran out', () => {
    const first = drinkElixir({}, 'xp', T0)
    expect(first).toEqual({ xp: { startedAt: T0, expiresAt: T0 + ELIXIR_MS } })
    const again = drinkElixir(first, 'xp', T0 + 10 * MIN)
    expect(again.xp).toEqual({ startedAt: T0 + 10 * MIN, expiresAt: T0 + 10 * MIN + ELIXIR_MS })
    const both = drinkElixir(again, 'luck', T0 + 20 * MIN)
    expect(Object.keys(both).sort()).toEqual(['luck', 'xp'])
    const later = drinkElixir(both, 'damage', T0 + 3 * ELIXIR_MS)
    expect(Object.keys(later)).toEqual(['damage'])
  })

  it('counts the share of a stretch an elixir covered', () => {
    const entry = { startedAt: T0, expiresAt: T0 + ELIXIR_MS }
    expect(elixirShare(entry, T0, T0 + ELIXIR_MS)).toBe(1)
    expect(elixirShare(entry, T0, T0 + 2 * ELIXIR_MS)).toBe(0.5)
    expect(elixirShare(entry, T0 - ELIXIR_MS, T0 + ELIXIR_MS)).toBe(0.5)
    expect(elixirShare(entry, T0 + ELIXIR_MS, T0 + 2 * ELIXIR_MS)).toBe(0)
    // An instant (a boss fight): whether it is active right then.
    expect(elixirShare(entry, T0 + MIN, T0 + MIN)).toBe(1)
    expect(elixirShare(entry, T0 + ELIXIR_MS, T0 + ELIXIR_MS)).toBe(0)
    expect(elixirShare(undefined, T0, T0 + MIN)).toBe(0)
  })

  it('turns the active elixirs into bonuses over a stretch', () => {
    const elixirs = drinkElixir(drinkElixir({}, 'xp', T0), 'damage', T0)
    expect(elixirEffects(elixirs, T0, T0 + 2 * ELIXIR_MS)).toEqual({ xp: 0.25, damage: 0.1, luck: 0 })
    expect(elixirEffects({}, T0, T0 + MIN)).toEqual({ xp: 0, damage: 0, luck: 0 })
    expect(elixirEffects(undefined, T0, T0 + MIN)).toEqual({ xp: 0, damage: 0, luck: 0 })
    // Junk stored on a hero counts for nothing.
    expect(elixirEffects({ xp: 'x', luck: { startedAt: 'a' } }, T0, T0 + MIN)).toEqual({ xp: 0, damage: 0, luck: 0 })
  })

  it('raises the fighter attack by the damage bonus, leaving the rest alone', () => {
    const fighter = { stats: heroStats({ level: 5 }), skills: [], potions: { hp: 0, mp: 0 } }
    expect(buffFighter(fighter, 0)).toBe(fighter)
    const buffed = buffFighter(fighter, 0.2)
    expect(buffed.stats.attack).toBeCloseTo(fighter.stats.attack * 1.2)
    expect(buffed.stats.hp).toBe(fighter.stats.hp)
    expect(fighter.stats.attack).toBe(heroStats({ level: 5 }).attack)
  })

  it('lists the potions and elixirs the alchemist sells, with prices at this level', () => {
    const view = alchemistView(12)
    expect(view.potions).toEqual({ gold: POTION_PRICE, max: MAX_POTION_BUY })
    expect(view.elixirs.map((entry) => entry.type)).toEqual(Object.keys(ELIXIRS))
    for (const entry of view.elixirs) expect(entry).toEqual({ type: entry.type, bonus: ELIXIRS[entry.type].bonus, ms: ELIXIR_MS, ...elixirPrice(entry.type, 12) })
  })
})

describe('drop luck in the hunt', () => {
  const hero = { stats: heroStats({ level: 5 }), skills: [{ id: 'golpe', level: 1 }], potions: { hp: 0, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } }
  const hunt = (seed, dropLuck) =>
    settleHunt({ hero, zone: ZONES['floresta-js'].z1, difficulty: 'normal', startedAt: 0, now: 3_600_000, seed, bagFree: 1000, dropLuck })

  it('changes nothing at 0', () => {
    expect(hunt('luck:a', 0)).toEqual(hunt('luck:a'))
  })

  it('drops more at +30%, with the same kills and gold', () => {
    let plain = 0
    let lucky = 0
    for (const seed of ['luck:a', 'luck:b', 'luck:c']) {
      const a = hunt(seed, 0)
      const b = hunt(seed, 0.3)
      expect(b.kills).toBe(a.kills)
      expect(b.gold).toBe(a.gold)
      plain += a.items.length + a.gems.length
      lucky += b.items.length + b.gems.length
    }
    expect(lucky).toBeGreaterThan(plain * 1.1)
  })
})
