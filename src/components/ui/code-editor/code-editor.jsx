import { useRef } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import CodeEditorShortcuts from './code-editor-shortcuts.jsx'
import { copyLines, deleteLines, deletePair, indent, lineAbove, lineBelow, moveLines, newline, outdent, toggleComment, typeChar } from './editing.js'

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'])

// The edit a key makes, or null to let the browser handle it.
function editFor(event, state, language) {
  const { key, shiftKey, altKey, ctrlKey, metaKey } = event
  const mod = ctrlKey || metaKey
  if (key === 'Tab' && !mod && !altKey) return shiftKey ? outdent(state, language) : indent(state, language)
  if (key === 'Enter' && mod && !altKey) return shiftKey ? lineAbove(state) : lineBelow(state, language)
  // Shift+Enter is a plain new line too, as in VS Code.
  if (key === 'Enter' && !altKey) return newline(state, language)
  if (mod && !altKey && !shiftKey && (key === '/' || event.code === 'Slash')) return toggleComment(state, language)
  if (altKey && !mod && (key === 'ArrowUp' || key === 'ArrowDown')) {
    const direction = key === 'ArrowUp' ? -1 : 1
    return shiftKey ? copyLines(state, direction) : moveLines(state, direction)
  }
  if (mod && shiftKey && !altKey && (key.toLowerCase() === 'k' || event.code === 'KeyK')) return deleteLines(state)
  if (key === 'Backspace' && !mod && !altKey && !shiftKey) return deletePair(state)
  // Printable keys, AltGr ones included (Ctrl+Alt on Windows): brackets and quotes.
  if (key.length === 1 && !metaKey && (!ctrlKey || altKey)) return typeChar(state, key)
  return null
}

// Writes `next` into the textarea as one change the browser can undo: the smallest changed range
// goes in through execCommand, so Ctrl+Z steps back over it like over typing.
function applyEdit(textarea, before, next) {
  if (next.value !== before.value) {
    const old = before.value
    const max = Math.min(old.length, next.value.length)
    let from = 0
    while (from < max && old[from] === next.value[from]) from++
    let tail = 0
    while (tail < max - from && old[old.length - 1 - tail] === next.value[next.value.length - 1 - tail]) tail++
    const to = old.length - tail
    const text = next.value.slice(from, next.value.length - tail)
    textarea.setSelectionRange(from, to)
    const done =
      typeof document.execCommand === 'function' &&
      (text ? document.execCommand('insertText', false, text) : document.execCommand('delete', false))
    if (!done) {
      // No execCommand (old browsers, tests): the change still reaches React as typing would.
      textarea.setRangeText(text, from, to)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      // Settles the value, so whatever types next builds on it.
      // biome-ignore lint/correctness/noSelfAssign: a programmatic set, on purpose.
      textarea.value = textarea.value
    }
  }
  textarea.setSelectionRange(next.start, next.end)
}

// A textarea with a line-number gutter and the common VS Code keys. It grows with the code, so the
// gutter always lines up. `language` picks the comment token for Ctrl+/ and the Python colon indent.
// showShortcuts: false where the page lists the keys itself (the notes editor). label: an aria-label
// when no <label> points at it.
export default function CodeEditor({ id, value, onChange, minLines = 8, maxLength, placeholder, readOnly = false, language, showShortcuts = true, label }) {
  const t = useT()
  const lines = Math.max(minLines, value.split('\n').length)
  // Esc frees Tab for one press, so keyboard users can leave the editor.
  const tabLeaves = useRef(false)

  function onKeyDown(event) {
    if (readOnly || event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
      tabLeaves.current = true
      return
    }
    // Holding Shift for Shift+Tab keeps the way out open.
    if (MODIFIERS.has(event.key)) return
    const leaving = tabLeaves.current
    tabLeaves.current = false
    if (event.key === 'Tab' && leaving) return
    const textarea = event.currentTarget
    const state = { value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd }
    const next = editFor(event, state, language)
    if (!next) return
    // Past the limit, the browser's own cap decides.
    if (maxLength && next.value.length > maxLength && next.value.length > state.value.length) return
    event.preventDefault()
    applyEdit(textarea, state, next)
  }

  return (
    <div>
      <div className="flex border-2 border-ink bg-white transition-shadow duration-150 focus-within:shadow-pixel">
        <div
          aria-hidden="true"
          className="select-none border-r-2 border-ink bg-mist px-2.5 py-3 text-right font-mono text-sm leading-relaxed text-muted"
        >
          {Array.from({ length: lines }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are positions.
            <div key={index}>{index + 1}</div>
          ))}
        </div>
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            tabLeaves.current = false
          }}
          aria-label={label}
          aria-describedby={readOnly ? undefined : `${id}-keys`}
          maxLength={maxLength}
          rows={lines}
          wrap="off"
          spellCheck={false}
          readOnly={readOnly}
          placeholder={placeholder}
          className="block w-full resize-none overflow-x-auto overflow-y-hidden bg-transparent px-3 py-3 font-mono text-sm leading-relaxed text-ink placeholder:text-muted/60 focus-visible:outline-none"
        />
      </div>
      {!readOnly && (
        <>
          <p id={`${id}-keys`} className="sr-only">
            {t('editor.keys.trap')}
          </p>
          {showShortcuts && <CodeEditorShortcuts />}
        </>
      )}
    </div>
  )
}
