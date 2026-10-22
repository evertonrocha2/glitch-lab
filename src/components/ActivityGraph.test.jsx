import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { activityCalendar } from '../../shared/activity.js'
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
