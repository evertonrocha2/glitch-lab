// Fills a board with the demo cases. Usage: bun scripts/seed-demo.js
// Bun loads .env, so this hits Supabase when it's configured and the local JSON store otherwise.
// (In production, anonymous demo visitors are seeded automatically by GET /api/cases.)
import { seedDemo } from '../server/modules/demo/demo.seed.js'
import { getStore } from '../server/infra/database/index.js'

const usingSupabase = Boolean(process.env.SUPABASE_URL)
if (usingSupabase && !process.env.DEMO_USER_ID) {
  console.error('Set DEMO_USER_ID to the Supabase user id (a uuid) whose board should be seeded.')
  process.exit(1)
}

const userId = process.env.DEMO_USER_ID || 'demo'
const seeded = await seedDemo(getStore(), userId)
console.log(seeded ? `Seeded the demo board for ${userId}.` : `The board for ${userId} already has cases. Nothing changed.`)
