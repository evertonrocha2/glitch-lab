// Items for Glitch World: bases, affixes, rarities, the compilador set, uniques and gems, plus the seeded
// roll and the stat math. Pure: all randomness comes from the rng passed in, so the server can roll drops
// and the client can show the same tooltips. Ids and stat keys only, labels live in i18n.

export const SLOTS = ['helm', 'amulet', 'ring', 'weapon', 'chest', 'offhand', 'boots', 'relic']
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
export const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 11, epic: 3.5, legendary: 0.5 }
export const AFFIX_COUNT = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3 }
// An array is a random choice in that range, both ends included.
export const SOCKETS = { common: 0, uncommon: 0, rare: [0, 1], epic: 1, legendary: 2 }
export const BAG_SIZE = 60

export const STATS_KEYS = [
  'attack', 'magicPct', 'critChance', 'critDamage', 'attackSpeed', 'hp', 'mana', 'armor', 'dodge',
  'resFire', 'resIce', 'resLightning', 'resPoison', 'attackPct', 'hpPct',
]
// Flat stats stay whole numbers, the rest are percentages and keep one decimal.
const FLAT_STATS = new Set(['attack', 'hp', 'mana', 'armor'])

const RARITY_MULT = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 }
const SALVAGE = { common: 2, uncommon: 4, rare: 8, epic: 16, legendary: 40 }
const TIER_FLOORS = [1, 10, 20, 35, 50]
const MAX_UPGRADE = 10
const UPGRADE_BONUS = 0.06
const SET_CHANCE = 0.3
const UNIQUE_CHANCE = 0.4

const base = (id, slot, icon, minIlvl, stats) => ({ id, slot, icon, minIlvl, stats })

export const BASES = [
  base('capuz', 'helm', 'helm', 1, { armor: 4, hp: 10 }),
  base('capacete-de-ferro', 'helm', 'helm', 20, { armor: 10, hp: 25 }),
  base('amuleto', 'amulet', 'amulet', 1, { hp: 12, mana: 6 }),
  base('colar-de-logs', 'amulet', 'scroll', 20, { hp: 24, magicPct: 4 }),
  base('anel', 'ring', 'ring', 1, { attack: 2, critChance: 1 }),
  base('anel-de-bits', 'ring', 'bolt', 20, { attack: 5, critChance: 2 }),
  base('espada', 'weapon', 'sword', 1, { attack: 8 }),
  base('cajado', 'weapon', 'staff', 1, { attack: 3, magicPct: 10 }),
  base('martelo', 'weapon', 'hammer', 25, { attack: 16, attackSpeed: -5 }),
  base('armadura', 'chest', 'armor', 1, { armor: 8, hp: 20 }),
  base('colete-de-dev', 'chest', 'armor', 20, { armor: 16, hp: 45 }),
  base('escudo', 'offhand', 'shield', 1, { armor: 6, dodge: 1 }),
  base('livro-de-regras', 'offhand', 'book', 1, { magicPct: 6, mana: 10 }),
  base('botas', 'boots', 'boot', 1, { armor: 3, dodge: 2 }),
  base('tenis-veloz', 'boots', 'feather', 20, { armor: 5, attackSpeed: 4 }),
  base('teclado-runico', 'relic', 'keyboard', 1, { attack: 3, critDamage: 8 }),
  base('pergaminho-antigo', 'relic', 'scroll', 1, { mana: 15, critChance: 1 }),
]

// One affix: tiers carry the ilvl floor and the [min, max] roll range.
const affix = (id, stat, slots, ranges) => ({
  id,
  stat,
  slots,
  tiers: ranges.map(([min, max], i) => ({ minIlvl: TIER_FLOORS[i], min, max })),
})
const WEAPONISH = ['weapon', 'ring', 'relic', 'amulet']
const ARMORISH = ['helm', 'chest', 'offhand', 'boots']

export const AFFIXES = [
  affix('sharp', 'attack', 'any', [[1, 3], [3, 7], [7, 14], [14, 24], [24, 40]]),
  affix('arcane', 'magicPct', 'any', [[1, 3], [3, 6], [6, 10], [10, 15], [15, 22]]),
  affix('precise', 'critChance', 'any', [[1, 2], [2, 3], [3, 5], [5, 7], [7, 10]]),
  affix('brutal', 'critDamage', 'any', [[2, 5], [5, 10], [10, 18], [18, 28], [28, 40]]),
  affix('swift', 'attackSpeed', 'any', [[1, 3], [3, 5], [5, 8], [8, 12], [12, 16]]),
  affix('vital', 'hp', 'any', [[5, 12], [12, 28], [28, 55], [55, 100], [100, 170]]),
  affix('wise', 'mana', 'any', [[3, 8], [8, 16], [16, 30], [30, 52], [52, 85]]),
  affix('sturdy', 'armor', 'any', [[2, 5], [5, 10], [10, 18], [18, 30], [30, 48]]),
  affix('evasive', 'dodge', 'any', [[1, 2], [2, 3], [3, 5], [5, 7], [7, 10]]),
  affix('fireproof', 'resFire', 'any', [[2, 5], [5, 9], [9, 14], [14, 20], [20, 28]]),
  affix('frostproof', 'resIce', 'any', [[2, 5], [5, 9], [9, 14], [14, 20], [20, 28]]),
  affix('groundproof', 'resLightning', 'any', [[2, 5], [5, 9], [9, 14], [14, 20], [20, 28]]),
  affix('antidote', 'resPoison', 'any', [[2, 5], [5, 9], [9, 14], [14, 20], [20, 28]]),
  affix('mighty', 'attackPct', 'any', [[1, 2], [2, 4], [4, 7], [7, 11], [11, 16]]),
  affix('hearty', 'hpPct', 'any', [[1, 2], [2, 4], [4, 7], [7, 11], [11, 16]]),
  affix('honed', 'attack', WEAPONISH, [[2, 4], [4, 9], [9, 17], [17, 29], [29, 48]]),
  affix('lethal', 'critChance', WEAPONISH, [[1, 2], [2, 4], [4, 6], [6, 9], [9, 13]]),
  affix('ruthless', 'critDamage', WEAPONISH, [[3, 6], [6, 12], [12, 22], [22, 34], [34, 48]]),
  affix('fortified', 'armor', ARMORISH, [[3, 6], [6, 12], [12, 22], [22, 36], [36, 58]]),
  affix('resilient', 'hpPct', ARMORISH, [[1, 3], [3, 5], [5, 8], [8, 13], [13, 19]]),
  affix('nimble', 'dodge', ['boots', 'helm', 'ring', 'chest'], [[1, 3], [3, 4], [4, 6], [6, 9], [9, 12]]),
  affix('studious', 'mana', ['helm', 'amulet', 'offhand', 'relic'], [[4, 10], [10, 20], [20, 36], [36, 62], [62, 100]]),
  affix('sorcerous', 'magicPct', ['weapon', 'offhand', 'relic', 'amulet'], [[2, 4], [4, 8], [8, 13], [13, 19], [19, 27]]),
  affix('warding', 'resFire', ['chest', 'helm', 'offhand', 'amulet'], [[3, 6], [6, 11], [11, 17], [17, 24], [24, 33]]),
  affix('purifying', 'resPoison', ['chest', 'boots', 'ring', 'relic'], [[3, 6], [6, 11], [11, 17], [17, 24], [24, 33]]),
  affix('quick', 'attackSpeed', ['weapon', 'boots', 'ring', 'relic'], [[2, 4], [4, 6], [6, 10], [10, 14], [14, 19]]),
]

export const SETS = [
  {
    id: 'compilador',
    pieces: ['helm', 'chest', 'boots', 'relic'],
    bonus: { 2: { attackPct: 6, hp: 40 }, 4: { effect: 'chainBolt' } },
  },
]

export const UNIQUES = [
  { id: 'excalibug', slot: 'weapon', base: 'espada', effect: 'bugSplash' },
  { id: 'amuleto-do-root', slot: 'amulet', base: 'amuleto', effect: 'rootAccess' },
  { id: 'anel-recursivo', slot: 'ring', base: 'anel', effect: 'recursion' },
]

export const GEMS = {
  logica: { attackPct: 4 },
  sintaxe: { hpPct: 5 },
  algoritmos: { critChance: 3 },
}

const hexId = (rng) => Array.from({ length: 12 }, () => rng.int(16).toString(16)).join('')

const rollRarity = (rng, boost) => {
  const weights = {}
  for (const r of RARITIES) weights[r] = RARITY_WEIGHTS[r] * (RARITIES.indexOf(r) >= 2 ? 1 + boost : 1)
  return rng.weighted(weights)
}

const rollSockets = (rng, rarity) => {
  const rule = SOCKETS[rarity]
  const count = Array.isArray(rule) ? rule[0] + rng.int(rule[1] - rule[0] + 1) : rule
  return Array.from({ length: count }, () => null)
}

const rollAffixes = (rng, slot, ilvl, count) => {
  const pool = AFFIXES.filter((a) => (a.slots === 'any' || a.slots.includes(slot)) && a.tiers[0].minIlvl <= ilvl)
  const picked = []
  const usedStats = new Set()
  while (picked.length < count && pool.length > 0) {
    const idx = rng.int(pool.length)
    const [chosen] = pool.splice(idx, 1)
    if (usedStats.has(chosen.stat)) continue
    usedStats.add(chosen.stat)
    const open = chosen.tiers.map((t, i) => i).filter((i) => chosen.tiers[i].minIlvl <= ilvl)
    const tier = open[rng.int(open.length)]
    const { min, max } = chosen.tiers[tier]
    picked.push({ id: chosen.id, tier, value: min + rng.int(max - min + 1) })
  }
  return picked
}

export const rollItem = (rng, { ilvl, rarityBoost = 0, slot } = {}) => {
  const id = hexId(rng)
  const rarity = rollRarity(rng, rarityBoost)
  let unique
  let itemSlot = slot
  let baseId
  if (rarity === 'legendary' && rng.chance(UNIQUE_CHANCE)) {
    const options = UNIQUES.filter((u) => !slot || u.slot === slot)
    if (options.length > 0) {
      unique = rng.pick(options)
      itemSlot = unique.slot
      baseId = unique.base
    }
  }
  if (!itemSlot) itemSlot = rng.pick(SLOTS)
  if (!baseId) {
    const all = BASES.filter((b) => b.slot === itemSlot)
    const open = all.filter((b) => b.minIlvl <= ilvl)
    baseId = rng.pick(open.length > 0 ? open : all).id
  }
  let set
  if (!unique && RARITIES.indexOf(rarity) >= 3 && rng.chance(SET_CHANCE)) {
    set = SETS.find((s) => s.pieces.includes(itemSlot))?.id
  }
  const item = {
    id,
    kind: 'gear',
    base: baseId,
    slot: itemSlot,
    rarity,
    ilvl,
    affixes: rollAffixes(rng, itemSlot, ilvl, AFFIX_COUNT[rarity]),
    sockets: rollSockets(rng, rarity),
    upgrade: 0,
    rerolls: 0,
    equipped: null,
  }
  if (set) item.set = set
  if (unique) item.unique = unique.id
  return item
}

export const rollGem = (rng) => ({ id: hexId(rng), kind: 'gem', gem: rng.pick(Object.keys(GEMS)) })

const tidy = (stat, value) => (FLAT_STATS.has(stat) ? Math.round(value) : Math.round(value * 10) / 10)

export const itemStats = (item, gems = GEMS, bases = BASES) => {
  const total = {}
  const add = (stat, value) => {
    total[stat] = (total[stat] ?? 0) + value
  }
  const found = bases.find((b) => b.id === item.base)
  const scale = 1 + UPGRADE_BONUS * (item.upgrade ?? 0)
  for (const [stat, value] of Object.entries(found?.stats ?? {})) add(stat, value * scale)
  for (const a of item.affixes ?? []) {
    const def = AFFIXES.find((x) => x.id === a.id)
    if (def) add(def.stat, a.value)
  }
  for (const gemId of item.sockets ?? []) {
    for (const [stat, value] of Object.entries(gems[gemId] ?? {})) add(stat, value)
  }
  return Object.fromEntries(Object.entries(total).map(([stat, value]) => [stat, tidy(stat, value)]))
}

export const setBonuses = (equipped) => {
  const total = {}
  const effects = []
  const counts = {}
  for (const item of equipped) if (item.set) counts[item.set] = (counts[item.set] ?? 0) + 1
  for (const set of SETS) {
    const count = counts[set.id] ?? 0
    for (const need of Object.keys(set.bonus).map(Number).sort((a, b) => a - b)) {
      if (count < need) continue
      for (const [key, value] of Object.entries(set.bonus[need])) {
        if (key === 'effect') effects.push(value)
        else total[key] = (total[key] ?? 0) + value
      }
    }
  }
  for (const item of equipped) {
    const unique = item.unique && UNIQUES.find((u) => u.id === item.unique)
    if (unique) effects.push(unique.effect)
  }
  return { ...total, effects }
}

export const salvageValue = (item) => ({ scrap: SALVAGE[item.rarity] + (item.upgrade ?? 0) * 3 })

export const upgradeCost = (item) => {
  const upgrade = item.upgrade ?? 0
  if (upgrade >= MAX_UPGRADE) return null
  return {
    gold: 50 * (upgrade + 1) ** 2 * RARITY_MULT[item.rarity],
    scrap: 5 * (upgrade + 1),
    chance: Math.round(Math.max(0.3, 1 - 0.07 * upgrade) * 100) / 100,
  }
}

export const rerollCost = (item) => ({ gold: 200 * 2 ** (item.rerolls ?? 0), fragments: 20 })
