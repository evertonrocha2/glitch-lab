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

// Returns { id, email, isDemo } or null. Supabase when configured; otherwise "dev:<id>" tokens, never on Vercel.
export async function getUser(request) {
  const token = bearerToken(request)
  if (!token) return null

  if (process.env.SUPABASE_URL) {
    try {
      const { data, error } = await supabaseAdmin().auth.getUser(token)
      if (error || !data?.user) return null
      const email = data.user.email ?? ''
      return { id: data.user.id, email, isDemo: Boolean(process.env.DEMO_EMAIL) && email === process.env.DEMO_EMAIL }
    } catch {
      return null
    }
  }

  if (process.env.VERCEL === '1') return null
  const match = DEV_TOKEN.exec(token)
  return match ? { id: match[1], email: `${match[1]}@dev.local`, isDemo: match[1] === 'demo' } : null
}
