import { createLocalStore } from './local.js'
import { createSupabaseStore } from './supabase.js'

let store

// Supabase in production; a JSON file on your machine otherwise. Never the JSON file on Vercel.
export function getStore() {
  if (store) return store
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    store = createSupabaseStore({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY })
    return store
  }
  if (process.env.VERCEL === '1') throw new Error('No database configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  store = createLocalStore({ file: process.env.LOCAL_STORE_FILE || '.data/db.json' })
  return store
}

// Tests point LOCAL_STORE_FILE at a temp file and start fresh.
export function resetStore() {
  store = undefined
}
