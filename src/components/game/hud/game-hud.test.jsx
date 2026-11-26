import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import GameHud from './game-hud.jsx'

// happy-dom has no canvas: the icons draw nothing here.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

const view = (over = {}) => ({
  hero: {
    potions: { hp: 4, mp: 2 },
    skills: { owned: { golpe: 1, raio: 2 }, loadout: ['golpe', 'raio', null, null] },
    hunt: null,
  },
  level: { level: 12, xp: 3400, into: 3400, needed: 7500 },
  stats: { hp: 1240, mana: 160 },
  power: 900,
  ...over,
})

const ui = (props, locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <GameHud view={view()} onFullscreen={() => {}} onKey={() => {}} {...props} />
    </I18nProvider>,
  )

it('exposes hp, mana and xp as progressbars', () => {
  ui({ live: { hp: 893, mana: 88 } })
  const hp = screen.getByRole('progressbar', { name: /Health/ })
  expect(hp).toHaveAttribute('aria-valuenow', '893')
  expect(hp).toHaveAttribute('aria-valuemin', '0')
  expect(hp).toHaveAttribute('aria-valuemax', '1240')
  expect(screen.getByRole('progressbar', { name: /Mana/ })).toHaveAttribute('aria-valuenow', '88')
  const xp = screen.getByRole('progressbar', { name: /XP/ })
  expect(xp).toHaveAttribute('aria-valuenow', '3400')
  expect(xp).toHaveAttribute('aria-valuemax', '7500')
})

it('formats numbers per locale', () => {
  ui({ live: { hp: 893, mana: 88 } }, 'pt-BR')
  expect(screen.getByText('Vida 893 / 1.240')).toBeInTheDocument()
})

it('defaults to full hp and mana without live data', () => {
  ui({})
  expect(screen.getByRole('progressbar', { name: /Health/ })).toHaveAttribute('aria-valuenow', '1240')
})

it('shows buffs with seconds', () => {
  ui({ live: { buffs: [{ id: 'veneno', icon: 'poison', seconds: 6, bad: true }] } })
  expect(screen.getByText('6s')).toBeInTheDocument()
})

it('shows the boss bar with phase and enrage', () => {
  ui({ boss: { name: 'Slime King', phase: 2, phases: 3, hp: 6320, maxHp: 10000, enrageSec: 42 } })
  expect(screen.getByText('Slime King')).toBeInTheDocument()
  expect(screen.getByText('Phase 2 of 3')).toBeInTheDocument()
  expect(screen.getByText('Enrage in 0:42')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: /Slime King/ })).toHaveAttribute('aria-valuenow', '6320')
})

it('locked difficulty chips show the min level', () => {
  ui({})
  expect(screen.getByText('Normal')).toBeInTheDocument()
  expect(screen.getByText('Lv 25')).toBeInTheDocument()
  expect(screen.getByText('Lv 40')).toBeInTheDocument()
})

it('opens difficulties the hero level reaches', () => {
  ui({ view: view({ level: { level: 30, xp: 0, into: 0, needed: 1 } }) })
  expect(screen.queryByText('Lv 25')).toBeNull()
  expect(screen.getByText('Lv 40')).toBeInTheDocument()
})

it('colors the hits the hero takes red and heals green', () => {
  ui({ log: [{ t: 1, who: 'enemy', type: 'hit', amount: 15 }, { t: 2, who: 'hero', type: 'heal', amount: 30 }] })
  const [hurt, heal] = within(screen.getByRole('log')).getAllByRole('listitem')
  expect(hurt).toHaveTextContent('You took 15')
  expect(hurt).toHaveAttribute('data-tone', 'bad')
  expect(heal).toHaveAttribute('data-tone', 'good')
})

it('keeps the combat log visible but silent for screen readers', () => {
  ui({ log: [{ t: 1, who: 'hero', type: 'hit', amount: 10 }] })
  expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'off')
})

it('keeps the last 5 log events', () => {
  const log = Array.from({ length: 7 }, (_, i) => ({ t: i, who: 'hero', type: 'hit', amount: 10 + i }))
  ui({ log })
  const lines = within(screen.getByRole('log')).getAllByRole('listitem')
  expect(lines).toHaveLength(5)
  expect(lines[4]).toHaveTextContent('16')
})

it('draws 4 skill slots and 2 potion slots with counts and cooldown', () => {
  ui({ live: { cooldowns: { raio: 4 } } })
  expect(screen.getByLabelText(/Health potion/)).toHaveTextContent('4')
  expect(screen.getByLabelText(/Mana potion/)).toHaveTextContent('2')
  expect(screen.getByLabelText(/Bolt/)).toHaveTextContent('4s')
  expect(screen.getAllByTestId('slot')).toHaveLength(6)
})

it('F calls onFullscreen and M, I, K call onKey', () => {
  const onFullscreen = vi.fn()
  const onKey = vi.fn()
  ui({ onFullscreen, onKey })
  fireEvent.keyDown(window, { key: 'f' })
  expect(onFullscreen).toHaveBeenCalledOnce()
  fireEvent.keyDown(window, { key: 'M' })
  fireEvent.keyDown(window, { key: 'i' })
  fireEvent.keyDown(window, { key: 'k' })
  expect(onKey.mock.calls.map((c) => c[0])).toEqual(['world', 'bag', 'tree'])
})

it('ignores keys typed in an input or with a modifier', () => {
  const onFullscreen = vi.fn()
  ui({ onFullscreen })
  const input = document.createElement('input')
  document.body.append(input)
  fireEvent.keyDown(input, { key: 'f' })
  fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
  expect(onFullscreen).not.toHaveBeenCalled()
  input.remove()
})

it('hides the fullscreen button when unsupported', () => {
  ui({ fullscreenSupported: false })
  expect(screen.queryByRole('button', { name: /fullscreen/i })).toBeNull()
})

it('fullscreen button works', () => {
  const onFullscreen = vi.fn()
  ui({ onFullscreen })
  fireEvent.click(screen.getByRole('button', { name: /fullscreen/i }))
  expect(onFullscreen).toHaveBeenCalledOnce()
})
