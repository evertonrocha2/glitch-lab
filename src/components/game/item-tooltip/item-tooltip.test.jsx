import { render, screen, within } from '@testing-library/react'
import { beforeAll, expect, it } from 'vitest'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import { epicRelic, gem, legendarySword, wornChest, wornHelm, wornRelic } from '../panel/fixtures.js'
import ItemTooltip from './item-tooltip.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

const ui = (props, locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <ItemTooltip {...props} />
    </I18nProvider>,
  )

it('shows the name in the rarity color, the rarity and the item level', () => {
  ui({ item: epicRelic })
  const name = screen.getByText('Compiler Runic Keyboard +2')
  expect(name).toHaveStyle({ color: '#c3a6ff' })
  expect(screen.getByText('Epic relic, item level 14')).toBeInTheDocument()
})

it('agrees the rarity with the slot in Portuguese', () => {
  ui({ item: epicRelic }, 'pt-BR')
  expect(screen.getByText('Teclado Rúnico do Compilador +2')).toBeInTheDocument()
  expect(screen.getByText('Relíquia épica, nível de item 14')).toBeInTheDocument()
})

it('lists base stats with the upgrade bonus and every affix', () => {
  ui({ item: epicRelic })
  const base = screen.getByRole('list', { name: 'Base stats' })
  expect(within(base).getByText('+3 attack')).toBeInTheDocument()
  expect(within(base).getByText('+9% crit damage')).toBeInTheDocument()
  const affixes = screen.getByRole('list', { name: 'Affixes' })
  expect(within(affixes).getByText('+6 attack')).toBeInTheDocument()
  expect(within(affixes).getByText('+9% crit damage')).toBeInTheDocument()
  expect(within(affixes).getByText('+20 health')).toBeInTheDocument()
})

it('shows filled and empty sockets', () => {
  ui({ item: epicRelic })
  expect(screen.getByText('Logic Gem: +4% attack')).toBeInTheDocument()
  expect(screen.getByText('Empty socket')).toBeInTheDocument()
})

it('shows set progress with active tiers apart from inactive ones', () => {
  ui({ item: epicRelic, worn: [wornHelm, wornChest] })
  expect(screen.getByText('Compiler set (2 of 4)')).toBeInTheDocument()
  const on = screen.getByText('2 pieces: +6% attack, +40 health')
  const off = screen.getByText('4 pieces: Bolt deals 50% more damage')
  expect(on).toHaveAttribute('data-active', 'true')
  expect(off).toHaveAttribute('data-active', 'false')
})

it('shows the unique effect', () => {
  ui({ item: legendarySword })
  expect(screen.getByText('Excalibug')).toBeInTheDocument()
  expect(screen.getByText(/20% chance to splash bugs for 50% of attack/)).toBeInTheDocument()
})

it('compares against the equipped item with ups and downs', () => {
  ui({ item: epicRelic, equipped: wornRelic })
  const compare = screen.getByText('Vs equipped:').closest('p')
  const up = within(compare).getByText('+9 attack')
  expect(up).toHaveAttribute('data-trend', 'up')
  expect(within(compare).getByText('-15 mana')).toHaveAttribute('data-trend', 'down')
})

it('skips the compare line for the item that is itself equipped', () => {
  ui({ item: wornRelic, equipped: wornRelic })
  expect(screen.queryByText('Vs equipped:')).toBeNull()
})

it('describes a gem', () => {
  ui({ item: gem })
  expect(screen.getByText('Syntax Gem')).toBeInTheDocument()
  expect(screen.getByText('+5% health')).toBeInTheDocument()
})
