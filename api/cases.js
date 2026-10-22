import { ok, requireUser } from './_lib/http.js'
import { localeOf } from './_lib/locale.js'
import { seedDemo } from './_lib/seed.js'
import { getStore } from './_lib/store/index.js'

export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const store = getStore()
  // A demo visitor lands on a ready-made board (their own copy), so every column has something to click.
  if (auth.user.isDemo) await seedDemo(store, auth.user.id, undefined, localeOf(request))
  return ok({ cases: await store.listCases(auth.user.id) })
}
