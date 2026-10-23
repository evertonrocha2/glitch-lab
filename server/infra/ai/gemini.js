import { AiError } from './errors.js'
import { readEventStream } from './event-stream.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
// gemini-2.5-flash is closed to new API keys; Google points to this one instead.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'

const fetchFailure = (err) => new AiError(err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 504 : 502)

// The answer's text, without the model's thinking parts.
const textOf = (data) =>
  (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')

async function post(method, { system, prompt, apiKey, model, signal }, generationConfig) {
  if (!apiKey) throw new AiError(500, 'GEMINI_API_KEY is not set')

  let res
  try {
    // alt=sse is a format switch, not a secret: the key still goes in a header so it never shows
    // up in URLs or logs.
    res = await fetch(`${BASE_URL}/${model}:${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, ...generationConfig },
      }),
      signal,
    })
  } catch (err) {
    throw fetchFailure(err)
  }
  if (!res.ok) throw new AiError(res.status)
  return res
}

export async function geminiGenerate({ schema, ...args }) {
  const res = await post('generateContent', args, { responseMimeType: 'application/json', responseSchema: schema })
  const text = textOf(await res.json().catch(() => null))
  if (!text) throw new AiError(502, 'Gemini answered without text')
  return text
}

// Plain text as the model writes it: onDelta(piece) for each piece, then the whole text.
// streamGenerateContent with alt=sse sends one `data: {...}` per piece, each a small response.
export async function geminiStream({ onDelta, ...args }) {
  const res = await post('streamGenerateContent?alt=sse', args, {})
  let text = ''
  try {
    await readEventStream(res, (data) => {
      let chunk
      try {
        chunk = JSON.parse(data)
      } catch {
        return false
      }
      if (chunk?.error) throw new AiError(chunk.error.code === 429 ? 429 : 502, `Gemini stream failed: ${chunk.error.message ?? 'unknown error'}`)
      const piece = textOf(chunk)
      if (piece) {
        text += piece
        onDelta(piece)
      }
      return false
    })
  } catch (err) {
    throw err instanceof AiError ? err : fetchFailure(err)
  }
  if (!text) throw new AiError(502, 'Gemini streamed no text')
  return text
}
