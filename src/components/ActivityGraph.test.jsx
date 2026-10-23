import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { activityCalendar } from '../../shared/activity.js'
import { I18nProvider } from '../lib/i18n/I18nProvider.jsx'
import ActivityGraph from './ActivityGraph.jsx'

const TODAY = '2026-10-22'
const calendar = activityCalendar(
  { cases: [{ createdAt: '2026-10-20T10:00:00.000Z' }, { createdAt: '2026-10-20T11:00:00.000Z' }, { createdAt: '2026-09-02T10:00:00.000Z' }] },
  TODAY,
)

it('sums up the year for everyone, not just sighted readers', () => {
  render(<ActivityGraph activity={calendar} today={TODAY} />)
  expect(screen.getByRole('img', { name: 'Activity: 3 activities in the last year, on 2 days.' })).toBeInTheDocument()
  const table = screen.getByRole('table', { name: 'Activity per month' })
  expect(within(table).getByRole('row', { name: 'October 2026 2' })).toBeInTheDocument()
  expect(within(table).getByRole('row', { name: 'September 2026 1' })).toBeInTheDocument()
})

it('draws one square per day up to today and explains a day on hover', () => {
  const { container } = render(<ActivityGraph activity={calendar} today={TODAY} />)
  // 52 full weeks plus Sunday to Thursday of this one.
  expect(container.querySelectorAll('rect')).toHaveLength(52 * 7 + 5)
  const busy = [...container.querySelectorAll('rect')].find((rect) => rect.getAttribute('fill') === '#8f6ff5')
  fireEvent.mouseMove(busy)
  expect(screen.getByRole('status')).toHaveTextContent('2 activities on Tue, Oct 20, 2026')
})

it('speaks Brazilian Portuguese: summary, weekdays, months and the hover text', () => {
  const { container } = render(
    <I18nProvider locale="pt-BR">
      <ActivityGraph activity={calendar} today={TODAY} />
    </I18nProvider>,
  )
  expect(screen.getByRole('img', { name: 'Atividade: 3 atividades no último ano, em 2 dias.' })).toBeInTheDocument()
  const table = screen.getByRole('table', { name: 'Atividade por mês' })
  expect(within(table).getByRole('row', { name: 'Outubro de 2026 2' })).toBeInTheDocument()
  const labels = [...container.querySelectorAll('text')].map((text) => text.textContent)
  expect(labels).toEqual(expect.arrayContaining(['Seg', 'Qua', 'Sex', 'Out']))
  const busy = [...container.querySelectorAll('rect')].find((rect) => rect.getAttribute('fill') === '#8f6ff5')
  fireEvent.mouseMove(busy)
  expect(screen.getByRole('status')).toHaveTextContent('2 atividades em ter., 20 de out. de 2026')
})

it('says so when the year is empty', () => {
  render(
    <I18nProvider locale="pt-BR">
      <ActivityGraph activity={{ ...calendar, days: calendar.days.map(() => 0), total: 0, activeDays: 0, best: null }} today={TODAY} />
    </I18nProvider>,
  )
  expect(screen.getByRole('img', { name: 'Atividade: Nenhuma atividade no último ano.' })).toBeInTheDocument()
})
