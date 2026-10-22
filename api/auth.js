import { POST as demo } from './_lib/handlers/demo.js'
import { POST as login } from './_lib/handlers/login.js'
import { POST as register } from './_lib/handlers/register.js'
import { fail } from './_lib/http.js'

// One function for sign in, sign up and the demo account: Vercel's free plan allows 12 functions.
const ACTIONS = { login, register, demo }

export async function POST(request) {
  const action = ACTIONS[new URL(request.url).searchParams.get('action')]
  return action ? action(request) : fail(404, 'Not found.')
}
