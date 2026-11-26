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
import SiteFooter from '../../components/landing/site-footer/site-footer.jsx'
import SiteHeader from '../../components/landing/site-header/site-header.jsx'
import '../../components/landing/landing.css'

// The public landing, "noite arcana": the hero and the CTA band sit over shaders; everything you
// read (how it works, the FAQ) sits on calm panels.
export default function LandingPage() {
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
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
