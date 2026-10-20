import Squiggle from '../Squiggle.jsx'

function LineNumber({ n }) {
  return (
    <span aria-hidden="true" className="mr-5 inline-block w-3 select-none text-right text-muted/50">
      {n}
    </span>
  )
}

// A static sample of what the app does: real code, real error, and the "why" pinned on top.
export default function HeroExample() {
  return (
    <figure className="relative mx-auto w-full max-w-lg lg:mr-0">
      <div className="rounded-2xl border border-line bg-white shadow-[0_30px_70px_-35px_rgba(28,29,38,0.45)]">
        <div className="border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-muted">cart.js</span>
        </div>
        <code className="block px-4 pb-3 pt-4 font-mono text-[13px] leading-7 text-ink">
          <span className="block">
            <LineNumber n={1} />
            <span className="text-secondary">const</span> user = {'{}'}
          </span>
          <span className="block">
            <LineNumber n={2} />
            console.log(
            <span className="relative inline-block">
              user.name
              <Squiggle animated delay={900} className="absolute -bottom-1 left-0 h-2 w-full" />
            </span>
            .length)
          </span>
        </code>
        <p className="mx-4 mb-4 rounded-lg bg-mist px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink">
          <span className="text-muted">Uncaught </span>
          TypeError: Cannot read properties of undefined (reading 'length')
        </p>
      </div>

      <div className="relative -mt-5 ml-6 animate-rise rounded-2xl border border-primary/20 bg-primary-soft p-5 shadow-[0_20px_50px_-30px_rgba(106,61,240,0.6)] motion-reduce:animate-none sm:ml-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">Why it broke</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          The object exists, but <code className="font-mono text-[13px]">user.name</code> was never set. It is{' '}
          <code className="font-mono text-[13px]">undefined</code>, and undefined has no{' '}
          <code className="font-mono text-[13px]">.length</code> to read.
        </p>
        <div className="mt-4 border-t border-primary/15 pt-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-secondary">Now you try</p>
          <p className="mt-1.5 font-mono text-[13px] text-ink">
            <span className="text-secondary">const</span> a = {'{}'}; console.log(a.b.c)
          </p>
        </div>
      </div>
      <figcaption className="sr-only">Example of Glitch Detective explaining a JavaScript TypeError</figcaption>
    </figure>
  )
}
