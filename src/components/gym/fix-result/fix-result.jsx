import { Link } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { ProgressBlocks } from '../../board/case-card/case-card.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'

// Blue when the fix passes (practice paid off), purple when it needs another look.
// back: { to, text }, where the way back goes; the board for a case, the daily page for a puzzle.
export default function FixResult({ result, back }) {
  const t = useT()
  const { passed, feedback, case: kase } = result
  const way = back ?? { to: '/board', text: t('board.gym.backBoard') }

  if (!passed) {
    return (
      <div role="status" className="border-2 border-ink bg-primary-soft p-5 shadow-pixel">
        <p className="font-label text-sm text-primary">{t('board.fix.notYet')}</p>
        <p className="mt-2 text-ink">{feedback}</p>
        <p className="mt-2 text-sm text-muted">{t('board.fix.tryAgain')}</p>
      </div>
    )
  }

  const solved = kase?.status === 'solved'
  return (
    <div role="status" className="border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
      <p className="font-label text-sm text-secondary">{solved ? t('board.fix.caseSolved') : t('board.fix.fixed')}</p>
      <p className="mt-2 text-ink">{feedback}</p>
      {kase && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink">
          <ProgressBlocks passed={kase.passedCount} />
          {t('board.fix.passedOnCase', { passed: kase.passedCount })}
        </p>
      )}
      <PixelButton as={Link} to={way.to} variant="secondary" className="mt-4">
        {way.text}
      </PixelButton>
    </div>
  )
}
