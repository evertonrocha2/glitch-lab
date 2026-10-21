// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { afterAll, describe } from 'vitest'
import { createSupabaseStore } from '../../api/_lib/store/supabase.js'
import { storeContract } from './store-contract.js'

// Runs against a real Supabase project only when test credentials are set; skipped otherwise.
const url = process.env.SUPABASE_TEST_URL
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !serviceKey)('supabase', () => {
  const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null
  const created = []
  // The database outlives each test, so every test gets brand-new users (and so a clean slate).
  const ids = {}

  async function newUser(name) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `contract-${name}-${crypto.randomUUID()}@glitch.test`,
      password: crypto.randomUUID(),
      email_confirm: true,
    })
    if (error) throw error
    created.push(data.user.id)
    return data.user.id
  }

  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id)
  })

  storeContract(
    'supabase',
    async () => {
      ids.alice = await newUser('alice')
      ids.bob = await newUser('bob')
      return createSupabaseStore({ url, serviceKey })
    },
    ids,
  )
})
