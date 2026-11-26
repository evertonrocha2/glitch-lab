import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TALENTS } from '../../../../shared/game/talents.js'
import TalentCanvas, { drawTree, nodeAt } from './talent-canvas.jsx'
import { supportColor } from './support-gem.js'

// A 2D context that records every call and accepts any property.
function stubContext() {
  const calls = []
  const ctx = new Proxy(
    {},
    {
      get(target, key) {
        if (key in target) return target[key]
        if (key === 'createRadialGradient') return () => ({ addColorStop() {} })
        return (...args) => calls.push([key, ...args])
      },
      set(target, key, value) {
        target[key] = value
        return true
      },
    },
  )
  return { ctx, calls }
}

const empty = { owned: new Set(['root']), queued: new Set(), open: new Set(), selected: null, labels: null }

afterEach(() => {
  vi.restoreAllMocks()
  delete window.matchMedia
})

it('finds the node under a point, with a wide target for small nodes', () => {
  const small = TALENTS.nodes.find((node) => node.id === 'logica-c0')
  expect(nodeAt(small.x + 10, small.y)?.id).toBe('logica-c0')
  expect(nodeAt(5, 5)).toBeNull()
})

it('draws keystones as octagons and every edge', () => {
  const { ctx, calls } = stubContext()
  drawTree(ctx, { ...empty, labels: { logica: { name: 'Logic', sub: 'damage' } } }, null)
  const strokes = calls.filter(([name]) => name === 'stroke').length
  expect(strokes).toBeGreaterThanOrEqual(TALENTS.edges.length + TALENTS.nodes.length)
  expect(calls.some(([name, text]) => name === 'fillText' && text === 'Logic')).toBe(true)
})

it('draws branch labels bigger when the canvas is shown small', () => {
  const fonts = []
  const { ctx } = stubContext()
  const labels = { logica: { name: 'Logic', sub: 'damage' } }
  const spy = new Proxy(ctx, {
    set(target, key, value) {
      if (key === 'font') fonts.push(value)
      target[key] = value
      return true
    },
  })
  drawTree(spy, { ...empty, labels }, null, 2)
  expect(fonts).toContain('bold 28px ui-monospace, Menlo, monospace')
  expect(fonts).toContain('20px ui-monospace, Menlo, monospace')
})

it('does not throw without a 2D context', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  expect(() => render(<TalentCanvas {...empty} onSelect={() => {}} />)).not.toThrow()
})

it('draws one still frame with reduced motion', () => {
  const { ctx, calls } = stubContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  const raf = vi.spyOn(window, 'requestAnimationFrame')
  render(<TalentCanvas {...empty} onSelect={() => {}} />)
  expect(raf).not.toHaveBeenCalled()
  expect(calls.filter(([name]) => name === 'fillRect').length).toBeGreaterThan(0)
})

it('draws socket nodes as gem slots, a filled one in its gem color', () => {
  const fills = []
  const { ctx } = stubContext()
  const spy = new Proxy(ctx, {
    set(target, key, value) {
      if (key === 'fillStyle') fills.push(value)
      target[key] = value
      return true
    },
  })
  drawTree(spy, { ...empty, sockets: { 'logica-f0-1': 'fogo' } }, null)
  expect(fills).toContain(supportColor('fogo'))
  fills.length = 0
  drawTree(spy, empty, null)
  expect(fills).not.toContain(supportColor('fogo'))
})

it('gives socket nodes a click target', () => {
  const socket = TALENTS.nodes.find((node) => node.id === 'logica-f0-1')
  expect(nodeAt(socket.x + 6, socket.y)?.id).toBe('logica-f0-1')
})
