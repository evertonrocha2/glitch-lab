import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createNote } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { useT } from '../i18n/I18nProvider.jsx'
import { useProgressRefresh } from '../progress/progress-provider.jsx'
import { interrogationNote } from './note.js'

// "Export as note": writes the interrogation into a new note and opens it.
// onError gets any failure (an expired session included), so the caller decides what to show.
export function useExportInterrogation({ onError }) {
  const t = useT()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const refresh = useProgressRefresh()
  const [exporting, setExporting] = useState(false)
  const busy = useRef(false)

  const exportNote = useCallback(
    async (kase, interrogation) => {
      if (busy.current) return
      busy.current = true
      setExporting(true)
      try {
        const note = await createNote(interrogationNote({ kase, interrogation, t }), await getToken())
        refresh()
        navigate(`/notes/${note.id}`)
      } catch (err) {
        onError(err)
      } finally {
        busy.current = false
        setExporting(false)
      }
    },
    [getToken, navigate, onError, refresh, t],
  )

  return { exportNote, exporting }
}
