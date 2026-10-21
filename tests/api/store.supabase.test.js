// @vitest-environment node
import { describe } from 'vitest'
import { createSupabaseStore } from '../../api/_lib/store/supabase.js'
import { storeContract } from './store-contract.js'

// Runs against a real Supabase project only when test credentials are set; skipped otherwise.
// Every test gets brand-new users (and so a clean slate), since the database outlives each test.
const url = process.env.SUPABASE_TEST_URL
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !serviceKey)('supabase', () => {
  const ids = {}

  storeContract(
    'supabase',
    async () => {
      const store = createSupabaseStore({ url, serviceKey })
      for (const name of ['alice', 'bob']) {
        const user = await store.createUser({ email: `contract-${name}-${crypto.randomUUID()}@glitch.test`, passwordHash: null, isDemo: false })
        ids[name] = user.id
      }
      return store
    },
    ids,
  )
})
