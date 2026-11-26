// @vitest-environment node
// Fase 2c: support gems in the talent tree's sockets (game.build.js), and what the hero fights with.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { xpForLevel } from '../../shared/game/fuel.js'
import { BAG_SIZE } from '../../shared/game/items.js'
import { SOCKET_NODES } from '../../shared/game/talents.js'
import { fighterOf, newHero, withDefaults } from '../../server/modules/game/game.model.js'
import { api, useTempStore } from './helpers.js'

const fuel = vi.hoisted(() => ({ level: null }))
vi.mock('../../server/modules/game/game.fuel.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    loadFuel: async (...args) => {
      const loaded = await real.loadFuel(...args)
      return fuel.level ? { ...loaded, studyXp: xpForLevel(fuel.level) } : loaded
    },
  }
})

let store

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
})

afterEach(() => {
  fuel.level = null
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const post = (path, body) => api(`/api/game${path}`, { body })
const M = { badItem: "That item can't be used for this.", bagFull: 'Your bag is full.', noGold: 'Not enough gold.' }

async function bodyOf(res) {
  const text = await res.text()
  expect(res.status, text).toBe(200)
  return JSON.parse(text)
}
async function refused(res, message) {
  expect(res.status).toBe(400)
  const body = await res.json()
  if (message) expect(body.message).toBe(message)
  return body
}

let nextId = 0
const support = (name = 'fogo') => ({ id: `sup${String(nextId++).padStart(9, '0')}`, kind: 'support', support: name })
const filler = (count) =>
  Array.from({ length: count }, () => ({
    id: `fil${String(nextId++).padStart(9, '0')}`, kind: 'gear', base: 'anel', slot: 'ring', rarity: 'common', ilvl: 1,
    affixes: [], sockets: [], upgrade: 0, rerolls: 0, equipped: null,
  }))
// logica-f0-1 is a socket three points from the root.
const SOCKET = 'logica-f0-1'
const PATH = ['root', 'logica-c0', 'logica-c1', SOCKET]
const saveHero = (patch) => store.saveGameHero('alice', { ...newHero(), ...patch }, 0)
const stored = async () => (await store.getGameHero('alice')).data

it('a new hero has empty tree sockets, and an old save loads with them', () => {
  expect(newHero().treeSockets).toEqual({})
  const { treeSockets: _gone, ...old } = newHero()
  expect(withDefaults(old).treeSockets).toEqual({})
  expect(SOCKET_NODES).toContain(SOCKET)
})

it('sockets a support gem from the bag into an allocated socket node, and the hero fights with it', async () => {
  const gem = support('fogo')
  await saveHero({ talents: PATH, items: [gem] })
  const body = await bodyOf(await post('/talents/socket', { node: SOCKET, gemId: gem.id }))
  expect(body.hero.treeSockets).toEqual({ [SOCKET]: gem })
  expect(body.hero.items).toEqual([])
  const saved = await stored()
  expect(saved.treeSockets[SOCKET]).toEqual(gem)
  expect(fighterOf(withDefaults(saved), 5).supports).toEqual(['fogo'])
})

it('swaps: a gem into a filled socket sends the old one back to the bag', async () => {
  const [a, b] = [support('fogo'), support('rapido')]
  await saveHero({ talents: PATH, items: [b], treeSockets: { [SOCKET]: a } })
  const body = await bodyOf(await post('/talents/socket', { node: SOCKET, gemId: b.id }))
  expect(body.hero.treeSockets[SOCKET]).toEqual(b)
  expect(body.hero.items).toEqual([a])
})

it('removes a gem back to the bag, and refuses with a full bag or an empty socket', async () => {
  const gem = support('vampiro')
  await saveHero({ talents: PATH, treeSockets: { [SOCKET]: gem }, items: filler(BAG_SIZE) })
  await refused(await post('/talents/unsocket', { node: SOCKET }), M.bagFull)
  await store.saveGameHero('alice', { ...(await stored()), items: [] }, 1)
  const body = await bodyOf(await post('/talents/unsocket', { node: SOCKET }))
  expect(body.hero.treeSockets).toEqual({})
  expect(body.hero.items).toEqual([gem])
  await refused(await post('/talents/unsocket', { node: SOCKET }), M.badItem)
})

it('refuses bad sockets and bad gems with a 400, saving nothing', async () => {
  const gem = support('encadear')
  const twin = support('fogo')
  const ruby = { id: 'gem000000001', kind: 'gem', gem: 'logica' }
  const odd = { id: 'sup000000999', kind: 'support', support: 'constructor' }
  await saveHero({ talents: [...PATH, 'sintaxe-c0', 'sintaxe-c1', 'sintaxe-c2', 'sintaxe-f0-1', 'sintaxe-f0-2', 'sintaxe-f0-3'], items: [gem, twin, ruby, odd], treeSockets: { 'sintaxe-f0-3': support('fogo') } })
  const { version } = await store.getGameHero('alice')
  // A socket node the hero has not taken, a node that is no socket, an unknown node.
  await refused(await post('/talents/socket', { node: 'algoritmos-f0-1', gemId: gem.id }), M.badItem)
  await refused(await post('/talents/socket', { node: 'logica-c1', gemId: gem.id }), M.badItem)
  await refused(await post('/talents/socket', { node: 'nope', gemId: gem.id }), M.badItem)
  // A gear gem, a support of an unknown kind, an item not in the bag.
  await refused(await post('/talents/socket', { node: SOCKET, gemId: ruby.id }), M.badItem)
  await refused(await post('/talents/socket', { node: SOCKET, gemId: odd.id }), M.badItem)
  await refused(await post('/talents/socket', { node: SOCKET, gemId: 'nothing-here' }), M.badItem)
  // The same support twice in the tree.
  await refused(await post('/talents/socket', { node: SOCKET, gemId: twin.id }), M.badItem)
  for (const body of [{}, { node: SOCKET }, { node: 3, gemId: gem.id }, { node: ['x'], gemId: gem.id }, { node: '__proto__', gemId: gem.id }]) {
    await refused(await post('/talents/socket', body))
  }
  for (const body of [{}, { node: 7 }, { node: 'constructor' }]) await refused(await post('/talents/unsocket', body))
  expect((await store.getGameHero('alice')).version).toBe(version)
})

it('answers a 409 when the hero changed in another tab', async () => {
  const gem = support('fogo')
  await saveHero({ talents: PATH, items: [gem] })
  vi.spyOn(store, 'saveGameHero').mockResolvedValueOnce(null)
  const res = await post('/talents/socket', { node: SOCKET, gemId: gem.id })
  expect(res.status).toBe(409)
  expect((await res.json()).code).toBe('GAME_CONFLICT')
})

it('respec returns every socketed gem to the bag, and refuses when the bag has no room for them', async () => {
  fuel.level = 6
  const [a, b] = [support('fogo'), support('frio')]
  const talents = [...PATH, 'sintaxe-c0', 'sintaxe-c1', 'sintaxe-c2', 'sintaxe-f0-1', 'sintaxe-f0-2', 'sintaxe-f0-3']
  await saveHero({ gold: 1000, talents, treeSockets: { [SOCKET]: a, 'sintaxe-f0-3': b }, items: filler(BAG_SIZE - 1) })
  await refused(await post('/talents/respec'), M.bagFull)
  expect((await stored()).gold).toBe(1000)
  await store.saveGameHero('alice', { ...(await stored()), items: filler(BAG_SIZE - 2) }, 1)
  const body = await bodyOf(await post('/talents/respec'))
  expect(body.hero.talents).toEqual(['root'])
  expect(body.hero.treeSockets).toEqual({})
  expect(body.hero.items.slice(-2)).toEqual([a, b])
  expect(body.hero.gold).toBe(1000 - 50 * (talents.length - 1))
})

it('fights only with the supports in allocated sockets, each kind once', () => {
  const hero = withDefaults({
    ...newHero(),
    talents: PATH,
    treeSockets: { [SOCKET]: support('fogo'), 'sintaxe-f0-3': support('rapido') },
  })
  expect(fighterOf(hero, 5).supports).toEqual(['fogo'])
})

it('needs a session for the socket actions', async () => {
  for (const path of ['/talents/socket', '/talents/unsocket']) {
    expect((await api(`/api/game${path}`, { token: null, body: {} })).status).toBe(401)
  }
})
