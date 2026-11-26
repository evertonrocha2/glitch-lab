import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK, LOOK_OPTIONS, randomLook } from '../../../shared/game/look.js'
import { createRng } from '../../../shared/game/rng.js'
import { I18nProvider } from '../../lib/i18n/I18nProvider.jsx'
import LookDialog from './look-dialog.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

afterEach(() => {
  vi.restoreAllMocks()
})

const GEAR = { weapon: { b: 'sword', r: 'rare' } }

function ui(props = {}, locale = 'pt-BR') {
  const onSave = props.onSave ?? vi.fn(async () => ({}))
  const onClose = props.onClose ?? vi.fn()
  const onLater = props.onLater ?? vi.fn()
  render(
    <I18nProvider locale={locale}>
      <LookDialog look={DEFAULT_LOOK} gear={GEAR} first={false} {...props} onSave={onSave} onClose={onClose} onLater={onLater} />
    </I18nProvider>,
  )
  return { onSave, onClose, onLater }
}

const preview = () => screen.getByRole('img', { name: /^Seu herói/ })

it('first time: titled "Crie seu herói", offers Depois, and Escape does not close', () => {
  const { onClose } = ui({ first: true })
  const dialog = screen.getByRole('dialog', { name: 'Crie seu herói' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(within(dialog).getByRole('button', { name: 'Depois' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Cancelar' })).toBeNull()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
})

it('later: titled Aparência, no Depois, Escape closes', () => {
  const { onClose } = ui()
  const dialog = screen.getByRole('dialog', { name: 'Aparência' })
  expect(within(dialog).queryByRole('button', { name: 'Depois' })).toBeNull()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('has six labeled radio groups with one radio per option', () => {
  ui()
  const groups = {
    Pele: LOOK_OPTIONS.skin,
    Cabelo: LOOK_OPTIONS.hairStyle,
    'Cor do cabelo': LOOK_OPTIONS.hairColor,
    Olhos: LOOK_OPTIONS.eyeStyle,
    'Cor dos olhos': LOOK_OPTIONS.eyeColor,
    Roupa: LOOK_OPTIONS.outfit,
  }
  expect(screen.getAllByRole('radiogroup')).toHaveLength(6)
  for (const [name, count] of Object.entries(groups)) {
    const group = screen.getByRole('radiogroup', { name })
    expect(within(group).getAllByRole('radio')).toHaveLength(count)
    expect(within(group).getAllByRole('radio', { checked: true })).toHaveLength(1)
  }
  expect(within(screen.getByRole('radiogroup', { name: 'Cor do cabelo' })).getByRole('radio', { name: 'ruivo' })).toBeInTheDocument()
  expect(within(screen.getByRole('radiogroup', { name: 'Cabelo' })).getByRole('radio', { name: 'rabo de cavalo' })).toBeInTheDocument()
})

it('picking options updates the preview label', () => {
  ui()
  expect(preview()).toHaveAccessibleName('Seu herói: pele clara, cabelo curto castanho, olhos: redondo, cor dos olhos: castanho, roupa: azul')
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Cor do cabelo' })).getByRole('radio', { name: 'ruivo' }))
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Cabelo' })).getByRole('radio', { name: 'espetado' }))
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Roupa' })).getByRole('radio', { name: 'roxa' }))
  expect(preview()).toHaveAccessibleName('Seu herói: pele clara, cabelo espetado ruivo, olhos: redondo, cor dos olhos: castanho, roupa: roxa')
})

it('speaks English too', () => {
  ui({ first: true }, 'en')
  expect(screen.getByRole('dialog', { name: 'Create your hero' })).toBeInTheDocument()
  expect(
    screen.getByRole('img', {
      name: 'Your hero: light skin, short brown hair, round brown eyes, blue outfit',
    }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument()
})

it('Salvar sends the six fields and closes on success', async () => {
  const { onSave, onClose } = ui()
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Pele' })).getByRole('radio', { name: 'morena' }))
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Cor dos olhos' })).getByRole('radio', { name: 'violeta' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' })))
  expect(onSave).toHaveBeenCalledWith({
    ...DEFAULT_LOOK,
    skin: 2,
    eyeColor: 3,
  })
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('a failed save shows the error inline and stays open', async () => {
  const onSave = vi.fn(async () => {
    throw new Error('Sem conexão')
  })
  const { onClose } = ui({ onSave })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' })))
  expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão')
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('Depois hands back to onLater', () => {
  const { onLater, onSave } = ui({ first: true })
  fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
  expect(onLater).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

it('Aleatório rolls a random look from the clock', () => {
  vi.spyOn(Date, 'now').mockReturnValue(424242)
  ui()
  fireEvent.click(screen.getByRole('button', { name: 'Aleatório' }))
  const rolled = randomLook(createRng(424242))
  const radios = within(screen.getByRole('radiogroup', { name: 'Cor do cabelo' })).getAllByRole('radio')
  expect(radios[rolled.hairColor]).toBeChecked()
  const outfits = within(screen.getByRole('radiogroup', { name: 'Roupa' })).getAllByRole('radio')
  expect(outfits[rolled.outfit]).toBeChecked()
})

it('starts from the hero current look', () => {
  ui({ look: { ...DEFAULT_LOOK, hairColor: 5, eyeStyle: 2 } })
  expect(within(screen.getByRole('radiogroup', { name: 'Cor do cabelo' })).getByRole('radio', { name: 'azul' })).toBeChecked()
  expect(within(screen.getByRole('radiogroup', { name: 'Olhos' })).getByRole('radio', { name: 'determinado' })).toBeChecked()
})

it('the gear switch is on by default and toggles', () => {
  ui()
  const toggle = screen.getByRole('switch', { name: 'Com equipamento' })
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-checked', 'false')
})

it('hides the gear switch when nothing is equipped', () => {
  ui({ gear: {} })
  expect(screen.queryByRole('switch')).toBeNull()
})

it('moves focus in, keeps Tab inside, and gives focus back on close', () => {
  const opener = document.createElement('button')
  document.body.appendChild(opener)
  opener.focus()
  const view = render(
    <I18nProvider locale="pt-BR">
      <LookDialog look={DEFAULT_LOOK} gear={GEAR} first={false} onSave={vi.fn()} onClose={vi.fn()} onLater={vi.fn()} />
    </I18nProvider>,
  )
  const dialog = screen.getByRole('dialog')
  expect(dialog.contains(document.activeElement)).toBe(true)
  const save = screen.getByRole('button', { name: 'Salvar' })
  save.focus()
  fireEvent.keyDown(save, { key: 'Tab' })
  expect(dialog.contains(document.activeElement)).toBe(true)
  expect(document.activeElement).not.toBe(save)
  view.unmount()
  expect(document.activeElement).toBe(opener)
  opener.remove()
})

it('keeps its keys from the game shortcuts behind it', () => {
  const onWindowKey = vi.fn()
  window.addEventListener('keydown', onWindowKey)
  ui()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Salvar' }), {
    key: 'i',
  })
  window.removeEventListener('keydown', onWindowKey)
  expect(onWindowKey).not.toHaveBeenCalled()
})

it('first time: pressing on the backdrop keeps focus inside the creator', () => {
  ui({ first: true })
  const dialog = screen.getByRole('dialog', { name: 'Crie seu herói' })
  const backdrop = dialog.parentElement.firstElementChild
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  backdrop.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(dialog.contains(document.activeElement)).toBe(true)
})

it('pt-BR preview reads with each part named, so adjectives never clash with the noun', () => {
  ui({ look: { ...DEFAULT_LOOK, outfit: 1, eyeStyle: 1 } })
  expect(preview()).toHaveAccessibleName(/roupa: vermelha/)
  expect(preview()).toHaveAccessibleName(/olhos: brilho/)
})
