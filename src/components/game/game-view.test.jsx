import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
    socketSupport: ok(),
    unsocketSupport: ok(),
    buySkill: ok(),
    upgradeSkill: ok(),
    saveLoadout: ok(),
    saveLook: ok(),
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

it('opens the study page in a window over the game from the quest card, the game still there', async () => {
  const api = makeApi()
  ui(api)
  fireEvent.click(await screen.findByRole('button', { name: /Estudar pra ficar mais forte/ }))
  const study = screen.getByRole('region', { name: 'Estudo' })
  expect(study.querySelector('iframe')).toHaveAttribute('src', '/daily?embed=1')
  expect(screen.getByRole('tablist')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Cena da caça' })).toBeInTheDocument()
})

it('syncs every 20 s while the study window is open and once when it closes', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const api = makeApi()
  ui(api)
  fireEvent.click(await screen.findByRole('button', { name: /Estudar pra ficar mais forte/ }))
  expect(api.syncGame).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(20_000))
  expect(api.syncGame).toHaveBeenCalledTimes(2)
  await act(() => vi.advanceTimersByTimeAsync(20_000))
  expect(api.syncGame).toHaveBeenCalledTimes(3)
  // Minimized still counts as open: the page may still be answering.
  fireEvent.click(screen.getByRole('button', { name: 'Minimizar a janela de estudo' }))
  await act(() => vi.advanceTimersByTimeAsync(20_000))
  expect(api.syncGame).toHaveBeenCalledTimes(4)
  fireEvent.click(screen.getAllByRole('button', { name: 'Fechar a janela de estudo' }).at(-1))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(api.syncGame).toHaveBeenCalledTimes(5)
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(api.syncGame).toHaveBeenCalledTimes(5)
})

it('on a phone, opening study closes the panel drawer and brings the scene up above the sheet', async () => {
  window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })
  const scrolled = vi.fn()
  Element.prototype.scrollIntoView = scrolled
  try {
    const api = makeApi()
    ui(api)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir o painel' }))
    fireEvent.click(screen.getByRole('button', { name: /Estudar pra ficar mais forte/ }))
    expect(screen.getByRole('region', { name: 'Estudo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir o painel' })).toHaveAttribute('aria-expanded', 'false')
    expect(scrolled).toHaveBeenCalledWith({ block: 'start' })
  } finally {
    delete window.matchMedia
    delete Element.prototype.scrollIntoView
  }
})

it('offers more study from the away summary, in the study window', async () => {
  const api = makeApi()
  api.syncGame.mockResolvedValueOnce({ ...makeView(), studyClaimed: CLAIMED })
  ui(api)
  const dialog = await screen.findByRole('dialog', { name: 'Bem-vindo de volta' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Estudar mais' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: 'Estudo' }).querySelector('iframe')).toHaveAttribute('src', '/daily?embed=1')
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
  expect(screen.queryByText('Rei Slime derrotado!')).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  // Every zone is open from the start: a first win opens nothing.
  expect(await screen.findByText('Rei Slime derrotado!')).toBeInTheDocument()
  expect(screen.queryByText(/Zona 2 aberta|Zona 2 abre/)).toBeNull()
  expect(screen.getByText('Prêmio: 1 item, 1 gema')).toBeInTheDocument()
})

it('shows no "zonas à frente bloqueadas" sign, even for an answer that still marks zones locked', async () => {
  const view = makeView()
  for (const zone of view.zones['floresta-js'].normal.slice(1)) zone.unlocked = false
  ui(makeApi(view))
  expect(await screen.findByRole('region', { name: 'Cena da caça' })).toBeInTheDocument()
  expect(screen.queryByText('Zonas à frente bloqueadas')).toBeNull()
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

// A promise the test resolves by hand.
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const visible = () => act(async () => document.dispatchEvent(new Event('visibilitychange')))

it('runs overlapping syncs one after the other, and queues only one more', async () => {
  const api = makeApi()
  const first = deferred()
  api.syncGame.mockImplementationOnce(() => first.promise)
  ui(api)
  await visible()
  await visible()
  expect(api.syncGame).toHaveBeenCalledTimes(1)
  await act(async () => first.resolve(makeView()))
  await vi.waitFor(() => expect(api.syncGame).toHaveBeenCalledTimes(2))
  await screen.findByRole('tablist')
  expect(api.syncGame).toHaveBeenCalledTimes(2)
})

it('never runs two server calls at once, even under StrictMode', async () => {
  const api = makeApi()
  let running = 0
  let most = 0
  api.syncGame.mockImplementation(async () => {
    running++
    most = Math.max(most, running)
    await new Promise((done) => setTimeout(done, 5))
    running--
    return makeView()
  })
  render(
    <StrictMode>
      <I18nProvider locale="pt-BR">
        <MemoryRouter>
          <GameView worldId="floresta-js" api={api} onLeave={vi.fn()} studyHref="/daily" />
        </MemoryRouter>
      </I18nProvider>
    </StrictMode>,
  )
  await screen.findByRole('tablist')
  await new Promise((done) => setTimeout(done, 30))
  expect(most).toBe(1)
  expect(screen.queryByText('Seu herói mudou em outra aba.')).toBeNull()
})

it('applies a sync queued behind an action after the action', async () => {
  const api = makeApi(makeView({ gold: 500 }))
  const hunt = deferred()
  api.startHunt.mockImplementationOnce(() => hunt.promise)
  ui(api)
  fireEvent.click(await screen.findByRole('tab', { name: /Mundo/ }))
  fireEvent.click(within(screen.getByRole('region', { name: /Clareira/ })).getByRole('button', { name: 'Caçar aqui' }))
  api.syncGame.mockResolvedValue(makeView({ gold: 900, hunt: HUNT }))
  await visible()
  expect(api.syncGame).toHaveBeenCalledTimes(1)
  await act(async () => hunt.resolve(makeView({ gold: 777, hunt: HUNT })))
  await vi.waitFor(() => expect(api.syncGame).toHaveBeenCalledTimes(2))
  expect(await screen.findByText('900')).toBeInTheDocument()
  expect(screen.queryByText('777')).toBeNull()
})

it('skips the minute sync while the tab is hidden', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const api = makeApi(makeView({ hunt: HUNT }))
  ui(api)
  await screen.findByRole('tablist')
  Object.defineProperty(document, 'hidden', { value: true, configurable: true })
  try {
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(api.syncGame).toHaveBeenCalledTimes(1)
  } finally {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  }
})

describe('the character creator', () => {
  const fresh = (view = makeView()) => ({ ...view, hero: { ...view.hero, lookSet: false } })

  it('opens by itself when the hero never picked a look', async () => {
    ui(makeApi(fresh()))
    const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
    expect(within(dialog).getAllByRole('radiogroup')).toHaveLength(6)
  })

  it('stays closed when the look is already set', async () => {
    ui(makeApi())
    await screen.findByRole('tablist')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Depois saves the current look, closes, and does not come back on the next sync', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const api = makeApi(fresh(makeView({ hunt: HUNT })))
    api.saveLook.mockResolvedValue(makeView({ hunt: HUNT }))
    ui(api)
    const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Depois' })))
    expect(api.saveLook).toHaveBeenCalledWith({ skin: 0, hairStyle: 0, hairColor: 0, eyeStyle: 0, eyeColor: 0, outfit: 0 })
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(api.syncGame).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Salvar sends the six fields and closes', async () => {
    const api = makeApi(fresh())
    ui(api)
    const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
    fireEvent.click(within(within(dialog).getByRole('radiogroup', { name: 'Roupa' })).getByRole('radio', { name: 'laranja' }))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' })))
    expect(api.saveLook).toHaveBeenCalledWith({ skin: 0, hairStyle: 0, hairColor: 0, eyeStyle: 0, eyeColor: 0, outfit: 6 })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens from the Aparência button and Escape closes it', async () => {
    ui(makeApi())
    fireEvent.click(await screen.findByRole('button', { name: 'Aparência' }))
    const dialog = screen.getByRole('dialog', { name: 'Aparência' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the away summary after the creator, not over it', async () => {
    const api = makeApi(fresh())
    api.syncGame.mockResolvedValue({ ...fresh(), away: AWAY })
    ui(api)
    const dialog = await screen.findByRole('dialog', { name: 'Crie seu herói' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Depois' })))
    expect(screen.getByRole('dialog', { name: 'Bem-vindo de volta' })).toBeInTheDocument()
  })
})

describe('on a phone', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    delete window.matchMedia
  })

  it('docks the panel at the bottom and tells the page its height while mounted', async () => {
    const view = ui(makeApi())
    await screen.findByRole('button', { name: 'Abrir o painel' })
    expect(document.documentElement.style.getPropertyValue('--dock-h')).toMatch(/px$/)
    view.unmount()
    expect(document.documentElement.style.getPropertyValue('--dock-h')).toBe('')
  })

  it('opens the drawer on a tab, focuses that tab, and closes on Escape', async () => {
    ui(makeApi())
    fireEvent.click(await screen.findByRole('button', { name: 'Bolsa' }))
    const tab = screen.getByRole('tab', { name: /Bolsa/ })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    await vi.waitFor(() => expect(tab).toHaveFocus())
    fireEvent.keyDown(tab, { key: 'Escape' })
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir o painel' })).toHaveAttribute('aria-expanded', 'false')
  })
})

it('starts the camera far out, zooms in from the HUD and remembers the level', async () => {
  window.localStorage.removeItem('gd:game-zoom')
  const first = ui(makeApi())
  const scene = await screen.findByRole('region', { name: 'Cena da caça' })
  const farAspect = scene.style.aspectRatio
  fireEvent.click(screen.getByRole('button', { name: 'Aproximar câmera (+)' }))
  expect(scene.style.aspectRatio).not.toBe(farAspect)
  expect(window.localStorage.getItem('gd:game-zoom')).toBe('mid')
  first.unmount()

  ui(makeApi())
  const again = await screen.findByRole('region', { name: 'Cena da caça' })
  expect(again.style.aspectRatio).not.toBe(farAspect)
  window.localStorage.removeItem('gd:game-zoom')
})
