import { useId, useRef, useState } from 'react'
import { NOTE_TAG_LIMITS, normalizeTag, noteTagProblem } from '../../../../shared/note-tags.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

const MAX_OPTIONS = 8

// A note's tags as chips. Enter, a comma or leaving the field turns the text into a chip, and
// Backspace on an empty field takes the last one off. Suggestions are the writer's other tags, in a
// listbox the arrow keys drive while focus stays in the field (aria-activedescendant).
export default function TagInput({ tags, onChange, suggestions = [] }) {
  const t = useT()
  const id = useId()
  const inputId = `${id}-input`
  const listId = `${id}-list`
  const hintId = `${id}-hint`
  const input = useRef(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  // -1: nothing picked, so Enter adds what was typed rather than a suggestion.
  const [active, setActive] = useState(-1)
  const [error, setError] = useState('')

  const needle = normalizeTag(text)
  const options = open && needle ? suggestions.filter((tag) => tag.includes(needle) && !tags.includes(tag)).slice(0, MAX_OPTIONS) : []
  const shown = options.length > 0
  const current = Math.min(active, options.length - 1)

  function reason(tag, count) {
    if (count >= NOTE_TAG_LIMITS.tags) return t('notes.tags.tooMany', { max: NOTE_TAG_LIMITS.tags })
    if (!noteTagProblem(tag)) return ''
    return tag.length > NOTE_TAG_LIMITS.tag ? t('notes.tags.tooLong', { max: NOTE_TAG_LIMITS.tag }) : t('notes.tags.chars')
  }

  // Adds each word as a tag. A word that can't be one stays in the field, so it can be fixed.
  function commit(words, rest = '') {
    let next = tags
    let problem = ''
    const kept = []
    for (const word of words) {
      const tag = normalizeTag(word)
      if (!tag || next.includes(tag)) continue
      const why = reason(tag, next.length)
      if (why) {
        problem ||= why
        kept.push(word.trim())
      } else {
        next = [...next, tag]
      }
    }
    if (next !== tags) onChange(next)
    setError(problem)
    setText([...kept, rest.trimStart()].filter(Boolean).join(', '))
    setActive(-1)
  }

  function remove(tag) {
    onChange(tags.filter((item) => item !== tag))
    setError('')
    // The chip's button is gone: keep the keyboard in the field instead of losing focus.
    input.current?.focus()
  }

  function change(value) {
    setOpen(true)
    setActive(-1)
    setError('')
    // Pasting "a, b, c" (or a phone keyboard's comma) adds the finished words at once.
    if (value.includes(',')) {
      const words = value.split(',')
      const rest = words.pop()
      commit(words, rest)
      return
    }
    setText(value)
  }

  function keyDown(event) {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && shown) {
      event.preventDefault()
      const count = options.length
      setActive(event.key === 'ArrowDown' ? (current + 1) % count : current <= 0 ? count - 1 : current - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit([shown && current >= 0 ? options[current] : text])
    } else if (event.key === ',') {
      event.preventDefault()
      commit([text])
    } else if (event.key === 'Backspace' && text === '' && tags.length) {
      event.preventDefault()
      onChange(tags.slice(0, -1))
      setError('')
    } else if (event.key === 'Escape' && shown) {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative mt-4">
      <label htmlFor={inputId} className="font-label text-[10px] text-muted">
        {t('notes.tags.label')}
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-2 border-ink bg-white p-1 focus-within:shadow-pixel">
        {tags.length > 0 && (
          <ul aria-label={t('notes.tags.list')} className="flex min-w-0 flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag} className="flex min-w-0 items-center bg-primary-soft pl-2 font-mono text-xs text-primary">
                <span className="min-w-0 break-all">#{tag}</span>
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  aria-label={t('notes.tags.remove', { tag })}
                  className="grid size-10 shrink-0 place-items-center text-base hover:bg-primary hover:text-white"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={input}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          enterKeyHint="enter"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={shown ? listId : undefined}
          aria-activedescendant={shown && current >= 0 ? `${listId}-${current}` : undefined}
          aria-describedby={hintId}
          value={text}
          onChange={(event) => change(event.target.value)}
          onKeyDown={keyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            if (text.trim()) commit([text])
          }}
          placeholder={tags.length ? '' : t('notes.tags.placeholder')}
          className="min-h-10 w-32 min-w-0 flex-1 bg-transparent px-2 font-mono text-sm text-ink placeholder:text-muted/60 focus-visible:outline-none"
        />
      </div>
      <p id={hintId} aria-live="polite" className={`mt-1.5 text-xs ${error ? 'text-primary' : 'text-muted'}`}>
        {error || t('notes.tags.hint', { max: NOTE_TAG_LIMITS.tags })}
      </p>
      {shown && (
        <div className="absolute top-full left-0 z-20 -mt-5 w-full max-w-xs border-2 border-ink bg-white shadow-pixel">
          <p className="border-b-2 border-ink bg-mist px-3 py-1.5 font-label text-[10px] text-muted">{t('notes.tags.suggestions')}</p>
          <div id={listId} role="listbox" aria-label={t('notes.tags.suggestions')} className="max-h-60 overflow-y-auto py-1">
            {options.map((tag, index) => (
              <div
                key={tag}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === current}
                // mousedown would blur the field first, and the blur would add the half-typed text.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit([tag])}
                onKeyDown={() => {}}
                className={`flex min-h-10 cursor-pointer items-center px-3 font-mono text-sm break-all text-ink ${index === current ? 'bg-primary-soft' : 'hover:bg-mist'}`}
              >
                #{tag}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
