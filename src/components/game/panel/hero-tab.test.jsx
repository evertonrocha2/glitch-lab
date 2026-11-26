import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
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
  const bar = screen.getByRole('progressbar', { name: 'Your power' })
  expect(bar).toHaveAttribute('aria-valuenow', '79')
  expect(bar).toHaveAttribute('aria-valuemax', '130')
  expect(screen.getByText('Slime King asks for 130. You are 51 short.')).toBeInTheDocument()
})

it('scales the suggested power with the target difficulty', () => {
  const view = makeView({ level: 30 })
  ui({ view, target: { world: 'floresta-js', zone: 'z3', difficulty: 'pesadelo' } })
  expect(screen.getByRole('progressbar', { name: 'Your power' })).toHaveAttribute('aria-valuemax', String(Math.round(400 * 3.2)))
  expect(screen.getByText(/Undefined Hydra asks for approx\. 1,280\./)).toBeInTheDocument()
})

it('says the hero is ready when power reaches the boss', () => {
  const view = { ...makeView(), power: 150 }
  ui({ view })
  expect(screen.getByText('Ready to face Slime King (130 suggested).')).toBeInTheDocument()
  // valuenow never passes valuemax.
  expect(screen.getByRole('progressbar', { name: 'Your power' })).toHaveAttribute('aria-valuenow', '130')
})

it('lays out 8 slots with rarity borders', () => {
  ui()
  const doll = screen.getByRole('list', { name: 'Equipment' })
  expect(within(doll).getAllByRole('listitem')).toHaveLength(8)
  const helm = within(doll).getByRole('button', { name: /Helm: Compiler Hood/ })
  expect(helm).toHaveStyle({ borderColor: '#2f7ae0' })
  expect(within(doll).getByRole('button', { name: /Relic: Ancient Scroll/ })).toHaveStyle({ borderColor: '#8a8fa0' })
  expect(within(doll).getByRole('img', { name: 'Weapon: empty' })).toBeInTheDocument()
})

it('shows the stat grid', () => {
  ui()
  const stats = screen.getByRole('list', { name: 'Stats' })
  expect(within(stats).getByText('Attack')).toBeInTheDocument()
  expect(within(stats).getByText('Attack speed')).toBeInTheDocument()
  expect(within(stats).getByText('1/s')).toBeInTheDocument()
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

it('shows the study call to action with today and the next point', () => {
  ui({ studyHref: '/study' })
  const link = screen.getByRole('link', { name: /Study to get stronger/ })
  expect(link).toHaveAttribute('href', '/study')
  expect(within(link).getByText('Today: 14 correct answers.')).toBeInTheDocument()
  expect(within(link).getByText('6 more for the next tree point.')).toBeInTheDocument()
})

it('leaves a spot for the hero portrait', () => {
  ui({ portrait: <p>portrait here</p> })
  expect(screen.getByText('portrait here')).toBeInTheDocument()
})
