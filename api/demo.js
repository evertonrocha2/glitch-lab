import { sessionResponse } from './_lib/accounts.js'
import { clientDay, serverDay } from './_lib/days.js'
import { readJson } from './_lib/http.js'
import { seedDemo } from './_lib/seed.js'
import { getStore } from './_lib/store/index.js'

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
