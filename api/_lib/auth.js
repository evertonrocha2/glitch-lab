import { createClient } from '@supabase/supabase-js'

const DEV_TOKEN = /^dev:([a-z0-9-]{1,40})$/

let admin

function supabaseAdmin() {
  admin ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return admin
}

function bearerToken(request) {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
}

// Supabase couldn't answer (outage, network, misconfig): not the same as "you're signed out".
export class AuthUnavailableError extends Error {}

// Returns { id, email, isDemo } or null. Supabase when configured; otherwise "dev:<id>" tokens, never in production.
export async function getUser(request) {
  const token = bearerToken(request)
  if (!token) return null

  if (process.env.SUPABASE_URL) {
    let result
    try {
      result = await supabaseAdmin().auth.getUser(token)
    } catch {
      throw new AuthUnavailableError('Supabase auth did not answer')
    }
    const { data, error } = result
    if (error) {
      // 4xx: the token is bad or expired. Anything else: Supabase is in trouble.
      if (error.status && error.status < 500) return null
      throw new AuthUnavailableError(error.message)
    }
    if (!data?.user) return null

    const email = data.user.email ?? ''
    // Demo visitors sign in anonymously (each gets their own seeded board); DEMO_EMAIL covers a fixed demo login too.
    const demoEmail = process.env.DEMO_EMAIL?.toLowerCase()
    const isDemo = data.user.is_anonymous === true || (Boolean(demoEmail) && email.toLowerCase() === demoEmail)
    return { id: data.user.id, email, isDemo }
  }

  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') return null
  const match = DEV_TOKEN.exec(token)
  return match ? { id: match[1], email: `${match[1]}@dev.local`, isDemo: match[1] === 'demo' } : null
}
