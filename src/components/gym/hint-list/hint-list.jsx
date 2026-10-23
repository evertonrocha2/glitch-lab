import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'

// Hints arrive one at a time, vaguest first; the button disappears after the last one.
export default function HintList({ hints, total, onReveal, loading }) {
  const t = useT()
  const remaining = total - hints.length

  return (
    <section aria-labelledby="hints-title" className="border-2 border-ink bg-primary-soft p-5 shadow-pixel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hints-title" className="font-label text-sm text-primary">
          {t('board.hints.title')}
        </h2>
        {remaining > 0 ? (
          <PixelButton variant="ghost" onClick={onReveal} disabled={loading} className="px-3 py-2">
            {t('board.hints.get', { shown: hints.length, total })}
          </PixelButton>
        ) : (
          <p className="text-sm text-muted">{t('board.hints.noMore')}</p>
        )}
      </div>
      {hints.length === 0 ? (
        <p className="mt-3 text-sm text-ink/75">{t('board.hints.empty')}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {hints.map((hint, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: hints only grow at the end; the AI may repeat a text.
            <li key={index} className="flex gap-3 border-2 border-ink bg-white p-3 text-ink">
              <span className="font-label text-xs text-primary">{index + 1}</span>
              <span>{hint}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
