import { SLOTS, UNIQUES } from '../../../../shared/game/items.js'
import { RANK } from './palette.js'

// The bases the renderer knows how to draw, per slot. Anything else (future content, junk) is
// skipped, so new items never break the hero.
const DRAWN = {
  helm: ['capuz', 'capacete-de-ferro'],
  amulet: ['amuleto', 'colar-de-logs'],
  ring: ['anel', 'anel-de-bits'],
  weapon: ['espada', 'cajado', 'martelo'],
  chest: ['armadura', 'colete-de-dev'],
  offhand: ['escudo', 'livro-de-regras'],
  boots: ['botas', 'tenis-veloz'],
  relic: ['teclado-runico', 'pergaminho-antigo'],
}

const UNIQUE_BASE = Object.fromEntries(UNIQUES.map((u) => [u.id, u.base]))

// Equipped items (the view's item list) -> { [slot]: { b: baseId, r: rarity } }. Uniques show as
// their base; unequipped items and gems are left out.
export function gearOf(items) {
  const gear = {}
  for (const item of items ?? []) {
    if (item?.kind !== 'gear' || !SLOTS.includes(item.equipped)) continue
    gear[item.equipped] = { b: UNIQUE_BASE[item.unique] ?? item.base, r: item.rarity }
  }
  return gear
}

// Only the pieces the renderer can draw, in the slot they belong to. An unknown rarity draws as common.
export function drawableGear(gear) {
  const out = {}
  if (typeof gear !== 'object' || gear === null) return out
  for (const slot of SLOTS) {
    const it = gear[slot]
    if (!DRAWN[slot].includes(it?.b)) continue
    out[slot] = { b: it.b, r: Object.hasOwn(RANK, it.r) ? it.r : 'common' }
  }
  return out
}
