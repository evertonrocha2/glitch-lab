import { useNavigate } from 'react-router'
import ErrorForm from '../components/ErrorForm.jsx'
import Hero from '../components/landing/Hero.jsx'
import HowItWorks from '../components/landing/HowItWorks.jsx'
import SiteFooter from '../components/landing/SiteFooter.jsx'
import SiteHeader from '../components/landing/SiteHeader.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import { saveDraft } from '../lib/draft.js'

export default function LandingPage() {
  const navigate = useNavigate()

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
        <HowItWorks />
        <section id="try" aria-labelledby="try-title" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-24">
            <p className="font-label text-[11px] text-primary">Your turn</p>
            <h2 id="try-title" className="mt-4 font-pixel text-3xl font-bold text-ink sm:text-[2.6rem]">
              Investigate your error
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Paste the message exactly as it appears. JavaScript, Python and most other languages work. It lands on your
              board as a new case.
            </p>
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
