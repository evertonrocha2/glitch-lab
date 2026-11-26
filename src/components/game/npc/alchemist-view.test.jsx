import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { elixirPrice } from '../../../../shared/game/elixirs.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import GamePanel from '../panel/game-panel.jsx'
import { activeElixirs, countdown } from './elixir-time.js'
import { makeNpcActions, makeNpcView } from './npc-fixtures.js'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

afterEach(() => {
  vi.useRealTimers()
})

function Harness({ view, actions, start }) {
  const [tab, setTab] = useState(start)
  const [npc, setNpc] = useState('alchemist')
  return <GamePanel view={view} tab={tab} onTab={setTab} npc={npc} onNpc={setNpc} actions={actions} />
}

const ui = ({ view = makeNpcView({ gold: 100_000, fragments: 100 }), actions, start = 'town' } = {}, locale = 'en') => {
  const bound = actions ?? makeNpcActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={bound} start={start} />
    </I18nProvider>,
  )
  return { view, actions: bound }
}

const fmt = (n) => new Intl.NumberFormat('en').format(n)
const xpPrice = elixirPrice('xp', 12)

it('sells potions by kind and count (moved here from the Bag)', async () => {
  const { actions } = ui()
  fireEvent.click(screen.getByRole('button', { name: 'Mana (1)' }))
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buy for 120 gold' }))
  await waitFor(() => expect(actions.buyPotions).toHaveBeenCalledWith('mp', 3))
})

it('lists the three elixirs with what they do and both prices', () => {
  ui()
  const list = within(screen.getByRole('list', { name: 'Elixirs' }))
  expect(list.getAllByRole('listitem')).toHaveLength(3)
  expect(list.getByText('+50% hunt XP')).toBeInTheDocument()
  expect(list.getByText('+20% damage')).toBeInTheDocument()
  expect(list.getByText('+30% drop chance')).toBeInTheDocument()
  expect(list.getByRole('button', { name: `Drink the XP elixir for ${fmt(xpPrice.gold)} gold` })).toBeEnabled()
  expect(list.getByRole('button', { name: `Drink the XP elixir for ${xpPrice.fragments} fragments` })).toBeEnabled()
})

it('drinks an elixir for gold or for fragments', async () => {
  const view = makeNpcView({ gold: 100_000, fragments: 100 })
  const actions = makeNpcActions(vi, view)
  actions.buyElixir = vi.fn(async () => ({ ...view, elixir: { type: 'luck', expiresAt: Date.now() + 1_800_000, price: { fragments: 25 } } }))
  ui({ view, actions })
  fireEvent.click(screen.getByRole('button', { name: 'Drink the Luck elixir for 25 fragments' }))
  await waitFor(() => expect(actions.buyElixir).toHaveBeenCalledWith('luck', 'fragments'))
  expect(await screen.findByText('Luck elixir active for 30 min')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: `Drink the XP elixir for ${fmt(xpPrice.gold)} gold` }))
  await waitFor(() => expect(actions.buyElixir).toHaveBeenCalledWith('xp', 'gold'))
})

it('says why an elixir is out of reach', () => {
  ui({ view: makeNpcView({ gold: 10, fragments: 30 }) })
  expect(screen.getByRole('button', { name: `Drink the XP elixir for ${fmt(xpPrice.gold)} gold` })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Drink the XP elixir for 40 fragments' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Drink the Fury elixir for 25 fragments' })).toBeEnabled()
  expect(screen.getAllByText('Not enough fragments')).toHaveLength(1)
})

it('counts an active elixir down, live', () => {
  vi.useFakeTimers({ now: new Date('2026-11-26T12:00:00Z'), toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  const now = Date.now()
  ui({ view: makeNpcView({ elixirs: { xp: { startedAt: now - 60_000, expiresAt: now + 90_000 }, luck: { startedAt: now - 3_600_000, expiresAt: now - 1 } } }) })
  const active = within(screen.getByRole('list', { name: 'Active elixirs' }))
  expect(active.getAllByRole('listitem')).toHaveLength(1)
  expect(active.getByText('1:30 left')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1000))
  expect(active.getByText('1:29 left')).toBeInTheDocument()
})

it('says when no elixir is active', () => {
  ui()
  expect(screen.getByText('No elixir active.')).toBeInTheDocument()
})

it('leaves the Bag a link to the Alchemist instead of the potion shop', () => {
  ui({ start: 'bag' })
  expect(screen.queryByRole('button', { name: /^Buy for/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Visit the Alchemist' }))
  expect(screen.getByRole('tab', { name: 'Town' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: 'Alchemist' })).toBeInTheDocument()
})

it('reads the running elixirs and their countdown', () => {
  expect(activeElixirs({ damage: { startedAt: 0, expiresAt: 5000 }, xp: { startedAt: 0, expiresAt: 900 } }, 1000)).toEqual([{ type: 'damage', left: 4000, expiresAt: 5000 }])
  expect(countdown(90_000)).toBe('1:30')
  expect(countdown(1)).toBe('0:01')
  expect(countdown(3_661_000)).toBe('1:01:01')
})

it('says why the potion buy is off, in Portuguese', () => {
  ui({ view: makeNpcView({ gold: 30 }) }, 'pt-BR')
  expect(screen.getByRole('heading', { name: 'Alquimista' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Comprar por 40 de ouro' })).toBeDisabled()
  expect(screen.getAllByText('Falta ouro').length).toBeGreaterThan(0)
})
