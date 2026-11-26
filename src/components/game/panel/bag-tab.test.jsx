import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { epicRelic, gem, legendarySword, makeActions, makeView, plainRing } from './fixtures.js'
import GamePanel from './game-panel.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions }) {
  const [tab, setTab] = useState('bag')
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} />
}

const ui = ({ view = makeView(), actions } = {}, locale = 'en') => {
  const bound = actions ?? makeActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={bound} />
    </I18nProvider>,
  )
  return { view, actions: bound }
}

const bag = () => screen.getByRole('list', { name: /^Bag/ })
const cellNames = () => within(bag()).getAllByRole('button').map((cell) => cell.getAttribute('aria-label'))

it('draws 60 cells and counts what is used', () => {
  ui()
  expect(within(bag()).getAllByRole('listitem')).toHaveLength(60)
  expect(screen.getByText('4 of 60')).toBeInTheDocument()
})

it('sorts by rarity and by slot', () => {
  ui()
  expect(cellNames()).toEqual(['Excalibug, Legendary', 'Compiler Runic Keyboard +2, Epic', 'Ring, Uncommon', 'Syntax Gem'])
  fireEvent.click(screen.getByRole('button', { name: 'Slot' }))
  expect(screen.getByRole('button', { name: 'Slot' })).toHaveAttribute('aria-pressed', 'true')
  expect(cellNames()).toEqual(['Ring, Uncommon', 'Excalibug, Legendary', 'Compiler Runic Keyboard +2, Epic', 'Syntax Gem'])
})

it('selects an item, shows its tooltip with a compare line and equips it', async () => {
  const { actions } = ui()
  fireEvent.click(screen.getByRole('button', { name: 'Compiler Runic Keyboard +2, Epic' }))
  const tip = screen.getByRole('region', { name: 'Compiler Runic Keyboard +2' })
  expect(within(tip).getByText('Vs equipped:')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Equip' }))
  await waitFor(() => expect(actions.equipItem).toHaveBeenCalledWith(epicRelic.id))
})

it('sends the selected item to the forge', () => {
  ui()
  fireEvent.click(screen.getByRole('button', { name: 'Excalibug, Legendary' }))
  fireEvent.click(screen.getByRole('button', { name: 'Forge' }))
  expect(screen.getByRole('tab', { name: 'Forge' })).toHaveAttribute('aria-selected', 'true')
})

it('salvages one item after a confirm', async () => {
  const { actions } = ui()
  fireEvent.click(screen.getByRole('button', { name: 'Ring, Uncommon' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvage (+4 scrap)' }))
  expect(actions.forgeSalvage).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Yes, salvage' }))
  await waitFor(() => expect(actions.forgeSalvage).toHaveBeenCalledWith([plainRing.id]))
})

it('disarms the salvage confirm when another item is selected', () => {
  ui()
  fireEvent.click(screen.getByRole('button', { name: 'Ring, Uncommon' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvage (+4 scrap)' }))
  expect(screen.getByRole('button', { name: 'Yes, salvage' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Syntax Gem' }))
  expect(screen.queryByRole('button', { name: 'Yes, salvage' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Salvage (+10 scrap)' })).toBeInTheDocument()
})

it('disarms the multi-select confirm when the picked set changes', () => {
  const { actions } = ui()
  fireEvent.click(screen.getByRole('button', { name: 'Salvage many' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ring, Uncommon' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvage 1 item (+4 scrap)' }))
  expect(screen.getByRole('button', { name: 'Yes, salvage 1 item (+4 scrap)' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Syntax Gem' }))
  expect(screen.queryByRole('button', { name: /^Yes, salvage/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Salvage 2 items (+14 scrap)' })).toBeInTheDocument()
  expect(actions.forgeSalvage).not.toHaveBeenCalled()
})

it('salvages many at once', async () => {
  const view = makeView()
  const actions = makeActions(vi, view)
  actions.forgeSalvage = vi.fn(async () => ({ ...view, salvage: { scrap: 14 } }))
  ui({ view, actions })
  fireEvent.click(screen.getByRole('button', { name: 'Salvage many' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ring, Uncommon' }))
  fireEvent.click(screen.getByRole('button', { name: 'Syntax Gem' }))
  expect(screen.getByRole('button', { name: 'Syntax Gem' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Salvage 2 items (+14 scrap)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, salvage 2 items (+14 scrap)' }))
  await waitFor(() => expect(actions.forgeSalvage).toHaveBeenCalledWith([plainRing.id, gem.id]))
  expect(await screen.findByText('Salvaged for 14 scrap')).toBeInTheDocument()
})

it('opens a chest and names the item', async () => {
  const view = makeView({ chests: [{ day: '2026-11-20', boost: 0 }, { day: '2026-11-21', boost: 0 }] })
  const actions = makeActions(vi, view)
  actions.openChest = vi.fn(async () => ({ ...view, chest: { item: legendarySword } }))
  ui({ view, actions })
  expect(screen.getByText('2 chests')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  await waitFor(() => expect(actions.openChest).toHaveBeenCalled())
  expect(await screen.findByText('Got Excalibug')).toBeInTheDocument()
})

it('says when a chest item became scrap', async () => {
  const view = makeView({ chests: [{ day: '2026-11-20', boost: 0 }] })
  const actions = makeActions(vi, view)
  actions.openChest = vi.fn(async () => ({ ...view, chest: { item: legendarySword }, overflow: { scrap: 40 } }))
  ui({ view, actions })
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  expect(await screen.findByText('Bag full: the item became 40 scrap')).toBeInTheDocument()
})

it('turns the open button off with no chest', () => {
  ui()
  expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
  expect(screen.getByText('No chests to open')).toBeInTheDocument()
})

it('buys potions by kind and count', async () => {
  const { actions } = ui()
  fireEvent.click(screen.getByRole('button', { name: 'Mana (1)' }))
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buy for 120 gold' }))
  await waitFor(() => expect(actions.buyPotions).toHaveBeenCalledWith('mp', 3))
})

it('says why the potion buy is off', () => {
  ui({ view: makeView({ gold: 30 }) }, 'pt-BR')
  expect(screen.getByRole('button', { name: 'Comprar por 40 de ouro' })).toBeDisabled()
  expect(screen.getByText('Falta ouro')).toBeInTheDocument()
})

it('shows a server refusal as an alert', async () => {
  const view = makeView()
  const actions = makeActions(vi, view)
  actions.equipItem = vi.fn(async () => {
    throw Object.assign(new Error('Your bag is full.'), { status: 400 })
  })
  ui({ view, actions })
  fireEvent.click(screen.getByRole('button', { name: 'Ring, Uncommon' }))
  fireEvent.click(screen.getByRole('button', { name: 'Equip' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your bag is full.'))
})

it('picks every bag item of a rarity in one click, and a second click lets them go', () => {
  const view = makeView()
  const twin = { ...plainRing, id: 'aaaaaaaaaaz1' }
  view.hero.items = [...view.hero.items, twin]
  ui({ view })
  fireEvent.click(screen.getByRole('button', { name: 'Salvage many' }))
  fireEvent.click(screen.getByRole('button', { name: 'All uncommon' }))
  const rings = screen.getAllByRole('button', { name: 'Ring, Uncommon' })
  expect(rings).toHaveLength(2)
  for (const ring of rings) expect(ring).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Syntax Gem' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: /^Salvage 2 items/ })).toBeInTheDocument()
  // Rarities the bag doesn't hold get no shortcut.
  expect(screen.queryByRole('button', { name: 'All common' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'All uncommon' }))
  for (const ring of screen.getAllByRole('button', { name: 'Ring, Uncommon' })) expect(ring).toHaveAttribute('aria-pressed', 'false')
})
