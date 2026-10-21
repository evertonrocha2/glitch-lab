import { conceptLabel } from '../../../shared/concepts.js'
import { weakSpot } from '../../lib/caseInfo.js'

const pad = (count) => String(count).padStart(2, '0')

// One glance: how much is on the board and which kind of bug keeps coming back.
export default function BoardStats({ cases }) {
  const count = (status) => cases.filter((item) => item.status === status).length
  const spot = weakSpot(cases)
  const numbers = [
    { label: 'Cases', value: pad(cases.length), tone: 'text-ink' },
    { label: 'Training', value: pad(count('training')), tone: 'text-secondary' },
    { label: 'Solved', value: pad(count('solved')), tone: 'text-primary' },
  ]

  return (
    <ul
      aria-label="Board summary"
      className="grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)]"
    >
      {numbers.map((item) => (
        <li key={item.label} className="bg-white px-4 py-3">
          <span className="font-label text-xs text-muted">{item.label}</span>
          <strong className={`mt-1 block font-label text-[28px] leading-none pt-1 ${item.tone}`}>{item.value}</strong>
        </li>
      ))}
      <li className="col-span-3 bg-primary-soft px-4 py-3 sm:col-span-1">
        <span className="font-label text-xs text-primary">Weak spot</span>
        <strong className="mt-1 block text-lg font-semibold text-ink">{spot ? conceptLabel(spot.concept) : 'None yet'}</strong>
        <span className="text-sm text-muted">
          {spot ? `${spot.count} open ${spot.count === 1 ? 'case' : 'cases'} of this kind` : 'Investigate a few errors first.'}
        </span>
      </li>
    </ul>
  )
}
