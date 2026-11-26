import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGame, getWorld } from '../../lib/api.js'
import { PREFETCH_MAX_AGE_MS, prefetchWorld, resetWorldPrefetch, takeWorldPrefetch } from './world-prefetch.js'

vi.mock('../../lib/api.js', () => ({ getWorld: vi.fn(), getGame: vi.fn() }))

const POSITION = { position: { world: 'town', x: 4, y: 5 } }
const VIEW = { hero: { level: 3 } }
const token = () => Promise.resolve('token-ana')
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('world prefetch', () => {
  beforeEach(() => {
    resetWorldPrefetch()
    getWorld.mockReset().mockResolvedValue(POSITION)
    getGame.mockReset().mockResolvedValue(VIEW)
  })
  afterEach(() => resetWorldPrefetch())

  it('starts loading the hero before the world page mounts', async () => {
    prefetchWorld('ana', token, { now: 0 })
    await flush()
    expect(getWorld).toHaveBeenCalledWith('token-ana')
    expect(getGame).toHaveBeenCalledWith('token-ana')
    const taken = takeWorldPrefetch('ana', 1000)
    await expect(taken.world).resolves.toEqual(POSITION)
    await expect(taken.game).resolves.toEqual(VIEW)
    expect(getWorld).toHaveBeenCalledTimes(1)
  })

  it('hands the calls over once, then the page loads its own', () => {
    prefetchWorld('ana', token, { now: 0 })
    expect(takeWorldPrefetch('ana', 10)).not.toBeNull()
    expect(takeWorldPrefetch('ana', 20)).toBeNull()
  })

  it('stops prefetching once the world page opened, so a saved position is never read stale', async () => {
    takeWorldPrefetch('ana', 0)
    prefetchWorld('ana', token, { now: 10 })
    await flush()
    expect(getWorld).not.toHaveBeenCalled()
    expect(takeWorldPrefetch('ana', 20)).toBeNull()
  })

  it('starts once while fresh, even when every page mounts the shell again', async () => {
    prefetchWorld('ana', token, { now: 0 })
    prefetchWorld('ana', token, { now: 100 })
    await flush()
    expect(getWorld).toHaveBeenCalledTimes(1)
  })

  it('drops an old or another user\'s prefetch', () => {
    prefetchWorld('ana', token, { now: 0 })
    expect(takeWorldPrefetch('bia', 10)).toBeNull()
    resetWorldPrefetch()
    prefetchWorld('ana', token, { now: 0 })
    expect(takeWorldPrefetch('ana', PREFETCH_MAX_AGE_MS)).toBeNull()
  })

  it('never throws: a failed prefetch rejects quietly and a broken token is no prefetch', async () => {
    getWorld.mockRejectedValue(new Error('offline'))
    prefetchWorld('ana', token, { now: 0 })
    const taken = takeWorldPrefetch('ana', 10)
    await expect(taken.world).rejects.toThrow('offline')
    resetWorldPrefetch()
    expect(() =>
      prefetchWorld(
        'ana',
        () => {
          throw new Error('no token')
        },
        { now: 0 },
      ),
    ).not.toThrow()
    await expect(takeWorldPrefetch('ana', 10).world).rejects.toThrow('no token')
  })

  it('does nothing signed out', () => {
    prefetchWorld(null, token, { now: 0 })
    expect(takeWorldPrefetch(null, 10)).toBeNull()
  })
})
