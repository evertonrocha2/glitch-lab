import { useNavigate } from 'react-router'
import ErrorForm from '../../components/investigate/error-form/error-form.jsx'
import BugTypes from '../../components/landing/bug-types/bug-types.jsx'
import Compare from '../../components/landing/compare/compare.jsx'
import Faq from '../../components/landing/faq/faq.jsx'
import Features from '../../components/landing/features/features.jsx'
import Hero from '../../components/landing/hero/hero.jsx'
import HowItWorks from '../../components/landing/how-it-works/how-it-works.jsx'
import LevelLadder from '../../components/landing/level-ladder/level-ladder.jsx'
import Marquee from '../../components/landing/marquee/marquee.jsx'
import SiteFooter from '../../components/landing/site-footer/site-footer.jsx'
import SiteHeader from '../../components/landing/site-header/site-header.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { saveDraft } from '../../lib/draft.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

export default function LandingPage() {
  const navigate = useNavigate()
  const t = useT()

  // The board investigates the draft right away; signed-out visitors pass through the login first.
  function handleSubmit(input) {
    saveDraft(input)
    navigate('/board')
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <HowItWorks />
        <Compare />
        <Features />
        <BugTypes />
        <LevelLadder />
        <Faq />
        <section id="try" aria-labelledby="try-title" className="scroll-mt-4 bg-mist">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-24">
            <p className="font-label text-xs text-primary">{t('landing.try.kicker')}</p>
            <h2 id="try-title" className="mt-4 font-pixel text-3xl font-bold text-ink sm:text-[2.6rem]">
              {t('landing.try.title')}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">{t('landing.try.body')}</p>
            <PixelCard className="mt-10 p-5 sm:p-8">
              <ErrorForm onSubmit={handleSubmit} loading={false} />
            </PixelCard>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
