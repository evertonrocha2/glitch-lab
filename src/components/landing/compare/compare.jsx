import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// Each row is landing.why.<n>.bot (the chatbot) and landing.why.<n>.us (Glitch Lab).
const ROWS = [1, 2, 3, 4, 5, 6]

function Mark({ good }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-ink font-label text-[10px] leading-none ${good ? 'bg-primary text-white' : 'bg-white text-muted'}`}
    >
      {good ? '✓' : '×'}
    </span>
  )
}

export default function Compare() {
  const t = useT()
  return (
    <section id="why" aria-labelledby="why-title" className="scroll-mt-4 border-b-2 border-ink bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-label text-xs text-secondary">{t('landing.why.kicker')}</p>
          <h2 id="why-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            {t('landing.why.title')}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{t('landing.why.body')}</p>
        </div>

        <div className="mt-12 border-2 border-ink shadow-pixel-ink">
          <div aria-hidden="true" className="hidden grid-cols-2 border-b-2 border-ink sm:grid">
            <p className="border-r-2 border-ink bg-mist px-5 py-3 font-label text-xs text-muted">{t('landing.why.chatbot')}</p>
            <p className="bg-primary px-5 py-3 font-label text-xs text-white">Glitch Lab</p>
          </div>
          <ul aria-label={t('landing.why.list')}>
            {ROWS.map((row) => (
              <li key={row} className="grid border-b-2 border-dashed border-line last:border-b-0 sm:grid-cols-2">
                <p className="flex gap-3 px-5 py-4 text-muted sm:border-r-2 sm:border-ink">
                  <Mark />
                  <span>
                    <span className="sr-only">{t('landing.why.chatbotSr')}</span>
                    {t(`landing.why.${row}.bot`)}
                  </span>
                </p>
                <p className="flex gap-3 bg-primary-soft/60 px-5 py-4 text-ink">
                  <Mark good />
                  <span>
                    <span className="sr-only">Glitch Lab: </span>
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
