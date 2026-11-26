import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { FLORESTA_JS } from '../../../shared/world/maps/floresta-js.js'
import { I18nProvider } from '../../lib/i18n/I18nProvider.jsx'
import GameView, { stageOffset } from './game-view.jsx'
import { makeView } from './panel/fixtures.js'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

describe('stageOffset: the camera follows the hero', () => {
  const crop = { w: 16, h: 10 }
  it('slides the map so the hero sits in the middle, a bit high, clear of the skill bar', () => {
    const at = stageOffset(FLORESTA_JS, { x: 15.5, y: 9.5 }, crop)
    expect(at.left).toBeCloseTo((-(15.5 + 0.5 - 8) / 16) * 100)
    expect(at.top).toBeCloseTo((-(9.5 + 1 + 0.5 - 5) / 10) * 100)
  })
  it('stops at the map edges', () => {
    expect(stageOffset(FLORESTA_JS, { x: 0, y: 0 }, crop)).toEqual({ left: -0, top: -0 })
    const end = stageOffset(FLORESTA_JS, { x: 47, y: 31 }, crop)
    expect(end.left).toBeCloseTo((-(48 - 16) / 16) * 100)
    expect(end.top).toBeCloseTo((-(32 - 10) / 10) * 100)
  })
  it('snaps to whole art pixels so the pixel art stays crisp', () => {
    const at = stageOffset(FLORESTA_JS, { x: 10.013, y: 8.5 }, crop)
    const tiles = (-at.left / 100) * 16
    expect(Math.round(tiles * 16)).toBeCloseTo(tiles * 16, 6)
  })
})

function ui() {
  const view = makeView()
  const api = { syncGame: vi.fn(async () => view) }
  return render(
    <I18nProvider locale="pt-BR">
      <MemoryRouter>
        <GameView start={{ world: 'laboratorio', x: 16, y: 8 }} api={api} onSave={vi.fn()} studyHref="/daily" />
      </MemoryRouter>
    </I18nProvider>,
  )
}

describe('walking a region', () => {
  it('offers the pad on phones and says how to walk', async () => {
    ui()
    expect(await screen.findByRole('group', { name: /^(Andar|Walk)$/ })).toBeInTheDocument()
    expect(screen.getByText(/ande com as setas ou WASD/)).toBeInTheDocument()
    expect(screen.getByText(/Setas ou WASD para andar/)).toBeInTheDocument()
  })

  it('takes the arrows and WASD from the page, never from a text field', async () => {
    ui()
    await screen.findByRole('region', { name: /^Glitch World: / })
    const fromPage = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
    document.body.dispatchEvent(fromPage)
    expect(fromPage.defaultPrevented).toBe(true)
    const wasd = new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true })
    document.body.dispatchEvent(wasd)
    expect(wasd.defaultPrevented).toBe(true)
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true }))
    const field = document.createElement('input')
    document.body.append(field)
    const typed = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
    field.dispatchEvent(typed)
    expect(typed.defaultPrevented).toBe(false)
    field.remove()
  })
})
