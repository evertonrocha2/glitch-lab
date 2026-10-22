import { AiError } from './errors.js'
import { DEFAULT_GEMINI_MODEL, geminiGenerate } from './gemini.js'

export { AiError }

// Endpoints only call generateJson; adding a model later means adding a provider here.
const PROVIDERS = {
  gemini: (args) =>
    geminiGenerate({ ...args, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL }),
}

const BUSY_STATUSES = [429, 503]

// Read per call so tests and config changes apply without a restart.
function msFromEnv(name, fallback) {
  const value = Number(process.env[name])
  return process.env[name] && Number.isFinite(value) ? value : fallback
}

async function attempt(provider, args, timeoutMs) {
  return provider({ ...args, signal: AbortSignal.timeout(timeoutMs ?? msFromEnv('AI_TIMEOUT_MS', 120_000)) })
}

// timeoutMs and retry let a quick side call (like the assistant's router) fail fast instead of
// using up the whole function budget.
export async function generateJson({ system, prompt, schema, timeoutMs, retry = true }) {
  const provider = PROVIDERS[process.env.AI_PROVIDER || 'gemini']
  if (!provider) throw new AiError(500, `Unknown AI provider: ${process.env.AI_PROVIDER}`)

  const args = { system, prompt, schema }
  const started = Date.now()
  let text
  try {
    text = await attempt(provider, args, timeoutMs)
  } catch (err) {
    // One retry, only for a busy answer that came back fast: a slow one would blow the 300s function budget.
    const fast = Date.now() - started < msFromEnv('AI_FAST_FAIL_MS', 30_000)
    if (!(retry && err instanceof AiError && BUSY_STATUSES.includes(err.status) && fast)) throw err
    await new Promise((resolve) => setTimeout(resolve, msFromEnv('AI_RETRY_DELAY_MS', 2_000)))
    text = await attempt(provider, args, timeoutMs)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new AiError(502, 'AI answered with invalid JSON')
  }
}
