import { useId, useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { linkLabel, useLinkOptions } from '../../../lib/study/link-options.js'
import CommunityIcon from '../../community/community-icon/community-icon.jsx'

const MAX_SHOWN = 6

// Links a study session to one of your cases or notes: the current link as a chip (with a way to
// remove it), and a small searchable list that loads your cases and notes the first time it opens.
// value: { caseId, noteId }; onChange gets the new pair (one link at most, or none).
export default function LinkPicker({ value, onChange, options: given }) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const loaded = useLinkOptions(!given && (open || Boolean(value.caseId || value.noteId)))
  const options = given ?? loaded
  const kind = value.caseId ? 'case' : value.noteId ? 'note' : null
  const current = kind ? (linkLabel(options, kind, value.caseId ?? value.noteId) ?? t(`study.link.${kind}Linked`)) : null

  const needle = query.trim().toLowerCase()
  const matches = (options ?? []).filter((item) => !needle || item.label.toLowerCase().includes(needle))

  const pick = (item) => {
    onChange(item.kind === 'case' ? { caseId: item.id, noteId: null } : { caseId: null, noteId: item.id })
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="min-w-0">
      {current ? (
        <p className="flex min-w-0 items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5 border-2 border-ink bg-secondary-soft px-2 py-1 text-xs text-ink">
            <span className="shrink-0 font-label text-[10px] text-secondary">{t(`study.link.${kind}`)}</span>
            <span className="truncate">{current}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange({ caseId: null, noteId: null })}
            aria-label={t('study.link.remove', { label: current })}
            className="grid size-10 shrink-0 place-items-center font-label text-xs text-muted hover:text-primary"
          >
            <CommunityIcon name="cross" className="size-3" />
          </button>
        </p>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => setOpen((was) => !was)}
          className="min-h-10 font-label text-xs text-secondary underline decoration-dashed underline-offset-4 hover:text-primary"
        >
          {open ? t('study.link.close') : t('study.link.add')}
        </button>
      )}

      {open && !current && (
        <div id={`${id}-list`} className="mt-2 border-2 border-ink bg-white">
          <label htmlFor={`${id}-search`} className="sr-only">
            {t('study.link.search')}
          </label>
          <input
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('study.link.searchPlaceholder')}
            className="block min-h-10 w-full border-b-2 border-ink px-3 text-sm outline-none focus-visible:bg-primary-soft"
          />
          {!options ? (
            <p className="px-3 py-2 text-xs text-muted">{t('study.link.loading')}</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">{options.length ? t('study.link.noMatch') : t('study.link.none')}</p>
          ) : (
            <ul aria-label={t('study.link.options')} className="max-h-48 overflow-y-auto">
              {matches.slice(0, MAX_SHOWN).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm text-ink hover:bg-primary-soft focus-visible:bg-primary-soft"
                  >
                    <span className="w-9 shrink-0 font-label text-[10px] text-secondary">{t(`study.link.${item.kind}`)}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
