const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

export async function analyzeError({ error, code }) {
  let res
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error, code }),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection.')
  }

  const body = await res.json().catch(() => null)
  if (!res.ok || !body) throw new Error(body?.message || GENERIC_MESSAGE)
  return body
}
