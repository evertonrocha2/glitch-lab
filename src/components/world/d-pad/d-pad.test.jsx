import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import DPad from './d-pad.jsx'

function pad(props = {}) {
  const handlers = { onPress: vi.fn(), onRelease: vi.fn(), onStep: vi.fn(), ...props }
  render(
    <I18nProvider locale="pt-BR">
      <DPad {...handlers} />
    </I18nProvider>,
  )
  return handlers
}

// The widths of the arrow's rows, top to bottom, from its pixel rects.
function rowWidths(svg) {
  const rows = new Map()
  for (const rect of svg.querySelectorAll('rect')) {
    const y = Number(rect.getAttribute('y'))
    const h = Number(rect.getAttribute('height'))
    for (let row = y; row < y + h; row++) rows.set(row, (rows.get(row) ?? 0) + Number(rect.getAttribute('width')))
  }
  return [...rows.keys()].sort((a, b) => a - b).map((row) => rows.get(row))
}

it('draws each arrow as a solid triangle, never a cross, at whole screen pixels per art pixel', () => {
  pad()
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(4)
  for (const button of buttons) {
    const svg = button.querySelector('svg')
    const [, , viewW, viewH] = svg.getAttribute('viewBox').split(' ').map(Number)
    expect(viewW).toBe(viewH)
    // Each art pixel is a whole number of screen pixels, so no row blurs or vanishes when scaled.
    expect(Number(svg.getAttribute('width')) % viewW).toBe(0)
    expect(svg.getAttribute('width')).toBe(svg.getAttribute('height'))
    // A triangle: every row is wider than the one above it. A "+" has a stem narrower than its bar.
    const widths = rowWidths(svg)
    expect(widths.length).toBeGreaterThanOrEqual(3)
    for (let at = 1; at < widths.length; at++) expect(widths[at]).toBeGreaterThan(widths[at - 1])
  }
})

it('names the four directions and steps once on a keyboard click', () => {
  const { onStep, onPress } = pad()
  for (const name of ['Cima', 'Baixo', 'Esquerda', 'Direita']) expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /cima/i }), { detail: 0 })
  expect(onStep).toHaveBeenCalledWith('up')
  fireEvent.pointerDown(screen.getByRole('button', { name: /direita/i }))
  expect(onPress).toHaveBeenCalledWith('right')
})
