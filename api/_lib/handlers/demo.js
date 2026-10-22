import { sessionResponse } from '../accounts.js'
import { clientDay, serverDay } from '../days.js'
import { readJson } from '../http.js'
import { seedDemo } from '../seed.js'
import { getStore } from '../store/index.js'

// One click for judges: a brand-new demo account (no password, so nobody can take it over)
// with the sample board already filled in.
export async function POST(request) {
  const body = await readJson(request)
  const today = clientDay(body?.today) ?? serverDay()
  const store = getStore()
  const user = await store.createUser({ email: `demo-${crypto.randomUUID()}@demo.glitch`, passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, today)
  return sessionResponse(user, 201)
}
