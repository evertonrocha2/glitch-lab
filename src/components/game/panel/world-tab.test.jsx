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

const FOREST_Z1 = { world: 'floresta-js', zone: 'z1' }
const HUNT = { world: 'floresta-js', zone: 'z1', difficulty: 'normal', startedAt: 0, claims: 0 }

function Harness({ view, actions, here, replaying, onPause, paused }) {
  const [tab, setTab] = useState('world')
  const [difficulty, setDifficulty] = useState('normal')
  return (
    <GamePanel
      view={view}
      tab={tab}
      onTab={setTab}
      actions={actions}
      worldTab={(shared) => (
        <WorldTab {...shared} here={here} replaying={replaying} difficulty={difficulty} onDifficulty={setDifficulty} paused={paused} onPause={onPause} />
      )}
    />
  )
}

function ui({ view = makeView(), locale = 'pt-BR', here = FOREST_Z1, replaying = false, paused = false } = {}) {
  const actions = { ...makeActions(vi, view), startHunt: vi.fn(async () => view), stopHunt: vi.fn(async () => view), fightBoss: vi.fn(async () => view) }
  const onPause = vi.fn(async () => view)
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={actions} here={here} replaying={replaying} onPause={onPause} paused={paused} />
    </I18nProvider>,
  )
  return { actions, onPause }
}

const zone = (name) => screen.getByRole('region', { name })
const region = (name) => screen.getByRole('listitem', { name })

it('lists the town and every region by tier, the ENEM ones in Portuguese only', () => {
  ui()
  const names = within(screen.getByRole('list', { name: 'Regiões' }))
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('aria-label'))
  expect(names).toEqual([
    'Cidade do Laboratório',
    'Floresta do JavaScript',
    'Biblioteca das Linguagens',
    'Cidade das Humanas',
    'Caverna do SQL',
    'Jardim da Natureza',
    'Torre da Matemática',
  ])
  expect(region('Cidade do Laboratório')).toHaveTextContent('Zona segura')
  expect(region('Caverna do SQL')).toHaveTextContent('Tier 2')
  expect(region('Torre da Matemática')).toHaveTextContent('Tier 3')
})

it('leaves the ENEM regions out in English', () => {
  ui({ locale: 'en' })
  const names = within(screen.getByRole('list', { name: 'Regions' }))
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('aria-label'))
  expect(names).toEqual(['Lab City', 'JavaScript Forest', 'SQL Cave'])
})

it('marks where the hero stands', () => {
  ui({ here: { world: 'caverna-sql', zone: 'z2' } })
  expect(region('Caverna do SQL')).toHaveAttribute('aria-current', 'location')
  expect(region('Caverna do SQL')).toHaveTextContent('Você está aqui')
  expect(region('Floresta do JavaScript')).not.toHaveAttribute('aria-current')
})

it('shows each zone with its suggested level, danger, xp an hour, boss and suggested power', () => {
  ui({ view: makeView({ level: 1 }) })
  for (const [name, level, power] of [['Clareira', 1, 130], ['Copas', 8, 260], ['Raízes', 14, 400], ['Galerias', 20, 540], ['Cúpula', 50, '1.420']]) {
    const card = zone(name)
    expect(card).toHaveTextContent(`Nível sugerido ${level}`)
    expect(card).toHaveTextContent(`Poder sugerido ${power}`)
    expect(card).toHaveTextContent(/~[\d.]+ XP\/h/)
  }
  expect(zone('Clareira')).toHaveTextContent('Rei Slime')
  expect(zone('Galerias')).toHaveTextContent('Rei Query')
  expect(zone('Clareira')).toHaveTextContent('0,8 XP por abate')
  expect(zone('Galerias')).toHaveTextContent('1,52 XP por abate')
})

it('pays a level 12 hero more xp an hour in the deep forest than in the clearing', () => {
  ui({ view: makeView({ level: 12 }) })
  const perHour = (name) => Number(zone(name).textContent.match(/~([\d.]+) XP\/h/)[1].replace(/\./g, ''))
  expect(perHour('Copas')).toBeGreaterThan(perHour('Clareira'))
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

it('offers no "hunt here": the hero hunts by walking into a zone', () => {
  ui()
  expect(screen.queryByRole('button', { name: 'Caçar aqui' })).toBeNull()
  expect(screen.getByText('Entre numa zona para caçar nela. Na cidade a caça para e paga.')).toBeVisible()
})

it('fights the bosses of the region the hero stands in, on the picked difficulty, and no others', async () => {
  const { actions } = ui({ view: makeView({ level: 3 }) })
  expect(within(zone('Galerias')).queryByRole('button', { name: 'Enfrentar chefe' })).toBeNull()
  expect(region('Caverna do SQL')).toHaveTextContent('Vá até esta região para enfrentar os chefes dela.')
  fireEvent.click(screen.getByRole('button', { name: 'Inferno' }))
  fireEvent.click(within(zone('Copas')).getByRole('button', { name: 'Enfrentar chefe' }))
  expect(actions.fightBoss).toHaveBeenCalledWith({ world: 'floresta-js', zone: 'z2', difficulty: 'inferno' })
})

it('marks a beaten boss and the zone being hunted', () => {
  const view = makeView({ hunt: HUNT })
  view.zones['floresta-js'].normal[0].beaten = true
  ui({ view })
  const clearing = zone('Clareira')
  expect(clearing).toHaveTextContent('Chefe vencido')
  expect(clearing).toHaveTextContent('Caçando aqui')
  expect(screen.getByText('Caçando em Floresta do JavaScript, Clareira (Normal)')).toBeVisible()
})

it('pauses the hunt in the zone the hero stands in', async () => {
  const { onPause } = ui({ view: makeView({ hunt: HUNT }) })
  fireEvent.click(screen.getByRole('button', { name: 'Pausar a caça aqui' }))
  await vi.waitFor(() => expect(onPause).toHaveBeenCalledTimes(1))
})

it('offers no pause for a hunt somewhere else, or one already paused', () => {
  ui({ view: makeView({ hunt: HUNT }), here: { world: 'laboratorio', zone: null } })
  expect(screen.queryByRole('button', { name: 'Pausar a caça aqui' })).toBeNull()
})

it('opens the harder difficulties at any level, with a strong warning', () => {
  ui({ view: makeView({ level: 3 }) })
  expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText(/mais fortes que no Normal/)).toBeNull()
  const nightmare = screen.getByRole('button', { name: 'Pesadelo' })
  expect(nightmare).toBeEnabled()
  fireEvent.click(nightmare)
  expect(nightmare).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText(/Pesadelo: inimigos 3,2x mais fortes que no Normal. Sugerido a partir do nível 25./)).toBeVisible()
  expect(screen.getByText(/Seu herói está no nível 3/)).toBeVisible()
  expect(zone('Clareira')).toHaveTextContent('Nível sugerido 25')
  fireEvent.click(screen.getByRole('button', { name: 'Inferno' }))
  expect(screen.getByText(/Inferno: inimigos 9x mais fortes que no Normal. Sugerido a partir do nível 40./)).toBeVisible()
})

it('holds every fight button while a boss fight plays', () => {
  ui({ replaying: true })
  const fight = within(zone('Clareira')).getByRole('button', { name: 'Enfrentar chefe' })
  expect(fight).toBeDisabled()
  expect(fight).toHaveAccessibleDescription('Luta em andamento')
})
