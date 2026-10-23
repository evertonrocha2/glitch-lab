import { ok, requireUser } from '../server/core/http.js'
import { localeOf } from '../server/core/locale.js'
import { seedDemo } from '../server/modules/demo/demo.seed.js'
import { getStore } from '../server/infra/database/index.js'

export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const store = getStore()
  // A demo visitor lands on a ready-made board (their own copy), so every column has something to click.
  if (auth.user.isDemo) await seedDemo(store, auth.user.id, undefined, localeOf(request))
  return ok({ cases: await store.listCases(auth.user.id) })
}
