import { AiError } from './errors.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
// gemini-2.5-flash is closed to new API keys; Google points to this one instead.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'

export async function geminiGenerate({ system, prompt, schema, apiKey, model, signal }) {
  if (!apiKey) throw new AiError(500, 'GEMINI_API_KEY is not set')

  let res
  try {
    res = await fetch(`${BASE_URL}/${model}:generateContent`, {
      method: 'POST',
      // Key goes in a header so it never shows up in URLs or logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.4 },
      }),
      signal,
    })
  } catch (err) {
    throw new AiError(err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 504 : 502)
  }
  if (!res.ok) throw new AiError(res.status)

  const data = await res.json().catch(() => null)
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
  if (!text) throw new AiError(502, 'Gemini answered without text')
  return text
}
