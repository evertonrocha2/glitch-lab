import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// A note's tags as read-only chips, like the article tags. max: show that many, then "+N".
export default function NoteTags({ tags, max, large = false, className = '' }) {
  const t = useT()
  if (!tags?.length) return null
  const shown = max ? tags.slice(0, max) : tags
  const more = tags.length - shown.length
  const size = large ? 'px-2 py-1 text-sm' : 'px-1.5 py-0.5 text-xs'
  return (
    <ul aria-label={t('notes.tags.list')} className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map((tag) => (
        <li key={tag} className={`bg-primary-soft font-mono break-all text-primary ${size}`}>
          #{tag}
        </li>
      ))}
      {more > 0 && (
        <li className={`font-mono text-muted ${size}`}>
          <span aria-hidden="true">+{more}</span>
          <span className="sr-only">{t('notes.tags.more', { count: more })}</span>
        </li>
      )}
    </ul>
  )
}
