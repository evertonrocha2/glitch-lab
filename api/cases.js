import { ok, requireUser } from './_lib/http.js'
import { getStore } from './_lib/store/index.js'

export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  return ok({ cases: await getStore().listCases(auth.user.id) })
}
