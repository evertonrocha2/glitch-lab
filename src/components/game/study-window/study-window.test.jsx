import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { STUDY_FRAME_NAME } from '../../../app/embed.js'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { STORE_KEY } from './geometry.js'
import { StudyWindowProvider, useStudyWindow } from './study-window-provider.jsx'

let wide = true

beforeEach(() => {
  wide = true
  window.innerWidth = 1440
  window.innerHeight = 900
  window.matchMedia = (query) => ({ matches: wide, media: query, addEventListener() {}, removeEventListener() {} })
})

afterEach(() => {
  delete window.matchMedia
})

function Opener({ href }) {
  const study = useStudyWindow()
  return (
    <>
      <button type="button" onClick={() => study.open(href)}>
        Estudar
      </button>
      <output data-testid="open">{String(study.isOpen)}</output>
    </>
  )
}

function ui({ href = '/daily', locale = 'pt-BR', nested = false } = {}) {
  const opener = <Opener href={href} />
  return render(
    <I18nProvider locale={locale}>
      <StudyWindowProvider>{nested ? <StudyWindowProvider>{opener}</StudyWindowProvider> : opener}</StudyWindowProvider>
    </I18nProvider>,
  )
}

// The window is a named region; minimized it is hidden, so it is found by its label.
const win = () => document.querySelector('section[aria-label="Estudo"], section[aria-label="Study"]')
const frame = () => win().querySelector('iframe')
const moveBar = () => screen.getByRole('button', { name: 'Mover a janela de estudo (setas)' })
const at = () => ({ x: Number.parseInt(win().style.left, 10), y: Number.parseInt(win().style.top, 10), w: Number.parseInt(win().style.width, 10), h: Number.parseInt(win().style.height, 10) })

function openIt(options) {
  ui(options)
  const button = screen.getByRole('button', { name: 'Estudar' })
  button.focus()
  fireEvent.click(button)
}

it('opens the study page over the game, embedded, and puts focus on its title bar', () => {
  openIt()
  expect(screen.getByRole('region', { name: 'Estudo' })).toBe(win())
  expect(win()).toBeVisible()
  expect(frame()).toHaveAttribute('src', '/daily?embed=1')
  expect(frame()).toHaveAttribute('name', STUDY_FRAME_NAME)
  expect(frame()).toHaveAttribute('title', 'Página de estudo: Diário')
  expect(moveBar()).toHaveFocus()
  expect(screen.getByTestId('open')).toHaveTextContent('true')
  // Not a modal: the game's keys and clicks keep working behind it.
  expect(document.querySelector('[aria-modal="true"]')).toBeNull()
})

it('drags by the title bar and remembers where it was left', () => {
  openIt()
  const start = at()
  fireEvent.pointerDown(moveBar(), { button: 0, clientX: 1000, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(moveBar(), { clientX: 700, clientY: 60, pointerId: 1 })
  fireEvent.pointerUp(moveBar(), { clientX: 700, clientY: 60, pointerId: 1 })
  expect(at()).toEqual({ ...start, x: start.x - 300, y: start.y - 40 })
  expect(JSON.parse(localStorage.getItem(STORE_KEY))).toEqual(at())
})

it('moves with the arrow keys while its title bar has focus, and those keys never reach the game', () => {
  const gameKeys = vi.fn()
  window.addEventListener('keydown', gameKeys)
  openIt()
  const start = at()
  fireEvent.keyDown(moveBar(), { key: 'ArrowLeft' })
  fireEvent.keyDown(moveBar(), { key: 'ArrowLeft', shiftKey: true })
  fireEvent.keyDown(moveBar(), { key: 'ArrowUp' })
  fireEvent.keyDown(moveBar(), { key: 'f' })
  expect(at()).toEqual({ ...start, x: start.x - 80, y: start.y - 16 })
  expect(gameKeys).not.toHaveBeenCalled()
  window.removeEventListener('keydown', gameKeys)
})

it('resizes from its corner, never under the minimum', () => {
  openIt()
  const start = at()
  const corner = screen.getByRole('button', { name: 'Redimensionar a janela de estudo (setas)' })
  fireEvent.pointerDown(corner, { button: 0, clientX: 500, clientY: 500, pointerId: 2 })
  fireEvent.pointerMove(corner, { clientX: 460, clientY: 450, pointerId: 2 })
  fireEvent.pointerUp(corner, { pointerId: 2 })
  expect(at()).toEqual({ ...start, w: start.w - 40, h: start.h - 50 })
  fireEvent.pointerDown(corner, { button: 0, clientX: 500, clientY: 500, pointerId: 3 })
  fireEvent.pointerMove(corner, { clientX: -2000, clientY: -2000, pointerId: 3 })
  fireEvent.pointerUp(corner, { pointerId: 3 })
  expect(at()).toMatchObject({ w: 340, h: 300 })
})

it('Escape minimizes to a pill that keeps the page loaded, and the pill brings it back', () => {
  openIt()
  const page = frame()
  fireEvent.keyDown(moveBar(), { key: 'Escape' })
  expect(win()).not.toBeVisible()
  expect(page).toBeInTheDocument()
  const pill = screen.getByRole('button', { name: 'Abrir a janela de estudo' })
  expect(pill).toHaveFocus()
  expect(screen.getByTestId('open')).toHaveTextContent('true')

  fireEvent.click(pill)
  expect(win()).toBeVisible()
  expect(frame()).toBe(page)
  expect(moveBar()).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'Abrir a janela de estudo' })).toBeNull()
})

it('the minimize button does the same', () => {
  openIt()
  fireEvent.click(within(win()).getByRole('button', { name: 'Minimizar a janela de estudo' }))
  expect(win()).not.toBeVisible()
})

it('closes and gives focus back to what opened it', () => {
  openIt()
  fireEvent.click(within(win()).getByRole('button', { name: 'Fechar a janela de estudo' }))
  expect(win()).toBeNull()
  expect(screen.getByRole('button', { name: 'Estudar' })).toHaveFocus()
  expect(screen.getByTestId('open')).toHaveTextContent('false')
})

it('switches among the pages that give acertos, ENEM only in pt-BR', () => {
  openIt()
  const pick = screen.getByRole('combobox', { name: 'Página de estudo' })
  expect(pick).toHaveValue('/daily')
  expect(within(pick).getAllByRole('option').map((option) => option.textContent)).toEqual(['Diário', 'Caça à linha', 'ENEM', 'Board', 'Glitchdle', 'Duelo'])
  fireEvent.change(pick, { target: { value: '/hunt' } })
  expect(frame()).toHaveAttribute('src', '/hunt?embed=1')
})

it('leaves ENEM out of the English switcher and names a page it does not list', () => {
  openIt({ locale: 'en', href: '/gym/abc' })
  const pick = screen.getByRole('combobox', { name: 'Study page' })
  expect(within(pick).getAllByRole('option').map((option) => option.textContent)).toEqual(['This page', 'Daily', 'Line hunt', 'Board', 'Glitchdle', 'Duel'])
  expect(pick).toHaveValue('/gym/abc')
  expect(frame()).toHaveAttribute('src', '/gym/abc?embed=1')
})

it('opens where it was left, pulled back inside a smaller screen, and follows the screen when it shrinks', () => {
  localStorage.setItem(STORE_KEY, JSON.stringify({ x: 5000, y: 20, w: 500, h: 600 }))
  openIt()
  expect(at()).toEqual({ x: 1440 - 500 - 8, y: 20, w: 500, h: 600 })
  act(() => {
    window.innerWidth = 1100
    window.innerHeight = 640
    window.dispatchEvent(new Event('resize'))
  })
  expect(at()).toEqual({ x: 1100 - 500 - 8, y: 20, w: 500, h: 600 })
})

it('is a bottom sheet with a handle on a phone, with no dragging', () => {
  wide = false
  window.innerWidth = 390
  window.innerHeight = 844
  openIt()
  expect(win()).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Mover a janela de estudo (setas)' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Redimensionar a janela de estudo (setas)' })).toBeNull()
  const handle = screen.getByRole('button', { name: 'Minimizar a janela de estudo' })
  expect(handle).toHaveFocus()
  fireEvent.click(handle)
  expect(win()).not.toBeVisible()
})

it('a provider inside another one uses the outer window, so there is only ever one', () => {
  openIt({ nested: true })
  expect(document.querySelectorAll('section[aria-label="Estudo"]')).toHaveLength(1)
})

it('is null without a provider, so a study link can stay a plain link', () => {
  let study
  function Probe() {
    study = useStudyWindow()
    return null
  }
  render(<Probe />)
  expect(study).toBeNull()
})
