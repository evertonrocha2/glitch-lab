// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { getUser } from '../../api/_lib/auth.js'
import { requireUser } from '../../api/_lib/http.js'

const supabaseGetUser = vi.fn()
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: { getUser: supabaseGetUser } })) }))

const withToken = (token) =>
  new Request('http://localhost/api/cases', { headers: token ? { Authorization: `Bearer ${token}` } : {} })

function useSupabase() {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
  vi.stubEnv('DEMO_EMAIL', 'demo@glitch.dev')
}

afterEach(() => {
  vi.unstubAllEnvs()
  supabaseGetUser.mockReset()
})

it('accepts a dev token', async () => {
  expect(await getUser(withToken('dev:alice'))).toEqual({ id: 'alice', email: 'alice@dev.local', isDemo: false })
})

it('marks the demo user', async () => {
  expect((await getUser(withToken('dev:demo'))).isDemo).toBe(true)
})

it('rejects a missing or malformed token', async () => {
  expect(await getUser(withToken())).toBeNull()
  expect(await getUser(withToken('dev:'))).toBeNull()
  expect(await getUser(withToken('dev:Alice!'))).toBeNull()
  expect(await getUser(withToken('alice'))).toBeNull()
})

it('refuses dev tokens on Vercel', async () => {
  vi.stubEnv('VERCEL', '1')
  expect(await getUser(withToken('dev:alice'))).toBeNull()
})

it('verifies a Supabase token', async () => {
  useSupabase()
  supabaseGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'demo@glitch.dev' } }, error: null })
  expect(await getUser(withToken('jwt-123'))).toEqual({ id: 'u1', email: 'demo@glitch.dev', isDemo: true })
  expect(supabaseGetUser).toHaveBeenCalledWith('jwt-123')
})

it('returns null when Supabase rejects the token', async () => {
  useSupabase()
  supabaseGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } })
  expect(await getUser(withToken('jwt-123'))).toBeNull()
  expect(await getUser(withToken('dev:alice'))).toBeNull()
})

it('requireUser answers 401 without a user', async () => {
  const result = await requireUser(withToken())
  expect(result.response.status).toBe(401)
  expect(await result.response.json()).toEqual({ message: 'Sign in to continue.' })
  expect((await requireUser(withToken('dev:alice'))).user.id).toBe('alice')
})
