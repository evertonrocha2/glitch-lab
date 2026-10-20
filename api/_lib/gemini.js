import { RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from './prompt.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiError extends Error {
  constructor(status) {
    super(`Gemini request failed with status ${status}`)
    this.status = status
  }
}

export async function callGemini({ prompt, apiKey, model }) {
  let res
  try {
    res = await fetch(`${BASE_URL}/${model}:generateContent`, {
      method: 'POST',
      // Key goes in a header so it never shows up in URLs or logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.4,
        },
      }),
    })
  } catch {
    throw new GeminiError(502)
  }
  if (!res.ok) throw new GeminiError(res.status)

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
  if (!text) throw new GeminiError(502)
  return text
}
