import ErrorForm from './components/ErrorForm.jsx'
import Hero from './components/landing/Hero.jsx'
import HowItWorks from './components/landing/HowItWorks.jsx'
import SiteFooter from './components/landing/SiteFooter.jsx'
import SiteHeader from './components/landing/SiteHeader.jsx'

export default function App() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <section id="try" aria-labelledby="try-title" className="scroll-mt-4">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-24">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Your turn</p>
            <h2 id="try-title" className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-[2.6rem]">
              Investigate your error
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Paste the message exactly as it appears. JavaScript, Python and most other languages work.
            </p>
            <div className="mt-10 rounded-3xl border border-line bg-white p-5 shadow-[0_24px_60px_-40px_rgba(28,29,38,0.4)] sm:p-8">
              <ErrorForm onSubmit={() => {}} loading={false} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
