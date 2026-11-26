import { clientDay, serverDay } from '../../core/days.js'
import { queryText, requireBody } from '../../core/validation.js'
import * as build from './game.build.js'
import * as forge from './game.forge.js'
import * as npc from './game.npc.js'
import * as game from './game.service.js'

const todayOf = (req) => clientDay(queryText(req, 'today')) ?? serverDay()

export async function show(req, res) {
  res.json(await game.getGame(req.deps.store, req.user, todayOf(req)))
}

export async function sync(req, res) {
  res.json(await game.sync(req.deps.store, req.user, todayOf(req)))
}

export async function hunt(req, res) {
  res.json(await game.startHunt(req.deps.store, req.user, todayOf(req), requireBody(req)))
}

export async function stopHunt(req, res) {
  res.json(await game.stopHunt(req.deps.store, req.user, todayOf(req)))
}

export async function boss(req, res) {
  res.json(await game.fightBoss(req.deps.store, req.user, todayOf(req), requireBody(req)))
}

// Build, forge, chest and shop intents: each one answers the View (plus its own extra fields).
const action = (fn, { body = true } = {}) => async (req, res) => {
  res.json(await fn(req.deps.store, req.user, todayOf(req), body ? requireBody(req) : undefined))
}

export const equip = action(build.equip)
export const unequip = action(build.unequip)
export const talents = action(build.allocateTalents)
export const respec = action(build.respecTalents, { body: false })
export const socketSupport = action(build.socketSupport)
export const unsocketSupport = action(build.unsocketSupport)
export const buySkill = action(build.buySkill)
export const upgradeSkill = action(build.upgradeSkill)
export const loadout = action(build.setLoadout)
export const look = action(build.setLook)
export const forgeUpgrade = action(forge.upgradeItem)
export const forgeSalvage = action(forge.salvageItems)
export const forgeReroll = action(forge.rerollAffix)
export const forgeSocket = action(forge.socketGem)
export const openChest = action(forge.openChest, { body: false })
export const buyPotions = action(forge.buyPotions)

// The town's NPCs (fase 3). The alchemist sells potions through forge.buyPotions too.
export async function market(req, res) {
  res.json(await npc.getMarket(req.deps.store, req.user, todayOf(req), queryText(req, 'tier')))
}
export const marketBuy = action(npc.buyMarketItem)
export const marketSell = action(npc.sellItems)
export const marketReroll = action(npc.rerollMarket)
export const buyElixir = action(npc.buyElixir)
export const jewelerBuy = action(npc.buyJewel)
export const jewelerCombine = action(npc.combineGems)
export const claimQuest = action(npc.claimQuest)
