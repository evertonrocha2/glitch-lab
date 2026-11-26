import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { makeActions, makeView } from './fixtures.js'
import GamePanel from './game-panel.jsx'
import TreeTab from './tree-tab.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions }) {
  const [tab, setTab] = useState('tree')
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} treeTab={(shared) => <TreeTab {...shared} start="skills" />} />
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

const twoSkills = { owned: { golpe: 2, raio: 1 }, loadout: ['golpe', 'raio', null, null] }

it('lists the eight skills with level, cost and cooldown', () => {
  ui({ view: makeView({ level: 1 }) })
  const list = screen.getByRole('list', { name: 'Skills' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(8)
  const strike = within(list).getAllByRole('listitem')[0]
  expect(within(strike).getByText('Strike', { selector: 'b' })).toBeInTheDocument()
  expect(within(strike).getByText('Level 1/5')).toBeInTheDocument()
  expect(within(strike).getByText('0 mana, 4s cooldown')).toBeInTheDocument()
  expect(within(strike).getByText('Next level: 40 fragments')).toBeInTheDocument()
})

it('turns Comprar off for raio with "Precisa nível 3" at level 1', () => {
  ui({ view: makeView({ level: 1, fragments: 500 }) }, 'pt-BR')
  const buy = screen.getByRole('button', { name: 'Comprar Raio' })
  expect(buy).toBeDisabled()
  expect(buy).toHaveAccessibleDescription('Precisa nível 3')
})

it('buys a skill the hero can afford', async () => {
  const { actions } = ui({ view: makeView({ level: 12, fragments: 30 }) })
  expect(screen.getByText('Costs 30 fragments')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Buy Bolt' }))
  await waitFor(() => expect(actions.buySkill).toHaveBeenCalledWith('raio'))
  expect(await screen.findByText('Learned Bolt')).toBeInTheDocument()
})

it('says when fragments are short to buy', () => {
  ui({ view: makeView({ level: 12, fragments: 10 }) })
  expect(screen.getByRole('button', { name: 'Buy Bolt' })).toHaveAccessibleDescription('Not enough fragments')
})

it('upgrades an owned skill and stops at the max level', async () => {
  const { actions } = ui({ view: makeView({ fragments: 200, skills: { owned: { golpe: 1, raio: 5 }, loadout: ['golpe', null, null, null] } }) })
  fireEvent.click(screen.getByRole('button', { name: 'Upgrade Strike' }))
  await waitFor(() => expect(actions.upgradeSkill).toHaveBeenCalledWith('golpe'))
  expect(screen.getByRole('button', { name: 'Upgrade Bolt' })).toHaveAccessibleDescription('Already at max level')
})

it('reorders the loadout and saves the new order', async () => {
  const { actions } = ui({ view: makeView({ skills: twoSkills }) })
  const slots = screen.getByRole('list', { name: 'Equipped skills' })
  expect(within(slots).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    expect.stringContaining('Strike'),
    expect.stringContaining('Bolt'),
    expect.stringContaining('Empty'),
    expect.stringContaining('Empty'),
  ])
  // A move saves at once: no separate Save to forget.
  fireEvent.click(screen.getByRole('button', { name: 'Move Strike down' }))
  await waitFor(() =>
    expect(actions.saveLoadout).toHaveBeenCalledWith({ skills: ['raio', 'golpe', null, null], thresholds: { hp: 0.4, mp: 0.25 } }),
  )
  expect(await screen.findByText('Loadout saved')).toBeInTheDocument()
})

it('equipping a skill saves it straight away, and so does removing one', async () => {
  const { actions } = ui({ view: makeView({ skills: { owned: { golpe: 1, raio: 1 }, loadout: ['golpe', null, null, null] } }) })
  fireEvent.click(screen.getByRole('button', { name: 'Equip Bolt' }))
  await waitFor(() => expect(actions.saveLoadout).toHaveBeenCalledWith({ skills: ['golpe', 'raio', null, null], thresholds: { hp: 0.4, mp: 0.25 } }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Strike' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Remove Strike' }))
  await waitFor(() => expect(actions.saveLoadout).toHaveBeenLastCalledWith({ skills: [null, null, null, null], thresholds: { hp: 0.4, mp: 0.25 } }))
})

it('the Save button is only for the potion thresholds', () => {
  ui({ view: makeView({ skills: { owned: { golpe: 1, raio: 1 }, loadout: ['golpe', null, null, null] } }) })
  expect(screen.getByRole('button', { name: 'Save' })).toHaveAccessibleDescription('Nothing changed')
  // A plain state, not a problem: muted, not the error red.
  expect(screen.getByText('Nothing changed')).toHaveClass('text-[#9a93b8]')
})

it('sets the potion thresholds with sliders', async () => {
  const { actions } = ui()
  const hp = screen.getByRole('slider', { name: 'Health potion below' })
  expect(hp).toHaveAttribute('max', '0.9')
  expect(hp).toHaveAttribute('aria-valuetext', '40%')
  fireEvent.change(hp, { target: { value: '0.6' } })
  expect(hp).toHaveAttribute('aria-valuetext', '60%')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(actions.saveLoadout).toHaveBeenCalledWith({ skills: ['golpe', null, null, null], thresholds: { hp: 0.6, mp: 0.25 } }))
})

it('says which skill passives and support gems change each skill, with the changed cooldown', () => {
  const view = makeView({ talents: ['root', 'logica-c0', 'logica-c1', 'logica-f1-1', 'logica-f1-2', 'logica-f0-1'], skills: twoSkills })
  view.hero.treeSockets = { 'logica-f0-1': { id: 'ccccccccccc1', kind: 'support', support: 'rapido' } }
  ui({ view })
  const strike = within(screen.getByRole('list', { name: 'Skills' })).getAllByRole('listitem')[0]
  const mods = within(strike).getByRole('list', { name: 'Changed by' })
  expect(within(mods).getByText('Double Strike (passive): Strike hits again right after, at 50% power')).toBeInTheDocument()
  expect(within(mods).getByText('Quick Cast (support gem): Cooldowns recover 25% faster, skills cost 20% more mana')).toBeInTheDocument()
  expect(within(strike).getByText('0 mana, 3.2s cooldown')).toBeInTheDocument()
})

it('lists no changes for a skill nothing touches', () => {
  ui({ view: makeView({ skills: twoSkills }) })
  expect(screen.queryByRole('list', { name: 'Changed by' })).toBeNull()
})
