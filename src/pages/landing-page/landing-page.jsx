import { useNavigate } from 'react-router'
import ErrorForm from '../../components/investigate/error-form/error-form.jsx'
import BugTypes from '../../components/landing/bug-types/bug-types.jsx'
import Compare from '../../components/landing/compare/compare.jsx'
import CtaBand from '../../components/landing/cta-band/cta-band.jsx'
import Faq from '../../components/landing/faq/faq.jsx'
import Features from '../../components/landing/features/features.jsx'
import Hero from '../../components/landing/hero/hero.jsx'
import HowItWorks from '../../components/landing/how-it-works/how-it-works.jsx'
import Marquee from '../../components/landing/marquee/marquee.jsx'
import Modes from '../../components/landing/modes/modes.jsx'
import Quests from '../../components/landing/quests/quests.jsx'
import SectionHead from '../../components/landing/section-head/section-head.jsx'
import SiteFooter from '../../components/landing/site-footer/site-footer.jsx'
import SiteHeader from '../../components/landing/site-header/site-header.jsx'
import { saveDraft } from '../../lib/draft.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import '../../components/landing/landing.css'

// The public landing, "noite arcana": the hero and the CTA band sit over shaders; everything you
// read (how it works, the FAQ, the form) sits on calm night panels.
export default function LandingPage() {
  const navigate = useNavigate()
  const t = useT()

  // The board investigates the draft right away; signed-out visitors pass through the login first.
  function handleSubmit(input) {
    saveDraft(input)
    navigate('/board')
  }

  return (
    <div className="lp min-h-screen overflow-x-clip">
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <Modes />
        <HowItWorks />
        <Compare />
        <Features />
        <BugTypes />
        <Quests />
        <Faq />
        <section id="try" aria-labelledby="try-title" className="scroll-mt-16 pt-8 pb-24 sm:pb-28">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <SectionHead id="try-title" kicker={t('landing.try.kicker')} title={t('landing.try.title')} body={t('landing.try.body')} />
            <div className="lp-frame mt-10 p-5 sm:p-8">
              <ErrorForm onSubmit={handleSubmit} loading={false} />
            </div>
          </div>
        </section>
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
