import { AiError } from './errors.js'

const URL = 'https://openrouter.ai/api/v1/chat/completions'
// Fast, cheap and good at following a JSON schema. OPENROUTER_MODEL picks any other model.
export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5'

// The prompts write schemas in Gemini's dialect ('OBJECT', 'STRING'...). OpenRouter takes plain
// JSON Schema, so types go lowercase and objects are closed, which strict mode requires.
export function toJsonSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toJsonSchema)
  if (!schema || typeof schema !== 'object') return schema
  const out = {}
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') out.type = value.toLowerCase()
    else if (key === 'properties') out.properties = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, toJsonSchema(child)]))
    else if (key === 'propertyOrdering' || key === 'nullable') continue
    else out[key] = toJsonSchema(value)
  }
  if (out.type === 'object') out.additionalProperties = false
  return out
}

export async function openrouterGenerate({ system, prompt, schema, apiKey, model, signal }) {
  if (!apiKey) throw new AiError(500, 'OPENROUTER_API_KEY is not set')

  let res
  try {
    res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // Shown on OpenRouter's dashboard, so usage is easy to tell apart.
        'HTTP-Referer': 'https://glitch-lab-app.vercel.app',
        'X-Title': 'Glitch Lab',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: toJsonSchema(schema) } },
        temperature: 0.4,
      }),
      signal,
    })
  } catch (err) {
    throw new AiError(err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 504 : 502)
  }
  // 401/402 (bad key, no credits) are a setup problem, not a busy model.
  if (res.status === 401 || res.status === 402) throw new AiError(500, `OpenRouter refused the key (${res.status})`)
  if (!res.ok) throw new AiError(res.status)

  const data = await res.json().catch(() => null)
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text) throw new AiError(502, 'OpenRouter answered without text')
  // Some models wrap JSON in a code fence even in JSON mode.
  return text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')
}
