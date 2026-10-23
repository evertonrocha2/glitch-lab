import { env, isProduction } from '../../config/env.js'
import { createLocalStore } from './local/index.js'
import { createSupabaseStore } from './supabase/index.js'

let store

// Supabase when it's configured; a JSON file on your machine otherwise. Never the JSON file on a
// deployed server, where it would vanish with the next deploy.
export function getStore() {
  if (store) return store
  if (env.supabase) {
    store = createSupabaseStore(env.supabase)
    return store
  }
  if (isProduction()) throw new Error('No database configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  store = createLocalStore({ file: env.localStoreFile })
  return store
}

// Tests point LOCAL_STORE_FILE at a temp file and start fresh.
export function resetStore() {
  store = undefined
}
