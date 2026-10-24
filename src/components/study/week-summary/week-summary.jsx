import { formatDuration } from '../../../lib/day.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'

// The last 7 days at a glance: time the timer counted (the time that gives XP), how much was
// logged by hand on top (shown apart, it counts for nothing), and the most studied topics.
export default function WeekSummary({ summary }) {
  const t = useT()
  const most = summary.topTopics[0]?.seconds ?? 0
  return (
    <PixelCard as="section" aria-labelledby="study-week" className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:p-6">
      <div>
        <h2 id="study-week" className="font-label text-xs text-primary">
          {t('study.week.title')}
        </h2>
        <p className="mt-2 font-pixel text-4xl font-bold text-ink tabular-nums">{formatDuration(summary.countedSeconds)}</p>
        <p className="mt-1 text-sm text-muted">{t('study.week.counted')}</p>
        <p className="mt-3 text-sm text-ink">{t('study.week.sessions', { count: summary.sessionCount })}</p>
        {summary.manualSeconds > 0 && <p className="mt-1 text-xs text-muted">{t('study.week.manual', { time: formatDuration(summary.manualSeconds) })}</p>}
      </div>
      <div className="border-t-2 border-dashed border-line pt-4 sm:border-t-0 sm:border-l-2 sm:pt-0 sm:pl-6">
        <h3 className="font-label text-xs text-secondary">{t('study.week.topics')}</h3>
        {summary.topTopics.length ? (
          <ol className="mt-3 space-y-3">
            {summary.topTopics.map((item) => (
              <li key={item.topic}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{item.topic}</span>
                  <span className="shrink-0 font-label text-xs text-muted tabular-nums">{formatDuration(item.seconds)}</span>
                </div>
                <span aria-hidden="true" className="mt-1 block h-2 border border-ink bg-mist">
                  <span className="block h-full bg-secondary" style={{ width: `${Math.max(4, Math.round((item.seconds / most) * 100))}%` }} />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted">{t('study.week.noTopics')}</p>
        )}
      </div>
    </PixelCard>
  )
}
