import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { changedMessage, joinDuel, nudgeDuel, realtimeConfigured, seatsOnline } from './index.js'

// A fake Supabase client: one channel object per topic, with its listeners and what it sent.
const fake = vi.hoisted(() => ({ channels: [], createClient: null }))
vi.mock('@supabase/supabase-js', () => {
  fake.createClient = vi.fn(() => ({
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
        track: vi.fn(async () => 'ok'),
        presenceState: () => ({}),
        emit(type, event, payload) {
          for (const item of this.listeners) if (item.type === type && item.filter.event === event) item.callback(payload)
        },
      }
      fake.channels.push(channel)
      return channel
    },
  }))
  return { createClient: fake.createClient }
})

// A duel as the API sends it, with things that must never go out on the channel.
const DUEL = { id: 'd1', version: 7, current: { options: [{ id: 'python' }], myChoice: 'python' }, answer: 'python' }
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co/')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_demo')
  fake.channels = []
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 202 })))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('does nothing and reports off without config', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  expect(realtimeConfigured()).toBe(false)
  const onStatus = vi.fn()
  const channel = joinDuel('d1', { onStatus })
  expect(onStatus).toHaveBeenCalledWith('off')
  channel.nudge(3)
  expect(await nudgeDuel('d1', 3)).toBe(false)
  await flush()
  expect(fetch).not.toHaveBeenCalled()
  expect(fake.channels).toHaveLength(0)
})

it('the message is a type and a version number, whatever is passed in', () => {
  expect(changedMessage(7)).toEqual({ type: 'changed', v: 7 })
  expect(changedMessage(DUEL)).toEqual({ type: 'changed', v: null })
  expect(changedMessage('python')).toEqual({ type: 'changed', v: null })
})

it('nudges over REST on the public duel topic with nothing secret in it', async () => {
  expect(await nudgeDuel('d1', 7)).toBe(true)
  const [url, init] = vi.mocked(fetch).mock.calls[0]
  expect(url).toBe('https://demo.supabase.co/realtime/v1/api/broadcast')
  expect(init.headers.apikey).toBe('sb_publishable_demo')
  expect(JSON.parse(init.body)).toEqual({ messages: [{ topic: 'duel:d1', event: 'changed', payload: { type: 'changed', v: 7 }, private: false }] })

  await nudgeDuel('d1', DUEL)
  expect(vi.mocked(fetch).mock.calls[1][1].body).not.toContain('python')
})

it('never throws when the nudge fails', async () => {
  vi.mocked(fetch).mockRejectedValue(new Error('offline'))
  expect(await nudgeDuel('d1', 1)).toBe(false)
})

it('joins the duel channel, reports live, passes nudges on and tracks my seat', async () => {
  const onChange = vi.fn()
  const onStatus = vi.fn()
  const onPresence = vi.fn()
  const handle = joinDuel('d1', { onChange, onStatus, onPresence })
  await flush()
  const channel = fake.channels[0]
  expect(channel.subTopic).toBe('duel:d1')
  expect(channel.options.config.broadcast.self).toBe(false)
  expect(channel.options.config.private).toBeUndefined()

  channel.status('SUBSCRIBED')
  expect(onStatus).toHaveBeenLastCalledWith('live')
  expect(channel.track).not.toHaveBeenCalled()
  handle.setSeat(1)
  expect(channel.track).toHaveBeenCalledWith({ seat: 1 })

  channel.emit('broadcast', 'changed', { payload: { type: 'changed', v: 9 } })
  expect(onChange).toHaveBeenLastCalledWith(9)
  // A forged message with junk in it: still just "refetch".
  channel.emit('broadcast', 'changed', { payload: { v: 'drop table', answer: 'x' } })
  expect(onChange).toHaveBeenLastCalledWith(null)

  channel.presenceState = () => ({ a: [{ seat: 0 }], b: [{ seat: 1 }, { seat: 'x' }] })
  channel.emit('presence', 'sync')
  expect(onPresence).toHaveBeenLastCalledWith(new Set([0, 1]))

  channel.status('CHANNEL_ERROR')
  expect(onStatus).toHaveBeenLastCalledWith('off')
  handle.leave()
  channel.emit('broadcast', 'changed', { payload: { type: 'changed', v: 10 } })
  expect(onChange).toHaveBeenCalledTimes(2)
})

it('sends only the version on the channel, or over REST before it joined', async () => {
  const handle = joinDuel('d1', { onStatus: vi.fn() })
  handle.nudge(DUEL)
  await flush()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(vi.mocked(fetch).mock.calls[0][1].body).not.toContain('python')

  const channel = fake.channels[0]
  channel.status('SUBSCRIBED')
  handle.nudge(8)
  handle.nudge(DUEL)
  expect(channel.send.mock.calls.map(([message]) => message)).toEqual([
    { type: 'broadcast', event: 'changed', payload: { type: 'changed', v: 8 } },
    { type: 'broadcast', event: 'changed', payload: { type: 'changed', v: null } },
  ])
  handle.leave()
})

it('counts each seat once in the presence state', () => {
  expect(seatsOnline({ x: [{ seat: 0 }, { seat: 0 }] })).toEqual(new Set([0]))
  expect(seatsOnline(null)).toEqual(new Set())
})
