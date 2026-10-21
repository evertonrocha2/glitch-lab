import { Link } from 'react-router'
import { ProgressBlocks } from '../board/CaseCard.jsx'
import PixelButton from '../pixel/PixelButton.jsx'

// Blue when the fix passes (practice paid off), purple when it needs another look.
export default function FixResult({ result }) {
  const { passed, feedback, case: kase } = result

  if (!passed) {
    return (
      <div role="status" className="border-2 border-ink bg-primary-soft p-5 shadow-pixel">
        <p className="font-label text-sm text-primary">Not yet</p>
        <p className="mt-2 text-ink">{feedback}</p>
        <p className="mt-2 text-sm text-muted">Change your fix and submit again.</p>
      </div>
    )
  }

  const solved = kase?.status === 'solved'
  return (
    <div role="status" className="border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
      <p className="font-label text-sm text-secondary">{solved ? 'Case solved!' : 'Fixed!'}</p>
      <p className="mt-2 text-ink">{feedback}</p>
      {kase && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink">
          <ProgressBlocks passed={kase.passedCount} />
          {kase.passedCount}/2 challenges passed on this case
        </p>
      )}
      <PixelButton as={Link} to="/board" variant="secondary" className="mt-4">
        Back to board
      </PixelButton>
    </div>
  )
}
