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
        <li key={id} className="flex items-center gap-7 pr-7 font-mono text-[13px] uppercase tracking-[0.08em] whitespace-nowrap text-(--lp-muted)">
          {t(`landing.marquee.${id}`, { count })}
          <span aria-hidden="true" className="size-2 rotate-45 bg-(--lp-gold) shadow-[0_0_10px_rgb(242_193_78/0.6)]" />
        </li>
      ))}
    </ul>
  )
}

// A ticker of what's inside, on an inset strip under the hero. The second copy makes the loop
// seamless; reduced motion keeps it still.
export default function Marquee() {
  const t = useT()
  return (
    <section aria-label={t('landing.marquee.label')} className="overflow-hidden border-y-2 border-(--lp-void) bg-(--lp-inset) py-3.5 shadow-[inset_0_2px_0_#1b1433]">
      <div className="lp-marquee flex w-max">
        <Row />
        <Row hidden />
      </div>
    </section>
  )
}
