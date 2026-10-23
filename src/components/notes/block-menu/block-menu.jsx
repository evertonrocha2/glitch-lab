import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// The pop-up under a block: "/" block types or "@" cases. The input that opened it keeps focus and
// drives it with the arrow keys (aria-activedescendant); a search box appears when nothing else can type.
export default function BlockMenu({ id, label, items, active, onPick, empty, search, onSearch, onKeyDown, onClose }) {
  const t = useT()
  return (
    <div className="absolute top-full left-0 z-20 mt-1 w-full max-w-md border-2 border-ink bg-white shadow-pixel">
      <p className="border-b-2 border-ink bg-mist px-3 py-1.5 font-label text-[10px] text-muted">{label}</p>
      {onSearch && (
        <input
          // biome-ignore lint/a11y/noAutofocus: the menu was opened on purpose to search it
          autoFocus
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onClose}
          aria-label={t('notes.editor.searchCases')}
          aria-controls={id}
          aria-activedescendant={items.length ? `${id}-${active}` : undefined}
          placeholder={t('notes.editor.searchPlaceholder')}
          className="w-full border-b-2 border-ink px-3 py-2 text-sm text-ink focus-visible:outline-none"
        />
      )}
      {items.length === 0 && <p className="px-3 py-2 text-sm text-muted">{empty}</p>}
      <div id={id} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto py-1">
        {items.map((item, index) => (
          <div
            key={item.key}
            id={`${id}-${index}`}
            role="option"
            tabIndex={-1}
            aria-selected={index === active}
            // mousedown would blur the input first and close the menu.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(item)}
            onKeyDown={() => {}}
            className={`cursor-pointer px-3 py-2 ${index === active ? 'bg-primary-soft' : 'hover:bg-mist'}`}
          >
            <span className="block truncate text-sm font-semibold text-ink">{item.label}</span>
            {item.sub && <span className="block truncate text-xs text-muted">{item.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
