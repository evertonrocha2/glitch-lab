// @vitest-environment node
import { beforeEach, expect, it } from 'vitest'
import { worldById } from '../../shared/world/worlds.js'
import { api, useTempStore } from './helpers.js'
import { CASE, SECRET, challengeFor } from './store-contract.js'
import { examQuestion } from './store-contract-exams.js'

let store

beforeEach(async () => {
  store = await useTempStore()
})

const get = (token) => api('/api/world', { method: 'GET', token })
const put = (body, token) => api('/api/world/position', { method: 'PUT', body, token })
const world = async () => (await get()).json()
const worldOf = (body, id) => body.worlds.find((item) => item.id === id)
const spawnOf = (id) => ({ world: id, ...worldById(id).spawn })

async function rightAnswersInMath(count) {
  await store.upsertExamQuestions(Array.from({ length: count }, (_, index) => examQuestion('enem', { number: index + 1, topic: 'funcoes', answer: 'B' })))
  for (const question of await store.listExamQuestions('enem', 'funcoes', { offset: 0, limit: 50 })) {
    await api(`/api/exam-questions/${question.id}/answer`, { body: { choice: 'B' } })
  }
}

async function gymPasses(count) {
  for (let index = 0; index < count; index++) {
    const kase = await store.createCase('alice', CASE)
    const challenge = await store.createChallenge('alice', challengeFor(kase.id), SECRET)
    await store.updateChallenge('alice', challenge.id, { status: 'passed', attempts: 1 })
  }
}

it('starts a new player in the hub with only the forest open', async () => {
  const body = await world()
  expect(body.position).toEqual(spawnOf('laboratorio'))
  expect(worldOf(body, 'floresta-js')).toMatchObject({ unlocked: true, have: null, need: null })
  expect(worldOf(body, 'caverna-sql')).toMatchObject({ unlocked: false, have: 0, need: 3 })
  expect(worldOf(body, 'torre-matematica')).toMatchObject({ unlocked: false, have: 0, need: 5 })
  expect(body.zones['floresta-js'].map((zone) => zone.unlocked)).toEqual([true, true])
  expect(body.signals).toEqual({ enemCorrect: { linguagens: 0, humanas: 0, natureza: 0, matematica: 0 }, codeSolved: 0 })
})

it('opens the Math tower after 5 right first answers in Math', async () => {
  await rightAnswersInMath(4)
  expect(worldOf(await world(), 'torre-matematica')).toMatchObject({ unlocked: false, have: 4 })
  await rightAnswersInMath(1)
  const body = await world()
  expect(worldOf(body, 'torre-matematica')).toMatchObject({ unlocked: true, have: 5, need: 5 })
  expect(body.signals.enemCorrect.matematica).toBe(5)
})

it('opens the SQL cave after 3 passed gym challenges', async () => {
  await gymPasses(3)
  const body = await world()
  expect(body.signals.codeSolved).toBe(3)
  expect(worldOf(body, 'caverna-sql').unlocked).toBe(true)
})

it("keeps each player's unlocks to themselves", async () => {
  await gymPasses(3)
  const bobs = await (await get('dev:bob')).json()
  expect(worldOf(bobs, 'caverna-sql').unlocked).toBe(false)
})

it('saves a walkable position in an open world and gives it back', async () => {
  await gymPasses(3)
  const res = await put({ world: 'caverna-sql', x: 3, y: 10 })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ position: { world: 'caverna-sql', x: 3, y: 10 } })
  expect((await world()).position).toEqual({ world: 'caverna-sql', x: 3, y: 10 })
})

it('brings a hero saved inside a hunt world back to the hub, beside its portal', async () => {
  await store.saveWorldPosition('alice', { world: 'floresta-js', x: 5, y: 5 })
  expect((await world()).position).toEqual({ world: 'laboratorio', x: 2, y: 2 })
  expect((await put({ world: 'floresta-js', x: 3, y: 10 })).status).toBe(200)
  expect((await world()).position).toEqual({ world: 'laboratorio', x: 2, y: 2 })
})

it('refuses a locked world and a solid tile with 400', async () => {
  const locked = await put({ world: 'torre-matematica', x: 3, y: 10 })
  expect(locked.status).toBe(400)
  expect((await locked.json()).message).toBe('This world is still locked.')
  const solid = await put({ world: 'floresta-js', x: 0, y: 0 })
  expect(solid.status).toBe(400)
  expect((await solid.json()).message).toBe("Your hero can't stand there.")
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
  await store.saveWorldPosition('alice', { world: 'torre-matematica', x: 3, y: 10 })
  expect((await world()).position).toEqual(spawnOf('laboratorio'))
  await gymPasses(3)
  await store.saveWorldPosition('alice', { world: 'caverna-sql', x: 0, y: 0 })
  expect((await world()).position).toEqual(spawnOf('caverna-sql'))
  await store.saveWorldPosition('alice', { world: 'apagado', x: 1, y: 1 })
  expect((await world()).position).toEqual(spawnOf('laboratorio'))
})

it('asks to sign in', async () => {
  expect((await get(null)).status).toBe(401)
  expect((await put({ world: 'laboratorio', x: 9, y: 7 }, null)).status).toBe(401)
})
