import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { gem, legendarySword, makeActions, makeView, plainRing } from './fixtures.js'
import GamePanel from './game-panel.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

const support = { id: 'bbbbbbbbbbb1', kind: 'support', support: 'fogo' }

function Harness({ view, actions, start }) {
  const [tab, setTab] = useState(start)
  return <GamePanel view={view} tab={tab} onTab={setTab} actions={actions} />
}

const ui = ({ tab = 'bag', locale = 'en' } = {}) => {
  const view = makeView({ items: [support, gem, legendarySword, plainRing] })
  render(
    <I18nProvider locale={locale}>
      <Harness view={view} actions={makeActions(vi, view)} start={tab} />
    </I18nProvider>,
  )
}

const cell = () => screen.getByRole('button', { name: 'Added Fire' })

it('lists a support gem in the bag after the gear and the gems, named', () => {
  ui()
  const names = within(screen.getByRole('list', { name: /^Bag/ })).getAllByRole('button').map((each) => each.getAttribute('aria-label'))
  expect(names).toEqual(['Excalibug, Legendary', 'Ring, Uncommon', 'Syntax Gem', 'Added Fire'])
  fireEvent.click(screen.getByRole('button', { name: 'Slot' }))
  const bySlot = within(screen.getByRole('list', { name: /^Bag/ })).getAllByRole('button').map((each) => each.getAttribute('aria-label'))
  expect(bySlot.slice(-2)).toEqual(['Syntax Gem', 'Added Fire'])
})

it('shows a hover tooltip with the name, kind and effect, no compare', () => {
  ui()
  fireEvent.pointerEnter(cell(), { pointerType: 'mouse' })
  const tip = screen.getByRole('tooltip')
  expect(within(tip).getByText('Added Fire')).toBeInTheDocument()
  expect(within(tip).getByText('Support gem')).toBeInTheDocument()
  expect(within(tip).getByText(/add \d+% of their damage as fire/)).toBeInTheDocument()
  expect(within(tip).queryByText('Vs equipped:')).toBeNull()
})

it('opens a card with the effect, the socket hint and only Salvage', () => {
  ui()
  fireEvent.click(cell())
  const card = screen.getByRole('region', { name: 'Added Fire' })
  expect(within(card).getByText('Support gem')).toBeInTheDocument()
  expect(within(card).getByText(/add \d+% of their damage as fire/)).toBeInTheDocument()
  expect(screen.getByText('Socket it in the Tree')).toBeInTheDocument()
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^Salvage/ })).toHaveTextContent('+15 scrap')
  expect(screen.queryByRole('button', { name: 'Equip' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Forge' })).toBeNull()
})

it('speaks Portuguese', () => {
  ui({ locale: 'pt-BR' })
  fireEvent.click(screen.getByRole('button', { name: 'Fogo Adicional' }))
  expect(screen.getByText('Gema de suporte')).toBeInTheDocument()
  expect(screen.getByText('Encaixe num soquete da Árvore')).toBeInTheDocument()
})

it('the forge picker leaves supports out', () => {
  ui({ tab: 'forge' })
  expect(screen.queryByRole('button', { name: /Added Fire/ })).toBeNull()
})
