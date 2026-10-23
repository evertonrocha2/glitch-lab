// Every value is read when it's asked for, not cached at import: tests stub the env per test, and
// the same modules run under Vite in dev, where .env is loaded after the config is.

// A deployed server (Vercel, Render or any host that sets NODE_ENV=production), where dev fallbacks are off.
export const isProduction = () => process.env.VERCEL === '1' || Boolean(process.env.RENDER) || process.env.NODE_ENV === 'production'

export const env = {
  get port() {
    return Number(process.env.PORT ?? 3000)
  },
  get authSecret() {
    return process.env.AUTH_SECRET ?? ''
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? ''
  },
  get supabase() {
    const url = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    return url && serviceKey ? { url, serviceKey } : null
  },
  get localStoreFile() {
    return process.env.LOCAL_STORE_FILE || '.data/db.json'
  },
}

// What a deployed server can't run without. Checked once at boot, so a bad deploy fails its health
// check instead of answering every request with a 500. Locally the dev fallbacks cover all of it.
// errors stop the boot; warnings only turn one feature off (the cron is refused without its secret).
export function checkEnv() {
  const result = { errors: [], warnings: [] }
  if (!isProduction()) return result
  if (!env.authSecret) result.errors.push('AUTH_SECRET is not set')
  if (!env.supabase) result.errors.push('No database configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  if (!env.cronSecret) result.warnings.push('CRON_SECRET is not set, so the daily cron is refused')
  if (!process.env.GEMINI_API_KEY) result.warnings.push('GEMINI_API_KEY is not set, so every AI feature answers 500')
  return result
}
