// Imports ENEM 2019-2023 from api.enem.dev into the store, then tags each question with a topic
// using the AI. Safe to rerun: questions are matched by source, and a saved topic is never cleared.
// Writes to Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, to the local JSON file
// otherwise. The tagging pass spends AI credits (about one call per 10 untagged questions).
//
//   node --env-file=.env scripts/import-enem.mjs              import, then tag what's untagged
//   node --env-file=.env scripts/import-enem.mjs --no-tag     import only
//   node --env-file=.env scripts/import-enem.mjs --tag-only   tag only

import { env } from '../server/config/env.js'
import { generateJson } from '../server/infra/ai/index.js'
import { getStore } from '../server/infra/database/index.js'
import { ENEM_YEARS, fetchYear, toQuestionRow } from './enem/source.js'
import { tagUntagged } from './enem/tag.js'

const args = new Set(process.argv.slice(2))
const importing = !args.has('--tag-only')
const tagging = !args.has('--no-tag')

console.log(`Store: ${env.supabase ? `Supabase (${env.supabase.url})` : `local file (${env.localStoreFile})`}`)
if (tagging) console.log(`AI: ${process.env.AI_PROVIDER || 'gemini'}`)

const store = getStore()

if (importing) {
  for (const year of ENEM_YEARS) {
    const questions = await fetchYear(year)
    const rows = questions.map(toQuestionRow).filter(Boolean)
    const { inserted, updated } = await store.upsertExamQuestions(rows)
    const review = rows.filter((row) => row.needsReview).length
    console.log(`${year}: ${rows.length} rows (${inserted} new, ${updated} updated, ${review} need review, ${questions.length - rows.length} skipped)`)
  }
}

if (tagging) {
  console.log('Tagging questions with a topic...')
  const { tagged, skipped } = await tagUntagged(store, { generate: generateJson })
  console.log(`Tagged ${tagged}. Still untagged: ${skipped}.`)
}
