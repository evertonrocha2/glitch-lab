import { POST as demo } from '../server/modules/auth/demo.js'
import { POST as login } from '../server/modules/auth/auth.service.js'
import { POST as register } from '../server/modules/auth/register.js'
import { fail } from '../server/core/http.js'

// One function for sign in, sign up and the demo account: Vercel's free plan allows 12 functions.
const ACTIONS = { login, register, demo }

export async function POST(request) {
  const action = ACTIONS[new URL(request.url).searchParams.get('action')]
  return action ? action(request) : fail(404, 'Not found.')
}
