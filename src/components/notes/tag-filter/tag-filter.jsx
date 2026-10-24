import { useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// How many tag chips show before "+N"; the selected ones always show.
const FIRST = 12

// The search box and the tag chips above the notes list. counts: [{ tag, count }] across every note.
// Several selected tags narrow the list to notes carrying all of them.
export default function TagFilter({ counts, selected, query, onToggle, onQuery, onClear }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const known = new Set(counts.map((item) => item.tag))
  // A tag from the address that no note has anymore still shows, so it can be turned off.
  const chips = [...counts, ...selected.filter((tag) => !known.has(tag)).map((tag) => ({ tag, count: 0 }))]
  const shown = all ? chips : chips.filter((item, index) => index < FIRST || selected.includes(item.tag))
  const hidden = chips.length - shown.length
  const active = selected.length > 0 || query.trim() !== ''

  return (
    <div className="mb-4 space-y-3">
      <div role="search">
        <label htmlFor="notes-search" className="sr-only">
          {t('notes.search.label')}
        </label>
        <input
          id="notes-search"
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('notes.search.placeholder')}
          maxLength={80}
          className="min-h-10 w-full border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
        />
      </div>
      {(chips.length > 0 || active) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.length > 0 && (
            <ul aria-label={t('notes.filter.label')} className="flex min-w-0 flex-wrap gap-1.5">
              {shown.map(({ tag, count }) => {
                const on = selected.includes(tag)
                return (
                  <li key={tag} className="min-w-0">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggle(tag)}
                      aria-label={t('notes.filter.tag', { tag, count })}
                      className={`flex min-h-10 max-w-full items-center gap-1.5 border-2 px-2 font-mono text-xs break-all ${
                        on ? 'border-ink bg-primary text-white shadow-pixel-ink' : 'border-transparent bg-primary-soft text-primary hover:border-ink'
                      }`}
                    >
                      #{tag}
                      <span className={on ? 'text-white/80' : 'text-muted'}>{count}</span>
                    </button>
                  </li>
                )
              })}
              {hidden > 0 && (
                <li>
                  <button type="button" onClick={() => setAll(true)} aria-label={t('notes.tags.more', { count: hidden })} className="min-h-10 px-2 font-mono text-xs text-muted hover:text-ink">
                    +{hidden}
                  </button>
                </li>
              )}
            </ul>
          )}
          {active && (
            <button type="button" onClick={onClear} className="min-h-10 px-2 font-label text-[10px] text-ink underline underline-offset-2 hover:text-primary">
              {t('notes.filter.clear')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
