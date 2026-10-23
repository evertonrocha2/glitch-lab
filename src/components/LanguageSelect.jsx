import { useId } from 'react'
import { LOCALES, useI18n } from '../lib/i18n/I18nProvider.jsx'

const SHORT = { en: 'EN', 'pt-BR': 'PT' }

// The language picker: a real <select>, so it works with the keyboard, screen readers and phones'
// native pickers. `compact` shows EN / PT to fit tight headers; the full names stay in the label.
export default function LanguageSelect({ compact = false, className = '' }) {
  const { locale, setLocale, t } = useI18n()
  const id = useId()
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('language.label')}
      </label>
      <select
        id={id}
        value={locale}
        onChange={(event) => setLocale(event.target.value)}
        className="min-h-10 cursor-pointer appearance-none border-2 border-ink bg-white py-1.5 pr-7 pl-2.5 font-label text-xs text-ink transition-colors hover:bg-mist focus-visible:outline-2"
      >
        {LOCALES.map((value) => (
          <option key={value} value={value}>
            {compact ? SHORT[value] : t(`language.${value}`)}
          </option>
        ))}
      </select>
      <svg aria-hidden="true" viewBox="0 0 5 3" shapeRendering="crispEdges" className="pointer-events-none absolute right-2 size-2.5 fill-ink">
        <rect x="0" y="0" width="5" height="1" />
        <rect x="1" y="1" width="3" height="1" />
        <rect x="2" y="2" width="1" height="1" />
      </svg>
    </span>
  )
}
