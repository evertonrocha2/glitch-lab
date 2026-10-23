import { BADGES } from '../../../../shared/badges.js'
import { CONCEPTS } from '../../../../shared/concepts.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// Each item is landing.marquee.<id>; the counts fill {count}.
const ITEMS = [
  ['bugTypes', CONCEPTS.length],
  ['hints'],
  ['passes'],
  ['mentions'],
  ['timer'],
  ['badges', BADGES.length],
  ['trails'],
  ['export'],
  ['languages'],
]

function Row({ hidden = false }) {
  const t = useT()
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {ITEMS.map(([id, count]) => (
        <li key={id} className="flex items-center gap-6 pr-6 font-label text-xs whitespace-nowrap text-white">
          {t(`landing.marquee.${id}`, { count })}
          <span aria-hidden="true" className="size-2 bg-white/70" />
        </li>
      ))}
    </ul>
  )
}

// A pixel ticker of what's inside. The second copy makes the loop seamless; reduced motion keeps it still.
export default function Marquee() {
  const t = useT()
  return (
    <section aria-label={t('landing.marquee.label')} className="overflow-hidden border-b-2 border-ink bg-primary py-3">
      <div className="flex w-max motion-safe:animate-marquee">
        <Row />
        <Row hidden />
      </div>
    </section>
  )
}
