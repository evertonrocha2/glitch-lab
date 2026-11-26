// @vitest-environment node
import { beforeEach, expect, it } from 'vitest'
import { worldById } from '../../shared/world/worlds.js'
import { api, useTempStore } from './helpers.js'

let store

beforeEach(async () => {
  store = await useTempStore()
})

const get = (token) => api('/api/world', { method: 'GET', token })
const put = (body, token) => api('/api/world/position', { method: 'PUT', body, token })
const world = async () => (await get()).json()
const spawnOf = (id) => ({ world: id, ...worldById(id).spawn })

it('starts a new player in the town, with nothing locked to report', async () => {
  const body = await world()
  expect(body).toEqual({ position: spawnOf('laboratorio') })
})

it('saves a walkable position in any region from the start and gives it back', async () => {
  for (const place of [{ world: 'caverna-sql', x: 3, y: 10 }, { world: 'torre-matematica', x: 13, y: 2 }, { world: 'laboratorio', x: 0, y: 12 }]) {
    const res = await put(place)
    expect(res.status, JSON.stringify(place)).toBe(200)
    expect(await res.json()).toEqual({ position: place })
    expect((await world()).position).toEqual(place)
  }
})

it('keeps a hero saved inside a hunt region there: regions are walked now', async () => {
  await store.saveWorldPosition('alice', { world: 'floresta-js', x: 25, y: 10 })
  expect((await world()).position).toEqual({ world: 'floresta-js', x: 25, y: 10 })
})

it("keeps each player's position to themselves", async () => {
  await put({ world: 'caverna-sql', x: 3, y: 10 })
  expect((await (await get('dev:bob')).json()).position).toEqual(spawnOf('laboratorio'))
})

it('refuses a solid tile and an NPC tile with 400', async () => {
  const solid = await put({ world: 'floresta-js', x: 0, y: 0 })
  expect(solid.status).toBe(400)
  expect((await solid.json()).message).toBe("Your hero can't stand there.")
  const merchant = worldById('laboratorio').npcs.find((npc) => npc.id === 'merchant')
  const npc = await put({ world: 'laboratorio', x: merchant.x, y: merchant.y })
  expect(npc.status).toBe(400)
  expect((await npc.json()).message).toBe("Your hero can't stand there.")
})

it('refuses broken positions with 400', async () => {
  const bodies = [
    undefined,
    {},
    'not json',
    { world: 'laboratorio', x: '3', y: 4 },
    { world: 'laboratorio', x: 1.5, y: 4 },
    { world: 'laboratorio', x: -1, y: 4 },
    { world: 'laboratorio', x: 9999, y: 4 },
    { world: 'laboratorio', x: 3, y: Number.MAX_SAFE_INTEGER + 2 },
    { world: 'laboratorio', x: 3, y: null },
    { world: 3, x: 3, y: 4 },
    { world: 'x'.repeat(200), x: 1, y: 1 },
  ]
  for (const body of bodies) expect((await put(body)).status, JSON.stringify(body)).toBe(400)
  const unknown = await put({ world: 'nope', x: 1, y: 1 })
  expect(unknown.status).toBe(400)
  expect((await unknown.json()).message).toBe('World not found.')
  expect((await world()).position).toEqual(spawnOf('laboratorio'))
})

it('sends a hero standing somewhere no longer valid back to a spawn', async () => {
  await store.saveWorldPosition('alice', { world: 'caverna-sql', x: 0, y: 0 })
  expect((await world()).position).toEqual(spawnOf('caverna-sql'))
  // The old 15x10 Lab's portal tile is a wall of the new town.
  await store.saveWorldPosition('alice', { world: 'laboratorio', x: 2, y: 1 })
  expect((await world()).position).toEqual(spawnOf('laboratorio'))
  await store.saveWorldPosition('alice', { world: 'apagado', x: 1, y: 1 })
  expect((await world()).position).toEqual(spawnOf('laboratorio'))
})

it('sends a hero saved on a tile of the old 32x20 Forest that is solid on the 48x32 one to its spawn', async () => {
  // (31, 10) was the Forest's east road; it is the tree line between the clearing and the roots now.
  const forest = worldById('floresta-js')
  expect(forest.rows[10][31]).toBe('T')
  await store.saveWorldPosition('alice', { world: 'floresta-js', x: 31, y: 10 })
  expect((await world()).position).toEqual(spawnOf('floresta-js'))
})

it('asks to sign in', async () => {
  expect((await get(null)).status).toBe(401)
  expect((await put({ world: 'laboratorio', x: 9, y: 7 }, null)).status).toBe(401)
})
