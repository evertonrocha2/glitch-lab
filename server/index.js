// The API process (Render runs `node server/index.js`). The env comes from the host's settings;
// .env is never read here, so a local run can't reach the production database by accident.
import { createApp } from './app.js'
import { checkEnv, env } from './config/env.js'

const { errors, warnings } = checkEnv()
for (const warning of warnings) console.warn(`Warning: ${warning}`)
if (errors.length) {
  for (const error of errors) console.error(`Error: ${error}`)
  process.exit(1)
}

const server = createApp().listen(env.port, () => console.log(`Glitch Lab API on :${env.port}`))

// Render sends SIGTERM before a deploy swaps instances: finish the requests in flight first.
process.on('SIGTERM', () => server.close(() => process.exit(0)))
