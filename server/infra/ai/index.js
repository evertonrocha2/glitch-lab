import { AiError } from './errors.js'
import { DEFAULT_GEMINI_MODEL, geminiGenerate, geminiStream } from './gemini.js'
import { DEFAULT_OPENROUTER_MODEL, openrouterGenerate, openrouterStream } from './openrouter.js'

export { AiError }

const geminiConfig = () => ({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL })
const openrouterConfig = () => ({ apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL })

// Endpoints only call generateJson or streamText; adding a model later means adding a provider here.
const PROVIDERS = {
  gemini: { generate: (args) => geminiGenerate({ ...args, ...geminiConfig() }), stream: (args) => geminiStream({ ...args, ...geminiConfig() }) },
  openrouter: {
    generate: (args) => openrouterGenerate({ ...args, ...openrouterConfig() }),
    stream: (args) => openrouterStream({ ...args, ...openrouterConfig() }),
  },
}

// AI_PROVIDER is one provider or a fallback chain, e.g. "openrouter,gemini": the next one answers
// when the one before fails.
function providerNames() {
  const names = (process.env.AI_PROVIDER || 'gemini')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  for (const name of names) {
    if (!PROVIDERS[name]) throw new AiError(500, `Unknown AI provider: ${name}`)
  }
  return names
}

const BUSY_STATUSES = [429, 503]

// Read per call so tests and config changes apply without a restart.
function msFromEnv(name, fallback) {
  const value = Number(process.env[name])
  return process.env[name] && Number.isFinite(value) ? value : fallback
}

// The time limit, and the caller's own signal (a student who closed the tab) when there is one.
function limitSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs ?? msFromEnv('AI_TIMEOUT_MS', 120_000))
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

// One retry, only for a busy answer that came back fast: a slow one would keep the user waiting too long.
async function withRetry(run, canRetry) {
  const started = Date.now()
  try {
    return await run()
  } catch (err) {
    const fast = Date.now() - started < msFromEnv('AI_FAST_FAIL_MS', 30_000)
    if (!(canRetry() && err instanceof AiError && BUSY_STATUSES.includes(err.status) && fast)) throw err
    await new Promise((resolve) => setTimeout(resolve, msFromEnv('AI_RETRY_DELAY_MS', 2_000)))
    return run()
  }
}

// timeoutMs and retry let a quick side call (like the assistant's router) fail fast instead of
// using up the whole function budget.
export async function generateJson({ system, prompt, schema, timeoutMs, retry = true, signal }) {
  const names = providerNames()
  let lastError
  for (const name of names) {
    try {
      const text = await withRetry(() => PROVIDERS[name].generate({ system, prompt, schema, signal: limitSignal(signal, timeoutMs) }), () => retry)
      try {
        return JSON.parse(text)
      } catch {
        throw new AiError(502, 'AI answered with invalid JSON')
      }
    } catch (err) {
      if (!(err instanceof AiError) || signal?.aborted) throw err
      lastError = err
      if (names.length > 1) console.warn(`AI provider ${name} failed (${err.status}), trying the next one`)
    }
  }
  throw lastError
}

// Plain text, streamed: onDelta(piece) as the model writes, then resolves with the whole text.
// The chain falls back like generateJson, but only while nothing has been streamed yet: once the
// student has seen half a sentence from one model, another one can't pick it up.
export async function streamText({ system, prompt, onDelta, timeoutMs, retry = true, signal }) {
  const names = providerNames()
  let lastError
  for (const name of names) {
    let streamed = false
    const run = () =>
      PROVIDERS[name].stream({
        system,
        prompt,
        signal: limitSignal(signal, timeoutMs),
        onDelta: (piece) => {
          streamed = true
          onDelta?.(piece)
        },
      })
    try {
      return await withRetry(run, () => retry && !streamed)
    } catch (err) {
      if (!(err instanceof AiError) || streamed || signal?.aborted) throw err
      lastError = err
      if (names.length > 1) console.warn(`AI provider ${name} failed to stream (${err.status}), trying the next one`)
    }
  }
  throw lastError
}
