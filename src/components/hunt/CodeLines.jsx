import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const KEYS = { ArrowDown: 1, ArrowUp: -1 }

// A snippet as a column of big line buttons: tap one, or move with the arrow keys (Home and End
// too) and press Enter. One line is in the tab order at a time; blank lines are never a choice.
// After the answer, `answer` marks the bug line and `picked` the line chosen. Long lines scroll
// sideways inside the block, never the page.
export default function CodeLines({ code, onPick, disabled = false, picked = null, answer = null, autoFocus = false }) {
  const t = useT()
  const buttons = useRef({})
  const choices = code.flatMap((text, index) => (text.trim() === '' ? [] : [index + 1]))
  const [active, setActive] = useState(choices[0])
  const revealed = answer !== null

  // A new snippet starts on its first line, focused, so the keyboard works right away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new snippet resets the focus
  useEffect(() => {
    setActive(choices[0])
    if (autoFocus) buttons.current[choices[0]]?.focus()
  }, [code])

  function onKeyDown(event, line) {
    const at = choices.indexOf(line)
    let next = null
    if (KEYS[event.key]) next = choices[Math.min(choices.length - 1, Math.max(0, at + KEYS[event.key]))]
    if (event.key === 'Home') next = choices[0]
    if (event.key === 'End') next = choices.at(-1)
    if (next === null) return
    event.preventDefault()
    setActive(next)
    buttons.current[next]?.focus()
  }

  return (
    <div className="overflow-x-auto border-2 border-ink bg-mist">
      <ol aria-label={t('hunt.lines')} className="min-w-max py-1.5 font-mono text-[13px] leading-5 sm:text-sm">
        {code.map((text, index) => {
          const line = index + 1
          const isAnswer = revealed && line === answer
          const isPick = line === picked && !isAnswer
          const gutter = (
            <span aria-hidden="true" className="w-9 shrink-0 select-none pr-3 text-right text-muted sm:w-11">
              {line}
            </span>
          )
          const body = <span className="whitespace-pre pr-4 text-ink">{text}</span>
          if (text.trim() === '') {
            return (
              <li key={line} aria-hidden="true" className="flex min-h-5 items-center">
                {gutter}
              </li>
            )
          }
          const tone = isAnswer
            ? 'bg-primary-soft shadow-[inset_4px_0_0_var(--color-primary)]'
            : isPick
              ? 'bg-white shadow-[inset_4px_0_0_var(--color-ink)]'
              : 'enabled:hover:bg-white'
          return (
            <li key={line}>
              <button
                ref={(element) => {
                  buttons.current[line] = element
                }}
                type="button"
                tabIndex={line === active ? 0 : -1}
                disabled={disabled}
                aria-label={[
                  t('hunt.line', { n: line, text: text.trim() }),
                  isAnswer && t('hunt.marker.bug'),
                  line === picked && (revealed || disabled) && t('hunt.marker.pick'),
                ]
                  .filter(Boolean)
                  .join(', ')}
                onClick={() => onPick?.(line)}
                onKeyDown={(event) => onKeyDown(event, line)}
                onFocus={() => setActive(line)}
                className={`flex min-h-10 w-full items-center lg:min-h-8 text-left transition-colors disabled:cursor-default focus-visible:rounded-none focus-visible:bg-secondary-soft focus-visible:shadow-[inset_4px_0_0_var(--color-secondary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary ${tone}`}
              >
                {gutter}
                {body}
                {/* Sticky: on a long line the tag stays at the visible right edge instead of scrolling away. */}
                {isAnswer && <span className="sticky right-2 mr-2 shrink-0 bg-primary px-1.5 py-0.5 font-label text-[10px] leading-none text-white">{t('hunt.marker.bug')}</span>}
                {isPick && (revealed || disabled) && (
                  <span className="sticky right-2 mr-2 shrink-0 bg-ink px-1.5 py-0.5 font-label text-[10px] leading-none text-white">{t('hunt.marker.pick')}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
