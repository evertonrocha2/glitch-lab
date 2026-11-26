import { useId, useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import SectionHead, { WRAP } from '../section-head/section-head.jsx'

// Each question is landing.faq.<id>.q, with its answer in landing.faq.<id>.a.
const QUESTIONS = ['free', 'languages', 'answer', 'judge', 'upload', 'safe', 'export', 'account']

function Question({ q, a, open, onToggle }) {
  const id = useId()
  return (
    <div className={`border-2 border-(--lp-void) transition-colors duration-200 ${open ? 'bg-(--lp-raised) shadow-[inset_2px_2px_0_var(--lp-gold-dark),4px_4px_0_0_rgb(8_5_24/0.5)]' : 'bg-(--lp-panel) shadow-[inset_2px_2px_0_var(--lp-line),4px_4px_0_0_rgb(8_5_24/0.5)]'}`}>
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold transition-colors hover:text-(--lp-gold-hi)"
        >
          {q}
          <span
            aria-hidden="true"
            className={`grid size-7 shrink-0 place-items-center border-2 border-(--lp-void) transition-[background-color,color] duration-200 ${open ? 'bg-(--lp-gold) text-[#2a1606]' : 'bg-(--lp-inset) text-(--lp-arcane-hi)'}`}
          >
            <span className={`block font-pixel text-base leading-none transition-transform duration-300 ${open ? 'rotate-45' : 'rotate-0'}`}>+</span>
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
            className={`border-t border-dashed border-(--lp-line) px-5 py-4 leading-relaxed text-[#d6cff3] transition-[opacity,translate] duration-300 motion-reduce:transition-none ${open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
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
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 py-20 sm:py-28">
      <div className={`${WRAP} grid gap-10 lg:grid-cols-[1fr_1.6fr]`}>
        <div>
          <SectionHead id="faq-title" kicker={t('landing.faq.kicker')} title={t('landing.faq.title')} body={t('landing.faq.body')} />
          <button
            type="button"
            onClick={() => setOpen((current) => (current.size === QUESTIONS.length ? new Set() : new Set(QUESTIONS.keys())))}
            className="mt-6 font-mono text-xs uppercase tracking-[0.08em] text-(--lp-gold) underline underline-offset-4 hover:text-(--lp-gold-hi)"
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
