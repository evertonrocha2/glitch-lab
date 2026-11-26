import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TALENTS } from '../../../../shared/game/talents.js'
import TalentCanvas, { drawTree, nodeAt } from './talent-canvas.jsx'

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
