import { CONCEPTS } from '../../../../shared/concepts.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { conceptName } from '../../../lib/i18n/labels.js'

// What each bug type usually looks like when it hits you: landing.bugs.example.<id>.
export default function BugTypes() {
  const t = useT()
  return (
    <section id="bugs" aria-labelledby="bugs-title" className="scroll-mt-4 border-b-2 border-ink bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-label text-xs text-secondary">{t('landing.bugs.kicker')}</p>
            <h2 id="bugs-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
              {t('landing.bugs.title', { count: CONCEPTS.length })}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">{t('landing.bugs.body')}</p>
          </div>
        </div>
        <ul aria-label={t('landing.bugs.list')} className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONCEPTS.map((concept, index) => {
            const example = t(`landing.bugs.example.${concept.id}`)
            return (
              <li key={concept.id} className="flex items-stretch border-2 border-ink bg-white">
                <span
                  aria-hidden="true"
                  className={`grid w-12 shrink-0 place-items-center border-r-2 border-ink font-label text-xs ${index % 2 ? 'bg-secondary-soft text-secondary' : 'bg-primary-soft text-primary'}`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 px-3 py-2.5">
                  <span className="block font-semibold text-ink">{conceptName(t, concept.id)}</span>
                  <span className="block truncate font-mono text-xs text-muted" title={example}>
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
