import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SAVE_DELAY_MS, usePositionSave } from './use-position-save.js'

// The saves the hero's walk makes (ported from the old hub game, same rules).
let place
const setup = (onSave = vi.fn(async () => {})) => {
  const hook = renderHook(() => usePositionSave(() => place, onSave))
  return { ...hook, onSave }
}

beforeEach(() => {
  vi.useFakeTimers()
  place = { world: 'laboratorio', x: 16, y: 8 }
})
afterEach(() => {
  vi.useRealTimers()
})

it('saves at most once every 5 seconds while walking, with the latest tile', () => {
  const { result, onSave } = setup()
  act(() => result.current.saveSoon())
  place = { world: 'laboratorio', x: 17, y: 8 }
  act(() => result.current.saveSoon())
  expect(onSave).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(SAVE_DELAY_MS))
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave).toHaveBeenCalledWith({ world: 'laboratorio', x: 17, y: 8 }, { keepalive: false })
})

it('saves right away when asked, dropping the waiting one', async () => {
  const { result, onSave } = setup()
  act(() => result.current.saveSoon())
  await act(() => result.current.saveNow())
  act(() => vi.advanceTimersByTime(SAVE_DELAY_MS * 2))
  expect(onSave).toHaveBeenCalledTimes(1)
})

it('keeps going when a save fails', async () => {
  const onSave = vi.fn(async () => {
    throw new Error('offline')
  })
  const { result } = setup(onSave)
  await act(() => result.current.saveNow())
  await act(() => result.current.saveNow())
  expect(onSave).toHaveBeenCalledTimes(2)
})

it('saves the last tile with keepalive when it goes away mid-walk, and nothing when nothing waits', () => {
  const quiet = setup()
  quiet.unmount()
  expect(quiet.onSave).not.toHaveBeenCalled()
  const { result, unmount, onSave } = setup()
  act(() => result.current.saveSoon())
  place = { world: 'floresta-js', x: 30, y: 10 }
  unmount()
  expect(onSave).toHaveBeenCalledWith({ world: 'floresta-js', x: 30, y: 10 }, { keepalive: true })
})

it('saves the last tile with keepalive when the tab closes mid-walk', () => {
  const { result, onSave } = setup()
  act(() => result.current.saveSoon())
  window.dispatchEvent(new Event('pagehide'))
  expect(onSave).toHaveBeenCalledWith(place, { keepalive: true })
  act(() => vi.advanceTimersByTime(SAVE_DELAY_MS))
  expect(onSave).toHaveBeenCalledTimes(1)
})

it('sends saves one after another, so an older one never lands last', async () => {
  const done = []
  let release
  const onSave = vi.fn((position) => new Promise((resolve) => {
    if (!release) release = () => resolve(done.push(position.x))
    else resolve(done.push(position.x))
  }))
  const { result } = setup(onSave)
  let first
  act(() => {
    first = result.current.saveNow()
  })
  place = { world: 'laboratorio', x: 20, y: 8 }
  let second
  act(() => {
    second = result.current.saveNow()
  })
  expect(onSave).toHaveBeenCalledTimes(1)
  await act(async () => release())
  await act(() => Promise.all([first, second]))
  expect(done).toEqual([16, 20])
})
