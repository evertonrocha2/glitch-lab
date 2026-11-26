import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTLE_MS, huntMove, useAutoHunt } from './use-auto-hunt.js'

const Z1 = { world: 'floresta-js', zone: 'z1', difficulty: 'normal' }
const Z2 = { world: 'floresta-js', zone: 'z2', difficulty: 'normal' }
const hunting = (where) => ({ ...where, startedAt: 0, claims: 0 })

describe('huntMove', () => {
  it('starts a hunt in the zone the hero stands in', () => {
    expect(huntMove({ hunt: null, wanted: Z1 })).toBe('start')
  })
  it('moves the hunt to a new zone, and to a new difficulty', () => {
    expect(huntMove({ hunt: hunting(Z1), wanted: Z2 })).toBe('start')
    expect(huntMove({ hunt: hunting(Z1), wanted: { ...Z1, difficulty: 'pesadelo' } })).toBe('start')
    expect(huntMove({ hunt: hunting(Z1), wanted: { ...Z1, world: 'caverna-sql' } })).toBe('start')
  })
  it('leaves the hunt alone where it already runs', () => {
    expect(huntMove({ hunt: hunting(Z1), wanted: Z1 })).toBeNull()
  })
  it('stops it on safe ground, and does nothing there without one', () => {
    expect(huntMove({ hunt: hunting(Z1), wanted: null })).toBe('stop')
    expect(huntMove({ hunt: null, wanted: null })).toBeNull()
  })
  it('keeps a zone the player paused by hand quiet until the hero leaves it', () => {
    expect(huntMove({ hunt: null, wanted: Z1, paused: { world: 'floresta-js', zone: 'z1' } })).toBeNull()
    expect(huntMove({ hunt: null, wanted: Z2, paused: { world: 'floresta-js', zone: 'z1' } })).toBe('start')
  })
})

describe('useAutoHunt', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const view = (hunt = null) => ({ hero: { hunt } })
  const run = (props) => {
    const start = vi.fn()
    const stop = vi.fn()
    const hook = renderHook((p) => useAutoHunt({ start, stop, ...p }), { initialProps: props })
    return { ...hook, start, stop }
  }

  it('starts the hunt after the hero settles in a zone', () => {
    const { start } = run({ view: view(), wanted: Z1 })
    vi.advanceTimersByTime(SETTLE_MS - 1)
    expect(start).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(start).toHaveBeenCalledWith(Z1)
  })

  it('never fires for a zone the hero only walked through', () => {
    const { start, rerender } = run({ view: view(), wanted: Z1 })
    vi.advanceTimersByTime(SETTLE_MS / 2)
    rerender({ view: view(), wanted: Z2 })
    vi.advanceTimersByTime(SETTLE_MS / 2 + 1)
    expect(start).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SETTLE_MS)
    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(Z2)
  })

  it('stops the hunt once the hero settles in town', () => {
    const { stop, start } = run({ view: view(hunting(Z1)), wanted: null })
    vi.advanceTimersByTime(SETTLE_MS)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(start).not.toHaveBeenCalled()
  })

  it('waits for the View and for a boss fight to end', () => {
    const { start, rerender } = run({ view: null, wanted: Z1 })
    vi.advanceTimersByTime(SETTLE_MS * 2)
    rerender({ view: view(), wanted: Z1, blocked: true })
    vi.advanceTimersByTime(SETTLE_MS * 2)
    expect(start).not.toHaveBeenCalled()
    rerender({ view: view(), wanted: Z1, blocked: false })
    vi.advanceTimersByTime(SETTLE_MS)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('does nothing more once the server answers with the hunt running there', () => {
    const { start, rerender } = run({ view: view(), wanted: Z1 })
    vi.advanceTimersByTime(SETTLE_MS)
    rerender({ view: view(hunting(Z1)), wanted: Z1 })
    vi.advanceTimersByTime(SETTLE_MS * 3)
    expect(start).toHaveBeenCalledTimes(1)
  })
})

it('starts hunting 0.8 s after the hero stops in a zone', () => {
  expect(SETTLE_MS).toBe(800)
})
