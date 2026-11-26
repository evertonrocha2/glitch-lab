import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import SectionHead, { WRAP } from '../section-head/section-head.jsx'

// Each row is landing.why.<n>.bot (the chatbot) and landing.why.<n>.us (StudyQuest).
const ROWS = [1, 2, 3, 4, 5, 6]

function Mark({ good }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-(--lp-void) font-mono text-[11px] leading-none ${good ? 'bg-[#1c4a30] text-(--lp-ok) shadow-[inset_1px_1px_0_#2fae5f]' : 'bg-(--lp-inset) text-(--lp-danger)'}`}
    >
      {good ? '✓' : '×'}
    </span>
  )
}

// A chatbot on the left, dim; StudyQuest on the right, in a gold frame.
export default function Compare() {
  const t = useT()
  return (
    <section id="why" aria-labelledby="why-title" className="lp-band scroll-mt-16 py-20 sm:py-28">
      <div className={WRAP}>
        <SectionHead id="why-title" kicker={t('landing.why.kicker')} title={t('landing.why.title')} body={t('landing.why.body')} />
        <div className="lp-frame mt-12 sm:mt-14">
          <div aria-hidden="true" className="hidden grid-cols-2 border-b-2 border-(--lp-void) sm:grid">
            <p className="border-r-2 border-(--lp-void) px-5 py-3.5 font-mono text-xs uppercase tracking-[0.08em] text-(--lp-muted)">
              {t('landing.why.chatbot')}
            </p>
            <p className="bg-[linear-gradient(90deg,rgb(242_193_78/0.16),transparent)] px-5 py-3.5 font-pixel text-sm uppercase tracking-[0.06em] text-(--lp-gold)">
              StudyQuest
            </p>
          </div>
          <ul aria-label={t('landing.why.list')}>
            {ROWS.map((row) => (
              <li key={row} className="grid border-b border-dashed border-(--lp-line) last:border-b-0 sm:grid-cols-2">
                <p className="flex gap-3 px-5 py-4 text-(--lp-muted) sm:border-r-2 sm:border-(--lp-void)">
                  <Mark />
                  <span>
                    <span className="sr-only">{t('landing.why.chatbotSr')}</span>
                    {t(`landing.why.${row}.bot`)}
                  </span>
                </p>
                <p className="flex gap-3 bg-[rgb(138_92_255/0.07)] px-5 py-4">
                  <Mark good />
                  <span>
                    <span className="sr-only">StudyQuest: </span>
                    {t(`landing.why.${row}.us`)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
