import { useEffect, useRef, useState } from 'react'
import ErrorForm from './components/ErrorForm.jsx'
import Hero from './components/landing/Hero.jsx'
import HowItWorks from './components/landing/HowItWorks.jsx'
import SiteFooter from './components/landing/SiteFooter.jsx'
import SiteHeader from './components/landing/SiteHeader.jsx'
import ResultCards from './components/ResultCards.jsx'
import { analyzeError } from './lib/analyzeError.js'

function Investigating() {
  return (
    <div role="status" className="mt-8 rounded-2xl border border-line bg-white p-6">
      <p className="font-medium text-ink">Reading your error. This can take up to a minute.</p>
      <div aria-hidden="true" className="mt-5 space-y-3 motion-safe:animate-pulse">
        <div className="h-3 w-3/4 rounded-full bg-mist" />
        <div className="h-3 w-full rounded-full bg-primary-soft" />
        <div className="h-3 w-2/3 rounded-full bg-secondary-soft" />
      </div>
    </div>
  )
}

function ErrorNotice({ message }) {
  return (
    <div role="alert" className="mt-8 flex items-start gap-3 rounded-2xl border border-primary/25 bg-white p-5 text-ink">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mt-0.5 size-5 shrink-0 text-primary">
        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 5.75v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="10" cy="14" r="1" fill="currentColor" />
      </svg>
      <p>{message}</p>
    </div>
  )
}

export default function App() {
  const [status, setStatus] = useState('idle')
  const [analysis, setAnalysis] = useState(null)
  const [message, setMessage] = useState('')
  const resultsRef = useRef(null)

  async function handleSubmit(input) {
    setStatus('loading')
    try {
      setAnalysis(await analyzeError(input))
      setStatus('done')
    } catch (err) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    if (status === 'done') resultsRef.current?.scrollIntoView?.({ block: 'start' })
  }, [status])

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
              <ErrorForm onSubmit={handleSubmit} loading={status === 'loading'} />
            </div>
            {/* Old results unmount while loading, which also re-hides the fix and the answer. */}
            {status === 'loading' && <Investigating />}
            {status === 'error' && <ErrorNotice message={message} />}
            {status === 'done' && (
              <div ref={resultsRef} className="scroll-mt-6">
                <ResultCards analysis={analysis} />
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
