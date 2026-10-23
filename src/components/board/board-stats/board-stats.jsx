import { memo } from 'react'
import { weakSpot } from '../../../lib/case-info.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'

const pad = (count) => String(count).padStart(2, '0')

// One glance: how much is on the board and which kind of bug keeps coming back.
// Memoized: opening a case doesn't recount the board.
export default memo(function BoardStats({ cases }) {
  const t = useT()
  const labels = useLabels()
  const count = (status) => cases.filter((item) => item.status === status).length
  const spot = weakSpot(cases)
  const numbers = [
    { label: t('board.stats.cases'), value: pad(cases.length), tone: 'text-ink' },
    { label: labels.status('training'), value: pad(count('training')), tone: 'text-secondary' },
    { label: labels.status('solved'), value: pad(count('solved')), tone: 'text-primary' },
  ]

  return (
    <ul
      aria-label={t('board.stats.label')}
      className="grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)]"
    >
      {numbers.map((item) => (
        <li key={item.label} className="bg-white px-4 py-3">
          <span className="font-label text-xs text-muted">{item.label}</span>
          <strong className={`mt-1 block font-pixel font-bold text-[28px] leading-none pt-1 ${item.tone}`}>{item.value}</strong>
        </li>
      ))}
      <li className="col-span-3 bg-primary-soft px-4 py-3 sm:col-span-1">
        <span className="font-label text-xs text-primary">{t('board.stats.weakSpot')}</span>
        <strong className="mt-1 block text-lg font-semibold text-ink">{spot ? labels.concept(spot.concept) : t('board.stats.noneYet')}</strong>
        <span className="text-sm text-muted">
          {spot ? t('board.stats.openOfKind', { count: spot.count }) : t('board.stats.investigateFirst')}
        </span>
      </li>
    </ul>
  )
})
