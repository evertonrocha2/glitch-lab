import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import HeroExample from './HeroExample.jsx'

export default function Hero() {
  const t = useT()
  return (
    <section id="top" className="relative overflow-hidden border-b-2 border-ink bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-mist)_1px,transparent_1px),linear-gradient(90deg,var(--color-mist)_1px,transparent_1px)] bg-size-[24px_24px]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-14 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="font-label text-xs text-secondary">
            {t('landing.hero.kicker')}
            <span className="motion-safe:animate-caret">_</span>
          </p>
          <h1 className="mt-5 font-pixel text-[2.1rem] font-bold leading-[1.08] text-ink sm:text-5xl lg:text-[3.3rem]">
            {/* Spaces sit between the blocks so screen readers don't run the sentences together. */}
            <span className="block">{t('landing.hero.line1')}</span>{' '}
            <span className="block">
              {t('landing.hero.line2.before')}
              <span className="bg-primary px-2 text-white">{t('landing.hero.line2.why')}</span>
              {t('landing.hero.line2.after')}
            </span>{' '}
            <span className="block text-muted">{t('landing.hero.line3')}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t('landing.hero.body')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PixelButton as="a" href="#try" variant="secondary">
              {t('landing.hero.try')}
            </PixelButton>
            <PixelButton as="a" href="#how" variant="ghost">
              {t('landing.hero.how')}
            </PixelButton>
          </div>
        </div>
        <HeroExample />
      </div>
    </section>
  )
}
