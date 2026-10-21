// Fills the demo account's board. Usage: bun scripts/seed-demo.js
// Bun loads .env, so this hits Supabase when it's configured and the local JSON store otherwise.
import { seedDemo } from '../api/_lib/seed.js'
import { getStore } from '../api/_lib/store/index.js'

const userId = process.env.DEMO_USER_ID || 'demo'
const seeded = await seedDemo(getStore(), userId)
console.log(seeded ? `Seeded the demo board for ${userId}.` : `The board for ${userId} already has cases. Nothing changed.`)
