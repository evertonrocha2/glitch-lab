import { timeline } from '../../../../shared/interrogation.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { stepKey } from '../../../lib/interrogation/step-key.js'

// The interrogation as a timeline: each passed step with the student's answer and the coach's word.
// Steps not reached yet are left out. headingLevel: 'h2' on its own page, 'h3' inside the drawer.
// question: the case is a question card, so the steps are named for a doubt.
export default function InterrogationTimeline({ interrogation, headingLevel: Heading = 'h2', id = 'interrogation-timeline', question = false }) {
  const t = useT()
  const rows = timeline(interrogation).filter((row) => row.status === 'passed')
  if (!rows.length) return null

  return (
    <section aria-labelledby={id}>
      <Heading id={id} className="font-label text-xs text-primary">
        {t('interrogation.timeline.title')}
      </Heading>
      <ol className="mt-4 border-l-2 border-ink">
        {rows.map((row) => (
          <li key={row.id} className="relative pb-5 pl-6 last:pb-0">
            <span aria-hidden="true" className="absolute top-0 -left-[9px] grid size-4 place-items-center border-2 border-ink bg-secondary" />
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-label text-xs text-ink">
                {row.index + 1}. {t(stepKey(row.id, 'title', question))}
              </span>
              <span className="text-xs text-muted">{t('interrogation.tries', { count: row.tries })}</span>
            </p>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="border-2 border-ink bg-white p-3">
                <dt className="font-label text-[10px] text-secondary">{t('interrogation.timeline.you')}</dt>
                <dd className="mt-1 whitespace-pre-wrap wrap-break-word text-ink">{row.answer}</dd>
              </div>
              {row.feedback && (
                <div className="border-2 border-ink bg-primary-soft p-3">
                  <dt className="font-label text-[10px] text-primary">{t('interrogation.timeline.coach')}</dt>
                  <dd className="mt-1 wrap-break-word text-ink">{row.feedback}</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  )
}
