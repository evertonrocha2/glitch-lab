import { useMemo } from 'react'
import { CHANCE, RATE } from '../../../../shared/game/combat-effects.js'
import { AFFIXES, BASES, GEMS, STATS_KEYS, itemStats } from '../../../../shared/game/items.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { capitalize } from '../../../lib/i18n/format.js'
import { modText, supportColor, supportIcon } from '../panel/support-gem.js'

// Labels and colors for items, shared by the tooltip and the panel tabs. Ids come from
// shared/game/items.js, every word from the game.* messages.

// Border and text color per rarity (the mockup's .r-com ... .r-leg).
export const RARITY_COLORS = {
  common: { border: '#8a8fa0', text: '#c9ccd4' },
  uncommon: { border: '#2fae5f', text: '#6fe39a' },
  rare: { border: '#2f7ae0', text: '#6fb4ff' },
  epic: { border: '#8a5cff', text: '#c3a6ff' },
  legendary: { border: '#ff9a1f', text: '#ffb347' },
}

const FLAT_STATS = new Set(['attack', 'hp', 'mana', 'armor'])
export const BASE_BY_ID = Object.fromEntries(BASES.map((base) => [base.id, base]))
export const AFFIX_BY_ID = Object.fromEntries(AFFIXES.map((affix) => [affix.id, affix]))

// The numbers each effect's text names. chainBolt and rootAccess mirror CHAIN_BOLT and ROOT_ARMOR in
// shared/game/combat-effects.js (not exported there).
const pct = (rate) => Math.round(rate * 100)
const EFFECT_VARS = {
  chainBolt: { pct: 50 },
  rootAccess: { pct: 50 },
  bugSplash: { chance: pct(CHANCE.bugSplash), pct: pct(RATE.bugSplash) },
  selfCall: { chance: pct(CHANCE.selfCall) },
}

// Gems and support gems are not gear: no base, no affixes, no slot, nothing to compare.
export const isGear = (item) => item.kind !== 'gem' && item.kind !== 'support'

export const iconOf = (item) => (item.kind === 'support' ? supportIcon(item.support) : item.kind === 'gem' ? 'gem' : (BASE_BY_ID[item.base]?.icon ?? 'bag'))

// Border and text color of a gem or support gem; undefined for gear (its rarity decides).
export const gemColors = (item) => (item.kind === 'support' ? { border: supportColor(item.support), text: supportColor(item.support) } : item.kind === 'gem' ? { border: '#4fd1c5', text: '#7fe9ff' } : undefined)

// The item's stats minus the other's, stat by stat in STATS_KEYS order, zeros left out.
export function statDiff(item, other) {
  const mine = itemStats(item)
  const theirs = other ? itemStats(other) : {}
  return STATS_KEYS.map((stat) => [stat, Math.round(((mine[stat] ?? 0) - (theirs[stat] ?? 0)) * 10) / 10]).filter(([, value]) => value !== 0)
}

// Every label function for items, in the reader's language.
export function useItemText() {
  const { t, locale } = useI18n()
  return useMemo(() => {
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    const lower = (text) => text.toLocaleLowerCase(locale)
    const signed = (stat, value) => `${value < 0 ? '-' : '+'}${num.format(Math.abs(value))}${FLAT_STATS.has(stat) ? '' : '%'}`
    const statName = (stat) => t(`game.stat.${stat}`)
    const statLine = (stat, value) => t('game.item.stat', { value: signed(stat, value), name: lower(statName(stat)) })
    const statsLine = (stats) =>
      Object.entries(stats)
        .filter(([key]) => key !== 'effect')
        .map(([stat, value]) => statLine(stat, value))
        .join(', ')
    const gemName = (gem) => t(`game.gem.${gem}`)
    const gemLine = (gem) => statsLine(GEMS[gem] ?? {})
    const rarity = (id) => t(`game.rarity.${id}`)

    const plainName = (item) => {
      if (item.kind === 'gem') return gemName(item.gem)
      if (item.kind === 'support') return t(`game.support.${item.support}`)
      if (item.unique) return t(`game.unique.${item.unique}`)
      const base = t(`game.base.${item.base}`)
      return item.set ? t('game.item.setName', { base, set: t(`game.set.${item.set}`) }) : base
    }
    const name = (item) => (item.upgrade > 0 ? t('game.item.upgraded', { name: plainName(item), level: item.upgrade }) : plainName(item))
    // "Relíquia épica, nível de item 14": the rarity agrees with the slot's gender in Portuguese.
    const line = (item) => {
      const gender = t(`game.slotGender.${item.slot}`)
      const text = t('game.item.line', {
        rarity: t(`game.rarityAdj.${item.rarity}.${gender}`),
        slot: lower(t(`game.slot.${item.slot}`)),
        ilvl: item.ilvl,
      })
      return capitalize(text, locale)
    }
    const affixLine = (affix) => statLine(AFFIX_BY_ID[affix.id]?.stat, affix.value)
    const affixNamed = (affix) => t('game.item.affixName', { affix: t(`game.affix.${affix.id}`), line: affixLine(affix) })
    const effect = (id) => t(`game.effect.${id}`, EFFECT_VARS[id])
    const supportDesc = (item) => modText(t, (value) => num.format(value)).desc('support', item.support)
    const cellLabel = (item) => (!isGear(item) ? name(item) : t('game.item.cell', { name: name(item), rarity: rarity(item.rarity) }))

    return { t, locale, num, number: (value) => num.format(value), signed, statName, statLine, statsLine, gemName, gemLine, rarity, name, line, affixLine, affixNamed, effect, supportDesc, cellLabel }
  }, [t, locale])
}
