import PixelBug from '../pixel/PixelBug.jsx'
import PixelCard from '../pixel/PixelCard.jsx'

// The bug glitches on a dithered screen; the pinned card shows what the app answers.
export default function HeroExample() {
  return (
    <figure className="relative mx-auto w-full max-w-lg lg:mr-0">
      <div className="relative h-72 overflow-hidden border-2 border-ink bg-white shadow-pixel-ink sm:h-80">
        <div aria-hidden="true" className="dither-primary absolute inset-0 opacity-50" />
        <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-45" />
        <div className="absolute inset-x-0 top-[12%] flex justify-center">
          <PixelBug className="h-32 w-auto motion-safe:animate-glitch sm:h-40" />
        </div>
        <p className="absolute left-3 top-3 border-2 border-ink bg-white px-2 py-1 font-label text-[10px] text-ink">
          bug found: line 2
        </p>
      </div>

      <PixelCard className="relative -mt-16 ml-6 mr-1 p-4 sm:ml-16 sm:-mr-5">
        <p className="font-mono text-xs leading-relaxed text-ink">
          TypeError: Cannot read properties of undefined (reading 'length')
        </p>
        <p className="mt-3 font-label text-[10px] text-primary">Why it broke</p>
        <p className="mt-1 text-[15px] leading-relaxed text-ink">
          <code className="font-mono text-[13px]">user.name</code> was never set. It is{' '}
          <code className="font-mono text-[13px]">undefined</code>, and undefined has no{' '}
          <code className="font-mono text-[13px]">.length</code> to read.
        </p>
      </PixelCard>
      <figcaption className="sr-only">Example of Glitch Detective explaining a JavaScript TypeError</figcaption>
    </figure>
  )
}
