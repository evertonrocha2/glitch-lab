import { useEffect, useRef } from 'react'
import { conceptLabel } from '../../../shared/concepts.js'
import PixelButton from '../pixel/PixelButton.jsx'
import ResultCards from '../ResultCards.jsx'
import { firstLine } from './CaseCard.jsx'

const STATUS_TEXT = { new: 'New case', training: 'In training', solved: 'Solved' }

// A side panel to study one case, with the way into the gym at the bottom.
export default function CaseDrawer({ item, onClose, onTrain, training }) {
  const panel = useRef(null)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/40" onClick={onClose}>
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto border-l-2 border-ink bg-mist p-6 focus-visible:outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-label text-[11px] text-primary">
              {conceptLabel(item.concept)} · {STATUS_TEXT[item.status]}
            </p>
            <h2 id="case-title" className="mt-3 break-words font-mono text-base leading-relaxed text-ink">
              {firstLine(item.error)}
            </h2>
          </div>
          <PixelButton variant="ghost" onClick={onClose} className="shrink-0 px-3 py-2">
            Close
          </PixelButton>
        </div>

        <ResultCards analysis={item.analysis} />

        <div className="mt-10 border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
          <p className="font-label text-[11px] text-secondary">Gym</p>
          <p className="mt-2 text-ink">
            The AI writes new code with this same kind of bug. You fix it. {item.passedCount} of 2 challenges passed.
          </p>
          <PixelButton variant="secondary" onClick={() => onTrain(item)} disabled={training || !onTrain} className="mt-4">
            {training ? 'Preparing your challenge...' : 'Train this'}
          </PixelButton>
        </div>
      </aside>
    </div>
  )
}
