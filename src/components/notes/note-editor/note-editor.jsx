import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { conceptLabel } from '../../../../shared/concepts.js'
import { NOTE_LIMITS } from '../../../../shared/limits.js'
import { NOTE_AI_ACTIONS } from '../../../../shared/note-ai.js'
import { CALLOUT_EMOJI, CALLOUT_TONES, hasMarks, headingLevel, isList, listNumbers } from '../../../../shared/note-blocks.js'
import { isQuestion } from '../../../../shared/question.js'
import { caseHeading } from '../../../lib/case-info.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'
import {
  blockWords,
  duplicateBlock,
  emojiQueryAt,
  indentText,
  insertAfter,
  insertBefore,
  markdownShortcut,
  matchCases,
  matchSlash,
  mentionAt,
  moveBlock,
  moveBlockTo,
  newBlock,
  outdentText,
  placeCase,
  removeBlock,
  slashAt,
  splitInsert,
  splitText,
  updateBlock,
  wrapSelection,
} from '../../../lib/notes/blocks.js'
import { caretPoint } from '../../../lib/notes/caret.js'
import { rememberEmoji, searchEmojis, useEmojis } from '../../../lib/notes/emoji.js'
import CodeEditorShortcuts from '../../ui/code-editor/code-editor-shortcuts.jsx'
import ErrorNotice from '../../ui/error-notice/error-notice.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import Working from '../../ui/working/working.jsx'
import AiPreview from '../ai-preview/ai-preview.jsx'
import BlockHandle from '../block-handle/block-handle.jsx'
import BlockMenu from '../block-menu/block-menu.jsx'
import CaseBlock from '../case-block/case-block.jsx'
import CodeBlock from '../code-block/code-block.jsx'
import EmojiPicker from '../emoji-picker/emoji-picker.jsx'
import ExportMenu from '../export-menu/export-menu.jsx'
import InlineText from '../inline-text/inline-text.jsx'
import MenuButton from '../menu-button/menu-button.jsx'
import { CALLOUT_TONE } from '../rich-blocks/rich-blocks.jsx'
import ShareToggle from '../share-toggle/share-toggle.jsx'
import TagInput from '../tag-input/tag-input.jsx'
import useBlockDrag from './use-block-drag.js'

export const SAVE_AFTER_MS = 700
// The menu opened from the "Add" bar rather than from a block.
const APPEND = 'append'
const MENU_ID = 'note-block-menu'
const PICKER_ID = 'note-emoji-picker'
const KEYS_ID = 'note-editor-keys'
// The block menu's widest (max-w-md), to keep one opened at the caret inside the block.
const MENU_WIDTH = 448
// Keys that move the caret: after one, a menu opened by "/", "@" or ":" checks it is still there.
const CARET_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])
// What opened each inline menu, so it can tell when the caret has left it.
const TRIGGERS = { slash: slashAt, case: mentionAt, emoji: emojiQueryAt }
// Typing in one block within this long is a single step for undo.
const TYPING_MS = 1000
const HISTORY_MAX = 100
const NOTICE_MS = 8000
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'])
// Enter in these starts another of the same kind; on an empty one it goes back to plain text.
const CONTINUES = ['todo', 'bullet', 'numbered', 'quote']
// By physical key first, so the shortcuts work on any keyboard layout.
const MARK_KEYS = { KeyB: 'bold', KeyI: 'italic', KeyE: 'code', KeyK: 'link' }
const MARK_LETTERS = { b: 'bold', i: 'italic', e: 'code', k: 'link' }

const SAVE_TEXT = { saved: 'notes.editor.saved', unsaved: 'notes.editor.unsaved', saving: 'notes.editor.saving', error: 'notes.editor.saveFailed' }

const NOTE_SHORTCUTS = [
  { combos: [['/']], label: 'notes.keys.slash' },
  { combos: [['Enter'], ['Shift', 'Enter']], label: 'notes.keys.lineBreak' },
  { combos: [['Enter']], label: 'notes.keys.newBlock' },
  { combos: [['Tab'], ['Shift', 'Tab']], label: 'notes.keys.indent' },
  { combos: [['Mod', 'Enter'], ['Mod', 'Shift', 'Enter']], label: 'notes.keys.below' },
  { combos: [['Alt', 'Up'], ['Alt', 'Down']], label: 'notes.keys.move' },
  { combos: [['Mod', 'D']], label: 'notes.keys.duplicate' },
  { combos: [['Mod', 'Shift', 'K']], label: 'notes.keys.delete' },
  { combos: [['Mod', '/']], label: 'notes.keys.menu' },
  { combos: [['Mod', 'B'], ['Mod', 'I'], ['Mod', 'E'], ['Mod', 'K']], label: 'notes.keys.marks' },
  { combos: [['Mod', 'Z'], ['Mod', 'Shift', 'Z']], label: 'notes.keys.undo' },
  { combos: [['Esc'], ['Tab']], label: 'editor.keys.leave', sequence: true },
]

const lineClass = 'w-full bg-transparent text-ink placeholder:text-muted/60 focus-visible:outline-none'
const HEADING_CLASS = ['pt-3 text-2xl', 'pt-2 text-xl', 'pt-1 text-lg']
const FIELD_LABEL = { text: 'notes.block.text', todo: 'notes.block.todo', quote: 'notes.block.quote', bullet: 'notes.block.bulletItem', numbered: 'notes.block.numberedItem', callout: 'notes.block.calloutText' }

const isMod = (event) => event.ctrlKey || event.metaKey
const keyIs = (event, letter) => event.key.toLowerCase() === letter || event.code === `Key${letter.toUpperCase()}`
const focusable = (block) => block.type !== 'case'

function caseOption(item, labels, t) {
  const { type, message } = caseHeading(item)
  // A question card shows its badge and topic in front of its bug type.
  const kind = isQuestion(item) ? `${t('question.badge')} · ${item.topic} · ` : ''
  return {
    key: item.id,
    caseId: item.id,
    label: message ? `${type}: ${message}` : type,
    sub: `${kind}${labels.concept(item.concept)} · ${item.language} · ${labels.status(item.status)}`,
  }
}

const fieldLabel = (block, t) => (block.type === 'heading' ? t(`notes.block.heading${headingLevel(block)}`) : t(FIELD_LABEL[block.type] ?? 'notes.block.text'))

// A Notion-style page: a title, tags and a list of blocks. Saves on its own a moment after you stop
// typing. The keys work like an IDE's (Tab nests, Enter continues, Ctrl+Z undoes across blocks), with
// Esc then Tab as the way out. With onShare, a switch puts the note on your public profile.
// tagSuggestions: the writer's tags across every note, offered as they type a tag.
// folders and onMove(folderId): the "Move to folder" menu. onAi({ action, blockIds }, signal): the AI
// tools, answering { blockIds, blocks } to preview; nothing changes until the writer applies it.
export default function NoteEditor({ note, cases, onSave, onDelete, onExport, sharing, onShare, tagSuggestions = [], folders, onMove, onAi }) {
  const t = useT()
  const aiButtonId = useId()
  const labels = useLabels()
  const [initialBlocks] = useState(() => (note.blocks.length ? note.blocks : [newBlock('text')]))
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState(initialBlocks)
  const [tags, setTags] = useState(note.tags ?? [])
  // { blockId, kind: 'slash' | 'case' | 'emoji', start, query, active, searchable, at }: at is where
  // the menu sits in the block ({ top, left }), under the caret that opened it.
  const [menu, setMenu] = useState(null)
  // { id, start?, end? }: where the caret goes next (the end of the text when no start).
  const [focus, setFocus] = useState(null)
  // The block being typed in: it shows its markdown as typed, the others show it drawn.
  const [editing, setEditing] = useState(null)
  // { blockId, kind: 'insert' | 'callout', spot }: the emoji picker and where its emoji goes.
  const [picker, setPicker] = useState(null)
  const [wantEmojis, setWantEmojis] = useState(false)
  // What the line next to the save status says, with an Undo: 'deleted' (a block) or 'ai' (applied).
  const [notice, setNotice] = useState(null)
  // "Moved to position 3 of 5", read out after a block moves.
  const [moved, setMoved] = useState('')
  const [status, setStatus] = useState('saved')
  const [confirming, setConfirming] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Blocks picked for the AI from their handle menus, in the order picked.
  const [selected, setSelected] = useState([])
  // 'selection' (the picked blocks, or the block with selected text) or 'all'.
  const [aiScope, setAiScope] = useState('selection')
  // null, { phase: 'working', action } or { phase: 'preview', action, blockIds, before, after }.
  const [ai, setAi] = useState(null)
  const [aiError, setAiError] = useState('')
  const aiRun = useRef(null)
  // The block whose text was selected when the AI button was reached.
  const textPick = useRef(null)
  const emojiData = useEmojis(wantEmojis)
  const fields = useRef(new Map())
  const blocksRef = useRef(blocks)
  const history = useRef({ past: [], future: [], key: null, at: 0 })
  // The last caret in a block, so the toolbar's emoji lands where you were writing.
  const caret = useRef(null)
  // Esc frees Tab for one press, so keyboard users can leave the editor.
  const leaving = useRef(false)
  const pickerReturn = useRef(null)
  const saved = useRef(JSON.stringify({ title: note.title, blocks: initialBlocks, tags: note.tags ?? [] }))
  const latest = useRef({ title, blocks, tags })
  latest.current = { title, blocks, tags }
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  // Saves run one after another, so an older save can never land after a newer one.
  const queue = useRef(Promise.resolve())

  // Resolves true once what was written so far is saved, false when the save failed.
  const flush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const snapshot = latest.current
      const json = JSON.stringify(snapshot)
      if (json === saved.current) return true
      setStatus('saving')
      try {
        await onSaveRef.current(snapshot)
        saved.current = json
        setStatus(JSON.stringify(latest.current) === json ? 'saved' : 'unsaved')
        return true
      } catch (err) {
        setSaveError(err.message)
        setStatus('error')
        return false
      }
    })
    return queue.current
  }, [])

  useEffect(() => {
    if (JSON.stringify({ title, blocks, tags }) === saved.current) return
    setStatus('unsaved')
    const timer = setTimeout(flush, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [title, blocks, tags, flush])

  // Leaving the note saves whatever the timer hadn't sent yet, in line after any save still running,
  // and stops waiting for the AI.
  useEffect(
    () => () => {
      aiRun.current?.abort()
      flush()
    },
    [flush],
  )

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
    if (!focus) return
    const field = fields.current.get(focus.id)
    if (field) {
      field.focus()
      if (field.setSelectionRange) {
        const end = field.value.length
        field.setSelectionRange(Math.min(focus.start ?? end, end), Math.min(focus.end ?? focus.start ?? end, end))
      }
    }
    setFocus(null)
  }, [focus])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // A stable callback per block id, so a code block registers its textarea once.
  const registers = useRef(new Map())
  const register = (id) => {
    if (!registers.current.has(id)) {
      registers.current.set(id, (element) => {
        if (element) fields.current.set(id, element)
        else fields.current.delete(id)
      })
    }
    return registers.current.get(id)
  }

  // Every change to the blocks goes through here, so undo can step back over it. Typing in one
  // block (same key, soon after) adds to the last step instead of making a new one.
  function apply(next, key = null) {
    const current = blocksRef.current
    if (next === current) return
    const log = history.current
    const now = Date.now()
    if (!key || key !== log.key || now - log.at > TYPING_MS) {
      log.past.push(current)
      if (log.past.length > HISTORY_MAX) log.past.shift()
    }
    log.future = []
    log.key = key
    log.at = now
    blocksRef.current = next
    setBlocks(next)
  }

  function travel(from, to) {
    const log = history.current
    if (!log[from].length) return
    const current = blocksRef.current
    const next = log[from].pop()
    log[to].push(current)
    log.key = null
    blocksRef.current = next
    setBlocks(next)
    setMenu(null)
    setNotice(null)
    // The caret goes to the first block that changed, so you see what came back.
    let index = 0
    while (index < next.length && next[index] === current[index]) index++
    const target = next.slice(Math.min(index, next.length - 1)).find(focusable) ?? next.findLast(focusable)
    if (target) setFocus({ id: target.id })
  }
  const undo = () => travel('past', 'future')
  const redo = () => travel('future', 'past')

  // placeCase can add two blocks (the case and a line after it).
  const full = blocks.length + 2 > NOTE_LIMITS.blocks
  const numbers = listNumbers(blocks)
  const casesById = new Map(cases.map((item) => [item.id, item]))
  // Search finds a bug type by its English name and by its name in the reader's language.
  const conceptWords = (id) => `${conceptLabel(id)} ${labels.concept(id)}`
  const slashLabel = (item) => t(`notes.block.${item.key}`)

  let items = []
  if (menu?.kind === 'slash') {
    items = matchSlash(menu.query, slashLabel).map((item) => ({ key: item.key, icon: item.key, label: slashLabel(item), sub: t(`notes.block.${item.key}Sub`), item }))
  } else if (menu?.kind === 'case') {
    items = matchCases(cases, menu.query, conceptWords).map((item) => caseOption(item, labels, t))
  } else if (menu?.kind === 'emoji' && emojiData) {
    items = searchEmojis(emojiData.emojis, menu.query)
      .slice(0, 8)
      .map((emoji) => ({ key: emoji.char, glyph: emoji.char, label: `:${emoji.name}:`, char: emoji.char }))
  }
  const active = Math.min(menu?.active ?? 0, Math.max(items.length - 1, 0))

  const blockById = (id) => blocksRef.current.find((block) => block.id === id)

  // The next block the caret can go to, up (-1) or down (1). false when there is none.
  function go(block, direction) {
    const list = blocksRef.current
    const index = list.findIndex((item) => item.id === block.id)
    const rest = direction < 0 ? list.slice(0, index).reverse() : list.slice(index + 1)
    const target = rest.find(focusable)
    if (!target) return false
    setFocus(direction < 0 ? { id: target.id } : { id: target.id, start: 0, end: 0 })
    return true
  }

  function addBlock(block, where) {
    if (full) return
    const next = newBlock('text')
    apply(where === 'before' ? insertBefore(blocksRef.current, block.id, next) : insertAfter(blocksRef.current, block.id, next))
    setFocus({ id: next.id })
  }

  // The "+" beside a block: an empty line under it with the block menu open, to pick what it becomes.
  // An empty text line already is one, so the menu opens right there.
  function addBelow(block) {
    const blank = block.type === 'text' && block.text === ''
    if (!blank && full) return
    let target = block
    if (!blank) {
      target = newBlock('text')
      apply(insertAfter(blocksRef.current, block.id, target))
    }
    setPicker(null)
    setMenu({ blockId: target.id, kind: 'slash', query: '', active: 0, searchable: true })
  }

  function duplicate(block) {
    if (full) return
    const { blocks: next, copyId } = duplicateBlock(blocksRef.current, block.id)
    apply(next)
    setFocus({ id: copyId })
  }

  // Says where a moved block landed, for screen readers.
  function announceMove(id, list) {
    setMoved(t('notes.editor.moved', { position: list.findIndex((item) => item.id === id) + 1, total: list.length }))
  }

  function move(block, direction) {
    const field = fields.current.get(block.id)
    const list = blocksRef.current
    const next = moveBlock(list, block.id, direction)
    apply(next)
    if (next !== list) announceMove(block.id, next)
    setFocus({ id: block.id, start: field?.selectionStart, end: field?.selectionEnd })
  }

  // To a gap in the list (0 the top, the block count the end), by a drag or "Move to...", in one step.
  function moveTo(id, spot, { focus = false } = {}) {
    const list = blocksRef.current
    const next = moveBlockTo(list, id, spot)
    if (next === list) return
    apply(next)
    announceMove(id, next)
    if (focus) setFocus({ id })
  }
  const { drag, listProps, handleProps } = useBlockDrag(moveTo)

  // Undoable, and said out loud with an Undo button: nothing written goes away for good by accident.
  function remove(block, { notify = true } = {}) {
    const list = blocksRef.current
    const index = list.findIndex((item) => item.id === block.id)
    const previous = list.slice(0, index).reverse().find(focusable) ?? list.slice(index + 1).find(focusable)
    apply(removeBlock(list, block.id))
    if (notify) setNotice('deleted')
    if (previous) setFocus({ id: previous.id })
  }

  function setText(block, next) {
    apply(updateBlock(blocksRef.current, block.id, { text: next.value }))
    setFocus({ id: block.id, start: next.start, end: next.end })
  }

  // The block becomes another kind in place (same id), keeping what follows the markdown.
  function convert(block, { type, fields: extra }) {
    setMenu(null)
    if (type === 'divider') {
      const after = newBlock('text')
      const list = blocksRef.current.map((item) => (item.id === block.id ? { id: block.id, type: 'divider' } : item))
      apply(insertAfter(list, block.id, after))
      setFocus({ id: after.id })
      return
    }
    const next = { ...newBlock(type, extra), id: block.id }
    apply(blocksRef.current.map((item) => (item.id === block.id ? next : item)))
    setFocus({ id: block.id, start: 0, end: 0 })
  }

  function openPicker(target) {
    setWantEmojis(true)
    setMenu(null)
    pickerReturn.current = document.activeElement
    setPicker(target)
  }

  function closePicker({ refocus = true } = {}) {
    setPicker(null)
    const back = pickerReturn.current
    if (refocus && back?.isConnected) back.focus()
  }

  function pickEmoji(char) {
    const target = picker
    closePicker({ refocus: false })
    if (target.kind === 'callout') {
      apply(updateBlock(blocksRef.current, target.blockId, { emoji: char }))
      setFocus({ id: target.blockId })
      return
    }
    const spot = target.spot
    const block = spot && blockById(spot.blockId)
    if (block && typeof block.text === 'string') {
      const start = Math.min(spot.start, block.text.length)
      const end = Math.min(spot.end, block.text.length)
      setText(block, { value: block.text.slice(0, start) + char + block.text.slice(end), start: start + char.length, end: start + char.length })
      return
    }
    // Nowhere written yet: an empty last line takes it, or a new one does.
    const last = blocksRef.current.at(-1)
    if (last?.type === 'text' && last.text === '') {
      setText(last, { value: char, start: char.length, end: char.length })
      return
    }
    if (full) return
    const added = newBlock('text', { text: char })
    apply([...blocksRef.current, added])
    setFocus({ id: added.id })
  }

  // Picked from the Ctrl+/ menu (or the "+"): the block turns into the kind, keeping its words.
  function pickSearched(entry, block) {
    const keep = block.text ?? ''
    if (entry.key === 'case') {
      setMenu({ blockId: block.id, kind: 'case', start: 0, query: '', active: 0, searchable: true })
      return
    }
    if (entry.key === 'emoji') {
      setFocus({ id: block.id })
      openPicker({ blockId: block.id, kind: 'insert', spot: { blockId: block.id, start: keep.length, end: keep.length } })
      return
    }
    if (entry.type === 'divider' && keep) {
      if (full) return
      const after = newBlock('divider')
      apply(insertAfter(blocksRef.current, block.id, after))
      setFocus({ id: after.id })
      return
    }
    convert(block, { type: entry.type, fields: { text: keep, level: entry.level } })
    if (entry.type !== 'divider') setFocus({ id: block.id })
  }

  // Picked after typing "/cod" somewhere in the text: the new block goes right where the "/" was.
  // The words before stay in this block and the words after move to a text block below the new
  // one, all as one undo step. A block that held only "/cod" turns into the new kind instead.
  function pickSlash(entry, block, { start, query, at }) {
    const text = block.text ?? ''
    const end = start + 1 + query.length
    if (entry.key === 'case') {
      // Swap the "/cod" for "@" so typing keeps filtering the cases, just like a mention.
      apply(updateBlock(blocksRef.current, block.id, { text: `${text.slice(0, start)}@${text.slice(end)}` }))
      setMenu({ blockId: block.id, kind: 'case', start, query: '', active: 0, at })
      setFocus({ id: block.id, start: start + 1 })
      return
    }
    if (entry.key === 'emoji') {
      apply(updateBlock(blocksRef.current, block.id, { text: text.slice(0, start) + text.slice(end) }))
      setFocus({ id: block.id, start })
      openPicker({ blockId: block.id, kind: 'insert', spot: { blockId: block.id, start, end: start } })
      return
    }
    const parts = splitText(text, start, end)
    if (!parts.before && !parts.after) {
      convert(block, { type: entry.type, fields: { level: entry.level } })
      return
    }
    if (full) return
    let { blocks: next, block: placed, tail } = splitInsert(blocksRef.current, block.id, newBlock(entry.type, { level: entry.level }), parts)
    if (entry.type === 'divider') {
      // Nothing to type in a divider: the caret goes on to the words after it, or a new line.
      if (!tail) {
        tail = newBlock('text')
        next = insertAfter(next, placed.id, tail)
      }
      placed = tail
    }
    apply(next)
    setFocus({ id: placed.id, start: 0, end: 0 })
  }

  function pick(item) {
    if (menu.kind === 'slash') {
      const block = blockById(menu.blockId)
      setMenu(null)
      if (menu.searchable) pickSearched(item.item, block)
      else pickSlash(item.item, block, menu)
      return
    }
    if (menu.kind === 'emoji') {
      const block = blockById(menu.blockId)
      const end = menu.start + 1 + menu.query.length
      rememberEmoji(item.char)
      setMenu(null)
      setText(block, { value: block.text.slice(0, menu.start) + item.char + block.text.slice(end), start: menu.start + item.char.length, end: menu.start + item.char.length })
      return
    }
    if (full) {
      setMenu(null)
      return
    }
    if (menu.searchable && menu.blockId !== APPEND) {
      // Picked from the Ctrl+/ menu: the case goes right under the block, which keeps its text.
      apply(insertAfter(blocksRef.current, menu.blockId, newBlock('case', { caseId: item.caseId })))
      setFocus({ id: menu.blockId })
      setMenu(null)
      return
    }
    const target = menu.blockId === APPEND ? null : menu.blockId
    const placed = placeCase(blocksRef.current, target, item.caseId, { start: menu.start, query: menu.query })
    apply(placed.blocks)
    setFocus({ id: placed.focusId })
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
      event.stopPropagation()
      // A menu with its own search box had the focus: give it back to the block.
      if (menu.searchable && menu.blockId !== APPEND) setFocus({ id: menu.blockId })
      setMenu(null)
      return true
    }
    return false
  }

  function changeText(block, value, caretAt) {
    if (block.type === 'text') {
      // Only the shortcut typed into an empty block converts it ("- " then the words), never words
      // already written or pasted that happen to start like one.
      const shortcut = markdownShortcut(value)
      if (shortcut && !markdownShortcut(block.text) && !shortcut.fields.text && value.length === block.text.length + 1) {
        convert(block, shortcut)
        return
      }
    }
    apply(updateBlock(blocksRef.current, block.id, { text: value }), `type:${block.id}`)
    if (block.type === 'code' || menu?.searchable) return
    const slash = block.type === 'text' || block.type === 'quote' ? slashAt(value, caretAt) : null
    const mention = !slash && mentionAt(value, caretAt)
    const emoji = !slash && !mention && emojiQueryAt(value, caretAt)
    const found = slash ? ['slash', slash] : mention ? ['case', mention] : emoji ? ['emoji', emoji] : null
    if (!found) {
      if (menu?.blockId === block.id) setMenu(null)
      return
    }
    const [kind, spot] = found
    if (kind === 'emoji') setWantEmojis(true)
    // The menu stays put under the "/" (or "@", ":") while the words after it are typed.
    const same = menu?.blockId === block.id && menu.kind === kind && menu.start === spot.start
    const at = same && menu.at ? menu.at : anchorAt(block.id, spot.start)
    setMenu((current) => ({ blockId: block.id, kind, ...spot, at, active: current?.kind === kind && current.query === spot.query ? current.active : 0 }))
  }

  // Under the line where the menu's "/" (or "@", ":") was typed, inside the block's row.
  function anchorAt(blockId, index) {
    const field = fields.current.get(blockId)
    const row = field?.closest('[data-block]')
    if (!row || field.tagName !== 'TEXTAREA') return null
    const point = caretPoint(field, index)
    const fieldBox = field.getBoundingClientRect()
    const rowBox = row.getBoundingClientRect()
    const width = Math.min(rowBox.width, MENU_WIDTH)
    return {
      top: Math.round(fieldBox.top - rowBox.top + point.top + point.height),
      left: Math.round(Math.max(0, Math.min(fieldBox.left - rowBox.left + point.left, rowBox.width - width))),
    }
  }

  // The caret moved by a click or an arrow: a menu opened by typing closes once the caret left its word.
  function recheck(block, field) {
    setMenu((current) => {
      if (current?.blockId !== block.id || current.searchable) return current
      const still = TRIGGERS[current.kind]?.(field.value, field.selectionStart)
      return still && still.start === current.start && field.selectionStart === field.selectionEnd ? current : null
    })
  }

  // Keys every block shares (code blocks too). true when the key was used.
  function commonKey(event, block) {
    const mod = isMod(event)
    if (mod && !event.altKey && keyIs(event, 'z')) {
      if (event.shiftKey) redo()
      else undo()
      return true
    }
    if (mod && !event.altKey && !event.shiftKey && keyIs(event, 'y')) {
      redo()
      return true
    }
    if (mod && !event.altKey && event.key === 'Enter') {
      if (event.shiftKey) addBlock(block, 'before')
      else if (block.type === 'todo') apply(updateBlock(blocksRef.current, block.id, { done: !block.done }))
      else addBlock(block, 'after')
      return true
    }
    if (mod && !event.altKey && !event.shiftKey && keyIs(event, 'd')) {
      duplicate(block)
      return true
    }
    // In code these keys move, delete or comment lines, as in the gym editor.
    if (block.type === 'code') return false
    if (event.altKey && !mod && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      move(block, event.key === 'ArrowUp' ? -1 : 1)
      return true
    }
    if (mod && event.shiftKey && !event.altKey && keyIs(event, 'k')) {
      remove(block)
      return true
    }
    if (mod && !event.altKey && !event.shiftKey && (event.key === '/' || event.code === 'Slash')) {
      setMenu({ blockId: block.id, kind: 'slash', query: '', active: 0, searchable: true })
      return true
    }
    return false
  }

  // Esc, then Tab: the one way Tab leaves the editor. true when this Tab should leave.
  function escapeHatch(event) {
    if (event.key === 'Escape') {
      leaving.current = true
      return false
    }
    if (MODIFIERS.has(event.key)) return false
    const free = leaving.current
    leaving.current = false
    return event.key === 'Tab' && free
  }

  function enter(block, { value, start, end }) {
    if (full) return
    if (block.type === 'text') {
      const fence = /^```([\w+#.-]*)$/.exec(value)
      if (fence) {
        convert(block, { type: 'code', fields: { language: fence[1] } })
        return
      }
    }
    const continues = CONTINUES.includes(block.type)
    if (continues && value === '') {
      // Enter on an empty item leaves the list (or the to-dos, or the quote).
      apply(blocksRef.current.map((item) => (item.id === block.id ? { id: block.id, type: 'text', text: '' } : item)))
      setFocus({ id: block.id })
      return
    }
    const next = newBlock(continues ? block.type : 'text', { text: value.slice(end), indent: isList(block) ? block.indent : undefined })
    apply(insertAfter(updateBlock(blocksRef.current, block.id, { text: value.slice(0, start) }), block.id, next))
    setFocus({ id: next.id, start: 0, end: 0 })
  }

  function keyDown(event, block) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    // While a menu is open its keys win, and no other shortcut fires.
    if (menu?.blockId === block.id) {
      if (!menuKey(event) && (isMod(event) || event.altKey || event.key === 'Tab')) event.preventDefault()
      return
    }
    if (escapeHatch(event)) return
    if (commonKey(event, block)) {
      event.preventDefault()
      return
    }
    const field = event.currentTarget
    const state = { value: field.value, start: field.selectionStart, end: field.selectionEnd }
    const mark = isMod(event) && !event.altKey && !event.shiftKey ? (MARK_KEYS[event.code] ?? MARK_LETTERS[event.key.toLowerCase()]) : null
    if (mark) {
      event.preventDefault()
      setText(block, wrapSelection(state, mark))
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isList(block)) {
        const indent = event.shiftKey ? undefined : 1
        if (block.indent !== indent) apply(updateBlock(blocksRef.current, block.id, { indent }))
        return
      }
      const next = event.shiftKey ? outdentText(state) : indentText(state)
      if (next) setText(block, next)
      return
    }
    // In plain text and quotes Enter is a line break, like any text box; Ctrl+Enter makes a new block.
    // Lists, to-dos and headings keep Enter for the next item. Two exceptions: "```js" then Enter
    // opens a code block, and Enter on an empty quote leaves it.
    const lineBreak =
      (block.type === 'text' && !/^```[\w+#.-]*$/.test(state.value)) || (block.type === 'quote' && state.value !== '')
    if (event.key === 'Enter' && !event.shiftKey && !isMod(event) && !event.altKey && !lineBreak) {
      event.preventDefault()
      enter(block, state)
      return
    }
    if (event.key === 'Backspace' && !isMod(event) && !event.altKey && state.start === 0 && state.end === 0) {
      if (isList(block) && block.indent === 1) {
        event.preventDefault()
        apply(updateBlock(blocksRef.current, block.id, { indent: undefined }))
      } else if (block.text === '' && blocksRef.current.length > 1) {
        event.preventDefault()
        remove(block, { notify: false })
      } else if (block.type !== 'text') {
        // At the very start, Backspace takes the block back to plain text, words kept.
        event.preventDefault()
        convert(block, { type: 'text', fields: { text: block.text } })
      }
      return
    }
    const plainArrow = !isMod(event) && !event.altKey && !event.shiftKey && state.start === state.end
    if (plainArrow && ((event.key === 'ArrowUp' && state.start === 0) || (event.key === 'ArrowDown' && state.end === state.value.length))) {
      if (go(block, event.key === 'ArrowUp' ? -1 : 1)) event.preventDefault()
    }
  }

  // Runs before the code editor's own keys: the note's keys win where they overlap (Ctrl+Enter).
  function codeKeyCapture(event, block) {
    if (event.target.tagName !== 'TEXTAREA' || event.nativeEvent.isComposing || event.keyCode === 229) return
    const field = event.target
    let used = commonKey(event, block)
    if (!used && event.key === 'Backspace' && field.value === '' && blocksRef.current.length > 1) {
      remove(block, { notify: false })
      used = true
    }
    const plain = !isMod(event) && !event.altKey && !event.shiftKey && field.selectionStart === field.selectionEnd
    if (!used && plain && ((event.key === 'ArrowUp' && field.selectionStart === 0) || (event.key === 'ArrowDown' && field.selectionEnd === field.value.length))) {
      used = go(block, event.key === 'ArrowUp' ? -1 : 1)
    }
    if (used) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function dividerKey(event, block) {
    if (escapeHatch(event)) return
    if (commonKey(event, block)) {
      event.preventDefault()
      return
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      remove(block, { notify: false })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      addBlock(block, 'after')
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (go(block, event.key === 'ArrowUp' ? -1 : 1)) event.preventDefault()
    } else if (event.key === 'Tab') {
      event.preventDefault()
    }
  }

  const closeMenuFor = (blockId) => () => setMenu((current) => (current?.blockId === blockId ? null : current))
  const remember = (block) => (event) => {
    caret.current = { blockId: block.id, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
  }

  function menuFor(blockId, extra = {}) {
    if (menu?.blockId !== blockId) return null
    const kind = menu.kind
    const search = menu.searchable
      ? {
          search: menu.query,
          onSearch: (query) => setMenu((current) => ({ ...current, query, active: 0 })),
          onKeyDown: menuKey,
          onClose: closeMenuFor(blockId),
          ...(kind === 'slash' ? { searchLabel: t('notes.editor.searchBlocks'), searchPlaceholder: t('notes.editor.searchBlocksPlaceholder') } : {}),
        }
      : {}
    const label = { slash: t('notes.editor.turnInto'), case: t('notes.editor.mention'), emoji: t('notes.editor.emojiMenu') }[kind]
    const empty = { slash: t('notes.editor.slashNoMatch'), case: cases.length ? t('notes.editor.noMatch') : t('notes.editor.emptyBoard'), emoji: emojiData ? t('notes.emoji.none') : t('notes.emoji.loading') }[kind]
    return <BlockMenu id={MENU_ID} label={label} items={items} active={active} onPick={pick} empty={empty} at={menu.at} {...search} {...extra} />
  }

  function pickerFor(blockId) {
    if (!picker || picker.blockId !== blockId) return null
    // In the flow, not floating: on a phone a floating picker would hang off the bottom of the page.
    return <EmojiPicker id={PICKER_ID} onPick={pickEmoji} onClose={() => closePicker()} className="mt-1 basis-full" />
  }

  function inputProps(block) {
    const open = menu?.blockId === block.id && !menu.searchable && items.length > 0
    return {
      ref: register(block.id),
      value: block.text,
      onChange: (event) => changeText(block, event.target.value, event.target.selectionStart),
      onKeyDown: (event) => keyDown(event, block),
      onFocus: () => setEditing(block.id),
      onBlur: (event) => {
        remember(block)(event)
        setEditing((current) => (current === block.id ? null : current))
        if (!menu?.searchable) closeMenuFor(block.id)()
      },
      onSelect: remember(block),
      onKeyUp: (event) => {
        if (CARET_KEYS.has(event.key)) recheck(block, event.currentTarget)
      },
      onMouseUp: (event) => recheck(block, event.currentTarget),
      maxLength: NOTE_LIMITS.text,
      'aria-label': fieldLabel(block, t),
      'aria-describedby': KEYS_ID,
      'aria-controls': open ? MENU_ID : undefined,
      'aria-activedescendant': open ? `${MENU_ID}-${active}` : undefined,
    }
  }

  // A written block: its textarea, or (when not being typed in and it has marks) the marks drawn,
  // with the textarea kept for the keyboard and screen readers. A click on the drawing edits it.
  function written(block, className, placeholder) {
    const drawn = editing !== block.id && hasMarks(block.text)
    const field = (
      <textarea
        {...inputProps(block)}
        rows={1}
        placeholder={placeholder ?? fieldLabel(block, t)}
        className={drawn ? 'sr-only' : `${lineClass} block resize-none field-sizing-content ${className}`}
      />
    )
    if (!drawn) return field
    return (
      <>
        {field}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a mouse shortcut; the textarea above is the keyboard way in */}
        <div
          onMouseDown={(event) => {
            if (event.target.closest('a')) return
            event.preventDefault()
            setFocus({ id: block.id })
          }}
          className={`cursor-text wrap-break-word whitespace-pre-wrap text-ink ${className}`}
        >
          <InlineText text={block.text} />
        </div>
      </>
    )
  }

  function control(block) {
    switch (block.type) {
      case 'heading':
        return written(block, `font-pixel font-bold ${HEADING_CLASS[headingLevel(block) - 1]}`)
      case 'todo':
        return (
          <div className="flex items-start gap-2.5 py-0.5">
            <input
              type="checkbox"
              checked={block.done}
              onChange={(event) => apply(updateBlock(blocksRef.current, block.id, { done: event.target.checked }))}
              aria-label={t('notes.block.todoDone', { text: block.text || t('notes.block.todoFallback') })}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <div className="min-w-0 flex-1">{written(block, block.done ? 'text-muted line-through' : '')}</div>
          </div>
        )
      case 'bullet':
      case 'numbered':
        return (
          <div data-indent={block.indent ?? 0} className={`flex items-start gap-2 py-0.5 ${block.indent === 1 ? 'ml-6' : ''}`}>
            <span aria-hidden="true" className="w-5 shrink-0 pt-0.5 text-right font-label text-xs text-primary">
              {block.type === 'numbered' ? `${numbers.get(block.id)}.` : <span className="mt-1.5 ml-auto block size-1.5 bg-primary" />}
            </span>
            <div className="min-w-0 flex-1">{written(block, 'leading-relaxed')}</div>
          </div>
        )
      case 'quote':
        return <div className="border-l-4 border-primary py-0.5 pl-3">{written(block, 'leading-relaxed italic text-ink/85')}</div>
      case 'callout':
        return (
          <div className={`flex flex-wrap items-start gap-1 border-2 p-1 ${CALLOUT_TONE[block.tone] ?? CALLOUT_TONE.info}`}>
            <button
              type="button"
              onClick={() => openPicker({ blockId: block.id, kind: 'callout' })}
              aria-label={t('notes.callout.emoji', { emoji: block.emoji })}
              className="grid size-10 shrink-0 place-items-center text-xl hover:bg-white/60"
            >
              <span aria-hidden="true">{block.emoji}</span>
            </button>
            <div className="min-w-40 flex-1 py-2">{written(block, 'leading-relaxed')}</div>
            <select
              aria-label={t('notes.callout.tone')}
              value={block.tone}
              onChange={(event) => {
                const tone = event.target.value
                // The emoji follows the style unless it was picked by hand.
                const emoji = block.emoji === CALLOUT_EMOJI[block.tone] ? CALLOUT_EMOJI[tone] : block.emoji
                apply(updateBlock(blocksRef.current, block.id, { tone, emoji }))
              }}
              className="min-h-10 cursor-pointer bg-transparent px-1 font-label text-[10px] text-ink"
            >
              {CALLOUT_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {t(`notes.callout.${tone}`)}
                </option>
              ))}
            </select>
          </div>
        )
      case 'code':
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: listens for the note's keys on the way to the code editor
          <div onKeyDownCapture={(event) => codeKeyCapture(event, block)} className="py-1">
            <CodeBlock block={block} fieldRef={register(block.id)} onChange={(patch) => apply(updateBlock(blocksRef.current, block.id, patch), patch.text !== undefined ? `type:${block.id}` : null)} />
          </div>
        )
      case 'divider':
        return (
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the divider can be selected, moved and deleted with the keyboard
          <div
            ref={register(block.id)}
            tabIndex={0}
            role="group"
            aria-label={t('notes.block.divider')}
            onKeyDown={(event) => dividerKey(event, block)}
            className="py-4 focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <hr className="border-0 border-t-2 border-dashed border-ink/50" />
          </div>
        )
      case 'case':
        return <CaseBlock item={casesById.get(block.caseId)} />
      default:
        return written(block, 'py-1 leading-relaxed', t('notes.block.textPlaceholder'))
    }
  }

  // Picked blocks still in the note, in note order: what "the selection" means for the AI.
  const picked = blocks.filter((block) => selected.includes(block.id)).map((block) => block.id)
  const toggleSelected = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  // How "Move to..." names a block: its first words, else its kind.
  function blockName(block) {
    if (block.type === 'case') {
      const item = casesById.get(block.caseId)
      return item ? caseHeading(item).type : t('notes.block.case')
    }
    if (block.type === 'divider') return t('notes.block.divider')
    return blockWords(block.text) || (block.type === 'text' ? t('notes.editor.emptyLine') : fieldLabel(block, t))
  }

  // Every gap the block can go to, for keyboards and screen readers: the top, after each other block
  // (but the one it already follows), the end.
  function moveTargets(block, index) {
    const last = blocks.length - 1
    const after = blocks.flatMap((other, at) =>
      at === index || at === index - 1 || at === last ? [] : [{ key: `after-${other.id}`, label: t('notes.editor.moveAfter', { text: blockName(other) }), onSelect: () => moveTo(block.id, at + 1, { focus: true }) }],
    )
    return [
      { key: 'top', label: t('notes.editor.moveTop'), disabled: index === 0, onSelect: () => moveTo(block.id, 0, { focus: true }) },
      ...after,
      { key: 'end', label: t('notes.editor.moveEnd'), disabled: index === last, onSelect: () => moveTo(block.id, blocks.length, { focus: true }) },
    ]
  }

  function handleActions(block, index) {
    const on = selected.includes(block.id)
    return [
      { key: 'up', label: t('notes.editor.moveUp'), disabled: index === 0, onSelect: () => move(block, -1) },
      { key: 'down', label: t('notes.editor.moveDown'), disabled: index === blocks.length - 1, onSelect: () => move(block, 1) },
      { key: 'moveTo', label: t('notes.editor.moveTo'), disabled: blocks.length < 2, items: () => moveTargets(block, index) },
      { key: 'duplicate', label: t('notes.editor.duplicate'), disabled: full, onSelect: () => duplicate(block) },
      ...(onAi ? [{ key: 'select', label: on ? t('notes.editor.unselect') : t('notes.editor.select'), onSelect: () => toggleSelected(block.id) }] : []),
      { key: 'delete', label: t('notes.editor.deleteBlock'), danger: true, onSelect: () => remove(block) },
    ]
  }

  // A block whose textarea has some of its text selected, or null.
  function selectionIn(element) {
    for (const [id, field] of fields.current) {
      if (field === element && field.tagName === 'TEXTAREA' && field.selectionStart !== field.selectionEnd) return id
    }
    return null
  }
  // Blocks picked from their menus win; otherwise the block with selected text; otherwise none.
  const textBlock = textPick.current && blocks.some((block) => block.id === textPick.current) ? textPick.current : null
  const selection = picked.length ? picked : textBlock ? [textBlock] : []
  const scoped = aiScope === 'selection' && selection.length > 0

  // Back to the AI button once it is enabled again (it is disabled while the AI works).
  const backToAi = useRef(false)
  useEffect(() => {
    if (ai || !backToAi.current) return
    backToAi.current = false
    document.getElementById(aiButtonId)?.focus()
  }, [ai, aiButtonId])

  async function runAi(action) {
    const blockIds = scoped ? selection : null
    const wanted = blockIds && new Set(blockIds)
    const before = wanted ? blocksRef.current.filter((block) => wanted.has(block.id)) : blocksRef.current
    const run = new AbortController()
    aiRun.current = run
    setAiError('')
    setAi({ phase: 'working', action })
    try {
      // The server reads the saved note: these words have to be there first.
      if (!(await flush())) throw new Error(t('notes.ai.saveFirst'))
      if (run.signal.aborted) return
      const result = await onAi({ action, blockIds }, run.signal)
      if (run.signal.aborted) return
      setAi({ phase: 'preview', action, blockIds: result.blockIds, before, after: result.blocks })
    } catch (err) {
      if (run.signal.aborted) return
      setAi(null)
      setAiError(err.message)
    }
  }

  function stopAi() {
    aiRun.current?.abort()
    backToAi.current = true
    setAi(null)
  }

  function discardAi() {
    backToAi.current = true
    setAi(null)
  }

  // The new blocks take the place of the ones in scope (where the first of them was), as one step
  // that Ctrl+Z or the Undo next to the status takes back.
  function applyAi() {
    const replaced = new Set(ai.blockIds)
    const list = blocksRef.current
    const at = Math.max(list.findIndex((block) => replaced.has(block.id)), 0)
    const rest = list.filter((block) => !replaced.has(block.id))
    const next = [...rest.slice(0, at), ...ai.after, ...rest.slice(at)]
    const target = ai.after.find(focusable)
    setAi(null)
    if (next.length > NOTE_LIMITS.blocks) {
      setAiError(t('notes.ai.full'))
      return
    }
    apply(next)
    setSelected([])
    setNotice('ai')
    if (target) setFocus({ id: target.id })
  }

  const aiGroups = [
    ...(selection.length
      ? [
          {
            key: 'scope',
            label: t('notes.ai.scope'),
            items: [
              { key: 'selection', label: t('notes.ai.scopeSelection', { count: selection.length }), checked: scoped, keepOpen: true, onSelect: () => setAiScope('selection') },
              { key: 'all', label: t('notes.ai.scopeAll'), checked: !scoped, keepOpen: true, onSelect: () => setAiScope('all') },
            ],
          },
        ]
      : []),
    {
      key: 'actions',
      label: t('notes.ai.actions'),
      items: NOTE_AI_ACTIONS.map((action) => ({ key: action, label: t(`notes.ai.${action}`), sub: t(`notes.ai.${action}Sub`), onSelect: () => runAi(action) })),
    },
  ]

  // The line where a dragged block would land, unless that is where it already is.
  const dragFrom = drag ? blocks.findIndex((block) => block.id === drag.id) : -1
  const dropLine = drag && drag.spot !== null && drag.spot !== dragFrom && drag.spot !== dragFrom + 1 ? drag.top : null

  const folderName =(note.folderId && folders?.find((folder) => folder.id === note.folderId)?.name) || t('notes.folders.none')

  return (
    <article aria-label={t('notes.editor.label')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="flex flex-wrap items-center gap-2 font-label text-[10px] text-muted">
          <span aria-hidden="true" className={`size-2 border border-ink ${status === 'saved' ? 'bg-primary' : status === 'error' ? 'bg-ink' : 'bg-white'}`} />
          {status === 'error' ? saveError || t(SAVE_TEXT.error) : t(SAVE_TEXT[status])}
          {status === 'error' && (
            <button type="button" onClick={flush} className="text-primary underline underline-offset-2">
              {t('notes.editor.retry')}
            </button>
          )}
          {notice && (
            <span className="inline-flex items-center gap-1.5 text-ink">
              · {t(notice === 'ai' ? 'notes.ai.applied' : 'notes.editor.deleted')}
              <button type="button" onClick={undo} className="min-h-10 px-1 text-primary underline underline-offset-2">
                {t('notes.editor.undo')}
              </button>
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {onAi && (
            <MenuButton
              variant="secondary"
              heading={t('notes.ai.menu')}
              menuLabel={t('notes.ai.menu')}
              groups={aiGroups}
              footer={t('notes.ai.codeSafe')}
              button={{
                id: aiButtonId,
                disabled: Boolean(ai),
                // The text selected in a block, read before the button takes the focus (mouse) or
                // from the field it came from (keyboard).
                onPointerDown: (event) => {
                  if (document.activeElement !== event.currentTarget) textPick.current = selectionIn(document.activeElement)
                },
                onFocus: (event) => {
                  if (event.relatedTarget) textPick.current = selectionIn(event.relatedTarget)
                },
              }}
              menuClassName="w-72"
            >
              <span aria-hidden="true">✦</span> {t('notes.ai.button')}
            </MenuButton>
          )}
          {onMove && folders && (
            <MenuButton
              heading={t('notes.move.heading')}
              menuLabel={t('notes.move.menu')}
              button={{ 'aria-label': t('notes.move.label', { name: folderName }) }}
              menuClassName="w-56"
              groups={[
                {
                  key: 'folders',
                  items: [
                    { key: 'none', label: t('notes.folders.none'), checked: !folders.some((folder) => folder.id === note.folderId), onSelect: () => onMove(null) },
                    ...folders.map((folder) => ({ key: folder.id, label: folder.name, checked: folder.id === note.folderId, onSelect: () => onMove(folder.id) })),
                  ],
                },
              ]}
            >
              <span className="max-w-32 truncate">{t('notes.move.button', { name: folderName })}</span>
            </MenuButton>
          )}
          <ExportMenu onExport={(format) => onExport({ ...note, title, blocks, tags }, format)} />
          {confirming ? (
            <>
              <PixelButton variant="secondary" onClick={onDelete} className="px-3 py-2">
                {t('notes.editor.confirmDelete')}
              </PixelButton>
              <PixelButton variant="ghost" onClick={() => setConfirming(false)} className="px-3 py-2">
                {t('notes.editor.keep')}
              </PixelButton>
            </>
          ) : (
            <PixelButton variant="ghost" onClick={() => setConfirming(true)} className="px-3 py-2">
              {t('notes.editor.delete')}
            </PixelButton>
          )}
        </div>
      </div>

      {ai?.phase === 'working' && (
        <div className="mt-4 flex flex-wrap items-stretch gap-3">
          <div className="min-w-0 flex-1">
            <Working label={t(`notes.ai.working.${ai.action}`)} />
          </div>
          <PixelButton variant="ghost" onClick={stopAi} className="self-center px-4">
            {t('notes.ai.stop')}
          </PixelButton>
        </div>
      )}
      {aiError && (
        <div className="mt-4">
          <ErrorNotice message={aiError} />
        </div>
      )}
      {ai?.phase === 'preview' && <AiPreview action={ai.action} before={ai.before} after={ai.after} cases={casesById} onApply={applyAi} onDiscard={discardAi} />}

      {onShare && <ShareToggle noteId={note.id} isPublic={Boolean(note.isPublic)} sharing={sharing} onShare={onShare} />}

      <textarea
        rows={1}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          const first = blocks.find(focusable)
          if (first) setFocus({ id: first.id })
        }}
        maxLength={NOTE_LIMITS.title}
        aria-label={t('notes.editor.titleLabel')}
        placeholder={t('notes.untitled')}
        className={`${lineClass} mt-5 block resize-none font-pixel text-3xl font-bold field-sizing-content sm:text-4xl`}
      />
      <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions} />
      <p className="mt-2 text-sm text-muted">
        {t('notes.editor.hintBefore')} <kbd className="border border-line bg-white px-1 font-mono text-xs text-ink">/</kbd> {t('notes.editor.hintMiddle')}{' '}
        <kbd className="border border-line bg-white px-1 font-mono text-xs text-ink">@</kbd> {t('notes.editor.hintAfter')}
      </p>
      <p id={KEYS_ID} className="sr-only">
        {t('notes.editor.trap')}
      </p>
      <CodeEditorShortcuts shortcuts={NOTE_SHORTCUTS} listLabel="notes.keys.list" footer="notes.keys.markdown" className="mt-1" />

      <p aria-live="polite" className="sr-only">
        {moved}
      </p>
      <div {...listProps} className="relative mt-6 space-y-2">
        {dropLine !== null && (
          <div aria-hidden="true" data-drop-line style={{ top: dropLine }} className="pointer-events-none absolute right-0 left-0 z-10 h-1 bg-secondary">
            <span className="absolute -top-1 -left-1 size-3 border-2 border-ink bg-secondary" />
          </div>
        )}
        {blocks.map((block, index) => (
          <div
            key={block.id}
            data-block={block.type}
            data-selected={selected.includes(block.id) || undefined}
            className={`group relative flex flex-wrap items-start gap-1 ${selected.includes(block.id) ? 'bg-secondary-soft outline-2 outline-offset-2 outline-secondary outline-dashed' : ''} ${drag?.id === block.id ? 'opacity-40' : ''}`}
          >
            {selected.includes(block.id) && <span className="sr-only">{t('notes.editor.selected')}</span>}
            <div className="min-w-0 flex-1">{control(block)}</div>
            {/* On a phone the "+" only shows on the block being written, under the handle, so it never takes width from the text. */}
            <div className="flex shrink-0 max-sm:flex-col">
              <button
                type="button"
                aria-label={t('notes.editor.addBelow')}
                title={t('notes.editor.addBelow')}
                disabled={full && !(block.type === 'text' && block.text === '')}
                // Keeps the caret (and a phone's keyboard) in the block until the menu takes over.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addBelow(block)}
                className="grid size-10 place-items-center text-muted transition-opacity hover:text-ink focus-visible:opacity-100 disabled:text-muted/40 max-sm:order-last max-sm:hidden max-sm:group-focus-within:grid sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              >
                <svg aria-hidden="true" viewBox="0 0 5 5" shapeRendering="crispEdges" className="size-2.5 fill-current">
                  <rect x="2" y="0" width="1" height="5" />
                  <rect x="0" y="2" width="5" height="1" />
                </svg>
              </button>
              <BlockHandle
                actions={handleActions(block, index)}
                buttonProps={{
                  ...handleProps(block.id),
                  title: t('notes.editor.dragHint'),
                  className: 'cursor-grab select-none active:cursor-grabbing [-webkit-touch-callout:none]',
                }}
              />
            </div>
            {menuFor(block.id)}
            {pickerFor(block.id)}
          </div>
        ))}
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-line pt-4">
        <span className="mr-1 font-label text-[10px] text-muted">{t('notes.editor.add')}</span>
        {[
          ['text', t('notes.editor.addText')],
          ['heading', t('notes.editor.addHeading')],
          ['todo', t('notes.editor.addTodo')],
        ].map(([type, label]) => (
          <PixelButton
            key={type}
            variant="ghost"
            onClick={() => {
              if (full) return
              const block = newBlock(type)
              apply([...blocksRef.current, block])
              setFocus({ id: block.id })
            }}
            disabled={full}
            className="px-2.5 py-1.5"
          >
            {label}
          </PixelButton>
        ))}
        <PixelButton
          variant="secondary"
          onClick={() => setMenu({ blockId: APPEND, kind: 'case', start: 0, query: '', active: 0, searchable: true })}
          disabled={full}
          className="px-2.5 py-1.5"
        >
          {t('notes.editor.addCase')}
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => openPicker({ blockId: null, kind: 'insert', spot: caret.current })}
          aria-expanded={picker?.blockId === null}
          className="px-2.5 py-1.5"
        >
          <span aria-hidden="true">😀</span> {t('notes.editor.addEmoji')}
        </PixelButton>
        {full && <span className="text-xs text-muted">{t('notes.editor.full')}</span>}
        {menuFor(APPEND)}
        {pickerFor(null)}
      </div>
    </article>
  )
}
