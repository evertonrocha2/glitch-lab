import { useT } from '../../../lib/i18n/I18nProvider.jsx'

export const isMac = () => {
  const nav = globalThis.navigator
  return /Mac|iPhone|iPad|iPod/.test(nav?.userAgentData?.platform || nav?.platform || '')
}

// Each shortcut is a list of key combos, shown as "or"; a sequence is pressed one after the other.
const SHORTCUTS = [
  { combos: [['Tab'], ['Shift', 'Tab']], label: 'editor.keys.indent' },
  { combos: [['Enter']], label: 'editor.keys.newline' },
  { combos: [['Mod', 'Enter'], ['Mod', 'Shift', 'Enter']], label: 'editor.keys.lines' },
  { combos: [['Mod', '/']], label: 'editor.keys.comment' },
  { combos: [['Alt', 'Up'], ['Alt', 'Down']], label: 'editor.keys.move' },
  { combos: [['Shift', 'Alt', 'Up'], ['Shift', 'Alt', 'Down']], label: 'editor.keys.copy' },
  { combos: [['Mod', 'Shift', 'K']], label: 'editor.keys.delete' },
  { combos: [['Mod', 'Z']], label: 'editor.keys.undo' },
  { combos: [['Esc'], ['Tab']], label: 'editor.keys.leave', sequence: true },
]

// A pixel arrow: the pixel font has no arrow glyphs.
function Arrow({ down, label }) {
  return (
    <svg role="img" aria-label={label} viewBox="0 0 5 5" shapeRendering="crispEdges" className={`size-2.5 fill-current ${down ? 'rotate-180' : ''}`}>
      <rect x="2" y="0" width="1" height="5" />
      <rect x="1" y="1" width="3" height="1" />
      <rect x="0" y="2" width="1" height="1" />
      <rect x="4" y="2" width="1" height="1" />
    </svg>
  )
}

function Key({ name, mac, t }) {
  let content = name
  if (name === 'Mod') content = mac ? 'Cmd' : 'Ctrl'
  else if (name === 'Alt') content = mac ? 'Option' : 'Alt'
  else if (name === 'Up' || name === 'Down') content = <Arrow down={name === 'Down'} label={t(`editor.keys.${name.toLowerCase()}`)} />
  return (
    <kbd className="inline-flex min-h-5 min-w-5 items-center justify-center border-2 border-ink bg-white px-1 font-label text-[10px] leading-none text-ink shadow-[2px_2px_0_var(--color-ink)]">
      {content}
    </kbd>
  )
}

// The list under the editor, closed until asked for, so it never pushes the Submit button down.
export default function CodeEditorShortcuts() {
  const t = useT()
  const mac = isMac()
  return (
    <details className="group mt-2 text-xs text-muted">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 py-1 font-label text-[10px] text-ink select-none">
        <svg aria-hidden="true" viewBox="0 0 3 5" shapeRendering="crispEdges" className="size-2.5 fill-current transition-transform group-open:rotate-90">
          <rect x="0" y="0" width="1" height="5" />
          <rect x="1" y="1" width="1" height="3" />
          <rect x="2" y="2" width="1" height="1" />
        </svg>
        {t('editor.keys.title')}
      </summary>
      <div className="mt-2 border-2 border-ink bg-white p-3">
        <ul aria-label={t('editor.keys.list')} className="divide-y divide-line">
          {SHORTCUTS.map(({ combos, label, sequence }) => (
            <li key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-1.5 first:pt-0">
              <span className="text-ink">{t(label)}</span>
              <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-1">
                {combos.map((combo, index) => (
                  <span key={combo.join('+')} className="inline-flex items-center gap-1">
                    {index > 0 && <span className="px-0.5 text-muted">{sequence ? t('editor.keys.then') : '/'}</span>}
                    {combo.map((name, keyIndex) => (
                      <span key={name} className="inline-flex items-center gap-1">
                        {keyIndex > 0 && <span aria-hidden="true">+</span>}
                        <Key name={name} mac={mac} t={t} />
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 border-t border-line pt-2.5">{t('editor.keys.pairs')}</p>
      </div>
    </details>
  )
}
