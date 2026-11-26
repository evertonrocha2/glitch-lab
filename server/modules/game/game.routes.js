import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './game.controller.js'

// Glitch World v2: the idle hero. The client sends intents only; the server rolls every result.
export const gameRoutes = Router()
  .get('/game', requireAuth, controller.show)
  .post('/game/sync', requireAuth, controller.sync)
  .post('/game/hunt', requireAuth, controller.hunt)
  .post('/game/hunt/stop', requireAuth, controller.stopHunt)
  .post('/game/boss', requireAuth, controller.boss)
  .post('/game/equip', requireAuth, controller.equip)
  .post('/game/unequip', requireAuth, controller.unequip)
  .post('/game/talents', requireAuth, controller.talents)
  .post('/game/talents/respec', requireAuth, controller.respec)
  .post('/game/talents/socket', requireAuth, controller.socketSupport)
  .post('/game/talents/unsocket', requireAuth, controller.unsocketSupport)
  .post('/game/skills/buy', requireAuth, controller.buySkill)
  .post('/game/skills/upgrade', requireAuth, controller.upgradeSkill)
  .put('/game/loadout', requireAuth, controller.loadout)
  .post('/game/forge/upgrade', requireAuth, controller.forgeUpgrade)
  .post('/game/forge/salvage', requireAuth, controller.forgeSalvage)
  .post('/game/forge/reroll', requireAuth, controller.forgeReroll)
  .post('/game/forge/socket', requireAuth, controller.forgeSocket)
  .post('/game/chests/open', requireAuth, controller.openChest)
  .post('/game/potions/buy', requireAuth, controller.buyPotions)
  .put('/game/look', requireAuth, controller.look)
