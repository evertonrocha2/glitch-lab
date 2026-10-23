import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import NoteEditor from '../../components/notes/note-editor/note-editor.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { AuthError, createNote, deleteNote, listCases, listNotes, setNotePublic, updateNote } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import { exportNoteImage, exportNoteMarkdown, exportNotePdf } from '../../lib/exportNote.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import { newBlock } from '../../lib/notes/blocks.js'
import { useMyProfile } from '../../lib/profile/myProfile.js'
import { useProgress } from '../../lib/progress/ProgressProvider.jsx'

const EXPORTS = { md: exportNoteMarkdown, png: exportNoteImage, pdf: exportNotePdf }

const caseCount = (note) => note.blocks.filter((block) => block.type === 'case').length

// Whether notes can go on your public profile: never for demos, only once the profile is public.
function sharingFor(user, profile) {
  if (user.isDemo) return { status: 'demo' }
  if (!profile) return { status: 'loading' }
  if (!profile.isPublic || !profile.handle) return { status: 'private' }
  return { status: 'ready', handle: profile.handle }
}

function NoteList({ notes, showPublic }) {
  const t = useT()
  const { timeAgo } = useFormat()
  if (notes.length === 0) return <p className="text-sm text-muted">{t('notes.empty')}</p>
  return (
    <ul className="space-y-2">
      {notes.map((note) => {
        const count = caseCount(note)
        return (
          <li key={note.id}>
            <NavLink
              to={`/notes/${note.id}`}
              className={({ isActive }) =>
                `block border-2 border-ink px-3 py-2.5 transition-colors ${isActive ? 'bg-primary-soft shadow-pixel' : 'bg-white hover:bg-primary-soft'}`
              }
            >
              <span className="block truncate font-semibold text-ink">{note.title || t('notes.untitled')}</span>
              <span className="block text-xs text-muted">
                {count ? `${t('notes.cases', { count })} · ` : ''}
                {t('notes.edited', { time: timeAgo(note.updatedAt) })}
                {showPublic && note.isPublic && <span className="ml-1.5 bg-secondary px-1 py-0.5 font-label text-[10px] leading-none text-white">{t('notes.public')}</span>}
              </span>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

// A notebook next to the board: write about your cases and drop them into the page with @.
export default function NotesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const t = useT()
  const { user, getToken, signOut } = useAuth()
  const myProfile = useMyProfile()
  const { refresh: refreshProgress } = useProgress()
  const [notes, setNotes] = useState(null)
  const [cases, setCases] = useState([])
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  useEffect(() => {
    let alive = true
    getToken()
      .then((token) => Promise.all([listNotes(token), listCases(token)]))
      .then(([noteList, caseList]) => {
        if (!alive) return
        setNotes(noteList)
        setCases(caseList)
      })
      .catch((err) => {
        if (!alive) return
        setNotes((current) => current ?? [])
        handleError(err)
      })
    return () => {
      alive = false
    }
  }, [getToken, handleError])

  async function create() {
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setMessage('')
    try {
      const note = await createNote({ title: '', blocks: [newBlock('text')] }, await getToken())
      setNotes((current) => [note, ...(current ?? [])])
      navigate(`/notes/${note.id}`)
      refreshProgress()
    } catch (err) {
      await handleError(err)
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  const save = useCallback(
    async (noteId, fields, options) => {
      // Update the list right away: reopening this note before the save returns must show these edits.
      setNotes((current) => current?.map((note) => (note.id === noteId ? { ...note, ...fields } : note)) ?? current)
      try {
        const saved = await updateNote(noteId, fields, await getToken(), options)
        // The note just edited moves to the top, unless it was deleted while this save was on its way.
        setNotes((current) =>
          current?.some((note) => note.id === noteId) ? [saved, ...current.filter((note) => note.id !== noteId)] : current,
        )
        refreshProgress()
      } catch (err) {
        if (err instanceof AuthError) await signOut()
        throw err
      }
    },
    [getToken, signOut, refreshProgress],
  )

  async function remove(noteId) {
    try {
      await deleteNote(noteId, await getToken())
      setNotes((current) => current.filter((note) => note.id !== noteId))
      navigate('/notes')
      refreshProgress()
    } catch (err) {
      await handleError(err)
    }
  }

  async function share(noteId, isPublic) {
    try {
      const saved = await setNotePublic(noteId, isPublic, await getToken())
      setNotes((current) => current?.map((note) => (note.id === noteId ? { ...note, isPublic: saved.isPublic } : note)) ?? current)
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      throw err
    }
  }

  async function exportNote(note, format) {
    setMessage('')
    try {
      await EXPORTS[format]({ note, cases })
    } catch {
      setMessage(t(`notes.exportFailed.${format}`))
    }
  }

  const open = notes?.find((note) => note.id === id)
  const sharing = sharingFor(user, myProfile?.profile)

  return (
    <AppShell>
      <PageHeader
        kicker={t('notes.prompt')}
        title={t('notes.title')}
        lead={t('notes.lede')}
        actions={
          <PixelButton onClick={create} disabled={creating || notes === null} className="px-5 py-3">
            {creating ? t('notes.creating') : t('notes.new')}
          </PixelButton>
        }
      />

      {message && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {notes === null ? (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          {t('notes.loading')}
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <nav aria-label={t('notes.nav')} className={id ? 'hidden lg:block' : ''}>
            <NoteList notes={notes} showPublic={sharing.status === 'ready'} />
          </nav>

          <section className={id ? '' : 'hidden lg:block'}>
            {id && (
              <Link to="/notes" className="-my-3 mb-1 inline-flex min-h-10 items-center font-label text-xs text-ink hover:text-primary lg:hidden">
                &lt; {t('notes.all')}
              </Link>
            )}
            {open ? (
              <PixelCard className="p-5 sm:p-8">
                <NoteEditor
                  key={open.id}
                  note={open}
                  cases={cases}
                  onSave={(fields, options) => save(open.id, fields, options)}
                  onDelete={() => remove(open.id)}
                  onExport={exportNote}
                  sharing={sharing}
                  onShare={(isPublic) => share(open.id, isPublic)}
                />
              </PixelCard>
            ) : (
              <div className="relative grid min-h-64 place-items-center overflow-hidden border-2 border-dashed border-ink/40 p-8 text-center">
                <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-15" />
                <p className="relative max-w-sm text-muted">
                  {id ? t('notes.gone') : notes.length ? t('notes.pick') : t('notes.first')}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
