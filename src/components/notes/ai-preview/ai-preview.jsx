import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import CaseBlock from '../case-block/case-block.jsx'
import InlineText from '../inline-text/inline-text.jsx'
import RichBlocks from '../rich-blocks/rich-blocks.jsx'

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function Todos({ items }) {
  return (
    <ul className="space-y-1.5 py-1">
      {items.map((todo) => (
        <li key={todo.id} className="flex items-start gap-2.5">
          <span aria-hidden="true" className={`mt-1 grid size-4 shrink-0 place-items-center border-2 border-ink ${todo.done ? 'bg-primary' : 'bg-white'}`} />
          <span className={`leading-relaxed wrap-break-word ${todo.done ? 'text-muted line-through' : 'text-ink'}`}>
            <InlineText text={todo.text} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Side({ blocks, cases }) {
  return (
    <div className="space-y-2.5">
      <RichBlocks blocks={blocks} renderTodos={(items) => <Todos items={items} />} renderCase={(block) => <CaseBlock item={cases.get(block.caseId)} />} />
    </div>
  )
}

// What the AI would change, side by side on a wide screen and in two tabs on a phone, before
// anything is written into the note. Apply or Discard; Escape discards. Focus stays inside.
// cases: a Map of the writer's cases by id, for the case cards.
export default function AiPreview({ action, before, after, cases, onApply, onDiscard }) {
  const t = useT()
  const id = useId()
  const [tab, setTab] = useState('after')
  const panel = useRef(null)
  const title = useRef(null)
  const tabs = useRef({})

  useEffect(() => {
    title.current?.focus()
  }, [])

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onDiscard()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...panel.current.querySelectorAll(FOCUSABLE)]
      // The phone tabs are hidden on a wide screen: never a stop for Tab.
      .filter((item) => item.checkVisibility?.() ?? true)
    if (!items.length) return
    const first = items[0]
    const last = items.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function tabKey(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = tab === 'after' ? 'before' : 'after'
    setTab(next)
    tabs.current[next]?.focus()
  }

  const sides = [
    { key: 'before', blocks: before },
    { key: 'after', blocks: after },
  ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 sm:p-6">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-lead`}
        onKeyDown={onKeyDown}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col border-2 border-ink bg-white shadow-pixel-ink sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="border-b-2 border-ink px-4 py-3 sm:px-5">
          <h2 ref={title} id={`${id}-title`} tabIndex={-1} className="font-pixel text-xl font-bold text-ink focus:outline-none">
            {t(`notes.ai.previewTitle.${action}`)}
          </h2>
          <p id={`${id}-lead`} className="mt-1 text-sm text-muted">
            {t('notes.ai.previewLead')}
          </p>
          <div role="tablist" aria-label={t('notes.ai.views')} className="mt-3 flex gap-2 lg:hidden">
            {sides.map((side) => (
              <button
                key={side.key}
                ref={(element) => {
                  tabs.current[side.key] = element
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${side.key}`}
                aria-selected={tab === side.key}
                aria-controls={`${id}-panel-${side.key}`}
                tabIndex={tab === side.key ? 0 : -1}
                onClick={() => setTab(side.key)}
                onKeyDown={tabKey}
                className={`min-h-10 flex-1 border-2 border-ink px-3 font-label text-[10px] ${tab === side.key ? 'bg-primary text-white shadow-pixel-ink' : 'bg-white text-ink hover:bg-mist'}`}
              >
                {t(`notes.ai.${side.key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2">
          {sides.map((side) => (
            <section
              key={side.key}
              id={`${id}-panel-${side.key}`}
              aria-labelledby={`${id}-heading-${side.key}`}
              className={`min-w-0 p-4 sm:p-5 ${side.key === 'before' ? 'bg-mist/60 lg:border-r-2 lg:border-ink' : ''} ${tab === side.key ? '' : 'hidden lg:block'}`}
            >
              <h3 id={`${id}-heading-${side.key}`} className="mb-3 font-label text-[10px] text-muted">
                {t(`notes.ai.${side.key}`)}
              </h3>
              <Side blocks={side.blocks} cases={cases} />
            </section>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-ink px-4 py-3 sm:px-5">
          <p className="mr-auto text-xs text-muted">{t('notes.ai.codeSafe')}</p>
          <PixelButton variant="ghost" onClick={onDiscard}>
            {t('notes.ai.discard')}
          </PixelButton>
          <PixelButton onClick={onApply}>{t('notes.ai.apply')}</PixelButton>
        </div>
      </div>
    </div>
  )
}
