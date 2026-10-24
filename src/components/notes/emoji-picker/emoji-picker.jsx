import { useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { readRecent, rememberEmoji, searchEmojis, useEmojis } from '../../../lib/notes/emoji.js'

const COLUMNS = 7
const CATEGORY_ICON = { recent: '🕘', smileys: '😀', people: '👋', nature: '🌱', food: '🍕', activity: '⚽', travel: '🚀', objects: '💡', symbols: '❤️' }

// An emoji picker: a search box that drives a grid of emojis (a listbox, through
// aria-activedescendant, so focus never leaves the box), category tabs and the recently used ones.
// Escape or the close button calls onClose; the caller puts focus back where it was.
export default function EmojiPicker({ id, onPick, onClose, className = '' }) {
  const t = useT()
  const data = useEmojis()
  const [recent, setRecent] = useState(readRecent)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(() => (readRecent().length ? 'recent' : 'smileys'))
  const [active, setActive] = useState(0)
  const listId = `${id}-list`

  const emojis = data?.emojis ?? []
  const byChar = new Map(emojis.map((emoji) => [emoji.char, emoji]))
  let list
  if (query.trim()) list = searchEmojis(emojis, query)
  else if (category === 'recent') list = recent.map((char) => byChar.get(char) ?? { char, name: char })
  else list = emojis.filter((emoji) => emoji.category === category)
  const current = Math.min(active, Math.max(list.length - 1, 0))
  const tabs = [...(recent.length ? ['recent'] : []), ...(data?.categories ?? [])]

  function pick(emoji) {
    setRecent(rememberEmoji(emoji.char))
    onPick(emoji.char)
  }

  function keyDown(event) {
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }
    if (moves[event.key] !== undefined && list.length) {
      // Left and right belong to the search text while there is some to move through.
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && query && event.currentTarget.selectionStart !== query.length) return
      event.preventDefault()
      setActive(Math.min(Math.max(current + moves[event.key], 0), list.length - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (list[current]) pick(list[current])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-label={t('notes.emoji.title')}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
      className={`z-30 w-76 max-w-[calc(100vw-2.5rem)] border-2 border-ink bg-white shadow-pixel ${className}`}
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-mist pl-3">
        <p className="font-label text-[10px] text-muted">{t('notes.emoji.title')}</p>
        <button type="button" onClick={onClose} aria-label={t('notes.emoji.close')} className="grid size-10 place-items-center text-lg text-ink hover:bg-white">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <input
        // biome-ignore lint/a11y/noAutofocus: the picker was opened on purpose to search it
        autoFocus
        type="text"
        role="combobox"
        aria-label={t('notes.emoji.search')}
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={list.length ? `${listId}-${current}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={keyDown}
        placeholder={t('notes.emoji.placeholder')}
        autoComplete="off"
        className="min-h-10 w-full border-b-2 border-ink px-3 text-sm text-ink placeholder:text-muted/60 focus-visible:outline-none"
      />
      {!query.trim() && tabs.length > 0 && (
        <div role="group" aria-label={t('notes.emoji.categories')} className="flex overflow-x-auto border-b-2 border-ink">
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={category === name}
              aria-label={t(`notes.emoji.${name}`)}
              title={t(`notes.emoji.${name}`)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setCategory(name)
                setActive(0)
              }}
              className={`grid size-10 shrink-0 place-items-center text-lg ${category === name ? 'bg-primary-soft shadow-[inset_0_-3px_0_var(--color-primary)]' : 'hover:bg-mist'}`}
            >
              <span aria-hidden="true">{CATEGORY_ICON[name]}</span>
            </button>
          ))}
        </div>
      )}
      {!data && <p className="px-3 py-3 text-sm text-muted">{t('notes.emoji.loading')}</p>}
      {data && list.length === 0 && <p className="px-3 py-3 text-sm text-muted">{t('notes.emoji.none')}</p>}
      <div
        id={listId}
        role="listbox"
        aria-label={query.trim() ? t('notes.emoji.search') : t(`notes.emoji.${category}`)}
        className="grid max-h-56 grid-cols-7 overflow-y-auto p-1"
      >
        {list.map((emoji, index) => (
          <div
            key={emoji.char}
            id={`${listId}-${index}`}
            role="option"
            tabIndex={-1}
            aria-selected={index === current}
            aria-label={`${emoji.char} ${emoji.name}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(emoji)}
            onKeyDown={() => {}}
            className={`grid size-10 cursor-pointer place-items-center text-xl ${index === current ? 'bg-primary-soft outline-2 outline-primary' : 'hover:bg-mist'}`}
          >
            {emoji.char}
          </div>
        ))}
      </div>
    </div>
  )
}
