import { render, screen } from '@testing-library/react'
import { beforeAll, expect, it } from 'vitest'
import { I18nProvider } from '../../lib/i18n/I18nProvider.jsx'
import AwayDialog from './away-dialog.jsx'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null
})

const AWAY = { elapsedMs: 3600_000, kills: 612, elites: 50, deaths: 0, gold: 3000, fragments: 38, items: 2, gems: 0, scrap: 0, xp: 800 }
const ui = (props, locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <AwayDialog onClose={() => {}} {...props} />
    </I18nProvider>,
  )

it('lists the fragments the monsters dropped with the hunt, right after the gold', () => {
  ui({ away: AWAY })
  expect(screen.getByRole('dialog')).toHaveTextContent('While you were away: 612 enemies, 3,000 gold, +38 fragments, 2 items')
})

it('leaves fragments out of a hunt that dropped none, and reads a summary saved before fase 4', () => {
  const { fragments: _none, ...old } = AWAY
  ui({ away: old }, 'pt-BR')
  expect(screen.getByRole('dialog')).toHaveTextContent('Enquanto você estava fora: 612 inimigos, 3.000 de ouro, 2 itens')
})
