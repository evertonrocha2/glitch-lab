// Realtime nudges over Supabase Broadcast, on a public channel per duel (`duel:<id>`). A message
// only says "this duel changed, ask the API again": no answers, no choices, nothing secret. The
// server stays the only source of truth, so a forged message can at most cause one extra refetch.
// The client library is loaded on first use, so it stays out of the main bundle.

const EVENT = 'changed'

function config() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null
}

export const realtimeConfigured = () => Boolean(config())
export const duelTopic = (id) => `duel:${id}`
// The whole message: a type and the duel's version (a number), whatever the caller passed.
export const changedMessage = (v) => ({ type: EVENT, v: Number.isInteger(v) ? v : null })

let clientPromise = null
function getClient() {
  const { url, key } = config()
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
  )
  return clientPromise
}

// The seats with at least one page on the channel, from the presence state.
export function seatsOnline(state) {
  const seats = new Set()
  for (const entries of Object.values(state ?? {})) {
    for (const entry of entries) if (Number.isInteger(entry?.seat)) seats.add(entry.seat)
  }
  return seats
}

// Says "changed" on a duel's channel without joining it (the REST endpoint), e.g. right after
// joining from the lobby, before the duel page is even open. Never throws.
export async function nudgeDuel(id, v) {
  const settings = config()
  if (!settings) return false
  try {
    const response = await fetch(`${settings.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: settings.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: duelTopic(id), event: EVENT, payload: changedMessage(v), private: false }] }),
    })
    return response.ok
  } catch {
    return false
  }
}

// Joins a duel's channel. onChange(v) when someone else says it changed; onStatus('live' | 'off');
// onPresence(seats) with the seats online. `seat` is mine (null for a spectator, who isn't shown).
// Returns { nudge(v), setSeat(seat), leave() }. Without config it reports 'off' and does nothing.
export function joinDuel(id, { seat = null, onChange, onStatus, onPresence }) {
  let channel = null
  let joined = false
  let left = false
  let mySeat = seat
  const status = (value) => {
    if (!left) onStatus?.(value)
  }
  const track = () => {
    if (joined && mySeat !== null) channel.track({ seat: mySeat }).catch(() => {})
  }
  if (!config()) {
    status('off')
    return { nudge: () => {}, setSeat: () => {}, leave: () => {} }
  }
  getClient()
    .then(async (client) => {
      // The same duel left a moment ago: its channel may still be closing, and channel() would hand it back.
      const closing = client.getChannels().find((item) => item.subTopic === duelTopic(id))
      if (closing) await client.removeChannel(closing)
      if (left) return
      channel = client.channel(duelTopic(id), { config: { broadcast: { self: false }, presence: { key: crypto.randomUUID(), enabled: true } } })
      channel.on('broadcast', { event: EVENT }, ({ payload }) => {
        if (!left) onChange?.(Number.isInteger(payload?.v) ? payload.v : null)
      })
      channel.on('presence', { event: 'sync' }, () => {
        if (!left) onPresence?.(seatsOnline(channel.presenceState()))
      })
      channel.subscribe((state) => {
        joined = state === 'SUBSCRIBED'
        track()
        status(joined ? 'live' : 'off')
      })
    })
    .catch(() => status('off'))
  return {
    nudge(v) {
      if (left) return
      if (joined) channel.send({ type: 'broadcast', event: EVENT, payload: changedMessage(v) }).catch(() => {})
      else nudgeDuel(id, v)
    },
    setSeat(next) {
      if (next === mySeat) return
      mySeat = next
      track()
    },
    leave() {
      left = true
      joined = false
      if (channel) getClient().then((client) => client.removeChannel(channel))
    },
  }
}

// Chats use the same nudges: `dm:<conversationId>` and `community:<communityId>`. The message is
// still only { type: 'changed', v }; the page then asks the API what's new.
export const dmTopic = (id) => `dm:${id}`
export const communityTopic = (id) => `community:${id}`
// My own account's topic: the server nudges it when someone sends me a DM. Only I know my id.
export const userTopic = (id) => `user:${id}`

// Says "changed" on a topic without joining it. Never throws.
export async function nudgeTopic(topic, v = null) {
  const settings = config()
  if (!settings) return false
  try {
    const response = await fetch(`${settings.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: settings.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic, event: EVENT, payload: changedMessage(v), private: false }] }),
    })
    return response.ok
  } catch {
    return false
  }
}

// Joins a chat's topic. onChange() when someone else says it changed; onStatus('live' | 'off').
// Returns { nudge(v), leave() }. Without config it reports 'off' and does nothing.
export function joinTopic(topic, { onChange, onStatus }) {
  let channel = null
  let joined = false
  let left = false
  const status = (value) => {
    if (!left) onStatus?.(value)
  }
  if (!config()) {
    status('off')
    return { nudge: () => {}, leave: () => {} }
  }
  getClient()
    .then(async (client) => {
      const closing = client.getChannels().find((item) => item.subTopic === topic)
      if (closing) await client.removeChannel(closing)
      if (left) return
      channel = client.channel(topic, { config: { broadcast: { self: false } } })
      channel.on('broadcast', { event: EVENT }, () => {
        if (!left) onChange?.()
      })
      channel.subscribe((state) => {
        joined = state === 'SUBSCRIBED'
        status(joined ? 'live' : 'off')
      })
    })
    .catch(() => status('off'))
  return {
    nudge(v) {
      if (left) return
      if (joined) channel.send({ type: 'broadcast', event: EVENT, payload: changedMessage(v) }).catch(() => {})
      else nudgeTopic(topic, v)
    },
    leave() {
      left = true
      joined = false
      if (channel) getClient().then((client) => client.removeChannel(channel))
    },
  }
}
