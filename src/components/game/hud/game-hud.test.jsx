import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { RARITY_TRIM } from '../ui/tokens.js'
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
    look: { skin: 2, hairStyle: 1, hairColor: 3, eyeStyle: 0, eyeColor: 1, outfit: 2 },
    items: [],
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

it('exposes hp, mana and xp as meters with the numbers inside', () => {
  ui({ live: { hp: 893, mana: 88 } })
  const hp = screen.getByRole('meter', { name: /Health/ })
  expect(hp).toHaveAttribute('aria-valuenow', '893')
  expect(hp).toHaveAttribute('aria-valuemin', '0')
  expect(hp).toHaveAttribute('aria-valuemax', '1240')
  expect(hp).toHaveTextContent('893 / 1,240')
  expect(screen.getByRole('meter', { name: /Mana/ })).toHaveAttribute('aria-valuenow', '88')
  const xp = screen.getByRole('meter', { name: /XP/ })
  expect(xp).toHaveAttribute('aria-valuenow', '3400')
  expect(xp).toHaveAttribute('aria-valuemax', '7500')
})

it('formats numbers per locale', () => {
  ui({ live: { hp: 893, mana: 88 } }, 'pt-BR')
  expect(screen.getByRole('meter', { name: 'Vida' })).toHaveTextContent('893 / 1.240')
})

it('defaults to full hp and mana without live data', () => {
  ui({})
  expect(screen.getByRole('meter', { name: /Health/ })).toHaveAttribute('aria-valuenow', '1240')
})

it('shows the hero face as a labeled portrait with the level badge', () => {
  ui({})
  const face = screen.getByRole('img', { name: 'Your hero' })
  expect(face.tagName).toBe('CANVAS')
  // The head crop at scale 2: 24 art pixels -> 48 canvas pixels.
  expect(face).toHaveAttribute('width', '48')
  expect(screen.getByText('Level 12')).toBeInTheDocument()
  expect(screen.getByTestId('level-badge')).toHaveTextContent('12')
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
  expect(screen.getByRole('meter', { name: /Slime King/ })).toHaveAttribute('aria-valuenow', '6320')
})

it('shows the suggested level of a harder difficulty as advice, never as a lock', () => {
  ui({})
  expect(screen.getByText('Normal')).toBeInTheDocument()
  expect(screen.getByText('Lv 25')).toBeInTheDocument()
  expect(screen.getByText('Lv 40')).toBeInTheDocument()
  const list = screen.getByRole('list', { name: /difficult/i })
  expect(list).not.toHaveTextContent(/locked/i)
  expect(within(list).getByRole('listitem', { name: 'Nightmare, suggested from level 25' })).toBeInTheDocument()
})

it('drops the suggested level once the hero reaches it', () => {
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

it('colors crits gold, hits dealt light and loot in its rarity trim', () => {
  ui({
    log: [
      { t: 1, who: 'hero', type: 'hit', amount: 10 },
      { t: 2, who: 'hero', type: 'crit', amount: 25 },
      { t: 3, who: 'hero', type: 'skill', skill: 'raio', amount: 40, crit: true },
      { t: 4, who: 'hero', type: 'loot', rarity: 'epic' },
    ],
  })
  const [hit, crit, skillCrit, loot] = within(screen.getByRole('log')).getAllByRole('listitem')
  expect(hit).toHaveAttribute('data-tone', 'dealt')
  expect(crit).toHaveAttribute('data-tone', 'crit')
  expect(crit.className).toContain('gw-log-crit')
  expect(skillCrit).toHaveAttribute('data-tone', 'crit')
  expect(loot).toHaveAttribute('data-tone', 'loot')
  expect(loot).toHaveAttribute('data-rarity', 'epic')
  expect(loot).toHaveStyle({ color: RARITY_TRIM.epic })
})

it('says what fragments a fallen enemy dropped, in fragment purple', () => {
  ui({ log: [{ t: 1, who: 'enemy', type: 'death', src: 0 }, { t: 1, who: 'enemy', type: 'fragment', src: 0, amount: 2 }] }, 'pt-BR')
  const lines = within(screen.getByRole('log')).getAllByRole('listitem')
  expect(lines.at(-1)).toHaveTextContent('Fragmentos: +2')
  expect(lines.at(-1)).toHaveAttribute('data-tone', 'fragment')
})

it('fades the older log lines, the newest stays full', () => {
  const log = Array.from({ length: 5 }, (_, i) => ({ t: i, who: 'hero', type: 'hit', amount: 10 + i }))
  ui({ log })
  const lines = within(screen.getByRole('log')).getAllByRole('listitem')
  const alpha = lines.map((li) => Number(li.style.opacity || 1))
  expect(alpha[4]).toBe(1)
  for (let i = 1; i < alpha.length; i++) expect(alpha[i]).toBeGreaterThan(alpha[i - 1])
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

it('marks each slot with its key chip and the empty ones with a plus', () => {
  ui({})
  const slots = screen.getAllByTestId('slot')
  expect(slots.map((s) => s.querySelector('kbd')?.textContent)).toEqual(['1', '2', '3', '4', '5', '6'])
  expect(slots.filter((s) => s.hasAttribute('data-empty'))).toHaveLength(2)
  expect(screen.getAllByLabelText('Empty skill slot')).toHaveLength(2)
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

it('zoom buttons and the - and + keys step the camera out and in, and stop at the ends', () => {
  const onZoom = vi.fn()
  const { rerender } = ui({ onZoom, zoom: 'mid' })
  fireEvent.click(screen.getByRole('button', { name: 'Zoom out (-)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in (+)' }))
  fireEvent.keyDown(window, { key: '-' })
  fireEvent.keyDown(window, { key: '=' })
  fireEvent.keyDown(window, { key: '+' })
  expect(onZoom.mock.calls.map(([step]) => step)).toEqual([-1, 1, -1, 1, 1])

  rerender(
    <I18nProvider locale="en">
      <GameHud view={view()} onZoom={onZoom} zoom="far" />
    </I18nProvider>,
  )
  // aria-disabled, not disabled: a focused button that turns disabled would drop keyboard focus.
  const out = screen.getByRole('button', { name: 'Zoom out (-)' })
  expect(out).toHaveAttribute('aria-disabled', 'true')
  expect(out).toBeEnabled()
  onZoom.mockClear()
  fireEvent.click(out)
  expect(onZoom).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Zoom in (+)' })).toHaveAttribute('aria-disabled', 'false')
})

it('hides the zoom buttons without onZoom', () => {
  ui({})
  expect(screen.queryByRole('button', { name: 'Zoom out (-)' })).toBeNull()
})

it('ignores its shortcuts while a modal dialog is open', () => {
  const onZoom = vi.fn()
  const onFullscreen = vi.fn()
  const onKey = vi.fn()
  ui({ onZoom, onFullscreen, onKey })
  const modal = document.createElement('div')
  modal.setAttribute('aria-modal', 'true')
  document.body.append(modal)
  try {
    for (const key of ['f', '-', '+', 'm', 'i', 'k']) fireEvent.keyDown(window, { key })
    expect(onZoom).not.toHaveBeenCalled()
    expect(onFullscreen).not.toHaveBeenCalled()
    expect(onKey).not.toHaveBeenCalled()
  } finally {
    modal.remove()
  }
})

const studyView = (correct, xpMultiplier) => view({ study: { today: { correct, toNextPoint: 2 }, xpMultiplier } })

it('shows the study XP buff next to the unit frame, with what it is and where it comes from', () => {
  ui({ view: studyView(8, 1.8) })
  const buff = screen.getByRole('note', { name: /XP x1\.8/ })
  expect(buff).toHaveTextContent('XP x1.8')
  expect(buff).toHaveAttribute('data-active', 'true')
  expect(buff.getAttribute('aria-label')).toMatch(/8 correct answers today/)
  // The tooltip says the same for the mouse.
  expect(buff).toHaveAttribute('title', buff.getAttribute('aria-label'))
})

it('shows x1.0 muted with a hint to study, so players learn the buff exists', () => {
  ui({ view: studyView(0, 1) })
  const buff = screen.getByRole('note', { name: /XP x1\.0/ })
  expect(buff).toHaveTextContent('XP x1.0')
  expect(buff).toHaveAttribute('data-active', 'false')
  expect(buff.getAttribute('aria-label')).toMatch(/Study/)
  expect(buff.getAttribute('aria-label')).toMatch(/x3/)
})

it('says when the buff is at its max', () => {
  ui({ view: studyView(25, 3) })
  expect(screen.getByRole('note', { name: /max/ })).toHaveTextContent('XP x3.0')
})

it('formats the multiplier per locale', () => {
  ui({ view: studyView(8, 1.8) }, 'pt-BR')
  expect(screen.getByRole('note', { name: /x1,8/ })).toHaveTextContent('XP x1,8')
})

it('reads a View without study as x1.0', () => {
  ui({})
  expect(screen.getByRole('note', { name: /XP x1\.0/ })).toHaveAttribute('data-active', 'false')
})

it('names the talent and support log lines instead of printing their ids', () => {
  const log = [
    { who: 'hero', type: 'skill', skill: 'critBlast', amount: 10 },
    { who: 'hero', type: 'skill', skill: 'rethrow', amount: 11 },
    { who: 'hero', type: 'heal', skill: 'vampiro', amount: 12 },
    { who: 'hero', type: 'skill', skill: 'bugSplash', amount: 13 },
  ]
  ui({ log })
  const text = screen.getByRole('log').textContent
  expect(text).toMatch(/Fatal Exception/)
  expect(text).toMatch(/Rethrow/)
  expect(text).toMatch(/Life Leech/)
  expect(text).toMatch(/Bug Splash/)
  expect(text).not.toMatch(/critBlast|rethrow|vampiro|bugSplash/)
})

it('shows each active elixir as a buff chip next to the study buff, its countdown in the tooltip', async () => {
  const { act } = await import('@testing-library/react')
  vi.useFakeTimers({ now: new Date('2026-11-26T12:00:00Z'), toFake: ['Date', 'setInterval', 'clearInterval'] })
  try {
    const now = Date.now()
    const hero = { ...view().hero, elixirs: { damage: { startedAt: now - 1000, expiresAt: now + 125_000 }, xp: { startedAt: 0, expiresAt: now - 5 } } }
    ui({ view: view({ hero }) })
    const chips = within(screen.getByRole('list', { name: 'Elixirs' })).getAllByRole('listitem')
    expect(chips).toHaveLength(1)
    const chip = within(chips[0]).getByRole('note')
    expect(chip).toHaveAttribute('aria-label', 'Fury elixir: +20% damage, 2:05 left')
    expect(chip).toHaveAttribute('title', 'Fury elixir: +20% damage, 2:05 left')
    act(() => vi.advanceTimersByTime(5000))
    expect(chip).toHaveAttribute('title', 'Fury elixir: +20% damage, 2:00 left')
  } finally {
    vi.useRealTimers()
  }
})

it('shows no elixir chips without an active elixir', () => {
  ui()
  expect(screen.queryByRole('list', { name: 'Elixirs' })).toBeNull()
})
