import { Link } from 'react-router'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// A tiny snippet with one line lit up: the line hunt at a glance.
const ROWS = [72, 48, 88, 40, 60]
const BUG_ROW = 2

// The Daily page's way into the line hunt (the top nav is full).
export default function HuntTeaser({ className = '' }) {
  const t = useT()
  return (
    <Link
      to="/hunt"
      className={`group flex items-center gap-4 border-2 border-ink bg-white p-4 shadow-pixel-secondary transition-transform hover:-translate-y-0.5 sm:gap-5 sm:p-5 ${className}`}
    >
      <span aria-hidden="true" className="flex size-14 shrink-0 flex-col justify-center gap-[3px] border-2 border-ink bg-mist px-1.5">
        {ROWS.map((width, index) => (
          <span key={width} className={`h-[5px] ${index === BUG_ROW ? 'bg-primary' : 'bg-ink/50'}`} style={{ width: `${width}%` }} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-label text-[10px] text-secondary">{t('board.daily.alsoToday')}</span>
        <span className="mt-0.5 block font-pixel text-xl font-bold text-ink group-hover:text-primary">{t('hunt.teaser.title')}</span>
        <span className="mt-0.5 block text-sm text-muted">{t('hunt.teaser.lead')}</span>
      </span>
      <span aria-hidden="true" className="hidden font-label text-xs text-primary sm:block">
        {t('board.daily.play')}
      </span>
    </Link>
  )
}
