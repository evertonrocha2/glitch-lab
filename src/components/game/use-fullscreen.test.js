import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useFullscreen } from './use-fullscreen.js'

const setFullscreenElement = (el) => Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true })

afterEach(() => {
  setFullscreenElement(null)
  delete document.exitFullscreen
})

function setup() {
  const el = document.createElement('div')
  el.requestFullscreen = vi.fn(() => Promise.resolve())
  return { el, hook: renderHook(() => useFullscreen({ current: el })) }
}

it('is supported when the element can go fullscreen', () => {
  expect(setup().hook.result.current.supported).toBe(true)
})

it('is not supported when requestFullscreen is missing', () => {
  const el = document.createElement('div')
  el.requestFullscreen = undefined
  const { result } = renderHook(() => useFullscreen({ current: el }))
  expect(result.current.supported).toBe(false)
})

it('follows fullscreenchange', () => {
  const { el, hook } = setup()
  expect(hook.result.current.active).toBe(false)
  act(() => {
    setFullscreenElement(el)
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  expect(hook.result.current.active).toBe(true)
  act(() => {
    setFullscreenElement(null)
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  expect(hook.result.current.active).toBe(false)
})

it('toggle enters with requestFullscreen and leaves with exitFullscreen', () => {
  const { el, hook } = setup()
  act(() => hook.result.current.toggle())
  expect(el.requestFullscreen).toHaveBeenCalledOnce()
  document.exitFullscreen = vi.fn(() => Promise.resolve())
  setFullscreenElement(el)
  act(() => hook.result.current.toggle())
  expect(document.exitFullscreen).toHaveBeenCalledOnce()
})
