import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelCard from '../pixel/PixelCard.jsx'
import StepIcon from './StepIcon.jsx'

// Each step's text is landing.how.<icon>.title and landing.how.<icon>.body.
const STEPS = [
  { icon: 'investigate', tone: 'muted', label: 'text-muted' },
  { icon: 'board', tone: 'primary', label: 'text-primary' },
  { icon: 'gym', tone: 'secondary', label: 'text-secondary' },
]

export default function HowItWorks() {
  const t = useT()
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-b-2 border-ink bg-mist">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-label text-xs text-muted">{t('landing.how.kicker')}</p>
          <h2 id="how-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            {t('landing.how.title')}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{t('landing.how.body')}</p>
        </div>
        <ol aria-label={t('landing.how.list')} className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <PixelCard as="li" key={step.icon} tone={step.tone} className="p-6">
              <div className={`flex items-center justify-between ${step.label}`}>
                <p className="font-label text-xs">{t('landing.how.step', { n: index + 1 })}</p>
                <StepIcon kind={step.icon} className="h-7 w-auto" />
              </div>
              <h3 className="mt-5 font-pixel text-xl font-bold text-ink">{t(`landing.how.${step.icon}.title`)}</h3>
              <p className="mt-2 leading-relaxed text-ink/75">{t(`landing.how.${step.icon}.body`)}</p>
            </PixelCard>
          ))}
        </ol>
      </div>
    </section>
  )
}
