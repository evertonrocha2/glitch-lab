import { clientDay, serverDay } from '../../core/days.js'
import { queryText, requireBody } from '../../core/validation.js'
import * as build from './game.build.js'
import * as forge from './game.forge.js'
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
