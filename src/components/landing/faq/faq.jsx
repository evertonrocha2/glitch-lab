import { useId, useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// Each question is landing.faq.<id>.q, with its answer in landing.faq.<id>.a.
const QUESTIONS = ['free', 'languages', 'answer', 'judge', 'upload', 'safe', 'export', 'account']

function Question({ q, a, open, onToggle }) {
  const id = useId()
  return (
    <div
      className={`border-2 border-ink bg-white transition-[translate,box-shadow] duration-200 ${open ? '-translate-x-0.5 -translate-y-0.5 shadow-pixel' : 'shadow-none'}`}
    >
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-ink transition-colors hover:bg-mist"
        >
          {q}
          <span
            aria-hidden="true"
            className={`grid size-7 shrink-0 place-items-center border-2 border-ink transition-[background-color,color] duration-200 ${open ? 'bg-primary text-white' : 'bg-white text-ink'}`}
          >
            <span className={`block font-label text-sm leading-none transition-transform duration-300 ${open ? 'rotate-45' : 'rotate-0'}`}>+</span>
          </span>
        </button>
      </h3>
      {/* grid-rows 0fr -> 1fr animates to the answer's real height; inert keeps closed answers out of tab order. */}
      <section
        id={`${id}-a`}
        aria-labelledby={`${id}-q`}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p
            className={`border-t-2 border-dashed border-line px-5 py-4 leading-relaxed text-ink/80 transition-[opacity,translate] duration-300 motion-reduce:transition-none ${open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
          >
            {a}
          </p>
        </div>
      </section>
    </div>
  )
}

export default function Faq() {
  const t = useT()
  const [open, setOpen] = useState(() => new Set([0]))
  const toggle = (index) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 border-b-2 border-ink bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-24">
        <div>
          <p className="font-label text-xs text-secondary">{t('landing.faq.kicker')}</p>
          <h2 id="faq-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            {t('landing.faq.title')}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{t('landing.faq.body')}</p>
          <button
            type="button"
            onClick={() => setOpen((current) => (current.size === QUESTIONS.length ? new Set() : new Set(QUESTIONS.keys())))}
            className="mt-6 font-label text-xs text-primary underline underline-offset-4 hover:text-ink"
          >
            {t(open.size === QUESTIONS.length ? 'landing.faq.closeAll' : 'landing.faq.openAll')}
          </button>
        </div>
        <div className="space-y-3">
          {QUESTIONS.map((id, index) => (
            <Question key={id} q={t(`landing.faq.${id}.q`)} a={t(`landing.faq.${id}.a`)} open={open.has(index)} onToggle={() => toggle(index)} />
          ))}
        </div>
      </div>
    </section>
  )
}
