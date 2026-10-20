import PixelButton from '../pixel/PixelButton.jsx'
import HeroExample from './HeroExample.jsx'

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b-2 border-ink bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-mist)_1px,transparent_1px),linear-gradient(90deg,var(--color-mist)_1px,transparent_1px)] bg-size-[24px_24px]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-14 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="font-label text-[11px] text-secondary">
            &gt; debugging gym for students<span className="motion-safe:animate-caret">_</span>
          </p>
          <h1 className="mt-5 font-pixel text-[2.1rem] font-bold leading-[1.08] text-ink sm:text-5xl lg:text-[3.3rem]">
            {/* Spaces sit between the blocks so screen readers don't run the sentences together. */}
            <span className="block">Paste the error.</span>{' '}
            <span className="block">
              Understand <span className="bg-primary px-2 text-white">why</span>.
            </span>{' '}
            <span className="block text-muted">Practice so it never happens again.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            AI chatbots hand you the fix. Glitch Detective explains why it broke, saves it to your board, and trains you
            with fresh bugs of the same kind until you stop writing them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PixelButton as="a" href="#try" variant="secondary">
              Try it with your error
            </PixelButton>
            <PixelButton as="a" href="#how" variant="ghost">
              How it works
            </PixelButton>
          </div>
        </div>
        <HeroExample />
      </div>
    </section>
  )
}
