import { CONCEPTS } from '../../../../shared/concepts.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { conceptName } from '../../../lib/i18n/labels.js'
import SectionHead, { WRAP } from '../section-head/section-head.jsx'

// The bestiary: each bug type is an entry, with what it usually looks like when it hits you
// (landing.bugs.example.<id>).
export default function BugTypes() {
  const t = useT()
  return (
    <section id="bugs" aria-labelledby="bugs-title" className="lp-band scroll-mt-16 py-20 sm:py-28">
      <div className={WRAP}>
        <SectionHead
          id="bugs-title"
          kicker={t('landing.bugs.kicker')}
          title={t('landing.bugs.title', { count: CONCEPTS.length })}
          body={t('landing.bugs.body')}
        />
        <ul aria-label={t('landing.bugs.list')} className="mt-12 grid gap-3 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {CONCEPTS.map((concept, index) => {
            const example = t(`landing.bugs.example.${concept.id}`)
            return (
              <li key={concept.id} className="lp-frame flex items-stretch shadow-[inset_2px_2px_0_var(--lp-line),inset_-2px_-2px_0_var(--lp-void),4px_4px_0_0_rgb(6_8_11/0.5)]">
                <span
                  aria-hidden="true"
                  className="grid w-12 shrink-0 place-items-center border-r-2 border-(--lp-void) bg-(--lp-inset) font-pixel text-sm text-(--lp-danger)"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 px-3.5 py-3">
                  <span className="block font-semibold">{conceptName(t, concept.id)}</span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-(--lp-muted)" title={example}>
                    {example}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
