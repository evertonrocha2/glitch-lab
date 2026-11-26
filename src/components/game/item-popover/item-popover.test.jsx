import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { legendarySword, makeActions, makeView } from '../panel/fixtures.js'
import GamePanel from '../panel/game-panel.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions, start }) {
  const [tab, setTab] = useState(start)
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} />
}

const ui = ({ view = makeView(), actions, tab = 'bag' } = {}, locale = 'en') => {
  const bound = actions ?? makeActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={bound} start={tab} />
    </I18nProvider>,
  )
  return { view, actions: bound }
}

// The popover and the hover tooltip float in a portal beside the cell.
const relicCell = () => screen.getByRole('button', { name: 'Compiler Runic Keyboard +2, Epic' })
const ringCell = () => screen.getByRole('button', { name: 'Ring, Uncommon' })
const hover = (cell, pointerType = 'mouse') => fireEvent.pointerEnter(cell, { pointerType })

it('shows a compact tooltip on hover, with the item level and arrows against what is worn', () => {
  ui()
  hover(relicCell())
  const tip = screen.getByRole('tooltip')
  expect(within(tip).getByText('Compiler Runic Keyboard +2')).toBeInTheDocument()
  expect(within(tip).getByText('Epic relic, item level 14')).toBeInTheDocument()
  expect(within(tip).getByText('Vs equipped:')).toBeInTheDocument()
  expect(tip.querySelector('[data-trend="up"]')).toHaveTextContent('+9 attack')
  expect(within(tip).getByText('Click for details and actions')).toBeInTheDocument()
  expect(relicCell()).toHaveAttribute('aria-describedby', tip.id)
  fireEvent.pointerLeave(relicCell(), { pointerType: 'mouse' })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('says when nothing is worn in the slot, shows a gem by its stats, one tooltip at a time', () => {
  ui()
  hover(screen.getByRole('button', { name: 'Excalibug, Legendary' }))
  expect(within(screen.getByRole('tooltip')).getByText('Nothing worn in that slot yet')).toBeInTheDocument()
  hover(screen.getByRole('button', { name: 'Syntax Gem' }))
  expect(screen.getAllByRole('tooltip')).toHaveLength(1)
  expect(within(screen.getByRole('tooltip')).getByText('Gem. Socket it in the Forge.')).toBeInTheDocument()
})

it('shows the tooltip on keyboard focus, and never on a touch', () => {
  ui()
  hover(relicCell(), 'touch')
  expect(screen.queryByRole('tooltip')).toBeNull()
  act(() => relicCell().focus())
  expect(screen.getByRole('tooltip')).toHaveTextContent('Compiler Runic Keyboard +2')
  act(() => relicCell().blur())
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('opens a popover with the full card and its actions on click, and Escape gives focus back to the cell', () => {
  ui()
  expect(relicCell()).toHaveAttribute('aria-haspopup', 'dialog')
  expect(relicCell()).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(relicCell())
  const popover = screen.getByRole('dialog', { name: 'Compiler Runic Keyboard +2' })
  expect(within(popover).getByRole('region', { name: 'Compiler Runic Keyboard +2' })).toBeInTheDocument()
  for (const name of ['Equip', 'Forge', /^Salvage \(/]) expect(within(popover).getByRole('button', { name })).toBeInTheDocument()
  expect(popover).toHaveFocus()
  expect(relicCell()).toHaveAttribute('aria-expanded', 'true')
  // No tooltip while the popover is open.
  hover(ringCell())
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.keyDown(popover, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(relicCell()).toHaveFocus()
})

it('keeps one popover open at a time, and a second click on the cell closes it', () => {
  ui()
  fireEvent.click(relicCell())
  fireEvent.click(ringCell())
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.getByRole('dialog', { name: 'Ring' })).toHaveFocus()
  fireEvent.click(ringCell())
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('closes the popover on a press outside it, but not on one inside it or on its cell', () => {
  ui()
  fireEvent.click(relicCell())
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Equip' }))
  fireEvent.pointerDown(relicCell())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps Tab inside the popover', () => {
  ui()
  fireEvent.click(relicCell())
  const popover = screen.getByRole('dialog')
  const buttons = within(popover).getAllByRole('button')
  act(() => buttons.at(-1).focus())
  fireEvent.keyDown(popover, { key: 'Tab' })
  expect(buttons[0]).toHaveFocus()
})

it('opens no popover in multi-select: clicks only pick, and the tooltip says so', () => {
  ui()
  fireEvent.click(relicCell())
  fireEvent.click(screen.getByRole('button', { name: 'Salvage many' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(relicCell())
  expect(relicCell()).toHaveAttribute('aria-pressed', 'true')
  expect(relicCell()).not.toHaveAttribute('aria-haspopup')
  expect(screen.queryByRole('dialog')).toBeNull()
  hover(relicCell())
  expect(within(screen.getByRole('tooltip')).getByText('Click to pick it for salvage')).toBeInTheDocument()
})

it('opens the popover of the item a chest gave', async () => {
  const view = makeView({ chests: [{ day: '2026-11-20', boost: 0 }] })
  const actions = makeActions(vi, view)
  const got = { ...legendarySword, id: 'aaaaaaaaaab9' }
  actions.openChest = vi.fn(async () => ({ ...view, chest: { item: got } }))
  view.hero.items = [...view.hero.items, got]
  ui({ view, actions })
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  const popover = await screen.findByRole('dialog', { name: 'Excalibug' })
  expect(within(popover).getByRole('button', { name: 'Equip' })).toBeInTheDocument()
})

it('places the popover beside the cell, flipping to the left near the right edge', () => {
  const rects = { 'Compiler Runic Keyboard +2, Epic': { left: 900, top: 100 }, 'Ring, Uncommon': { left: 100, top: 100 } }
  const real = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function rect() {
    const at = rects[this.getAttribute?.('aria-label')]
    const r = at ? { ...at, width: 50, height: 50 } : { left: 0, top: 0, width: 0, height: 0 }
    return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height }
  }
  try {
    ui()
    fireEvent.click(relicCell())
    const left = screen.getByRole('dialog')
    expect(left).toHaveAttribute('data-side', 'left')
    expect(Number.parseFloat(left.style.left) + Number.parseFloat(left.style.width)).toBeLessThanOrEqual(900)
    fireEvent.click(ringCell())
    const right = screen.getByRole('dialog')
    expect(right).toHaveAttribute('data-side', 'right')
    expect(Number.parseFloat(right.style.left)).toBeGreaterThanOrEqual(150)
  } finally {
    Element.prototype.getBoundingClientRect = real
  }
})

it('opens a bottom sheet on a phone, closed by its button or Escape', () => {
  window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })
  try {
    ui()
    fireEvent.click(relicCell())
    const sheet = screen.getByRole('dialog', { name: 'Compiler Runic Keyboard +2' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(sheet).toHaveAttribute('data-sheet', 'true')
    expect(within(sheet).getByRole('button', { name: 'Equip' })).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(relicCell())
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(relicCell()).toHaveFocus()
  } finally {
    delete window.matchMedia
  }
})

it('opens a worn item in a popover from the Hero doll, with Unequip and Forge', () => {
  ui({ tab: 'hero' })
  const slot = screen.getByRole('button', { name: /Relic: Ancient Scroll/ })
  hover(slot)
  expect(within(screen.getByRole('tooltip')).getByText('Equipped')).toBeInTheDocument()
  fireEvent.click(slot)
  const popover = screen.getByRole('dialog', { name: 'Ancient Scroll' })
  for (const name of ['Unequip', 'Forge']) expect(within(popover).getByRole('button', { name })).toBeInTheDocument()
  fireEvent.keyDown(popover, { key: 'Escape' })
  expect(slot).toHaveFocus()
})

it('shows the tooltip in the forge picker, where a click still picks the item', () => {
  ui({ tab: 'forge' })
  hover(ringCell())
  expect(within(screen.getByRole('tooltip')).getByText('Click to forge it')).toBeInTheDocument()
  fireEvent.click(ringCell())
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: 'Ring' })).toBeInTheDocument()
})
