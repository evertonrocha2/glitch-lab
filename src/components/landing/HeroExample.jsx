import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelBug from '../pixel/PixelBug.jsx'
import PixelCard from '../pixel/PixelCard.jsx'

// The bug glitches on a dithered screen; the pinned card shows what the app answers.
export default function HeroExample() {
  const t = useT()
  return (
    <figure className="relative mx-auto w-full max-w-lg lg:mr-0">
      <div className="relative h-72 overflow-hidden border-2 border-ink bg-white shadow-pixel-ink sm:h-80">
        <div aria-hidden="true" className="dither-primary absolute inset-0 opacity-50" />
        <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-45" />
        <div className="absolute inset-x-0 top-[12%] flex justify-center">
          <PixelBug className="h-32 w-auto motion-safe:animate-glitch sm:h-40" />
        </div>
        <p className="absolute left-3 top-3 border-2 border-ink bg-white px-2 py-1 font-label text-[10px] text-ink">
          {t('landing.hero.found')}
        </p>
      </div>

      <PixelCard className="relative -mt-16 ml-6 mr-1 p-4 sm:ml-16 sm:-mr-5">
        <p className="font-mono text-xs leading-relaxed text-ink">
          TypeError: Cannot read properties of undefined (reading 'length')
        </p>
        <p className="mt-3 font-label text-[10px] text-primary">{t('landing.hero.why')}</p>
        {/* One font for the whole sentence, code names included. */}
        <p className="mt-1 text-base leading-relaxed text-ink">{t('landing.hero.answer')}</p>
      </PixelCard>
      <figcaption className="sr-only">{t('landing.hero.caption')}</figcaption>
    </figure>
  )
}
