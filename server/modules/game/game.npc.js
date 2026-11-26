import { randomUUID } from 'node:crypto'
import { ELIXIRS, drinkElixir, elixirPrice } from '../../../shared/game/elixirs.js'
import { BAG_SIZE, GEMS } from '../../../shared/game/items.js'
import { GEM_PRICE, SUPPORT_PRICE, combinable, combineCost, combinedGem } from '../../../shared/game/jeweler.js'
import { ALL_DONE_CHESTS, dailyQuests, questState, questsView } from '../../../shared/game/quests.js'
import {
  buyPrice, isMarketTier, marketRerollCost, marketState, marketStock, marketTierOf, marketView, sellValue,
} from '../../../shared/game/shop.js'
import { SUPPORT_IDS } from '../../../shared/game/skill-mods.js'
import { levelsGained, startingXp } from '../../../shared/game/xp.js'
import { badRequest } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { loadFuel } from './game.fuel.js'
import { MESSAGES, levelOf, newHero, withDefaults } from './game.model.js'
import { act, bagFree, itemOf, spend } from './game.service.js'

// The town's NPCs (fase 3): the Mercador (market), the Alquimista (potions and elixirs), the Joalheiro
// (gems) and the Quadro de missões (quests). The Ferreiro is the forge (game.forge.js). Every action
// runs through act: the running hunt is paid first, the server rolls and prices everything, and a
// stale version gets a 409. Stocks and quests are seeded per user and day (shared/game/shop.js, quests.js).

// A new jewel's id: 12 hex digits, like a rolled drop's.
const newId = () => randomUUID().replaceAll('-', '').slice(0, 12)

// An optional market tier (a town of the world passes its own), or a 400.
function tierOf(value) {
  if (value === undefined || value === null) return undefined
  if (!isMarketTier(value)) throw badRequest()
  return value
}

// The hero's market on its day (a new day restocks), and the stock of the tier asked (or the level's).
function openMarket(hero, user, today, level, tier) {
  hero.market = marketState(hero.market, today, level)
  const shown = tier ?? marketTierOf(hero.market.level)
  const rerolls = hero.market.rerolls[shown] ?? 0
  const stock = marketStock({ userId: user.id, day: hero.market.day, tier: shown, rerolls, level: hero.market.level })
  return { shown, rerolls, stock }
}

const marketOf = (hero, user, today, level, tier) =>
  marketView({ userId: user.id, market: hero.market, today, level, items: hero.items, tier })

// GET /game/market?tier=: the market of one tier, read only (the View carries the level's own tier).
export async function getMarket(store, user, today, tierText) {
  let tier
  if (tierText !== null) {
    if (!/^\d{1,2}$/.test(tierText)) throw badRequest()
    tier = tierOf(Number(tierText))
  }
  const loaded = await store.getGameHero(user.id)
  const hero = withDefaults(loaded?.data ?? newHero())
  // A hero saved before XP was stored takes its level from study, as the View does.
  if (!Number.isSafeInteger(hero.xp)) hero.xp = startingXp(hero, (await loadFuel(store, user.id, today)).studyXp)
  return { market: marketOf(hero, user, today, levelOf(hero).level, tier) }
}

// One stock piece into the bag, for its price. Answers it, and the tier's market after the buy.
export function buyMarketItem(store, user, today, body) {
  const tier = tierOf(body.tier)
  if (!isId(body.itemId)) throw badRequest()
  return act(store, user, today, (hero, ctx) => {
    const { stock } = openMarket(hero, user, ctx.today, ctx.level, tier)
    const item = stock.find((each) => each.id === body.itemId)
    if (!item || hero.market.bought.includes(item.id) || hero.items.some((each) => each.id === item.id)) throw badRequest(MESSAGES.soldOut)
    if (bagFree(hero) === 0) throw badRequest(MESSAGES.bagFull)
    const price = buyPrice(item)
    spend(hero, 'gold', price, MESSAGES.noGold)
    hero.market.bought.push(item.id)
    hero.items.push(item)
    return { bought: { item, price }, market: marketOf(hero, user, ctx.today, ctx.level, tier) }
  })
}

// Bag gear to the merchant for gold (sellValue). Worn gear and gems can't be sold.
export function sellItems(store, user, today, body) {
  const { itemIds } = body
  if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.length > BAG_SIZE) throw badRequest()
  if (!itemIds.every((id) => isId(id)) || new Set(itemIds).size !== itemIds.length) throw badRequest()
  return act(store, user, today, (hero) => {
    const items = itemIds.map((id) => itemOf(hero, id))
    if (items.some((item) => item.kind !== 'gear' || item.equipped)) throw badRequest(MESSAGES.badItem)
    const gold = items.reduce((sum, item) => sum + sellValue(item), 0)
    const gone = new Set(itemIds)
    hero.items = hero.items.filter((item) => !gone.has(item.id))
    hero.gold += gold
    return { sold: { gold, count: items.length } }
  })
}

// A new stock for the tier, for fragments that double with each reroll that day.
export function rerollMarket(store, user, today, body) {
  const tier = tierOf(body.tier)
  return act(store, user, today, (hero, ctx) => {
    const { shown, rerolls } = openMarket(hero, user, ctx.today, ctx.level, tier)
    const cost = marketRerollCost(rerolls)
    spend(hero, 'fragments', cost.fragments, MESSAGES.noFragments)
    hero.market.rerolls = { ...hero.market.rerolls, [shown]: rerolls + 1 }
    return { reroll: cost, market: marketOf(hero, user, ctx.today, ctx.level, tier) }
  })
}

const CURRENCY_MESSAGE = { gold: MESSAGES.noGold, fragments: MESSAGES.noFragments }

// { type, currency: 'gold' | 'fragments' }: drinks the elixir now, for 30 minutes (one already active
// starts over: it never stacks).
export function buyElixir(store, user, today, body) {
  const { type, currency } = body
  if (!isId(type) || !Object.hasOwn(ELIXIRS, type) || !isId(currency) || !Object.hasOwn(CURRENCY_MESSAGE, currency)) throw badRequest()
  return act(store, user, today, (hero, ctx) => {
    const price = elixirPrice(type, ctx.level)[currency]
    spend(hero, currency, price, CURRENCY_MESSAGE[currency])
    hero.elixirs = drinkElixir(hero.elixirs, type, ctx.now)
    return { elixir: { type, expiresAt: hero.elixirs[type].expiresAt, price: { [currency]: price } } }
  })
}

// { kind: 'gem', id: gem id } or { kind: 'support', id: support id }: a tier 1 item gem or a support
// gem of the player's pick, for fragments, into the bag.
export function buyJewel(store, user, today, body) {
  const { kind, id } = body
  const known = kind === 'gem' ? isId(id) && Object.hasOwn(GEMS, id) : kind === 'support' && SUPPORT_IDS.includes(id)
  if (!known) throw badRequest()
  return act(store, user, today, (hero) => {
    if (bagFree(hero) === 0) throw badRequest(MESSAGES.bagFull)
    spend(hero, 'fragments', kind === 'gem' ? GEM_PRICE : SUPPORT_PRICE, MESSAGES.noFragments)
    const jewel = kind === 'gem' ? { id: newId(), kind: 'gem', gem: id } : { id: newId(), kind: 'support', support: id }
    hero.items.push(jewel)
    return { jewel }
  })
}

// { gemIds: [3 ids] }: 3 bag gems of one kind and tier become 1 a tier up, for gold (combineCost).
export function combineGems(store, user, today, body) {
  const { gemIds } = body
  if (!Array.isArray(gemIds) || gemIds.length === 0 || gemIds.length > BAG_SIZE) throw badRequest()
  if (!gemIds.every((id) => isId(id)) || new Set(gemIds).size !== gemIds.length) throw badRequest()
  return act(store, user, today, (hero) => {
    const gems = gemIds.map((id) => itemOf(hero, id))
    const pick = combinable(gems)
    if (!pick) throw badRequest(MESSAGES.combine)
    spend(hero, 'gold', combineCost(pick.tier).gold, MESSAGES.noGold)
    const gone = new Set(gemIds)
    hero.items = hero.items.filter((item) => !gone.has(item.id))
    const combined = combinedGem(newId(), pick)
    hero.items.push(combined)
    return { combined }
  })
}

// { questId }: a done quest's reward (gold, fragments, xp at today's study multiplier), once. The last
// quest of the day collected adds ALL_DONE_CHESTS chests.
export function claimQuest(store, user, today, body) {
  if (!isId(body.questId)) throw badRequest()
  return act(store, user, today, (hero, ctx) => {
    hero.quests = questState(hero.quests, ctx.today, ctx.level)
    const state = hero.quests
    const view = questsView({ userId: user.id, state, today: ctx.today, level: ctx.level, ledger: ctx.fuel.ledger, multiplier: ctx.multiplier })
    const quest = view.quests.find((each) => each.id === body.questId)
    if (!quest) throw badRequest()
    if (quest.collected) throw badRequest(MESSAGES.questTaken)
    if (!quest.done) throw badRequest(MESSAGES.questNotDone)
    const { reward } = quest
    const xpBefore = hero.xp
    hero.gold += reward.gold
    hero.fragments += reward.fragments
    hero.xp += reward.xp
    state.taken = [...state.taken, quest.id]
    const ids = dailyQuests({ userId: user.id, day: state.day, level: state.level }).map((each) => each.id)
    const allDone = ids.every((id) => state.taken.includes(id))
    if (allDone) for (let at = 0; at < ALL_DONE_CHESTS; at++) hero.chests.push({ day: state.day, boost: 0 })
    return { quest: { id: quest.id, reward, chests: allDone ? ALL_DONE_CHESTS : 0, levelsGained: levelsGained(xpBefore, hero.xp) } }
  })
}
