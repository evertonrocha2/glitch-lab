import Squiggle from '../Squiggle.jsx'
import HeroExample from './HeroExample.jsx'

export default function Hero() {
  return (
    <section id="top">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-24">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">For students learning to code</p>
          <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[4.1rem]">
            {/* Spaces sit between the blocks so screen readers don't run the sentences together. */}
            <span className="block">Paste the error.</span>{' '}
            <span className="block">
              Understand{' '}
              <span className="relative inline-block text-primary">
                why
                <Squiggle animated delay={300} className="absolute -bottom-2 left-0 h-3.5 w-full" />
              </span>
              .
            </span>{' '}
            <span className="block text-muted">Practice so it never happens again.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
            Glitch Detective reads your error message and explains what went wrong, the idea behind it, and gives you a
            tiny exercise with the same bug. Next time, you spot it yourself.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#try"
              className="rounded-full bg-primary px-6 py-3.5 font-semibold text-white shadow-[0_12px_30px_-12px_rgba(106,61,240,0.8)] transition-colors duration-200 hover:bg-primary-strong"
            >
              Try it with your error
            </a>
            <a
              href="#how"
              className="rounded-full px-5 py-3.5 font-semibold text-ink transition-colors duration-200 hover:bg-mist"
            >
              See how it works
            </a>
          </div>
        </div>
        <HeroExample />
      </div>
    </section>
  )
}
