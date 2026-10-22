import { useId, useMemo, useRef, useState } from 'react'
import { searchLanguages } from '../../../shared/riddle/languages.js'
import PixelButton from '../pixel/PixelButton.jsx'

const MAX_OPTIONS = 8

// The guess box: type to filter the languages, arrows to move, Enter to guess, Escape to close.
// Languages already guessed stay in the list, greyed out, so nobody guesses one twice.
export default function LanguagePicker({ mode, guessed = [], onGuess, busy = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef(null)
  const listId = useId()
  const taken = useMemo(() => new Set(guessed), [guessed])
  const options = useMemo(() => searchLanguages(query).slice(0, MAX_OPTIONS), [query])
  const enabled = options.filter((item) => !taken.has(item.id))
  const optionId = (id) => `${listId}-${id}`

  function pick(item) {
    if (!item || taken.has(item.id) || busy) return
    onGuess(item.id)
    setQuery('')
    setOpen(false)
    setActive(-1)
    input.current?.focus()
  }

  // Moves the highlight to the next guessable option, wrapping around.
  function move(step) {
    if (!enabled.length) return
    setOpen(true)
    const current = enabled.findIndex((item) => options[active]?.id === item.id)
    const first = step > 0 ? enabled[0] : enabled.at(-1)
    const next = current === -1 ? first : enabled[(current + step + enabled.length) % enabled.length]
    setActive(options.indexOf(next))
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  // Enter or the button: the highlighted language, or the best match when nothing is highlighted.
  function submit() {
    // The highlight wins even when the list just closed (clicking the button blurs the input first).
    const highlighted = options[active]
    if (highlighted && !taken.has(highlighted.id)) return pick(highlighted)
    if (query.trim()) pick(enabled[0])
  }

  const showList = open && options.length > 0
  return (
    <div className="relative">
      <div className="flex gap-2">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Guess a language
        </label>
        <input
          id={`${listId}-input`}
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? optionId(options[active].id) : undefined}
          autoComplete="off"
          spellCheck="false"
          placeholder={mode === 'classic' ? 'Type a language...' : 'Which language is it?'}
          value={query}
          readOnly={busy}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 border-2 border-ink bg-white px-3 py-2.5 font-mono text-sm text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel read-only:bg-mist"
        />
        <PixelButton onClick={submit} disabled={busy || !query.trim() || enabled.length === 0} className="shrink-0">
          Guess
        </PixelButton>
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Languages"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border-2 border-ink bg-white shadow-pixel-ink"
        >
          {options.map((item, index) => {
            const used = taken.has(item.id)
            return (
              <li
                key={item.id}
                id={optionId(item.id)}
                role="option"
                aria-selected={index === active}
                aria-disabled={used || undefined}
                // Keep the input focused, so the blur doesn't close the list before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(item)}
                onMouseEnter={() => !used && setActive(index)}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                  used ? 'cursor-not-allowed text-muted line-through' : index === active ? 'cursor-pointer bg-primary text-white' : 'cursor-pointer text-ink hover:bg-primary-soft'
                }`}
              >
                <span className="font-semibold">{item.name}</span>
                <span className={`font-mono text-xs ${index === active && !used ? 'text-white/80' : 'text-muted'}`}>
                  {used ? 'guessed' : item.year}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
