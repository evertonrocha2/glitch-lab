// Realtime nudges from the server, over Supabase Broadcast's REST endpoint. Same rule as the
// browser's (src/lib/realtime): the message is only { type: 'changed', v }, never content. The page
// that hears it asks the API what's new, so a nudge can at most cause one extra refetch.

// Each signed-in page listens on its own account's topic. Account ids never leave the server
// except to their owner, so nobody else knows the name to listen on.
export const userTopic = (id) => `user:${id}`

// Read on every call, like the rest of the env: tests stub it per test. The publishable key is
// enough for a public channel; the service key works too (a deployed API may only have that one).
function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null
}

// Says "changed" on a topic. Never throws and never holds up the request: a lost nudge is caught
// by the page's slow poll. Answers whether it was sent.
export async function nudge(topic, v = null) {
  const settings = config()
  if (!settings) return false
  try {
    const response = await fetch(`${settings.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: settings.key, Authorization: `Bearer ${settings.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic, event: 'changed', payload: { type: 'changed', v: Number.isInteger(v) ? v : null }, private: false }] }),
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

export const nudgeUser = (userId) => nudge(userTopic(userId))
