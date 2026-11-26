import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { epicRelic, gem, makeActions, makeView, plainRing, wornHelm } from './fixtures.js'
import GamePanel from './game-panel.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions }) {
  const [tab, setTab] = useState('forge')
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} />
}

// Opens the forge with one item picked.
const ui = ({ view = makeView(), actions, pick = 'Compiler Runic Keyboard +2, Epic' } = {}, locale = 'en') => {
  const bound = actions ?? makeActions(vi, view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={bound} />
    </I18nProvider>,
  )
  if (pick) fireEvent.click(screen.getByRole('button', { name: pick }))
  return { view, actions: bound }
}

const PT_RELIC = 'Teclado Rúnico do Compilador +2, Épico'
const rich = (over = {}) => makeView({ gold: 5000, scrap: 40, fragments: 30, ...over })
// The View after the upgrade call, with the relic at a new level.
const withRelic = (view, relic) => ({ ...view, hero: { ...view.hero, items: view.hero.items.map((item) => (item.id === relic.id ? relic : item)) } })

it('asks for an item and lists all gear to pick from', () => {
  ui({ pick: null })
  expect(screen.getByText('Pick an item to forge.')).toBeInTheDocument()
  const picker = screen.getByRole('list', { name: 'Pick an item to forge.' })
  expect(within(picker).getAllByRole('button')).toHaveLength(6)
})

it('shows the upgrade cost and chance', () => {
  ui({ view: rich() })
  expect(screen.getByRole('region', { name: 'Compiler Runic Keyboard +2' })).toBeInTheDocument()
  expect(screen.getByText('1,350 gold, 15 scrap, 86% chance')).toBeInTheDocument()
})

it('turns upgrade off with "Falta ouro" when gold is short', () => {
  ui({ view: makeView({ gold: 100 }), pick: PT_RELIC }, 'pt-BR')
  const upgrade = screen.getByRole('button', { name: 'Melhorar' })
  expect(upgrade).toBeDisabled()
  expect(upgrade).toHaveAccessibleDescription('Falta ouro')
})

it('says when scrap is short', () => {
  ui({ view: rich({ scrap: 2 }) })
  expect(screen.getByRole('button', { name: 'Upgrade' })).toBeDisabled()
  expect(screen.getByText('Not enough scrap')).toBeInTheDocument()
})

it('upgrades and says the new level', async () => {
  const view = rich()
  const actions = makeActions(vi, view)
  actions.forgeUpgrade = vi.fn(async () => ({ ...withRelic(view, { ...epicRelic, upgrade: 3 }), forge: { ok: true } }))
  ui({ view, actions, pick: PT_RELIC }, 'pt-BR')
  fireEvent.click(screen.getByRole('button', { name: 'Melhorar' }))
  await waitFor(() => expect(actions.forgeUpgrade).toHaveBeenCalledWith(epicRelic.id))
  expect(await screen.findByText('Melhorou pra +3')).toBeInTheDocument()
})

it('says the item kept its level on a failed upgrade', async () => {
  const view = rich()
  const actions = makeActions(vi, view)
  actions.forgeUpgrade = vi.fn(async () => ({ ...view, forge: { ok: false } }))
  ui({ view, actions, pick: PT_RELIC }, 'pt-BR')
  fireEvent.click(screen.getByRole('button', { name: 'Melhorar' }))
  expect(await screen.findByText('Falhou, o item continua +2')).toBeInTheDocument()
})

it('rerolls the picked affix', async () => {
  const { actions } = ui({ view: rich() })
  expect(screen.getByText('400 gold, 20 fragments')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Brutal: +9% crit damage' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reroll' }))
  await waitFor(() => expect(actions.forgeReroll).toHaveBeenCalledWith(epicRelic.id, 1))
})

it('says when fragments are short for a reroll', () => {
  ui({ view: rich({ fragments: 5 }) })
  expect(screen.getByRole('button', { name: 'Reroll' })).toBeDisabled()
  expect(screen.getByText('Not enough fragments')).toBeInTheDocument()
})

it('sockets a gem from the bag into the first empty socket', async () => {
  const { actions } = ui({ view: rich() })
  fireEvent.click(screen.getByRole('button', { name: 'Socket Syntax Gem' }))
  await waitFor(() => expect(actions.forgeSocket).toHaveBeenCalledWith(epicRelic.id, gem.id, 1))
})

it('says why socketing is off', () => {
  ui({ view: rich(), pick: 'Ring, Uncommon' })
  expect(screen.getByText('No empty socket')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Socket / })).toBeNull()
})

it('salvages from the forge after a confirm, but not worn gear', async () => {
  const { actions } = ui({ view: rich(), pick: 'Ring, Uncommon' })
  fireEvent.click(screen.getByRole('button', { name: 'Salvage (+4 scrap)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, salvage' }))
  await waitFor(() => expect(actions.forgeSalvage).toHaveBeenCalledWith([plainRing.id]))
})

it('keeps worn gear from salvage', () => {
  ui({ view: rich(), pick: `Compiler Hood, Rare` })
  expect(screen.getByRole('region', { name: 'Compiler Hood' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Salvage/ })).toBeDisabled()
  expect(screen.getByText('Unequip it first')).toBeInTheDocument()
  expect(wornHelm.equipped).toBe('helm')
})
