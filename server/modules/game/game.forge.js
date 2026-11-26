import { randomUUID } from 'node:crypto'
import { DIFFICULTIES } from '../../../shared/game/enemies.js'
import { GEM_SALVAGE_SCRAP } from '../../../shared/game/hunt.js'
import { AFFIXES, BAG_SIZE, GEMS, MAX_POTION_BUY, POTION_PRICE, rerollCost, rollItem, salvageValue, upgradeCost } from '../../../shared/game/items.js'
import { createRng } from '../../../shared/game/rng.js'
import { HUNT_WORLDS, ZONES } from '../../../shared/game/zones.js'
import { badRequest } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { MESSAGES } from './game.model.js'
import { act, gearOf, isIntIn, itemOf, spend, stash } from './game.service.js'

// The forge, chests and the potion shop. Every roll here uses a fresh server seed: the client never
// picks or sees one. Every action runs through act, so a running hunt is paid first.

const MIN_CHEST_ILVL = 1

// Each forge roll has its own seed.
const forgeRng = (user, what) => createRng(`${user.id}:${what}:${randomUUID()}`)

// +1 with upgradeCost's chance. A failure still costs the gold and scrap, and the item keeps its level.
export const upgradeItem = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const item = gearOf(hero, body.itemId)
    const cost = upgradeCost(item)
    if (!cost) throw badRequest(MESSAGES.maxLevel)
    spend(hero, 'gold', cost.gold, MESSAGES.noGold)
    spend(hero, 'scrap', cost.scrap, MESSAGES.noScrap)
    const ok = forgeRng(user, 'forge').chance(cost.chance)
    if (ok) item.upgrade = (item.upgrade ?? 0) + 1
    return { forge: { ok } }
  })

// Bag items (gear or gems) to scrap. Equipped gear can't be salvaged.
export const salvageItems = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const { itemIds } = body
    if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.length > BAG_SIZE) throw badRequest()
    if (!itemIds.every((id) => isId(id)) || new Set(itemIds).size !== itemIds.length) throw badRequest()
    const items = itemIds.map((id) => itemOf(hero, id))
    if (items.some((item) => item.equipped)) throw badRequest(MESSAGES.badItem)
    const scrap = items.reduce((sum, item) => sum + (item.kind === 'gem' ? GEM_SALVAGE_SCRAP : salvageValue(item).scrap), 0)
    const gone = new Set(itemIds)
    hero.items = hero.items.filter((item) => !gone.has(item.id))
    hero.scrap += scrap
    return { salvage: { scrap } }
  })

// A new affix in place of the chosen one: any affix the slot can roll at the item's ilvl whose stat no
// other affix of the item has, at a tier the ilvl opens. The others stay as they are.
function rollAffix(rng, item, index) {
  const taken = new Set(
    item.affixes.filter((_, at) => at !== index).map((affix) => AFFIXES.find((def) => def.id === affix.id)?.stat),
  )
  const pool = AFFIXES.filter(
    (def) => (def.slots === 'any' || def.slots.includes(item.slot)) && def.tiers[0].minIlvl <= item.ilvl && !taken.has(def.stat),
  )
  if (pool.length === 0) return item.affixes[index]
  const def = rng.pick(pool)
  const open = def.tiers.map((_, tier) => tier).filter((tier) => def.tiers[tier].minIlvl <= item.ilvl)
  const tier = rng.pick(open)
  const { min, max } = def.tiers[tier]
  return { id: def.id, tier, value: min + rng.int(max - min + 1) }
}

export const rerollAffix = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const item = gearOf(hero, body.itemId)
    if (!isIntIn(body.affix, 0, item.affixes.length - 1)) throw badRequest()
    const cost = rerollCost(item)
    spend(hero, 'gold', cost.gold, MESSAGES.noGold)
    spend(hero, 'fragments', cost.fragments, MESSAGES.noFragments)
    item.affixes[body.affix] = rollAffix(forgeRng(user, 'reroll'), item, body.affix)
    item.rerolls = (item.rerolls ?? 0) + 1
    return {}
  })

// The gem leaves the bag and its name goes into an empty socket (itemStats reads it from there).
// Unsocketing isn't in phase 1, so a filled socket is refused.
export const socketGem = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const item = gearOf(hero, body.itemId)
    const gem = itemOf(hero, body.gemId)
    if (!isIntIn(body.socket, 0, item.sockets.length - 1)) throw badRequest()
    if (gem.kind !== 'gem' || !Object.hasOwn(GEMS, gem.gem) || item.sockets[body.socket] !== null) {
      throw badRequest(MESSAGES.badItem)
    }
    item.sockets[body.socket] = gem.gem
    hero.items = hero.items.filter((each) => each !== gem)
    return {}
  })

// The item level of the hardest zone the hero has beaten (zone ilvl plus its difficulty's), or 1.
function bestIlvl(progress) {
  let best = MIN_CHEST_ILVL
  for (const world of HUNT_WORLDS) {
    for (const difficulty of Object.keys(DIFFICULTIES)) {
      const beaten = progress?.[world]?.[difficulty]
      if (!Array.isArray(beaten)) continue
      for (const zone of beaten) {
        if (Object.hasOwn(ZONES[world], zone)) best = Math.max(best, ZONES[world][zone].ilvl + DIFFICULTIES[difficulty].ilvl)
      }
    }
  }
  return best
}

// Opens the oldest chest (earliest study day) for 1 item. A full bag salvages it into scrap.
export const openChest = (store, user, today) =>
  act(store, user, today, (hero) => {
    if (hero.chests.length === 0) throw badRequest(MESSAGES.noChest)
    const oldest = hero.chests.reduce((best, chest, at) => (chest.day < hero.chests[best].day ? at : best), 0)
    const [chest] = hero.chests.splice(oldest, 1)
    const item = rollItem(forgeRng(user, 'chest'), { ilvl: bestIlvl(hero.progress), rarityBoost: chest.boost ?? 0 })
    const scrapBefore = hero.scrap
    const kept = stash(hero, item)
    return { chest: { item }, overflow: kept ? undefined : { scrap: hero.scrap - scrapBefore } }
  })

export const buyPotions = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const { kind, count } = body
    if ((kind !== 'hp' && kind !== 'mp') || !isIntIn(count, 1, MAX_POTION_BUY)) throw badRequest()
    spend(hero, 'gold', POTION_PRICE * count, MESSAGES.noGold)
    hero.potions[kind] += count
    return {}
  })
