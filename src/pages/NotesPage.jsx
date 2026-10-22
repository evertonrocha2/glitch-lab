import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import AppShell from '../components/AppShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import NoteEditor from '../components/notes/NoteEditor.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import { AuthError, createNote, deleteNote, listCases, listNotes, updateNote } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { timeAgo } from '../lib/caseInfo.js'
import { downloadText, noteToMarkdown, slug } from '../lib/exportMarkdown.js'
import { newBlock } from '../lib/notes/blocks.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

const caseCount = (note) => note.blocks.filter((block) => block.type === 'case').length

function NoteList({ notes }) {
  if (notes.length === 0) return <p className="text-sm text-muted">No notes yet.</p>
  return (
    <ul className="space-y-2">
      {notes.map((note) => {
        const count = caseCount(note)
        return (
          <li key={note.id}>
            <NavLink
              to={`/notes/${note.id}`}
              className={({ isActive }) =>
                `block border-2 px-3 py-2.5 transition-colors ${isActive ? 'border-ink bg-white shadow-pixel' : 'border-transparent hover:border-ink hover:bg-white'}`
              }
            >
              <span className="block truncate font-semibold text-ink">{note.title || 'Untitled'}</span>
              <span className="block text-xs text-muted">
                {count ? `${count} ${count === 1 ? 'case' : 'cases'} · ` : ''}edited {timeAgo(note.updatedAt)}
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
  const { getToken, signOut } = useAuth()
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

  const exportNote = (note) => downloadText(`${slug(note.title)}.md`, noteToMarkdown(note, cases))

  const open = notes?.find((note) => note.id === id)

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-label text-xs text-secondary">
            &gt; notebook<span className="motion-safe:animate-caret">_</span>
          </p>
          <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Your notes</h1>
          <p className="mt-2 text-muted">Write about your cases in your own words. Type @ to bring one into the page.</p>
        </div>
        <PixelButton onClick={create} disabled={creating || notes === null} className="px-5 py-3">
          {creating ? 'Creating...' : 'New note'}
        </PixelButton>
      </div>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {notes === null ? (
        <p role="status" className="mt-10 font-label text-xs text-muted">
          Loading your notes...
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <nav aria-label="Notes" className={id ? 'hidden lg:block' : ''}>
            <NoteList notes={notes} />
          </nav>

          <section className={id ? '' : 'hidden lg:block'}>
            {id && (
              <Link to="/notes" className="mb-4 inline-block font-label text-xs text-ink hover:text-primary lg:hidden">
                &lt; All notes
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
                />
              </PixelCard>
            ) : (
              <div className="relative grid min-h-64 place-items-center overflow-hidden border-2 border-dashed border-ink/40 p-8 text-center">
                <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-15" />
                <p className="relative max-w-sm text-muted">
                  {id ? 'This note is gone. Pick another one.' : notes.length ? 'Pick a note, or start a new one.' : 'Start your first note. Mention a case with @ and write what you learned.'}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
