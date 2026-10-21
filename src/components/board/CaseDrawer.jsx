import { useEffect, useRef } from 'react'
import { conceptLabel } from '../../../shared/concepts.js'
import { splitError, timeAgo } from '../../lib/caseInfo.js'
import PixelButton from '../pixel/PixelButton.jsx'
import ResultCards from '../ResultCards.jsx'
import { ProgressBlocks } from './CaseCard.jsx'

const STATUS = {
  new: { text: 'New', style: 'border border-ink bg-white text-ink' },
  training: { text: 'Training', style: 'bg-secondary text-white' },
  solved: { text: 'Solved', style: 'bg-primary text-white' },
}

// A side panel to study one case, with the way into the gym at the bottom.
export default function CaseDrawer({ item, onClose, onTrain, training }) {
  const panel = useRef(null)
  const { type, message } = splitError(item.error)
  const status = STATUS[item.status]
  const solved = item.status === 'solved'
  const passed = Math.min(item.passedCount, 2)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Clicking the dimmed page closes the panel; keyboard users have Escape and the Close button. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close case panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40"
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-title"
        tabIndex={-1}
        className="relative h-full w-full max-w-2xl overflow-y-auto border-l-2 border-ink bg-mist focus-visible:outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-ink bg-white px-6 py-3 sm:px-8">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className={`px-1.5 py-0.5 text-xs font-semibold ${status.style}`}>{status.text}</span>
            <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{conceptLabel(item.concept)}</span>
            <span className="border border-line bg-white px-1.5 py-0.5 font-mono text-xs text-muted">{item.language}</span>
            <span className="text-xs text-muted">· opened {timeAgo(item.createdAt)}</span>
          </p>
          <PixelButton variant="ghost" onClick={onClose} className="shrink-0 px-3 py-2">
            Close
          </PixelButton>
        </div>

        <div className="p-6 sm:p-8">
          <h2 id="case-title">
            <span className="block wrap-break-word font-pixel text-3xl font-bold text-ink">{type}</span>
            <span className="sr-only">:</span>{' '}
            <span className="mt-2 block wrap-break-word font-mono text-sm leading-relaxed text-ink/80">{message}</span>
          </h2>

          {item.code && (
            <details className="mt-6 border-2 border-ink bg-white">
              <summary className="cursor-pointer px-4 py-2.5 font-label text-xs text-ink">Your code</summary>
              <pre className="overflow-x-auto border-t-2 border-ink bg-mist p-4 font-mono text-[13px] leading-relaxed text-ink">{item.code}</pre>
            </details>
          )}

          <ResultCards analysis={item.analysis} />

          <div className="mt-10 border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
            <div className="flex items-center justify-between gap-3">
              <p className="font-label text-xs text-secondary">Gym</p>
              <span className="flex items-center gap-2 text-sm text-ink">
                <ProgressBlocks passed={passed} />
                {passed}/2 challenges passed
              </span>
            </div>
            <p className="mt-3 text-ink">
              {solved
                ? 'You solved this case. Practice again any time to keep it sharp.'
                : 'The AI writes new code with this same kind of bug. You fix it. Pass 2 challenges to solve this case.'}
            </p>
            <PixelButton variant="secondary" onClick={() => onTrain(item)} disabled={training || !onTrain} className="mt-4">
              {training ? 'Preparing your challenge...' : solved ? 'Practice again' : 'Train this'}
            </PixelButton>
          </div>
        </div>
      </aside>
    </div>
  )
}
