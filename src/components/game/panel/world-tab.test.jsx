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

it('disables "Enfrentar chefe" under the boss level and says why', () => {
  ui({ view: makeView({ level: 3 }) })
  const clearing = zone('Clareira')
  const fight = within(clearing).getByRole('button', { name: 'Enfrentar chefe' })
  expect(fight).toBeDisabled()
  expect(fight).toHaveAccessibleDescription('Precisa nível 5')
  expect(within(clearing).getByRole('button', { name: 'Caçar aqui' })).toBeEnabled()
})

it('shows each zone with its level, lock reason, boss and suggested power', () => {
  ui()
  const clearing = zone('Clareira')
  expect(clearing).toHaveTextContent('A partir do nível 1')
  expect(clearing).toHaveTextContent('Rei Slime')
  expect(clearing).toHaveTextContent('Poder sugerido 130')
  const canopy = zone('Copas')
  expect(canopy).toHaveTextContent('Vença Rei Slime primeiro')
  expect(within(canopy).getByRole('button', { name: 'Caçar aqui' })).toBeDisabled()
  expect(within(canopy).getByRole('button', { name: 'Enfrentar chefe' })).toBeDisabled()
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

it('keeps the harder difficulties locked with the reason', () => {
  ui()
  const nightmare = screen.getByRole('button', { name: 'Pesadelo' })
  expect(nightmare).toBeDisabled()
  expect(nightmare).toHaveAccessibleDescription('Precisa nível 25')
  expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
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
