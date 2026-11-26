// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as api from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const call = () => {
  const [url, init] = fetch.mock.calls[0]
  return { url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers.Authorization }
}

const look = { skin: 1, hairStyle: 2, hairColor: 3, eyeStyle: 1, eyeColor: 2, outfit: 4 }
const loadout = { skills: ['a', 'b'], thresholds: { hp: 50, mp: 30 } }
const cases = [
  ['getGame', (t) => api.getGame(t), '/api/game', 'GET', undefined],
  ['syncGame', (t) => api.syncGame(t), '/api/game/sync', 'POST', undefined],
  ['startHunt', (t) => api.startHunt({ world: 'w', zone: 'z', difficulty: 'normal' }, t), '/api/game/hunt', 'POST', { world: 'w', zone: 'z', difficulty: 'normal' }],
  ['stopHunt', (t) => api.stopHunt(t), '/api/game/hunt/stop', 'POST', undefined],
  ['fightBoss', (t) => api.fightBoss({ world: 'w', zone: 'z', difficulty: 'normal' }, t), '/api/game/boss', 'POST', { world: 'w', zone: 'z', difficulty: 'normal' }],
  ['equipItem', (t) => api.equipItem('i1', t), '/api/game/equip', 'POST', { itemId: 'i1' }],
  ['unequipSlot', (t) => api.unequipSlot('weapon', t), '/api/game/unequip', 'POST', { slot: 'weapon' }],
  ['allocateTalents', (t) => api.allocateTalents(['t1', 't2'], t), '/api/game/talents', 'POST', { add: ['t1', 't2'] }],
  ['respecTalents', (t) => api.respecTalents(t), '/api/game/talents/respec', 'POST', undefined],
  ['socketSupport', (t) => api.socketSupport('logica-f0-1', 'g1', t), '/api/game/talents/socket', 'POST', { node: 'logica-f0-1', gemId: 'g1' }],
  ['unsocketSupport', (t) => api.unsocketSupport('logica-f0-1', t), '/api/game/talents/unsocket', 'POST', { node: 'logica-f0-1' }],
  ['buySkill', (t) => api.buySkill('s1', t), '/api/game/skills/buy', 'POST', { skillId: 's1' }],
  ['upgradeSkill', (t) => api.upgradeSkill('s1', t), '/api/game/skills/upgrade', 'POST', { skillId: 's1' }],
  ['saveLoadout', (t) => api.saveLoadout(loadout, t), '/api/game/loadout', 'PUT', loadout],
  ['forgeUpgrade', (t) => api.forgeUpgrade('i1', t), '/api/game/forge/upgrade', 'POST', { itemId: 'i1' }],
  ['forgeSalvage', (t) => api.forgeSalvage(['i1', 'i2'], t), '/api/game/forge/salvage', 'POST', { itemIds: ['i1', 'i2'] }],
  ['forgeReroll', (t) => api.forgeReroll('i1', 2, t), '/api/game/forge/reroll', 'POST', { itemId: 'i1', affix: 2 }],
  ['forgeSocket', (t) => api.forgeSocket('i1', 'g1', 0, t), '/api/game/forge/socket', 'POST', { itemId: 'i1', gemId: 'g1', socket: 0 }],
  ['openChest', (t) => api.openChest(t), '/api/game/chests/open', 'POST', undefined],
  ['buyPotions', (t) => api.buyPotions('hp', 3, t), '/api/game/potions/buy', 'POST', { kind: 'hp', count: 3 }],
  ['saveLook', (t) => api.saveLook(look, t), '/api/game/look', 'PUT', look],
]

it.each(cases)('%s sends the right request and returns the JSON', async (_name, run, url, method, body) => {
  const data = { ok: true }
  fetch.mockResolvedValue(Response.json(data))
  await expect(run('t1')).resolves.toEqual(data)
  const made = call()
  expect(made.url).toMatch(/\?today=\d{4}-\d{2}-\d{2}$/)
  expect({ ...made, url: made.url.replace(/\?today=[\d-]+$/, '') }).toEqual({ url, method, body, auth: 'Bearer t1' })
})

it('exposes status and code on a conflict', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'Busy', code: 'GAME_CONFLICT' }, { status: 409 }))
  await expect(api.syncGame('t1')).rejects.toMatchObject({ status: 409, code: 'GAME_CONFLICT' })
})

it('exposes the reason on a bad request', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'Bad', reason: 'no-room' }, { status: 400 }))
  await expect(api.equipItem('i1', 't1')).rejects.toMatchObject({ status: 400, reason: 'no-room' })
})

it('adds no code or reason when the server sends none', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'Nope' }, { status: 404 }))
  const err = await api.getGame('t1').catch((e) => e)
  expect(err.status).toBe(404)
  expect('code' in err).toBe(false)
  expect('reason' in err).toBe(false)
})
