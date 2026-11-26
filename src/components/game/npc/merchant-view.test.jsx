import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { BAG_SIZE } from '../../../../shared/game/items.js'
import { sellValue } from '../../../../shared/game/shop.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { epicRelic, plainRing } from '../panel/fixtures.js'
import GamePanel from '../panel/game-panel.jsx'
import { makeNpcActions, makeNpcView } from './npc-fixtures.js'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions }) {
  const [tab, setTab] = useState('town')
  const [npc, setNpc] = useState('merchant')
  return <GamePanel view={view} tab={tab} onTab={setTab} npc={npc} onNpc={setNpc} actions={actions} />
}

const ui = ({ view = makeNpcView({ gold: 100_000, fragments: 100 }), actions } = {}, locale = 'en') => {
  const bound = actions ?? makeNpcActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={bound} />
    </I18nProvider>,
  )
  return { view, actions: bound }
}

const stock = () => within(screen.getByRole('list', { name: "Today's stock" }))
const fmt = (n) => new Intl.NumberFormat('en').format(n)

it("shows today's six pieces, each with its price and a buy button", () => {
  const { view } = ui()
  expect(stock().getAllByRole('listitem')).toHaveLength(6)
  const [first] = view.npc.market.stock
  expect(stock().getByRole('button', { name: `Buy Armor for ${fmt(first.price)} gold` })).toBeEnabled()
})

it('buys a piece with the market tier and says what it got', async () => {
  const view = makeNpcView({ gold: 100_000 })
  const [first] = view.npc.market.stock
  const actions = makeNpcActions(vi, view)
  actions.buyMarketItem = vi.fn(async () => ({ ...view, bought: first }))
  ui({ view, actions })
  fireEvent.click(stock().getByRole('button', { name: `Buy Armor for ${fmt(first.price)} gold` }))
  await waitFor(() => expect(actions.buyMarketItem).toHaveBeenCalledWith(first.item.id, view.npc.market.tier))
  expect(await screen.findByText(`Bought Armor for ${fmt(first.price)} gold`)).toBeInTheDocument()
})

it('says why a piece cannot be bought: gold short', () => {
  ui({ view: makeNpcView({ gold: 800 }) })
  // The 720 gold pieces are fine, the 1800 and 5400 ones are not.
  expect(stock().getByRole('button', { name: /^Buy Armor/ })).toBeDisabled()
  expect(stock().getAllByText('Not enough gold')).toHaveLength(3)
  expect(stock().getByRole('button', { name: /^Buy Ring/ })).toBeEnabled()
})

it('says why a piece cannot be bought: the bag is full', () => {
  const junk = Array.from({ length: BAG_SIZE }, (_, at) => ({ id: `ffffffff${String(at).padStart(4, '0')}`, kind: 'gem', gem: 'logica' }))
  ui({ view: makeNpcView({ gold: 100_000, items: junk }) })
  expect(stock().getAllByText('Your bag is full')).toHaveLength(6)
})

it('rerolls the stock for its fragment cost, or says why not', async () => {
  const { actions, view } = ui()
  fireEvent.click(screen.getByRole('button', { name: 'New stock (10 fragments)' }))
  await waitFor(() => expect(actions.rerollMarket).toHaveBeenCalledWith(view.npc.market.tier))
})

it('holds the reroll without the fragments', () => {
  ui({ view: makeNpcView({ fragments: 4 }) })
  expect(screen.getByRole('button', { name: 'New stock (10 fragments)' })).toBeDisabled()
  expect(screen.getByText('Not enough fragments')).toBeInTheDocument()
})

it('sells picked bag gear after a confirm, with the total gold', async () => {
  const view = makeNpcView()
  const actions = makeNpcActions(vi, view)
  const gold = sellValue(plainRing)
  actions.sellItems = vi.fn(async () => ({ ...view, sold: { gold, count: 1 } }))
  ui({ view, actions })
  fireEvent.click(screen.getByRole('button', { name: 'Sell' }))
  const bag = within(screen.getByRole('list', { name: 'Bag gear to sell' }))
  // Worn gear and gems are not for sale: the three bag pieces only.
  expect(bag.getAllByRole('button')).toHaveLength(3)
  fireEvent.click(bag.getByRole('button', { name: 'Ring, Uncommon' }))
  fireEvent.click(screen.getByRole('button', { name: `Sell 1 piece for ${fmt(gold)} gold` }))
  expect(actions.sellItems).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Yes, sell' }))
  await waitFor(() => expect(actions.sellItems).toHaveBeenCalledWith([plainRing.id]))
  expect(await screen.findByText(`Sold 1 piece for ${fmt(gold)} gold`)).toBeInTheDocument()
})

it('warns that socketed gems are lost with a sale', () => {
  ui()
  fireEvent.click(screen.getByRole('button', { name: 'Sell' }))
  const bag = within(screen.getByRole('list', { name: 'Bag gear to sell' }))
  expect(screen.queryByText(/gems socketed/)).toBeNull()
  fireEvent.click(bag.getByRole('button', { name: 'Compiler Runic Keyboard +2, Epic' }))
  expect(screen.getByText('1 piece has gems socketed: they are lost with it.')).toBeInTheDocument()
  const total = sellValue(epicRelic)
  expect(screen.getByRole('button', { name: `Sell 1 piece for ${fmt(total)} gold` })).toBeInTheDocument()
})

it('speaks Portuguese', () => {
  ui({}, 'pt-BR')
  expect(screen.getByRole('heading', { name: 'Mercador' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nova mercadoria (10 fragmentos)' })).toBeInTheDocument()
})
