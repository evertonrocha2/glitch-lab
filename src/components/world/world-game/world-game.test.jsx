import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK } from '../../../../shared/game/look.js'
import { unlocks } from '../../../../shared/world/unlocks.js'
import { worldById } from '../../../../shared/world/worlds.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { cameraOn, cropFor } from '../hub-scene/hub-view.js'
import WorldGame, { SAVE_DELAY_MS, STEP_MS } from './world-game.jsx'

const signalsOf = ({ codeSolved = 0, ...areas } = {}) => ({
  enemCorrect: { linguagens: 0, humanas: 0, natureza: 0, matematica: 0, ...areas },
  codeSolved,
})
const stateAt = (position, signals = {}) => {
  const values = signalsOf(signals)
  return { ...unlocks(values), signals: values, position }
}

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

let onSave
let onWorldChange

function play(position, signals, { extra = null, locale = 'pt-BR' } = {}) {
  return render(
    <I18nProvider locale={locale}>
      <MemoryRouter initialEntries={['/mundo']}>
        <Routes>
          <Route path="*" element={<WorldGame state={stateAt(position, signals)} look={DEFAULT_LOOK} gear={{}} onSave={onSave} onWorldChange={onWorldChange} />} />
        </Routes>
        <Location />
        {extra}
      </MemoryRouter>
    </I18nProvider>,
  )
}

const map = () => screen.getByRole('application')
const place = () => map().dataset.place
const press = (key) => fireEvent.keyDown(map(), { key })
const tap = (key) => {
  press(key)
  fireEvent.keyUp(map(), { key })
}
const wait = (ms) => act(() => vi.advanceTimersByTime(ms))
// The map is a canvas: a tile is clicked at its middle, through the camera on the hero (far zoom on
// a wide stage, as a test has no matchMedia and no saved zoom). The picture is 10px a tile here.
const TILE = 10
const clickTile = (x, y) => {
  const [id, hx, hy] = place().split(' ')
  const world = worldById(id)
  const crop = cropFor(world, 'far', true)
  const camera = cameraOn(world, { x: Number(hx), y: Number(hy) }, crop)
  fireEvent.click(document.querySelector('canvas'), { clientX: (x + 0.5 - camera.x) * TILE, clientY: (y + 0.5 - camera.y) * TILE })
}
const location = () => screen.getByTestId('location').textContent

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom has no canvas: the scene draws nothing, the game around it plays as usual.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const width = (Number(this.getAttribute('width')) / 16) * TILE
    const height = (Number(this.getAttribute('height')) / 16) * TILE
    return { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }
  })
  onSave = vi.fn().mockResolvedValue(undefined)
  onWorldChange = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('walks one tile per arrow press and stops at walls', () => {
  play({ world: 'floresta-js', x: 3, y: 10 })
  map().focus()
  tap('ArrowUp')
  expect(place()).toBe('floresta-js 3 9')
  tap('ArrowUp') // (3,8) is a tree
  expect(place()).toBe('floresta-js 3 9')
  tap('d')
  expect(place()).toBe('floresta-js 4 9')
})

it('keeps walking while an arrow is held and stops on keyup', () => {
  play({ world: 'floresta-js', x: 3, y: 10 })
  press('ArrowRight')
  wait(STEP_MS * 2)
  expect(place()).toBe('floresta-js 6 10')
  fireEvent.keyUp(map(), { key: 'ArrowRight' })
  wait(STEP_MS * 5)
  expect(place()).toBe('floresta-js 6 10')
})

it('stops walking when the map loses focus', () => {
  play({ world: 'floresta-js', x: 3, y: 10 })
  press('ArrowRight')
  wait(STEP_MS * 2)
  fireEvent.blur(map())
  wait(STEP_MS * 5)
  expect(place()).toBe('floresta-js 6 10')
})

it('ignores keys typed into a text field and keys with a modifier', () => {
  play({ world: 'floresta-js', x: 3, y: 10 }, {}, { extra: <input aria-label="busca" /> })
  fireEvent.keyDown(screen.getByLabelText('busca'), { key: 'ArrowRight' })
  fireEvent.keyDown(map(), { key: 'ArrowRight', ctrlKey: true })
  wait(STEP_MS * 3)
  expect(place()).toBe('floresta-js 3 10')
})

it('refuses a locked door and says what to study', () => {
  play({ world: 'torre-matematica', x: 10, y: 10 }, { matematica: 12 })
  tap('ArrowRight')
  expect(place()).toBe('torre-matematica 10 10')
  const notice = screen.getByText(/12 de 15 acertos em Matemática/)
  expect(notice).toBeVisible()
  expect(screen.getByRole('link', { name: /estudar/i })).toHaveAttribute('href', '/exams/enem')
  expect(screen.getByRole('status')).toHaveTextContent(/12 de 15 acertos em Matemática/)
})

it('refuses the portal of a locked world and points to programming for the tech ones', () => {
  play({ world: 'laboratorio', x: 7, y: 2 })
  tap('ArrowUp')
  expect(place()).toBe('laboratorio 7 1')
  expect(screen.getByText(/0 de 3 desafios de programação/)).toBeVisible()
  expect(screen.getByRole('link', { name: /estudar/i })).toHaveAttribute('href', '/daily')
  expect(onWorldChange).not.toHaveBeenCalled()
})

it('travels through a portal and saves right away', () => {
  play({ world: 'floresta-js', x: 2, y: 10 })
  tap('ArrowLeft')
  expect(place()).toBe('laboratorio 2 2')
  expect(onWorldChange).toHaveBeenCalledWith('laboratorio')
  expect(onSave).toHaveBeenCalledWith({ world: 'laboratorio', x: 2, y: 2 }, { keepalive: false })
  expect(screen.getByRole('status')).toHaveTextContent('Você entrou em Laboratório')
})

it('walks to a clicked tile and ignores a tile it cannot reach', () => {
  play({ world: 'caverna-sql', x: 3, y: 10 }, { codeSolved: 3 })
  clickTile(5, 9)
  wait(STEP_MS * 4)
  expect(place()).toBe('caverna-sql 5 9')
  clickTile(13, 9) // inside the locked zone 2
  wait(STEP_MS * 10)
  expect(place()).toBe('caverna-sql 5 9')
})

it('walks next to a terminal when the terminal is clicked', () => {
  play({ world: 'floresta-js', x: 3, y: 9 })
  expect(screen.queryByRole('button', { name: /glitchdle|daily|diários/i })).toBeNull()
  clickTile(4, 6) // the Glitchdle terminal; (3,8) is a tree, so the way is round it
  wait(STEP_MS * 4)
  expect(place()).toBe('floresta-js 4 7')
  expect(screen.getByRole('button', { name: /abrir/i })).toBeVisible()
})

it('opens the topic practice from a terminal after saving', async () => {
  let finishSave
  onSave.mockReturnValue(new Promise((resolve) => (finishSave = resolve)))
  play({ world: 'torre-matematica', x: 2, y: 5 }, { matematica: 5 })
  expect(screen.getByRole('button', { name: /Aritmética e números/ })).toBeVisible()
  press('Enter')
  expect(onSave).toHaveBeenCalledWith({ world: 'torre-matematica', x: 2, y: 5 }, { keepalive: false })
  expect(location()).toBe('/mundo')
  await act(async () => finishSave())
  expect(location()).toBe('/exams/enem/aritmetica')
})

it('opens the topic practice even when saving fails', async () => {
  onSave.mockRejectedValue(new Error('offline'))
  play({ world: 'torre-matematica', x: 2, y: 5 }, { matematica: 5 })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Aritmética e números/ })))
  expect(location()).toBe('/exams/enem/aritmetica')
  expect(screen.queryByRole('alert')).toBeNull()
})

it('saves at most once every 5 seconds while walking, with the latest tile', () => {
  play({ world: 'floresta-js', x: 3, y: 10 })
  tap('ArrowRight')
  wait(1000)
  tap('ArrowRight')
  wait(SAVE_DELAY_MS - 1001)
  expect(onSave).not.toHaveBeenCalled()
  wait(1)
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave).toHaveBeenCalledWith({ world: 'floresta-js', x: 5, y: 10 }, { keepalive: false })
})

it('keeps playing when a save fails', async () => {
  onSave.mockRejectedValue(new Error('offline'))
  play({ world: 'floresta-js', x: 3, y: 10 })
  tap('ArrowRight')
  await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
  tap('ArrowRight')
  expect(place()).toBe('floresta-js 5 10')
  expect(screen.queryByRole('alert')).toBeNull()
})

it('saves the last tile with keepalive when it goes away mid-walk', () => {
  const { unmount } = play({ world: 'floresta-js', x: 3, y: 10 })
  tap('ArrowRight')
  unmount()
  expect(onSave).toHaveBeenCalledWith({ world: 'floresta-js', x: 4, y: 10 }, { keepalive: true })
})

it('does not save when nothing moved', () => {
  const { unmount } = play({ world: 'floresta-js', x: 3, y: 10 })
  wait(SAVE_DELAY_MS * 2)
  unmount()
  expect(onSave).not.toHaveBeenCalled()
})

it('moves with the on-screen pad', () => {
  play({ world: 'floresta-js', x: 3, y: 10 })
  const up = screen.getByRole('button', { name: 'Andar para cima' })
  fireEvent.pointerDown(up)
  expect(place()).toBe('floresta-js 3 9')
  fireEvent.pointerUp(up)
  wait(STEP_MS * 3)
  expect(place()).toBe('floresta-js 3 9')
  fireEvent.click(screen.getByRole('button', { name: 'Andar para baixo' })) // keyboard activation
  expect(place()).toBe('floresta-js 3 10')
})

it('tells screen readers how to play', () => {
  play({ world: 'floresta-js', x: 3, y: 10 })
  expect(map()).toHaveAccessibleName(/Floresta do JavaScript/)
  expect(map()).toHaveAccessibleDescription(/setas/i)
  expect(map()).toHaveAttribute('tabindex', '0')
})

it('opens a terminal once, even when Enter is pressed again while saving', async () => {
  let finishSave
  onSave.mockReturnValue(new Promise((resolve) => (finishSave = resolve)))
  play({ world: 'torre-matematica', x: 2, y: 5 }, { matematica: 5 })
  press('Enter')
  press('Enter')
  fireEvent.keyDown(map(), { key: 'Enter', repeat: true })
  expect(onSave).toHaveBeenCalledTimes(1)
  await act(async () => finishSave())
  expect(location()).toBe('/exams/enem/aritmetica')
})

it('stays where the player went when they leave before the save ends', async () => {
  let finishSave
  onSave.mockReturnValue(new Promise((resolve) => (finishSave = resolve)))
  render(
    <I18nProvider locale="pt-BR">
      <MemoryRouter initialEntries={['/mundo']}>
        <Routes>
          <Route path="/mundo" element={<WorldGame state={stateAt({ world: 'torre-matematica', x: 2, y: 5 }, { matematica: 5 })} look={DEFAULT_LOOK} gear={{}} onSave={onSave} onWorldChange={onWorldChange} />} />
          <Route path="*" element={null} />
        </Routes>
        <Location />
        <Link to="/progress">progresso</Link>
      </MemoryRouter>
    </I18nProvider>,
  )
  press('Enter')
  fireEvent.click(screen.getByRole('link', { name: 'progresso' }))
  expect(location()).toBe('/progress')
  await act(async () => finishSave())
  expect(location()).toBe('/progress')
})

it('walks past a portal on a click path instead of going through it', () => {
  play({ world: 'laboratorio', x: 5, y: 1 }, { codeSolved: 3 })
  clickTile(9, 1)
  wait(STEP_MS * 10)
  expect(place()).toBe('laboratorio 9 1')
  expect(onWorldChange).not.toHaveBeenCalled()
})

it('offers the terminal that was clicked, not its neighbor', () => {
  play({ world: 'torre-matematica', x: 4, y: 7 }, { matematica: 5 })
  clickTile(6, 6)
  wait(STEP_MS * 6)
  expect(screen.getByRole('button', { name: /Grandezas, medidas e escalas/ })).toBeVisible()
})

it('says what a locked door asks for when it is tapped, every time', () => {
  play({ world: 'caverna-sql', x: 5, y: 10 }, { codeSolved: 3 })
  clickTile(11, 10)
  wait(STEP_MS * 8)
  expect(place()).toBe('caverna-sql 10 10')
  expect(screen.getByRole('status')).toHaveTextContent(/3 de 8 desafios de programação/)
  tap('ArrowLeft')
  expect(screen.getByRole('status')).not.toHaveTextContent(/desafios/)
  tap('ArrowRight')
  clickTile(11, 10)
  expect(screen.getByRole('status')).toHaveTextContent(/3 de 8 desafios de programação/)
})

it('saves the last tile with keepalive when the tab closes mid-walk', () => {
  const { unmount } = play({ world: 'floresta-js', x: 3, y: 10 })
  tap('ArrowRight')
  window.dispatchEvent(new Event('pagehide'))
  expect(onSave).toHaveBeenCalledWith({ world: 'floresta-js', x: 4, y: 10 }, { keepalive: true })
  unmount()
  expect(onSave).toHaveBeenCalledTimes(1)
})

it('sends saves one after another, so an older one never lands last', async () => {
  let finishFirst
  onSave.mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
  play({ world: 'torre-matematica', x: 3, y: 5 }, { matematica: 5 })
  tap('ArrowLeft') // next to Aritmética
  wait(SAVE_DELAY_MS) // the walk's save starts and hangs
  expect(onSave).toHaveBeenCalledTimes(1)
  press('Enter')
  await act(async () => {})
  expect(onSave).toHaveBeenCalledTimes(1)
  await act(async () => finishFirst())
  expect(onSave).toHaveBeenCalledTimes(2)
  expect(location()).toBe('/exams/enem/aritmetica')
})

// ENEM only shows in the pt-BR UI: in English the hub draws the ENEM portals as floor.
it('hides the ENEM portals in English and shows them in Portuguese', () => {
  const allOpen = { linguagens: 99, humanas: 99, natureza: 99, matematica: 99, codeSolved: 99 }
  // The canvas lists where the portals it draws lead: the bottom ones go to jardim-natureza (7,8) and torre-matematica (12,8).
  const portals = (view) => view.container.querySelector('canvas').dataset.portals.split(' ')
  const english = play({ world: 'laboratorio', x: 10, y: 6 }, allOpen, { locale: 'en' })
  expect(portals(english)).not.toContain('torre-matematica')
  expect(portals(english)).not.toContain('jardim-natureza')
  expect(portals(english)).toContain('caverna-sql')
  english.unmount()
  const portuguese = play({ world: 'laboratorio', x: 10, y: 6 }, allOpen)
  expect(portals(portuguese)).toContain('torre-matematica')
  expect(portals(portuguese)).toContain('jardim-natureza')
})

it('walks over a hidden ENEM portal in English without going anywhere', () => {
  const allOpen = { linguagens: 99, humanas: 99, natureza: 99, matematica: 99, codeSolved: 99 }
  play({ world: 'laboratorio', x: 12, y: 7 }, allOpen, { locale: 'en' })
  tap('ArrowDown')
  expect(place()).toBe('laboratorio 12 8')
  expect(onWorldChange).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('')
})

it('zooms the camera with - and + and its buttons, remembered with the hunt\'s key', () => {
  play({ world: 'caverna-sql', x: 3, y: 10 }, { codeSolved: 3 })
  const canvas = () => document.querySelector('canvas')
  expect(canvas()).toHaveAttribute('width', String(24 * 16))
  press('+')
  expect(canvas()).toHaveAttribute('width', String(19 * 16))
  expect(localStorage.getItem('gd:game-zoom')).toBe('mid')
  fireEvent.click(screen.getByRole('button', { name: /Aproximar/ }))
  expect(canvas()).toHaveAttribute('width', String(15 * 16))
  expect(screen.getByRole('button', { name: /Aproximar/ })).toHaveAttribute('aria-disabled', 'true')
  press('-')
  fireEvent.click(screen.getByRole('button', { name: /Afastar/ }))
  expect(canvas()).toHaveAttribute('width', String(24 * 16))
  expect(localStorage.getItem('gd:game-zoom')).toBe('far')
  expect(place()).toBe('caverna-sql 3 10')
})

it('starts at the zoom the hunt left, and a click still lands on the tile under it', () => {
  localStorage.setItem('gd:game-zoom', 'near')
  play({ world: 'caverna-sql', x: 3, y: 10 }, { codeSolved: 3 })
  const canvas = document.querySelector('canvas')
  expect(canvas).toHaveAttribute('width', String(15 * 16))
  // 15x9 tiles with the camera at 0, 6: (5,9) is the 6th column, 4th row.
  fireEvent.click(canvas, { clientX: 5.5 * TILE, clientY: 3.5 * TILE })
  wait(STEP_MS * 4)
  expect(place()).toBe('caverna-sql 5 9')
})
