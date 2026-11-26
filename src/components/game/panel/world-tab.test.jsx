import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { makeActions, makeView } from './fixtures.js'
import GamePanel from './game-panel.jsx'
import WorldTab from './world-tab.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

function Harness({ view, actions, onLeave, replaying = false }) {
  const [tab, setTab] = useState('world')
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} worldTab={(shared) => <WorldTab {...shared} onLeave={onLeave} replaying={replaying} />} />
}

function ui({ view = makeView(), locale = 'pt-BR', onLeave = vi.fn(), replaying } = {}) {
  const actions = { ...makeActions(vi, view), startHunt: vi.fn(async () => view), stopHunt: vi.fn(async () => view), fightBoss: vi.fn(async () => view) }
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={actions} onLeave={onLeave} replaying={replaying} />
    </I18nProvider>,
  )
  return { actions, onLeave }
}

const zone = (name) => screen.getByRole('region', { name: new RegExp(name) })

it('lets a hero under the boss level fight the boss and hunt', () => {
  ui({ view: makeView({ level: 3 }) })
  const clearing = zone('Clareira')
  expect(within(clearing).getByRole('button', { name: 'Enfrentar chefe' })).toBeEnabled()
  expect(within(clearing).getByRole('button', { name: 'Caçar aqui' })).toBeEnabled()
})

it('shows every zone open, with its suggested level, boss and suggested power', () => {
  ui({ view: makeView({ level: 1 }) })
  for (const [name, level, power] of [['Clareira', 1, 130], ['Copas', 8, 260], ['Raízes', 14, 400]]) {
    const card = zone(name)
    expect(card).toHaveTextContent(`Nível sugerido ${level}`)
    expect(card).toHaveTextContent(`Poder sugerido ${power}`)
    expect(card).not.toHaveTextContent(/primeiro|Precisa nível/)
    expect(within(card).getByRole('button', { name: 'Caçar aqui' })).toBeEnabled()
    expect(within(card).getByRole('button', { name: 'Enfrentar chefe' })).toBeEnabled()
  }
  expect(zone('Clareira')).toHaveTextContent('Rei Slime')
})

it('starts a hunt in zone 3 at level 1', () => {
  const { actions } = ui({ view: makeView({ level: 1 }) })
  fireEvent.click(within(zone('Raízes')).getByRole('button', { name: 'Caçar aqui' }))
  expect(actions.startHunt).toHaveBeenCalledWith({ world: 'floresta-js', zone: 'z3', difficulty: 'normal' })
})

it('tags each zone by how dangerous it is for the hero, and warns an under-powered one', () => {
  const view = makeView({ level: 1 })
  view.power = 200
  ui({ view })
  expect(within(zone('Clareira')).getByText('Tranquila')).toBeVisible()
  expect(zone('Clareira')).not.toHaveTextContent('abaixo do sugerido')
  // 200 of 260: risky. 200 of 400: deadly.
  expect(within(zone('Copas')).getByText('Arriscada')).toBeVisible()
  expect(within(zone('Raízes')).getByText('Mortal')).toBeVisible()
  expect(zone('Raízes')).toHaveTextContent('Seu poder 200 está abaixo do sugerido')
})

it('starts a hunt and fights a boss on the picked zone and difficulty', async () => {
  const { actions } = ui()
  fireEvent.click(within(zone('Clareira')).getByRole('button', { name: 'Caçar aqui' }))
  expect(actions.startHunt).toHaveBeenCalledWith({ world: 'floresta-js', zone: 'z1', difficulty: 'normal' })
  await screen.findByText('Caçando em Clareira')
  fireEvent.click(within(zone('Clareira')).getByRole('button', { name: 'Enfrentar chefe' }))
  expect(actions.fightBoss).toHaveBeenCalledWith({ world: 'floresta-js', zone: 'z1', difficulty: 'normal' })
})

it('marks a beaten boss and the zone being hunted', () => {
  const view = makeView({ hunt: { world: 'floresta-js', zone: 'z1', difficulty: 'normal', startedAt: 0, claims: 0 } })
  view.zones['floresta-js'].normal[0].beaten = true
  ui({ view })
  const clearing = zone('Clareira')
  expect(clearing).toHaveTextContent('Chefe vencido')
  expect(clearing).toHaveTextContent('Caçando aqui')
})

it('opens the harder difficulties at any level, with a strong warning', async () => {
  const { actions } = ui({ view: makeView({ level: 3 }) })
  expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText(/mais fortes que no Normal/)).toBeNull()
  const nightmare = screen.getByRole('button', { name: 'Pesadelo' })
  expect(nightmare).toBeEnabled()
  fireEvent.click(nightmare)
  expect(nightmare).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText(/Pesadelo: inimigos 3,2x mais fortes que no Normal. Sugerido a partir do nível 25./)).toBeVisible()
  expect(screen.getByText(/Seu herói está no nível 3/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Inferno' }))
  expect(screen.getByText(/Inferno: inimigos 9x mais fortes que no Normal. Sugerido a partir do nível 40./)).toBeVisible()
  fireEvent.click(within(zone('Copas')).getByRole('button', { name: 'Caçar aqui' }))
  expect(actions.startHunt).toHaveBeenCalledWith({ world: 'floresta-js', zone: 'z2', difficulty: 'inferno' })
})

it('lists the Forest and the other worlds as coming soon, without ENEM in English', () => {
  ui({ locale: 'en' })
  const maps = screen.getByRole('list', { name: 'Worlds' })
  expect(within(maps).getByText('JavaScript Forest').closest('li')).toHaveTextContent('You are here')
  expect(within(maps).getByText('SQL Cave').closest('li')).toHaveTextContent('Coming soon')
  expect(within(maps).queryByText('Math Tower')).toBeNull()
})

it('stops the hunt and goes back to the Lab', async () => {
  const view = makeView({ hunt: { world: 'floresta-js', zone: 'z1', difficulty: 'normal', startedAt: 0, claims: 0 } })
  const { actions, onLeave } = ui({ view })
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Laboratório' }))
  await vi.waitFor(() => expect(onLeave).toHaveBeenCalled())
  expect(actions.stopHunt).toHaveBeenCalled()
})

it('holds every fight button while a boss fight plays', () => {
  ui({ replaying: true })
  const fight = within(zone('Clareira')).getByRole('button', { name: 'Enfrentar chefe' })
  expect(fight).toBeDisabled()
  expect(fight).toHaveAccessibleDescription('Luta em andamento')
})
