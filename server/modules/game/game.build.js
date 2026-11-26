import { SLOTS } from '../../../shared/game/items.js'
import { SUPPORTS } from '../../../shared/game/skill-mods.js'
import { isLook, normalizeLook } from '../../../shared/game/look.js'
import { LOADOUT_SIZE, MAX_THRESHOLD, SKILLS, skillUpgradeCost } from '../../../shared/game/skills.js'
import { RESPEC_GOLD_PER_POINT, SOCKET_NODES, TALENTS, canAllocate } from '../../../shared/game/talents.js'
import { badRequest, detailedBadRequest } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { MESSAGES } from './game.model.js'
import { act, bagFree, gearOf, itemOf, spend } from './game.service.js'

// The hero's build: gear, talents, skills, loadout and look. Every action runs through act, so a
// running hunt is paid with the old build first and goes on with the new one.

const spentPoints = (hero) => hero.talents.filter((id) => id !== 'root').length

// A known skill id, or a 400. SKILLS is an array, so no key reaches a prototype.
function skillOf(value) {
  const skill = isId(value) ? SKILLS.find((each) => each.id === value) : undefined
  if (!skill) throw badRequest()
  return skill
}

// Gear from the bag goes to its slot; whatever sat there goes back to the bag. Gems can't be equipped.
export const equip = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const item = gearOf(hero, body.itemId)
    if (item.equipped || !SLOTS.includes(item.slot)) throw badRequest(MESSAGES.badItem)
    for (const worn of hero.items) if (worn.equipped === item.slot) worn.equipped = null
    item.equipped = item.slot
    return {}
  })

export const unequip = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    if (!isId(body.slot) || !SLOTS.includes(body.slot)) throw badRequest()
    const worn = hero.items.find((item) => item.equipped === body.slot)
    if (!worn) throw badRequest(MESSAGES.badItem)
    if (bagFree(hero) === 0) throw badRequest(MESSAGES.bagFull)
    worn.equipped = null
    return {}
  })

// Talents in the order given. One refusal refuses them all, with canAllocate's reason.
export const allocateTalents = (store, user, today, body) =>
  act(store, user, today, (hero, { fuel, talentPoints }) => {
    const { add } = body
    if (!Array.isArray(add) || add.length === 0 || add.length > TALENTS.nodes.length || !add.every((id) => isId(id))) throw badRequest()
    for (const id of add) {
      const free = talentPoints - spentPoints(hero)
      const verdict = canAllocate(hero.talents, id, { free, branch: fuel.ledger.branch })
      if (!verdict.ok) throw detailedBadRequest(MESSAGES.talent, { reason: verdict.reason })
      hero.talents.push(id)
    }
    return {}
  })

// Every point comes back, for RESPEC_GOLD_PER_POINT gold each, and every support gem in the tree goes
// back to the bag (refused when the bag has no room for them all).
export const respecTalents = (store, user, today) =>
  act(store, user, today, (hero) => {
    const socketed = Object.values(hero.treeSockets)
    if (socketed.length > bagFree(hero)) throw badRequest(MESSAGES.bagFull)
    spend(hero, 'gold', RESPEC_GOLD_PER_POINT * spentPoints(hero), MESSAGES.noGold)
    hero.talents = ['root']
    hero.items.push(...socketed)
    hero.treeSockets = {}
    return {}
  })

// A socket node of the tree the hero has taken, or a 400.
function socketOf(hero, node) {
  if (!isId(node)) throw badRequest()
  if (!SOCKET_NODES.includes(node) || !hero.talents.includes(node)) throw badRequest(MESSAGES.badItem)
  return node
}

// A support gem from the bag into a socket node the hero has taken. A filled socket swaps: its gem goes
// back to the bag. A kind already in another socket is refused (each kind counts once).
export const socketSupport = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const node = socketOf(hero, body.node)
    const gem = itemOf(hero, body.gemId)
    if (gem.kind !== 'support' || !Object.hasOwn(SUPPORTS, gem.support)) throw badRequest(MESSAGES.badItem)
    const elsewhere = Object.entries(hero.treeSockets).some(([at, held]) => at !== node && held.support === gem.support)
    if (elsewhere) throw badRequest(MESSAGES.badItem)
    const old = hero.treeSockets[node]
    hero.items = hero.items.filter((each) => each !== gem)
    if (old) hero.items.push(old)
    hero.treeSockets[node] = gem
    return {}
  })

// The gem in a socket back to the bag.
export const unsocketSupport = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    if (!isId(body.node)) throw badRequest()
    const gem = Object.hasOwn(hero.treeSockets, body.node) ? hero.treeSockets[body.node] : null
    if (!gem) throw badRequest(MESSAGES.badItem)
    if (bagFree(hero) === 0) throw badRequest(MESSAGES.bagFull)
    delete hero.treeSockets[body.node]
    hero.items.push(gem)
    return {}
  })

export const buySkill = (store, user, today, body) =>
  act(store, user, today, (hero, { level }) => {
    const skill = skillOf(body.skillId)
    if (Object.hasOwn(hero.skills.owned, skill.id)) throw badRequest(MESSAGES.owned)
    if (level < skill.minLevel) throw badRequest(MESSAGES.skillLocked)
    spend(hero, 'fragments', skill.price, MESSAGES.noFragments)
    hero.skills.owned[skill.id] = 1
    return {}
  })

export const upgradeSkill = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const skill = skillOf(body.skillId)
    if (!Object.hasOwn(hero.skills.owned, skill.id)) throw badRequest(MESSAGES.notOwned)
    const cost = skillUpgradeCost(hero.skills.owned[skill.id])
    if (!cost) throw badRequest(MESSAGES.maxLevel)
    spend(hero, 'fragments', cost.fragments, MESSAGES.noFragments)
    hero.skills.owned[skill.id] += 1
    return {}
  })

const isThreshold = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_THRESHOLD

// Four slots of owned skills (or null), each skill once, and the potion thresholds.
export const setLoadout = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    const { skills, thresholds } = body
    if (!Array.isArray(skills) || skills.length !== LOADOUT_SIZE || !skills.every((id) => id === null || isId(id))) throw badRequest()
    if (!thresholds || typeof thresholds !== 'object' || !isThreshold(thresholds.hp) || !isThreshold(thresholds.mp)) throw badRequest()
    const picked = skills.filter((id) => id !== null)
    const known = picked.every((id) => SKILLS.some((skill) => skill.id === id) && Object.hasOwn(hero.skills.owned, id))
    if (!known || new Set(picked).size !== picked.length) throw badRequest(MESSAGES.badLoadout)
    hero.skills.loadout = [...skills]
    hero.thresholds = { hp: thresholds.hp, mp: thresholds.mp }
    return {}
  })

export const setLook = (store, user, today, body) =>
  act(store, user, today, (hero) => {
    if (!isLook(body)) throw badRequest()
    hero.look = normalizeLook(body)
    hero.lookSet = true
    return {}
  })
