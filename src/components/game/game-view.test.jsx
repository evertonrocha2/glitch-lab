import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../lib/i18n/I18nProvider.jsx'
import GameView from './game-view.jsx'
import { makeView } from './panel/fixtures.js'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

const AWAY = { elapsedMs: 2 * 3600_000 + 15 * 60_000, kills: 212, elites: 21, deaths: 0, gold: 3400, items: 4, gems: 0, scrap: 0 }
const CLAIMED = { fragments: 120, potions: 0, chests: [{ day: '2026-11-25', boost: 0 }], keys: 0, honor: 0 }
const HUNT = { world: 'floresta-js', zone: 'z1', difficulty: 'normal', startedAt: 0, claims: 0 }

function makeApi(view = makeView()) {
  const ok = () => vi.fn(async () => view)
  return {
    syncGame: ok(),
    startHunt: ok(),
    stopHunt: ok(),
    fightBoss: ok(),
    equipItem: ok(),
    unequipSlot: ok(),
    forgeUpgrade: ok(),
    forgeSalvage: ok(),
    forgeReroll: ok(),
    forgeSocket: ok(),
    openChest: ok(),
    buyPotions: ok(),
    allocateTalents: ok(),
    respecTalents: ok(),
    buySkill: ok(),
    upgradeSkill: ok(),
    saveLoadout: ok(),
  }
}

function ui(api, { locale = 'pt-BR', onLeave = vi.fn() } = {}) {
  return render(
    <I18nProvider locale={locale}>
      <MemoryRouter>
        <GameView worldId="floresta-js" api={api} onLeave={onLeave} studyHref="/daily" />
      </MemoryRouter>
    </I18nProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

it('syncs on mount and shows what happened while away', async () => {
  const api = makeApi()
  api.syncGame.mockResolvedValue({ ...makeView(), away: AWAY, studyClaimed: CLAIMED })
  ui(api)
  const dialog = await screen.findByRole('dialog', { name: 'Bem-vindo de volta' })
  expect(api.syncGame).toHaveBeenCalledTimes(1)
  expect(dialog).toHaveTextContent('Enquanto você estava fora: 212 inimigos, 3.400 de ouro, 4 itens')
  expect(dialog).toHaveTextContent('Do seu estudo: +120 fragmentos, 1 baú')
  expect(dialog).toHaveTextContent('Você ficou fora por 2 h 15 min.')
  fireEvent.click(within(dialog).getAllByRole('button', { name: 'Continuar' }).at(-1))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('shows no away dialog when nothing happened', async () => {
  const api = makeApi()
  ui(api)
  expect(await screen.findByRole('tablist')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('syncs again every 60 s while hunting and when the tab comes back', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const api = makeApi(makeView({ hunt: HUNT }))
  ui(api)
  await screen.findByRole('tablist')
  expect(api.syncGame).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(api.syncGame).toHaveBeenCalledTimes(2)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(api.syncGame).toHaveBeenCalledTimes(3)
})

it('does not poll when no hunt runs', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const api = makeApi()
  ui(api)
  await screen.findByRole('tablist')
  await act(() => vi.advanceTimersByTimeAsync(120_000))
  expect(api.syncGame).toHaveBeenCalledTimes(1)
})

it('says the hero changed in another tab on a 409, with a reload button', async () => {
  const api = makeApi()
  api.syncGame.mockRejectedValue(Object.assign(new Error('Your hero changed in another tab. Reload to continue.'), { status: 409, code: 'GAME_CONFLICT' }))
  ui(api)
  expect(await screen.findByText('Seu herói mudou em outra aba.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
})

it('applies the View an action returns', async () => {
  const api = makeApi(makeView({ gold: 500 }))
  api.startHunt.mockResolvedValue(makeView({ gold: 777, hunt: HUNT }))
  ui(api)
  fireEvent.click(await screen.findByRole('tab', { name: /Mundo/ }))
  const clearing = screen.getByRole('region', { name: /Clareira/ })
  fireEvent.click(within(clearing).getByRole('button', { name: 'Caçar aqui' }))
  expect(await screen.findByText('777')).toBeInTheDocument()
  expect(screen.getByText(/Caçando em Clareira \(Normal\)/)).toBeInTheDocument()
})

it('plays a boss fight back and then shows the result', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const before = makeView({ level: 6 })
  const after = makeView({ level: 6 })
  after.zones['floresta-js'].normal[0].beaten = true
  after.zones['floresta-js'].normal[1].unlocked = true
  const fight = {
    won: true,
    reason: 'killed',
    ms: 2000,
    heroHpLeft: 100,
    potionsUsed: { hp: 0, mp: 0 },
    log: [
      { t: 1000, who: 'hero', type: 'hit', amount: 700 },
      { t: 2000, who: 'hero', type: 'hit', amount: 600 },
      { t: 2000, who: 'enemy', type: 'death' },
    ],
    enemy: { id: 'rei-slime', sprite: 'rei-slime', element: 'poison', base: { hp: 1300 } },
    loot: { items: 1, gems: 1, scrap: 0, goldLost: 0 },
  }
  const api = makeApi(before)
  api.fightBoss.mockResolvedValue({ ...after, fight })
  ui(api)
  fireEvent.click(await screen.findByRole('tab', { name: /Mundo/ }))
  fireEvent.click(within(screen.getByRole('region', { name: /Clareira/ })).getByRole('button', { name: 'Enfrentar chefe' }))
  expect(await screen.findByText('Lutando contra Rei Slime')).toBeInTheDocument()
  expect(screen.queryByText('Rei Slime derrotado! Zona 2 aberta')).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(await screen.findByText('Rei Slime derrotado! Zona 2 aberta')).toBeInTheDocument()
  expect(screen.getByText('Prêmio: 1 item, 1 gema')).toBeInTheDocument()
})

it('says why a boss fight was lost, and the Inferno gold cost', async () => {
  const view = makeView({ level: 45 })
  const fight = {
    won: false,
    reason: 'enrage',
    ms: 1000,
    heroHpLeft: 0,
    potionsUsed: { hp: 0, mp: 0 },
    log: [{ t: 1000, who: 'enemy', type: 'enrage' }, { t: 1000, who: 'hero', type: 'death' }],
    enemy: { id: 'rei-slime', sprite: 'rei-slime', element: 'poison', base: { hp: 1300 } },
    loot: { items: 0, gems: 0, scrap: 0, goldLost: 50 },
  }
  const api = makeApi(view)
  api.fightBoss.mockResolvedValue({ ...view, fight })
  ui(api)
  fireEvent.click(await screen.findByRole('tab', { name: /Mundo/ }))
  fireEvent.click(within(screen.getByRole('region', { name: /Clareira/ })).getByRole('button', { name: 'Enfrentar chefe' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Pular luta' }))
  expect(await screen.findByText('Você perdeu: o chefe entrou em fúria. -10% de ouro (-50)')).toBeInTheDocument()
})

it('goes back to the Lab from the world tab', async () => {
  const api = makeApi(makeView({ hunt: HUNT }))
  const onLeave = vi.fn()
  ui(api, { onLeave })
  fireEvent.click(await screen.findByRole('tab', { name: /Mundo/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Laboratório' }))
  await vi.waitFor(() => expect(onLeave).toHaveBeenCalled())
  expect(api.stopHunt).toHaveBeenCalled()
})

it('offers fullscreen once the hero loaded, where the browser has it', async () => {
  HTMLElement.prototype.requestFullscreen = vi.fn(() => Promise.resolve())
  try {
    ui(makeApi())
    expect(await screen.findByRole('button', { name: 'Tela cheia (F)' })).toBeInTheDocument()
  } finally {
    delete HTMLElement.prototype.requestFullscreen
  }
})

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})
