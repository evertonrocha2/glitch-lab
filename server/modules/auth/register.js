import { credentialsProblem, sessionResponse } from './credentials.js'
import { hashPassword } from '../../infra/security/password.js'
import { fail, readJson } from '../../core/http.js'
import { getStore } from '../../infra/database/index.js'

export async function POST(request) {
  const body = await readJson(request)
  if (!body) return fail(400, 'Invalid request.')
  const problem = credentialsProblem(body)
  if (problem) return fail(400, problem)

  const user = await getStore().createUser({ email: body.email, passwordHash: await hashPassword(body.password), isDemo: false })
  if (!user) return fail(409, 'An account with this email already exists. Sign in instead.')
  return sessionResponse(user, 201)
}
