import { sessionResponse } from './credentials.js'
import { clientDay, serverDay } from '../../core/days.js'
import { readJson } from '../../core/http.js'
import { localeOf } from '../../core/locale.js'
import { seedDemo } from '../demo/demo.seed.js'
import { getStore } from '../../infra/database/index.js'

// One click for judges: a brand-new demo account (no password, so nobody can take it over)
// with the sample board already filled in, in the visitor's language.
export async function POST(request) {
  const body = await readJson(request)
  const today = clientDay(body?.today) ?? serverDay()
  const store = getStore()
  const user = await store.createUser({ email: `demo-${crypto.randomUUID()}@demo.glitch`, passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, today, localeOf(request))
  return sessionResponse(user, 201)
}
