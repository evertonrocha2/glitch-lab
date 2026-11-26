import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import StepIcon from '../../ui/step-icon/step-icon.jsx'
import SectionHead, { WRAP } from '../section-head/section-head.jsx'

// Each step's text is landing.how.<icon>.title and landing.how.<icon>.body. They read as a quest
// chain: each one unlocks the next.
const STEPS = [
  { icon: 'investigate', color: 'var(--lp-arcane-hi)' },
  { icon: 'board', color: 'var(--lp-mana)' },
  { icon: 'gym', color: 'var(--lp-gold)' },
]

export default function HowItWorks() {
  const t = useT()
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-16 py-20 sm:py-28">
      <div className={WRAP}>
        <SectionHead id="how-title" kicker={t('landing.how.kicker')} title={t('landing.how.title')} body={t('landing.how.body')} />
        <ol aria-label={t('landing.how.list')} className="relative mt-12 grid gap-6 sm:mt-14 md:grid-cols-3 md:gap-8">
          <span
            aria-hidden="true"
            className="absolute top-[42px] right-[16%] left-[16%] hidden h-1 bg-[repeating-linear-gradient(90deg,var(--lp-line-hi)_0_8px,transparent_8px_14px)] md:block"
          />
          {STEPS.map((step, index) => (
            <li key={step.icon} className="lp-frame relative p-6" style={{ '--step': step.color }}>
              <div className="flex items-center justify-between">
                <span className="lp-inset grid size-[52px] place-items-center text-(--step)">
                  <StepIcon kind={step.icon} className="h-7 w-auto" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.08em] text-(--step)">{t('landing.how.step', { n: index + 1 })}</span>
              </div>
              <h3 className="mt-6 font-pixel text-2xl leading-tight">{t(`landing.how.${step.icon}.title`)}</h3>
              <p className="mt-2.5 leading-relaxed text-(--lp-muted)">{t(`landing.how.${step.icon}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
