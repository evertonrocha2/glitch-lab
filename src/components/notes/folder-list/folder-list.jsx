import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { folderNameProblem, NO_FOLDER, NOTE_FOLDER_LIMITS, normalizeFolderName } from '../../../../shared/note-folders.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import BlockHandle from '../block-handle/block-handle.jsx'

// What a drag carries: a note (from the list) or a folder (from this column).
export const NOTE_DRAG = 'application/x-glitch-note'
const FOLDER_DRAG = 'application/x-glitch-folder'
const carries = (event, type) => [...(event.dataTransfer?.types ?? [])].includes(type)

// The client's own wording for a name the API would refuse (same rules, shared/note-folders.js).
function nameError(t, name) {
  const problem = folderNameProblem(name)
  if (!problem) return ''
  return name ? t('server.folderNameLong', { max: NOTE_FOLDER_LIMITS.name }) : t('server.folderNameEmpty')
}

function FolderIcon({ open = false }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 8 6" shapeRendering="crispEdges" className="h-3 w-4 shrink-0 fill-current">
      <rect x="0" y="0" width="3" height="1" />
      <rect x="0" y="1" width="8" height="1" />
      <rect x="0" y="2" width="1" height="4" />
      <rect x="7" y="2" width="1" height="4" />
      <rect x="0" y="5" width="8" height="1" />
      {open && <rect x="1" y="2" width="6" height="3" opacity="0.35" />}
    </svg>
  )
}

const rowClass = (active, over) =>
  `flex min-h-10 min-w-0 flex-1 items-center gap-2 border-2 px-2.5 text-sm transition-colors ${
    over ? 'border-dashed border-secondary bg-secondary-soft' : active ? 'border-ink bg-primary-soft font-semibold text-ink shadow-pixel' : 'border-transparent text-ink hover:bg-mist'
  }`

// One entry ("All notes", "No folder" or a folder): a link that filters the list. With onDropNote
// it takes a note dropped on it.
function Entry({ to, label, count, active, onDropNote, children, icon, linkRef, onKeyDown, ...rest }) {
  const t = useT()
  const [over, setOver] = useState(false)
  const drop = onDropNote
    ? {
        onDragOver: (event) => {
          if (!carries(event, NOTE_DRAG) && !carries(event, FOLDER_DRAG)) return
          event.preventDefault()
          setOver(true)
        },
        onDragLeave: () => setOver(false),
        onDrop: (event) => {
          setOver(false)
          event.preventDefault()
          onDropNote(event.dataTransfer)
        },
      }
    : {}
  return (
    <li className="group flex min-w-0 items-center gap-1" {...drop} {...rest}>
      <Link
        ref={linkRef}
        to={to}
        aria-current={active ? 'page' : undefined}
        aria-label={t('notes.folders.item', { name: label, count })}
        onKeyDown={onKeyDown}
        className={rowClass(active, over)}
      >
        {icon ?? <FolderIcon open={active} />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={`font-mono text-xs ${active ? 'text-ink' : 'text-muted'}`}>{count}</span>
      </Link>
      {children}
    </li>
  )
}

function FolderRow({ folder, index, total, count, active, to, onRename, onDelete, onReorder, onMoveNote }) {
  const t = useT()
  const [mode, setMode] = useState('view')
  const [name, setName] = useState(folder.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const link = useRef(null)
  const input = useRef(null)
  const keep = useRef(null)
  const formId = useId()

  useEffect(() => {
    if (mode === 'rename') input.current?.select()
    if (mode === 'confirm') keep.current?.focus()
  }, [mode])

  function back() {
    setMode('view')
    setError('')
    // After the row redraws as a link again.
    requestAnimationFrame(() => link.current?.focus())
  }

  async function rename(event) {
    event?.preventDefault()
    const next = normalizeFolderName(name)
    if (next === folder.name) return back()
    const problem = nameError(t, next)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await onRename(folder.id, next)
      back()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function keyDown(event) {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      onReorder(folder.id, index + (event.key === 'ArrowUp' ? -1 : 1))
    } else if (event.key === 'F2') {
      event.preventDefault()
      setName(folder.name)
      setMode('rename')
    }
  }

  if (mode === 'rename') {
    return (
      <li>
        <form onSubmit={rename} className="flex items-center gap-1">
          <label htmlFor={formId} className="sr-only">
            {t('notes.folders.name')}
          </label>
          <input
            ref={input}
            id={formId}
            value={name}
            maxLength={NOTE_FOLDER_LIMITS.name}
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                back()
              }
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${formId}-error` : undefined}
            className="min-h-10 min-w-0 flex-1 border-2 border-ink bg-white px-2 text-sm text-ink focus:outline-none focus-visible:shadow-pixel"
          />
          <button type="submit" disabled={busy} className="min-h-10 px-2 font-label text-[10px] text-primary underline underline-offset-2">
            {t('notes.folders.save')}
          </button>
        </form>
        {error && (
          <p id={`${formId}-error`} role="alert" className="mt-1 text-xs text-primary">
            {error}
          </p>
        )}
      </li>
    )
  }

  return (
    <>
      <Entry
        to={to}
        label={folder.name}
        count={count}
        active={active}
        linkRef={link}
        onKeyDown={keyDown}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(FOLDER_DRAG, folder.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDropNote={(data) => {
          const noteId = data.getData(NOTE_DRAG)
          const folderId = data.getData(FOLDER_DRAG)
          if (noteId) onMoveNote(noteId, folder.id)
          else if (folderId && folderId !== folder.id) onReorder(folderId, index)
        }}
      >
        <BlockHandle
          label={t('notes.folders.menu', { name: folder.name })}
          actions={[
            {
              key: 'rename',
              label: t('notes.folders.rename'),
              onSelect: () => {
                setName(folder.name)
                setMode('rename')
              },
            },
            { key: 'up', label: t('notes.folders.moveUp'), disabled: index === 0, onSelect: () => onReorder(folder.id, index - 1) },
            { key: 'down', label: t('notes.folders.moveDown'), disabled: index === total - 1, onSelect: () => onReorder(folder.id, index + 1) },
            { key: 'delete', label: t('notes.folders.delete'), danger: true, onSelect: () => setMode('confirm') },
          ]}
        />
      </Entry>
      {mode === 'confirm' && (
        <li className="border-2 border-ink bg-white p-2.5 text-sm text-ink shadow-pixel-muted">
          <p>{t('notes.folders.confirm', { name: folder.name })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                setMode('view')
                await onDelete(folder.id)
              }}
              className="min-h-10 border-2 border-ink bg-primary px-3 font-label text-[10px] text-white"
            >
              {t('notes.folders.confirmYes')}
            </button>
            <button ref={keep} type="button" onClick={back} className="min-h-10 border-2 border-ink bg-white px-3 font-label text-[10px] text-ink hover:bg-mist">
              {t('notes.folders.keep')}
            </button>
          </div>
        </li>
      )}
    </>
  )
}

// The folders beside the notes list: "All notes", "No folder", then mine, each with its count.
// A link per entry (the filter lives in the address); drop a note on one to move it there, drag a
// folder to reorder (Alt+Up/Down does the same from the keyboard, F2 renames).
// current: null (all), NO_FOLDER or a folder id. linkFor(value) is where each entry links to.
export default function FolderList({ folders, counts, current, linkFor, open, onToggle, onCreate, onRename, onDelete, onReorder, onMoveNote }) {
  const t = useT()
  const listId = useId()
  const formId = useId()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const newButton = useRef(null)
  const full = folders.length >= NOTE_FOLDER_LIMITS.folders
  const currentName = current === NO_FOLDER ? t('notes.folders.none') : folders.find((folder) => folder.id === current)?.name

  function stopCreating() {
    setCreating(false)
    setName('')
    setError('')
    requestAnimationFrame(() => newButton.current?.focus())
  }

  async function create(event) {
    event.preventDefault()
    const next = normalizeFolderName(name)
    const problem = nameError(t, next)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await onCreate(next)
      stopCreating()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <nav aria-label={t('notes.folders.nav')} className="min-w-0">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink pb-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={listId}
          title={t('notes.folders.toggle')}
          className="flex min-h-10 min-w-0 items-center gap-2 font-label text-xs text-ink hover:text-primary"
        >
          <span aria-hidden="true" className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>
            &gt;
          </span>
          {t('notes.folders.title')}
          {!open && currentName && <span className="truncate font-sans text-xs font-normal text-muted">· {currentName}</span>}
        </button>
        {open && !creating && (
          <button
            ref={newButton}
            type="button"
            onClick={() => setCreating(true)}
            disabled={full}
            aria-label={t('notes.folders.newLabel')}
            className="min-h-10 px-1 font-label text-[10px] text-primary hover:underline disabled:text-muted/50"
          >
            {t('notes.folders.new')}
          </button>
        )}
      </div>
      <div id={listId} hidden={!open}>
        {creating && (
          <form onSubmit={create} className="mt-2">
            <label htmlFor={formId} className="font-label text-[10px] text-muted">
              {t('notes.folders.newLabel')}
            </label>
            <input
              id={formId}
              // biome-ignore lint/a11y/noAutofocus: the field appears because the writer asked for it
              autoFocus
              value={name}
              maxLength={NOTE_FOLDER_LIMITS.name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  stopCreating()
                }
              }}
              placeholder={t('notes.folders.namePlaceholder')}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${formId}-error` : undefined}
              className="mt-1 min-h-10 w-full border-2 border-ink bg-white px-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
            />
            {error && (
              <p id={`${formId}-error`} role="alert" className="mt-1 text-xs text-primary">
                {error}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button type="submit" disabled={busy} className="min-h-10 border-2 border-ink bg-primary px-3 font-label text-[10px] text-white shadow-pixel-ink">
                {t('notes.folders.create')}
              </button>
              <button type="button" onClick={stopCreating} className="min-h-10 border-2 border-ink bg-white px-3 font-label text-[10px] text-ink hover:bg-mist">
                {t('notes.folders.cancel')}
              </button>
            </div>
          </form>
        )}
        <ul className="mt-2 space-y-1">
          <Entry to={linkFor(null)} label={t('notes.folders.all')} count={counts.all} active={current === null} icon={<span aria-hidden="true" className="w-4 shrink-0 text-center font-label text-[10px] text-primary">*</span>} />
          <Entry
            to={linkFor(NO_FOLDER)}
            label={t('notes.folders.none')}
            count={counts.none}
            active={current === NO_FOLDER}
            onDropNote={(data) => {
              const noteId = data.getData(NOTE_DRAG)
              if (noteId) onMoveNote(noteId, null)
            }}
          />
          {folders.map((folder, index) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              index={index}
              total={folders.length}
              count={counts.byFolder.get(folder.id) ?? 0}
              active={current === folder.id}
              to={linkFor(folder.id)}
              onRename={onRename}
              onDelete={onDelete}
              onReorder={onReorder}
              onMoveNote={onMoveNote}
            />
          ))}
        </ul>
        {full && <p className="mt-2 text-xs text-muted">{t('notes.folders.full', { max: NOTE_FOLDER_LIMITS.folders })}</p>}
        {folders.length > 0 && <p className="mt-3 text-xs leading-snug text-muted">{t('notes.folders.hint')}</p>}
      </div>
    </nav>
  )
}
