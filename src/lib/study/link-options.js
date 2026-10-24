import { useEffect, useMemo, useState } from 'react'
import { listCases, listNotes } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { caseHeading } from '../case-info.js'
import { useT } from '../i18n/I18nProvider.jsx'

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

// A case reads as its error type and message ("TypeError: x is undefined"), a note as its title.
export function caseLabel(item) {
  const { type, message } = caseHeading(item)
  return clip(message ? `${type}: ${message}` : type, 80)
}

// [{ kind: 'case' | 'note', id, label }] for the link picker, cases first (newest), then notes.
export function linkOptions(cases, notes, untitled) {
  return [
    ...cases.map((item) => ({ kind: 'case', id: item.id, label: caseLabel(item) })),
    ...notes.map((note) => ({ kind: 'note', id: note.id, label: clip(note.title.trim() || untitled, 80) })),
  ]
}

// The label of a linked case or note, or null when it isn't in the options (not loaded, or gone).
export const linkLabel = (options, kind, id) => (id && options?.find((item) => item.kind === kind && item.id === id)?.label) ?? null

// Your cases and notes as link options, fetched once `enabled` turns true (a picker opening).
// null while loading; an empty list if they couldn't be loaded (the picker then just has nothing).
export function useLinkOptions(enabled = true) {
  const { getToken } = useAuth()
  const t = useT()
  const [lists, setLists] = useState(null)

  useEffect(() => {
    if (!enabled || lists) return
    let live = true
    ;(async () => {
      try {
        const token = await getToken()
        const [cases, notes] = await Promise.all([listCases(token), listNotes(token)])
        if (live) setLists({ cases: cases ?? [], notes: notes ?? [] })
      } catch {
        if (live) setLists({ cases: [], notes: [] })
      }
    })()
    return () => {
      live = false
    }
  }, [enabled, lists, getToken])

  const untitled = t('study.untitledNote')
  return useMemo(() => (lists ? linkOptions(lists.cases, lists.notes, untitled) : null), [lists, untitled])
}
