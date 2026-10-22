import { useCallback, useEffect, useRef, useState } from 'react'
import { conceptLabel } from '../../../shared/concepts.js'
import { NOTE_LIMITS } from '../../../shared/limits.js'
import { splitError } from '../../lib/caseInfo.js'
import { insertAfter, matchCases, mentionAt, newBlock, placeCase, removeBlock, updateBlock } from '../../lib/notes/blocks.js'
import PixelButton from '../pixel/PixelButton.jsx'
import BlockMenu from './BlockMenu.jsx'
import CaseBlock from './CaseBlock.jsx'
import ExportMenu from './ExportMenu.jsx'

export const SAVE_AFTER_MS = 700
// The menu opened from the "Add" bar rather than from a block.
const APPEND = 'append'
const MENU_ID = 'note-block-menu'
const STATUS = { new: 'New', training: 'Training', solved: 'Solved' }

const BLOCK_TYPES = [
  { key: 'text', label: 'Text', sub: 'Plain writing' },
  { key: 'heading', label: 'Heading', sub: 'A section title' },
  { key: 'todo', label: 'To-do', sub: 'Something to practice' },
  { key: 'case', label: 'Case from your board', sub: 'Same as typing @' },
]

const SAVE_TEXT = { saved: 'Saved', unsaved: 'Unsaved changes', saving: 'Saving...', error: "Couldn't save." }

const lineClass = 'w-full bg-transparent text-ink placeholder:text-muted/60 focus-visible:outline-none'

function caseOption(item) {
  const { type, message } = splitError(item.error)
  return {
    key: item.id,
    caseId: item.id,
    label: message ? `${type}: ${message}` : type,
    sub: `${conceptLabel(item.concept)} · ${item.language} · ${STATUS[item.status]}`,
  }
}

// A Notion-style page: a title and a list of blocks. Saves on its own a moment after you stop typing.
export default function NoteEditor({ note, cases, onSave, onDelete, onExport }) {
  const [initialBlocks] = useState(() => (note.blocks.length ? note.blocks : [newBlock('text')]))
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState(initialBlocks)
  // { blockId, kind: 'slash' | 'case', start, query, active }
  const [menu, setMenu] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const [status, setStatus] = useState('saved')
  const [confirming, setConfirming] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fields = useRef(new Map())
  const saved = useRef(JSON.stringify({ title: note.title, blocks: initialBlocks }))
  const latest = useRef({ title, blocks })
  latest.current = { title, blocks }
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  // Saves run one after another, so an older save can never land after a newer one.
  const queue = useRef(Promise.resolve())

  const flush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const snapshot = latest.current
      const json = JSON.stringify(snapshot)
      if (json === saved.current) return
      setStatus('saving')
      try {
        await onSaveRef.current(snapshot)
        saved.current = json
        setStatus(JSON.stringify(latest.current) === json ? 'saved' : 'unsaved')
      } catch (err) {
        setSaveError(err.message)
        setStatus('error')
      }
    })
    return queue.current
  }, [])

  useEffect(() => {
    if (JSON.stringify({ title, blocks }) === saved.current) return
    setStatus('unsaved')
    const timer = setTimeout(flush, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [title, blocks, flush])

  // Leaving the note saves whatever the timer hadn't sent yet, in line after any save still running.
  useEffect(() => () => flush(), [flush])

  // Closing the tab skips React's cleanup: send the last edits with keepalive so they still arrive,
  // and warn before leaving a note the server keeps refusing.
  const failing = useRef(false)
  failing.current = status === 'error'
  useEffect(() => {
    const onHide = () => {
      if (JSON.stringify(latest.current) !== saved.current) onSaveRef.current(latest.current, { keepalive: true }).catch(() => {})
    }
    const onBeforeUnload = (event) => {
      if (failing.current) event.preventDefault()
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  useEffect(() => {
    if (!focusId) return
    const field = fields.current.get(focusId)
    if (field) {
      field.focus()
      const end = field.value.length
      field.setSelectionRange(end, end)
    }
    setFocusId(null)
  }, [focusId])

  const register = (id) => (element) => {
    if (element) fields.current.set(id, element)
    else fields.current.delete(id)
  }

  // placeCase can add two blocks (the case and a line after it).
  const full = blocks.length + 2 > NOTE_LIMITS.blocks
  const casesById = new Map(cases.map((item) => [item.id, item]))
  const items = !menu ? [] : menu.kind === 'slash' ? BLOCK_TYPES : matchCases(cases, menu.query, conceptLabel).map(caseOption)
  const active = Math.min(menu?.active ?? 0, Math.max(items.length - 1, 0))

  function pick(item) {
    if (menu.kind === 'slash') {
      if (item.key === 'case') {
        // Swap the "/" for "@" so typing keeps filtering the cases, just like a mention.
        setBlocks((current) => updateBlock(current, menu.blockId, { text: '@' }))
        setMenu({ blockId: menu.blockId, kind: 'case', start: 0, query: '', active: 0 })
        setFocusId(menu.blockId)
        return
      }
      setBlocks((current) => current.map((block) => (block.id === menu.blockId ? { ...newBlock(item.key), id: block.id } : block)))
      setFocusId(menu.blockId)
      setMenu(null)
      return
    }
    if (full) {
      setMenu(null)
      return
    }
    const target = menu.blockId === APPEND ? null : menu.blockId
    const placed = placeCase(blocks, target, item.caseId, { start: menu.start, query: menu.query })
    setBlocks(placed.blocks)
    setFocusId(placed.focusId)
    setMenu(null)
  }

  // Arrow keys, Enter and Escape belong to the menu while it's open. true when the key was used.
  function menuKey(event) {
    if (!menu) return false
    const count = items.length
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count) {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setMenu((current) => ({ ...current, active: (active + step + count) % count }))
      return true
    }
    if (event.key === 'Enter' && count) {
      event.preventDefault()
      pick(items[active])
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setMenu(null)
      return true
    }
    return false
  }

  function changeText(block, value, caret) {
    setBlocks((current) => updateBlock(current, block.id, { text: value }))
    if (block.type === 'text' && value === '/') {
      setMenu({ blockId: block.id, kind: 'slash', active: 0 })
      return
    }
    const mention = mentionAt(value, caret)
    if (mention) {
      setMenu((current) => ({ blockId: block.id, kind: 'case', ...mention, active: current?.query === mention.query ? current.active : 0 }))
    } else if (menu?.blockId === block.id) {
      setMenu(null)
    }
  }

  function keyDown(event, block) {
    if (menu?.blockId === block.id && menuKey(event)) return
    // Headings and to-dos are one line: Enter starts the next block instead of a line break.
    if (event.key === 'Enter' && block.type !== 'text') {
      event.preventDefault()
      if (full) return
      const next = newBlock(block.type === 'todo' ? 'todo' : 'text')
      setBlocks((current) => insertAfter(current, block.id, next))
      setFocusId(next.id)
    } else if (event.key === 'Backspace' && block.text === '' && blocks.length > 1) {
      event.preventDefault()
      const index = blocks.findIndex((item) => item.id === block.id)
      const previous = blocks
        .slice(0, index)
        .reverse()
        .find((item) => item.type !== 'case')
      setBlocks((current) => removeBlock(current, block.id))
      if (previous) setFocusId(previous.id)
    }
  }

  function append(type) {
    if (full) return
    const block = newBlock(type)
    setBlocks((current) => [...current, block])
    setFocusId(block.id)
  }

  const closeMenuFor = (blockId) => () => setMenu((current) => (current?.blockId === blockId ? null : current))

  function menuFor(blockId, extra = {}) {
    if (menu?.blockId !== blockId) return null
    return (
      <BlockMenu
        id={MENU_ID}
        label={menu.kind === 'slash' ? 'Turn into' : 'Mention a case'}
        items={items}
        active={active}
        onPick={pick}
        empty={cases.length ? 'No case matches that.' : 'Your board is empty. Investigate an error first.'}
        {...extra}
      />
    )
  }

  function inputProps(block) {
    const open = menu?.blockId === block.id && items.length > 0
    return {
      ref: register(block.id),
      value: block.text,
      onChange: (event) => changeText(block, event.target.value, event.target.selectionStart),
      onKeyDown: (event) => keyDown(event, block),
      onBlur: closeMenuFor(block.id),
      maxLength: NOTE_LIMITS.text,
      'aria-controls': open ? MENU_ID : undefined,
      'aria-activedescendant': open ? `${MENU_ID}-${active}` : undefined,
    }
  }

  function control(block) {
    switch (block.type) {
      case 'heading':
        return (
          <textarea
            {...inputProps(block)}
            rows={1}
            aria-label="Heading"
            placeholder="Heading"
            className={`${lineClass} block resize-none pt-3 font-pixel text-2xl font-bold field-sizing-content`}
          />
        )
      case 'todo':
        return (
          <div className="flex items-start gap-2.5 py-0.5">
            <input
              type="checkbox"
              checked={block.done}
              onChange={(event) => setBlocks((current) => updateBlock(current, block.id, { done: event.target.checked }))}
              aria-label={`Done: ${block.text || 'to-do'}`}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <textarea
              {...inputProps(block)}
              rows={1}
              aria-label="To-do"
              placeholder="To-do"
              className={`${lineClass} block resize-none field-sizing-content ${block.done ? 'text-muted line-through' : ''}`}
            />
          </div>
        )
      case 'case':
        return <CaseBlock item={casesById.get(block.caseId)} />
      default:
        return (
          <textarea
            {...inputProps(block)}
            rows={1}
            aria-label="Text"
            placeholder="Write something. Type @ to mention a case, / for more."
            className={`${lineClass} block resize-none py-1 leading-relaxed field-sizing-content`}
          />
        )
    }
  }

  return (
    <article aria-label="Note editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="flex items-center gap-2 font-label text-[10px] text-muted">
          <span aria-hidden="true" className={`size-2 border border-ink ${status === 'saved' ? 'bg-primary' : status === 'error' ? 'bg-ink' : 'bg-white'}`} />
          {status === 'error' ? saveError || SAVE_TEXT.error : SAVE_TEXT[status]}
          {status === 'error' && (
            <button type="button" onClick={flush} className="text-primary underline underline-offset-2">
              Retry
            </button>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportMenu onExport={(format) => onExport({ ...note, title, blocks }, format)} />
          {confirming ? (
            <>
              <PixelButton variant="secondary" onClick={onDelete} className="px-3 py-2">
                Yes, delete
              </PixelButton>
              <PixelButton variant="ghost" onClick={() => setConfirming(false)} className="px-3 py-2">
                Keep it
              </PixelButton>
            </>
          ) : (
            <PixelButton variant="ghost" onClick={() => setConfirming(true)} className="px-3 py-2">
              Delete
            </PixelButton>
          )}
        </div>
      </div>

      <textarea
        rows={1}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          const first = blocks.find((block) => block.type !== 'case')
          if (first) setFocusId(first.id)
        }}
        maxLength={120}
        aria-label="Note title"
        placeholder="Untitled"
        className={`${lineClass} mt-5 block resize-none font-pixel text-3xl font-bold field-sizing-content sm:text-4xl`}
      />
      <p className="mt-2 text-sm text-muted">
        Type <kbd className="border border-line bg-white px-1 font-mono text-xs text-ink">@</kbd> to bring in a case from your board,{' '}
        <kbd className="border border-line bg-white px-1 font-mono text-xs text-ink">/</kbd> for other blocks.
      </p>

      <div className="mt-6 space-y-2">
        {blocks.map((block) => (
          <div key={block.id} className="group relative flex items-start gap-2">
            <div className="min-w-0 flex-1">{control(block)}</div>
            <button
              type="button"
              onClick={() => setBlocks((current) => removeBlock(current, block.id))}
              aria-label="Remove this block"
              className="mt-1 px-1.5 text-lg leading-none text-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ink focus:opacity-100"
            >
              ×
            </button>
            {menuFor(block.id)}
          </div>
        ))}
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-line pt-4">
        <span className="mr-1 font-label text-[10px] text-muted">Add</span>
        {[
          ['text', '+ Text'],
          ['heading', '+ Heading'],
          ['todo', '+ To-do'],
        ].map(([type, label]) => (
          <PixelButton key={type} variant="ghost" onClick={() => append(type)} disabled={full} className="px-2.5 py-1.5">
            {label}
          </PixelButton>
        ))}
        <PixelButton
          variant="secondary"
          onClick={() => setMenu({ blockId: APPEND, kind: 'case', start: 0, query: '', active: 0 })}
          disabled={full}
          className="px-2.5 py-1.5"
        >
          @ Case
        </PixelButton>
        {full && <span className="text-xs text-muted">This note is full. Start a new one to keep going.</span>}
        {menuFor(APPEND, {
          search: menu?.query ?? '',
          onSearch: (query) => setMenu((current) => ({ ...current, query, active: 0 })),
          onKeyDown: menuKey,
          onClose: closeMenuFor(APPEND),
        })}
      </div>
    </article>
  )
}
