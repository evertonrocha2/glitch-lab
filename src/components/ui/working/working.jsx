import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelBug from '../pixel-bug/pixel-bug.jsx'

const BLOCKS = 8

// Gemini can take minutes, so the wait has to look alive and say so honestly.
export default function Working({ label }) {
  const t = useT()
  return (
    <div role="status" className="flex items-center gap-4 border-2 border-ink bg-white p-4 shadow-pixel">
      <PixelBug className="h-8 w-auto shrink-0 motion-safe:animate-walk" />
      <div className="min-w-0 flex-1">
        <p className="font-label text-xs text-ink">{label}</p>
        <p className="mt-1 text-sm text-muted">{t('board.working.note')}</p>
        <div aria-hidden="true" className="mt-3 flex gap-1">
          {Array.from({ length: BLOCKS }, (_, index) => (
            <span
              key={index}
              className="size-2.5 bg-primary opacity-20 motion-safe:animate-blink"
              style={{ animationDelay: `${index * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
