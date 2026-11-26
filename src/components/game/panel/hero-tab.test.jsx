import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { RARITY_TRIM } from '../ui/tokens.js'
import { makeActions, makeView, wornRelic } from './fixtures.js'
import GamePanel from './game-panel.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

const ui = (props = {}, locale = 'en') => {
  const view = props.view ?? makeView()
  const actions = props.actions ?? makeActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <GamePanel view={view} tab="hero" onTab={() => {}} actions={actions} {...props} />
    </I18nProvider>,
  )
  return { view, actions }
}

it('measures power against the next boss and warns when short', () => {
  const view = { ...makeView({ level: 1 }), power: 79 }
  ui({ view })
  const bar = screen.getByRole('meter', { name: 'Your power' })
  expect(bar).toHaveAttribute('aria-valuenow', '79')
  expect(bar).toHaveAttribute('aria-valuetext', '79 of 130')
  // The boss mark sits inside the track, so the bar shows how far there is to go.
  expect(Number(bar.getAttribute('aria-valuemax'))).toBeGreaterThan(130)
  expect(bar.querySelector('[data-part="tick"]')).not.toBeNull()
  expect(screen.getByText('Slime King asks for 130. You are 51 short.')).toBeInTheDocument()
})

it('scales the suggested power with the target difficulty', () => {
  const view = makeView({ level: 30 })
  ui({ view, target: { world: 'floresta-js', zone: 'z3', difficulty: 'pesadelo' } })
  expect(screen.getByRole('meter', { name: 'Your power' }).getAttribute('aria-valuetext')).toMatch(/of approx\. 1,280$/)
  expect(screen.getByText(/Undefined Hydra asks for approx\. 1,280\./)).toBeInTheDocument()
})

it('says the hero is ready when power reaches the boss', () => {
  const view = { ...makeView(), power: 150 }
  ui({ view })
  expect(screen.getByText('Ready to face Slime King (130 suggested).')).toBeInTheDocument()
  const bar = screen.getByRole('meter', { name: 'Your power' })
  expect(bar).toHaveAttribute('aria-valuenow', '150')
  // valuenow never passes valuemax.
  expect(Number(bar.getAttribute('aria-valuemax'))).toBeGreaterThanOrEqual(150)
})

it('lays out the 8 slots around the hero with their names and rarity trims', () => {
  ui()
  const doll = screen.getByRole('group', { name: 'Equipment' })
  expect(within(doll).getAllByRole('listitem')).toHaveLength(8)
  const helm = within(doll).getByRole('button', { name: /Helm: Compiler Hood/ })
  expect(helm).toHaveStyle({ borderColor: RARITY_TRIM.rare })
  expect(within(doll).getByRole('button', { name: /Relic: Ancient Scroll/ })).toHaveStyle({ borderColor: RARITY_TRIM.common })
  // An empty slot says its name, to the eye and to screen readers.
  const weapon = within(doll).getByRole('img', { name: 'Weapon: empty' })
  expect(within(weapon).getByText('Weapon')).toBeInTheDocument()
  for (const name of ['Amulet', 'Ring', 'Boots', 'Off-hand']) expect(within(doll).getByRole('img', { name: `${name}: empty` })).toBeInTheDocument()
  // Left column helm, amulet, chest, offhand; right column weapon, ring, boots, relic.
  const [left, right] = within(doll).getAllByRole('list')
  expect(within(left).getAllByRole('listitem').map((li) => li.dataset.slot)).toEqual(['helm', 'amulet', 'chest', 'offhand'])
  expect(within(right).getAllByRole('listitem').map((li) => li.dataset.slot)).toEqual(['weapon', 'ring', 'boots', 'relic'])
})

it('shows the hero wearing the gear, with an accessible name', () => {
  ui()
  const doll = screen.getByRole('group', { name: 'Equipment' })
  expect(within(doll).getByRole('img', { name: 'Your hero' }).tagName).toBe('CANVAS')
})

it('opens the look editor from the Appearance button, and hides it without a handler', () => {
  const onEditLook = vi.fn()
  ui({ onEditLook })
  fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
  expect(onEditLook).toHaveBeenCalledTimes(1)
})

it('has no Appearance button when nothing opens the editor', () => {
  ui()
  expect(screen.queryByRole('button', { name: 'Appearance' })).toBeNull()
})

it('groups the stats under three headings', () => {
  ui()
  const stats = screen.getByRole('group', { name: 'Stats' })
  const groups = { Offense: ['Attack', 'Attack speed', '1/s'], Defense: ['Health', 'Armor'], Resistances: ['Fire res.', 'Poison res.'] }
  for (const [title, texts] of Object.entries(groups)) {
    within(stats).getByRole('heading', { name: title })
    const list = within(stats).getByRole('list', { name: title })
    for (const each of texts) expect(within(list).getByText(each)).toBeInTheDocument()
  }
})

it('opens the tooltip of a worn item and unequips it', async () => {
  const { actions } = ui()
  fireEvent.click(screen.getByRole('button', { name: /Relic: Ancient Scroll/ }))
  expect(screen.getByRole('region', { name: 'Ancient Scroll' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Unequip' }))
  await waitFor(() => expect(actions.unequipSlot).toHaveBeenCalledWith(wornRelic.slot))
})

it('says why unequip is off when the bag is full', () => {
  const filler = Array.from({ length: 60 }, (_, i) => ({ id: `f${String(i).padStart(11, '0')}`, kind: 'gem', gem: 'logica' }))
  ui({ view: makeView({ items: [wornRelic, ...filler] }) })
  fireEvent.click(screen.getByRole('button', { name: /Relic: Ancient Scroll/ }))
  expect(screen.getByRole('button', { name: 'Unequip' })).toBeDisabled()
  expect(screen.getByText('Your bag is full')).toBeInTheDocument()
})

it('shows the study quest card with today, the next point and its meter', () => {
  ui({ studyHref: '/study' })
  const link = screen.getByRole('link', { name: /Study to get stronger/ })
  expect(link).toHaveAttribute('href', '/study')
  expect(within(link).getByText('Today: 14 correct answers.')).toBeInTheDocument()
  expect(within(link).getByText('6 more for the next tree point.')).toBeInTheDocument()
  const meter = within(link).getByRole('meter', { name: 'Correct answers toward the next tree point' })
  expect(meter).toHaveAttribute('aria-valuenow', '4')
  expect(meter).toHaveAttribute('aria-valuemax', '10')
})

it('drops the quest meter once tree points from answers are maxed out', () => {
  ui({ view: makeView({ toNextPoint: null }) })
  expect(screen.getByText('Tree points from answers are maxed out.')).toBeInTheDocument()
  expect(screen.queryByRole('meter', { name: 'Correct answers toward the next tree point' })).toBeNull()
})
