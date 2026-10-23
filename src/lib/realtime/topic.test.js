import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// A fake Supabase client: one channel object per topic, with its listeners and what it sent.
const fake = vi.hoisted(() => ({ channels: [] }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    getChannels: () => fake.channels.filter((channel) => !channel.removed),
    removeChannel: vi.fn(async (channel) => {
      channel.removed = true
      return 'ok'
    }),
    channel: (topic, options) => {
      const channel = {
        subTopic: topic,
        options,
        listeners: [],
        on(type, filter, callback) {
          this.listeners.push({ type, filter, callback })
          return this
        },
        subscribe(callback) {
          this.status = callback
          return this
        },
        send: vi.fn(async () => 'ok'),
        emit(type, event, payload) {
          for (const item of this.listeners) if (item.type === type && item.filter.event === event) item.callback(payload)
        },
      }
      fake.channels.push(channel)
      return channel
    },
  })),
}))

beforeEach(() => {
  fake.channels.length = 0
  vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co/')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'pk')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const { communityTopic, dmTopic, joinTopic, nudgeTopic } = await import('./index.js')

it('names chat topics by conversation and community', () => {
  expect(dmTopic('c1')).toBe('dm:c1')
  expect(communityTopic('k1')).toBe('community:k1')
})

it('joins a chat topic, hears other pages, and sends only a changed nudge', async () => {
  const onChange = vi.fn()
  const onStatus = vi.fn()
  const joined = joinTopic('dm:c1', { onChange, onStatus })
  await vi.waitFor(() => expect(fake.channels).toHaveLength(1))
  const channel = fake.channels[0]
  expect(channel.subTopic).toBe('dm:c1')
  expect(channel.options).toEqual({ config: { broadcast: { self: false } } })
  channel.status('SUBSCRIBED')
  expect(onStatus).toHaveBeenLastCalledWith('live')

  channel.emit('broadcast', 'changed', { payload: { type: 'changed', v: null } })
  expect(onChange).toHaveBeenCalledTimes(1)

  joined.nudge(3)
  expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'changed', payload: { type: 'changed', v: 3 } })
  joined.leave()
  channel.emit('broadcast', 'changed', {})
  expect(onChange).toHaveBeenCalledTimes(1)
})

it('nudges over REST without joining, never with message content', async () => {
  expect(await nudgeTopic('community:k1')).toBe(true)
  const [url, init] = fetch.mock.lastCall
  expect(url).toBe('https://demo.supabase.co/realtime/v1/api/broadcast')
  expect(JSON.parse(init.body)).toEqual({ messages: [{ topic: 'community:k1', event: 'changed', payload: { type: 'changed', v: null }, private: false }] })
})

it('reports off and does nothing without config', () => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  const onStatus = vi.fn()
  const joined = joinTopic('dm:c1', { onStatus })
  expect(onStatus).toHaveBeenCalledWith('off')
  expect(() => joined.nudge(1)).not.toThrow()
})
