import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { folderCounts, moveFolder, NO_FOLDER } from '../../../shared/note-folders.js'
import { tagCounts } from '../../../shared/note-tags.js'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import FolderList, { NOTE_DRAG } from '../../components/notes/folder-list/folder-list.jsx'
import NoteEditor from '../../components/notes/note-editor/note-editor.jsx'
import NoteTags from '../../components/notes/note-tags/note-tags.jsx'
import TagFilter from '../../components/notes/tag-filter/tag-filter.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import {
  AuthError,
  createNote,
  createNoteFolder,
  deleteNote,
  deleteNoteFolder,
  listCases,
  listNoteFolders,
  listNotes,
  moveNoteToFolder,
  noteAi,
  setNotePublic,
  updateNote,
  updateNoteFolder,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { exportNoteImage, exportNoteMarkdown, exportNotePdf } from '../../lib/export-note.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import { newBlock } from '../../lib/notes/blocks.js'
import { filterNotes, filterParams, readFilters } from '../../lib/notes/filter.js'
import { useMyProfile } from '../../lib/profile/my-profile.js'
import { useProgressRefresh } from '../../lib/progress/progress-provider.jsx'
import NotesPageSkeleton from './notes-page-skeleton.jsx'

const EXPORTS = { md: exportNoteMarkdown, png: exportNoteImage, pdf: exportNotePdf }

const caseCount = (note) => note.blocks.filter((block) => block.type === 'case').length

// The folder column stays open or closed as the writer left it; at first, open on a wide screen
// and closed on a phone, where it sits above the list.
const FOLDERS_OPEN = 'gd:notes-folders-open'
function foldersOpenAtFirst() {
  try {
    const saved = localStorage.getItem(FOLDERS_OPEN)
    if (saved !== null) return saved === '1'
  } catch {
    // Storage blocked: fall back to the screen size.
  }
  return window.matchMedia?.('(min-width: 1024px)').matches ?? true
}

// Whether notes can go on your public profile: never for demos, only once the profile is public.
function sharingFor(user, profile) {
  if (user.isDemo) return { status: 'demo' }
  if (!profile) return { status: 'loading' }
  if (!profile.isPublic || !profile.handle) return { status: 'private' }
  return { status: 'ready', handle: profile.handle }
}

// search: the list filters, carried along so opening a note keeps them. A note drags onto a folder
// (the editor's "Move to folder" is the keyboard way).
function NoteList({ notes, showPublic, search, empty }) {
  const t = useT()
  const { timeAgo } = useFormat()
  if (notes.length === 0) return empty ?? <p className="text-sm text-muted">{t('notes.empty')}</p>
  return (
    <ul className="space-y-2">
      {notes.map((note) => {
        const count = caseCount(note)
        return (
          <li key={note.id}>
            <NavLink
              to={{ pathname: `/notes/${note.id}`, search }}
              draggable
              title={t('notes.folders.dragNote')}
              onDragStart={(event) => {
                event.dataTransfer.setData(NOTE_DRAG, note.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
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
              <NoteTags tags={note.tags} max={3} inLink className="mt-1.5" />
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
  const { search } = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const t = useT()
  const { user, getToken, signOut } = useAuth()
  const myProfile = useMyProfile()
  const refreshProgress = useProgressRefresh()
  const [notes, setNotes] = useState(null)
  const [cases, setCases] = useState([])
  const [folders, setFolders] = useState([])
  const [foldersOpen, setFoldersOpen] = useState(foldersOpenAtFirst)
  // Said out loud after a move ("Moved to Work."), since a drag has no other feedback for a screen reader.
  const [moved, setMoved] = useState('')
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
      .then((token) => Promise.all([listNotes(token), listCases(token), listNoteFolders(token)]))
      .then(([noteList, caseList, folderList]) => {
        if (!alive) return
        setNotes(noteList)
        setCases(caseList)
        setFolders(folderList)
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
      // Inside the folder on screen, so the new note shows up in the list being looked at.
      const folderId = folders.some((folder) => folder.id === filters.folder) ? filters.folder : undefined
      const note = await createNote({ title: '', blocks: [newBlock('text')], folderId }, await getToken())
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
        // Its folder is the one on screen: a move sent while this save was out may not be in `saved`.
        setNotes((current) => {
          const mine = current?.find((note) => note.id === noteId)
          return mine ? [{ ...saved, folderId: mine.folderId ?? null }, ...current.filter((note) => note.id !== noteId)] : current
        })
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
      navigate({ pathname: '/notes', search })
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

  // Into a folder (or out of every folder with null), right away on screen and put back if the
  // server says no.
  async function moveNote(noteId, folderId) {
    const before = notes?.find((note) => note.id === noteId)
    if (!before || (before.folderId ?? null) === folderId) return
    setMessage('')
    setNotes((current) => current.map((note) => (note.id === noteId ? { ...note, folderId } : note)))
    try {
      await moveNoteToFolder(noteId, folderId, await getToken())
      const name = folders.find((folder) => folder.id === folderId)?.name
      setMoved(name ? t('notes.folders.moved', { name }) : t('notes.folders.movedOut'))
    } catch (err) {
      setNotes((current) => current.map((note) => (note.id === noteId ? { ...note, folderId: before.folderId ?? null } : note)))
      await handleError(err)
    }
  }

  async function createFolder(name) {
    try {
      const folder = await createNoteFolder(name, await getToken())
      setFolders((current) => [...current, folder])
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      throw err
    }
  }

  async function renameFolder(id, name) {
    try {
      const folder = await updateNoteFolder(id, { name }, await getToken())
      setFolders((current) => current.map((item) => (item.id === id ? { ...item, name: folder.name } : item)))
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      throw err
    }
  }

  // Moves at once on screen; the server renumbers the rest the same way.
  async function reorderFolder(id, to) {
    const before = folders
    const next = moveFolder(before, id, to)
    if (next === before) return
    setFolders(next.map((folder, index) => ({ ...folder, position: index })))
    try {
      await updateNoteFolder(id, { position: next.findIndex((folder) => folder.id === id) }, await getToken())
    } catch (err) {
      setFolders(before)
      await handleError(err)
    }
  }

  // Its notes stay, outside every folder. Looking at that folder? Then back to all notes.
  async function removeFolder(id) {
    setMessage('')
    try {
      await deleteNoteFolder(id, await getToken())
      setFolders((current) => current.filter((folder) => folder.id !== id))
      setNotes((current) => current.map((note) => (note.folderId === id ? { ...note, folderId: null } : note)))
      if (filters.folder === id) setFilters({ folder: null })
    } catch (err) {
      await handleError(err)
    }
  }

  const askAi = useCallback(
    async (noteId, payload, signal) => {
      try {
        return await noteAi(noteId, payload, await getToken(), { signal })
      } catch (err) {
        if (err instanceof AuthError) await signOut()
        throw err
      }
    },
    [getToken, signOut],
  )

  function toggleFolders() {
    setFoldersOpen((current) => {
      try {
        localStorage.setItem(FOLDERS_OPEN, current ? '0' : '1')
      } catch {
        // Not remembered this time; the column still opens and closes.
      }
      return !current
    })
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
  // Every note is already here (the API caps them at 200), so the filters run in the page: instant,
  // and they see edits the server hasn't answered yet.
  const counts = tagCounts(notes ?? [])
  const known = new Set(folders.map((folder) => folder.id))
  // A folder in the address that isn't mine (deleted, or a stale link) shows every note.
  const folder = filters.folder === NO_FOLDER || known.has(filters.folder) ? filters.folder : null
  const visible = filterNotes(notes ?? [], { ...filters, folder }, known)
  const perFolder = folderCounts(notes ?? [], folders)

  // Replace, not push: typing a search shouldn't fill the back button with one entry per letter.
  function setFilters(changes) {
    setParams(filterParams({ ...filters, folder, ...changes }), { replace: true })
  }
  const toggleTag = (tag) => setFilters({ tags: filters.tags.includes(tag) ? filters.tags.filter((item) => item !== tag) : [...filters.tags, tag] })
  // The folder stays: Clear is about the tags and the search.
  const clearFilters = () => setFilters({ tags: [], query: '' })
  // Each folder links to the same page with only the folder changed.
  const linkFor = (value) => {
    const query = filterParams({ ...filters, folder: value }).toString()
    return { pathname: id ? `/notes/${id}` : '/notes', search: query ? `?${query}` : '' }
  }

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
        !message && <NotesPageSkeleton withNote={Boolean(id)} />
      ) : (
        <div
          className={`mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:gap-6 ${foldersOpen ? 'lg:grid-cols-[12.5rem_15rem_minmax(0,1fr)]' : 'lg:grid-cols-[auto_16rem_minmax(0,1fr)]'}`}
        >
          <div className={id ? 'hidden lg:block' : ''}>
            <FolderList
              folders={folders}
              counts={perFolder}
              current={folder}
              linkFor={linkFor}
              open={foldersOpen}
              onToggle={toggleFolders}
              onCreate={createFolder}
              onRename={renameFolder}
              onDelete={removeFolder}
              onReorder={reorderFolder}
              onMoveNote={moveNote}
            />
            <p aria-live="polite" className="sr-only">
              {moved}
            </p>
          </div>
          <nav aria-label={t('notes.nav')} className={id ? 'hidden lg:block' : ''}>
            {notes.length > 0 && (
              <TagFilter
                counts={counts}
                selected={filters.tags}
                query={filters.query}
                onToggle={toggleTag}
                onQuery={(query) => setFilters({ query })}
                onClear={clearFilters}
              />
            )}
            <NoteList
              notes={visible}
              showPublic={sharing.status === 'ready'}
              search={search}
              empty={
                notes.length > 0 ? (
                  <div className="border-2 border-dashed border-ink/40 p-4 text-sm text-muted">
                    <p>{filters.tags.length ? t('notes.filter.empty') : filters.query ? t('notes.filter.emptySearch') : t('notes.folders.empty')}</p>
                    {(filters.tags.length > 0 || filters.query) && (
                      <button type="button" onClick={clearFilters} className="mt-2 min-h-10 font-label text-[10px] text-ink underline underline-offset-2 hover:text-primary">
                        {t('notes.filter.clear')}
                      </button>
                    )}
                  </div>
                ) : null
              }
            />
          </nav>

          <section className={id ? '' : 'hidden lg:block'}>
            {id && (
              <Link to={{ pathname: '/notes', search }} className="-my-3 mb-1 inline-flex min-h-10 items-center font-label text-xs text-ink hover:text-primary lg:hidden">
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
                  tagSuggestions={counts.map((item) => item.tag)}
                  folders={folders}
                  onMove={(folderId) => moveNote(open.id, folderId)}
                  onAi={(payload, signal) => askAi(open.id, payload, signal)}
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
