// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { newHero } from '../../server/modules/game/game.model.js'
import { settle } from '../../server/modules/game/game.service.js'
import { api, useTempStore } from './helpers.js'

// Keys 5 and 6: a potion drunk by hand during a hunt. The server records it on the running hunt
// (hunt.drunk) and settle spends max(what the sim drank, what was drunk by hand) of each kind.

let store

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const HOUR = 3_600_000
const FOREST = 'floresta-js'
const drink = (body) => api('/api/game/potion', { body })

async function hunting(potions, over = {}) {
  const hero = newHero()
  hero.potions = potions
  hero.hunt = { world: FOREST, zone: 'z1', difficulty: 'normal', startedAt: Date.now(), seed: 'alice:potion', claims: 0, xpMultiplier: 1, ...over }
  await store.saveGameHero('alice', hero, 0)
  return hero
}

it('refuses a drink when no hunt runs', async () => {
  const res = await drink({ kind: 'hp' })
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ message: 'Your hero is not hunting.' })
})

it('refuses kinds other than hp and mp', async () => {
  await hunting({ hp: 3, mp: 3 })
  for (const body of [{ kind: 'xp' }, { kind: 'constructor' }, { kind: 1 }, {}]) expect((await drink(body)).status).toBe(400)
  expect((await store.getGameHero('alice')).data.hunt.drunk).toBeUndefined()
})

it('records each drink on the running hunt, never more than the stock, and leaves the hunt unpaid', async () => {
  await hunting({ hp: 2, mp: 0 })
  const first = await drink({ kind: 'hp' })
  expect(first.status).toBe(200)
  const body = await first.json()
  expect(body.hero.hunt.drunk).toEqual({ hp: 1, mp: 0 })
  expect(body.potionsLeft).toEqual({ hp: 1, mp: 0 })
  // The stock itself only drops when the hunt is paid.
  expect(body.hero.potions).toEqual({ hp: 2, mp: 0 })
  expect(body.hero.hunt).toMatchObject({ startedAt: Date.now(), claims: 0 })

  expect((await (await drink({ kind: 'hp' })).json()).potionsLeft).toEqual({ hp: 0, mp: 0 })
  const empty = await drink({ kind: 'hp' })
  expect(empty.status).toBe(400)
  expect(await empty.json()).toEqual({ message: 'You have no potion of that kind left.' })
  expect((await drink({ kind: 'mp' })).status).toBe(400)
  expect((await store.getGameHero('alice')).data.hunt.drunk).toEqual({ hp: 2, mp: 0 })
})

// A level 1 hero in Inferno drinks on its own: the stretch's own count, with no drink by hand.
const STOCK = 1000
function huntHero(drunk) {
  const hero = newHero()
  hero.xp = 0
  hero.potions = { hp: STOCK, mp: 0 }
  hero.hunt = { world: FOREST, zone: 'z3', difficulty: 'inferno', startedAt: Date.now() - 8 * HOUR, seed: 'alice:auto', claims: 0, xpMultiplier: 1, ...(drunk ? { drunk } : {}) }
  return hero
}

it('spends what the sim drank or what was drunk by hand, whichever is more, and resets the count on keep', () => {
  const now = Date.now()
  const auto = huntHero()
  settle(auto, now, { keep: true })
  const autoUsed = STOCK - auto.potions.hp
  expect(autoUsed).toBeGreaterThan(0)
  expect(autoUsed).toBeLessThan(STOCK - 2)

  // Fewer by hand than the sim drank: the hand drinks were some of the sim's own.
  const fewer = huntHero({ hp: 1, mp: 0 })
  settle(fewer, now, { keep: true })
  expect(fewer.potions.hp).toBe(auto.potions.hp)
  expect(fewer.hunt.drunk).toBeUndefined()
  expect(fewer.hunt).toMatchObject({ startedAt: now, claims: 1 })

  // More by hand than the sim drank: every hand drink is spent.
  const more = huntHero({ hp: autoUsed + 2, mp: 0 })
  settle(more, now, { keep: true })
  expect(more.potions.hp).toBe(STOCK - autoUsed - 2)
  expect(more.hunt.drunk).toBeUndefined()

  // Ending the hunt spends them too.
  const stopped = huntHero({ hp: autoUsed + 1, mp: 0 })
  settle(stopped, now, { keep: false })
  expect(stopped.potions.hp).toBe(STOCK - autoUsed - 1)
  expect(stopped.hunt).toBeNull()
})

it('pays the hand drinks on the next sync', async () => {
  await hunting({ hp: 3, mp: 2 })
  await drink({ kind: 'mp' })
  vi.setSystemTime(new Date(Date.now() + HOUR))
  const synced = await (await api('/api/game/sync')).json()
  // At least the hand drink is spent, whatever the sim drank.
  expect(synced.hero.potions.mp).toBeLessThanOrEqual(1)
  expect(synced.hero.hunt.drunk).toBeUndefined()
})
