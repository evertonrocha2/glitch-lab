import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { unlocks } from '../../../../shared/world/unlocks.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
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

function play(position, signals, { extra = null } = {}) {
  return render(
    <I18nProvider locale="pt-BR">
      <MemoryRouter initialEntries={['/mundo']}>
        <Routes>
          <Route path="*" element={<WorldGame state={stateAt(position, signals)} heroColor="cobalt" onSave={onSave} onWorldChange={onWorldChange} />} />
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
const tile = (container, x, y) => container.querySelector(`[data-x="${x}"][data-y="${y}"]`)
const location = () => screen.getByTestId('location').textContent

beforeEach(() => {
  vi.useFakeTimers()
  onSave = vi.fn().mockResolvedValue(undefined)
  onWorldChange = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
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
  play({ world: 'laboratorio', x: 9, y: 2 })
  tap('ArrowUp')
  expect(place()).toBe('laboratorio 9 1')
  expect(screen.getByText(/0 de 3 desafios de programação/)).toBeVisible()
  expect(screen.getByRole('link', { name: /estudar/i })).toHaveAttribute('href', '/daily')
  expect(onWorldChange).not.toHaveBeenCalled()
})

it('travels through a portal and saves right away', () => {
  play({ world: 'floresta-js', x: 2, y: 10 })
  tap('ArrowLeft')
  expect(place()).toBe('laboratorio 3 2')
  expect(onWorldChange).toHaveBeenCalledWith('laboratorio')
  expect(onSave).toHaveBeenCalledWith({ world: 'laboratorio', x: 3, y: 2 }, { keepalive: false })
  expect(screen.getByRole('status')).toHaveTextContent('Você entrou em Laboratório')
})

it('walks to a clicked tile and ignores a tile it cannot reach', () => {
  const { container } = play({ world: 'floresta-js', x: 3, y: 10 })
  fireEvent.click(tile(container, 5, 9))
  wait(STEP_MS * 4)
  expect(place()).toBe('floresta-js 5 9')
  fireEvent.click(tile(container, 13, 9)) // inside the locked zone 2
  wait(STEP_MS * 10)
  expect(place()).toBe('floresta-js 5 9')
})

it('walks next to a terminal when the terminal is clicked', () => {
  const { container } = play({ world: 'floresta-js', x: 3, y: 6 })
  expect(screen.queryByRole('button', { name: /glitchdle|daily|diários/i })).toBeNull()
  fireEvent.click(tile(container, 4, 4))
  wait(STEP_MS * 4)
  expect(['floresta-js 3 4', 'floresta-js 4 5', 'floresta-js 5 4']).toContain(place())
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
