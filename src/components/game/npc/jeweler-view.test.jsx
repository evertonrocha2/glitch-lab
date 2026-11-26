import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { epicRelic, wornRelic } from '../panel/fixtures.js'
import GamePanel from '../panel/game-panel.jsx'
import { gemOf, makeNpcActions, makeNpcView } from './npc-fixtures.js'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions }) {
  const [tab, setTab] = useState('town')
  const [npc, setNpc] = useState('jeweler')
  return <GamePanel view={view} tab={tab} onTab={setTab} npc={npc} onNpc={setNpc} actions={actions} />
}

const three = [gemOf('dddddddddd01', 'logica'), gemOf('dddddddddd02', 'logica'), gemOf('dddddddddd03', 'logica')]
const items = [epicRelic, wornRelic, ...three, gemOf('dddddddddd04', 'logica'), gemOf('dddddddddd05', 'sintaxe', 2), gemOf('dddddddddd06', 'sintaxe', 2)]

const ui = ({ view = makeNpcView({ gold: 5000, fragments: 100, items }), actions } = {}, locale = 'en') => {
  const bound = actions ?? makeNpcActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={bound} />
    </I18nProvider>,
  )
  return { view, actions: bound }
}

it('sells each item gem for fragments', async () => {
  const view = makeNpcView({ gold: 5000, fragments: 100, items })
  const actions = makeNpcActions(vi, view)
  actions.buyJewel = vi.fn(async () => ({ ...view, jewel: gemOf('eeeeeeeeee01', 'algoritmos') }))
  ui({ view, actions })
  const gems = within(screen.getByRole('list', { name: 'Gems' }))
  expect(gems.getAllByRole('listitem')).toHaveLength(3)
  expect(gems.getByText('+3% crit chance')).toBeInTheDocument()
  fireEvent.click(gems.getByRole('button', { name: 'Buy Algorithms Gem for 25 fragments' }))
  await waitFor(() => expect(actions.buyJewel).toHaveBeenCalledWith('gem', 'algoritmos'))
  expect(await screen.findByText('Bought Algorithms Gem')).toBeInTheDocument()
})

it('sells support gems for fragments, or says why not', async () => {
  const { actions } = ui()
  const supports = within(screen.getByRole('list', { name: 'Support gems' }))
  expect(supports.getAllByRole('listitem')).toHaveLength(9)
  fireEvent.click(supports.getAllByRole('button')[0])
  await waitFor(() => expect(actions.buyJewel).toHaveBeenCalledWith('support', 'projeteis'))
})

it('holds a purchase without the fragments', () => {
  ui({ view: makeNpcView({ fragments: 30, items }) })
  expect(screen.getByRole('button', { name: 'Buy Logic Gem for 25 fragments' })).toBeEnabled()
  const supports = within(screen.getByRole('list', { name: 'Support gems' }))
  for (const button of supports.getAllByRole('button')) expect(button).toBeDisabled()
})

it('combines 3 gems of a kind and tier, with a preview of the result and its fee', async () => {
  const view = makeNpcView({ gold: 5000, fragments: 100, items })
  const actions = makeNpcActions(vi, view)
  actions.combineGems = vi.fn(async () => ({ ...view, combined: gemOf('eeeeeeeeee02', 'logica', 2) }))
  ui({ view, actions })
  const picker = within(screen.getByRole('list', { name: 'Gems in the bag' }))
  fireEvent.click(picker.getByRole('button', { name: 'Logic Gem, 4 in the bag' }))
  const preview = within(screen.getByRole('region', { name: 'Combine preview' }))
  expect(preview.getByText('Logic Gem II')).toBeInTheDocument()
  expect(preview.getByText('+8.8% attack')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Combine for 200 gold' }))
  await waitFor(() => expect(actions.combineGems).toHaveBeenCalledWith(three.map((gem) => gem.id)))
  expect(await screen.findByText('Made Logic Gem II')).toBeInTheDocument()
})

it('needs 3 of a kind and tier to combine', () => {
  ui()
  const picker = within(screen.getByRole('list', { name: 'Gems in the bag' }))
  const pair = picker.getByRole('button', { name: 'Syntax Gem II, 2 in the bag' })
  expect(pair).toBeDisabled()
  expect(picker.getByText('Needs 3')).toBeInTheDocument()
})

it('says why a combine is off: gold short', () => {
  ui({ view: makeNpcView({ gold: 50, items }) })
  fireEvent.click(screen.getByRole('button', { name: 'Logic Gem, 4 in the bag' }))
  expect(screen.getByRole('button', { name: 'Combine for 200 gold' })).toBeDisabled()
  expect(screen.getByText('Not enough gold')).toBeInTheDocument()
})

it('says when there are no gems to combine', () => {
  ui({ view: makeNpcView({ items: [epicRelic] }) })
  expect(screen.getByText('No gems in the bag yet.')).toBeInTheDocument()
})
