import { useEffect, useRef, useState } from 'react'
import ErrorForm from './components/ErrorForm.jsx'
import Hero from './components/landing/Hero.jsx'
import HowItWorks from './components/landing/HowItWorks.jsx'
import SiteFooter from './components/landing/SiteFooter.jsx'
import SiteHeader from './components/landing/SiteHeader.jsx'
import PixelCard from './components/pixel/PixelCard.jsx'
import Working from './components/pixel/Working.jsx'
import ResultCards from './components/ResultCards.jsx'
import { analyzeError } from './lib/analyzeError.js'

function ErrorNotice({ message }) {
  return (
    <div role="alert" className="mt-8 flex items-start gap-3 border-2 border-ink bg-primary-soft p-4 text-ink shadow-pixel">
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center bg-primary font-label text-xs text-white">
        !
      </span>
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
        <section id="try" aria-labelledby="try-title" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-24">
            <p className="font-label text-[11px] text-primary">Your turn</p>
            <h2 id="try-title" className="mt-4 font-pixel text-3xl font-bold text-ink sm:text-[2.6rem]">
              Investigate your error
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Paste the message exactly as it appears. JavaScript, Python and most other languages work.
            </p>
            <PixelCard className="mt-10 p-5 sm:p-8">
              <ErrorForm onSubmit={handleSubmit} loading={status === 'loading'} />
            </PixelCard>
            {/* Old results unmount while loading, which also re-hides the fix and the answer. */}
            {status === 'loading' && (
              <div className="mt-8">
                <Working label="Investigating your error" />
              </div>
            )}
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
