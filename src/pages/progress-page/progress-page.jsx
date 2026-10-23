import { useEffect } from 'react'
import { Link } from 'react-router'
import { BADGES } from '../../../shared/badges.js'
import { DAILY_XP } from '../../../shared/daily.js'
import { INTERROGATION_XP } from '../../../shared/interrogation.js'
import { COMMUNITY_XP, XP } from '../../../shared/progress.js'
import { RIDDLE_XP } from '../../../shared/riddle/game.js'
import { REVIEW_XP } from '../../../shared/review.js'
import { MISSION_XP, TRAIL_BONUS_XP } from '../../../shared/trails.js'
import ActivityGraph from '../../components/progress/activity-graph/activity-graph.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import BadgeIcon from '../../components/ui/badge-icon/badge-icon.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import SkillMap from '../../components/review/skill-map/skill-map.jsx'
import { formatDuration, localDay } from '../../lib/day.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import { useProgressData, useProgressRefresh } from '../../lib/progress/progress-provider.jsx'
import ProgressPageSkeleton from './progress-page-skeleton.jsx'

const SEGMENTS = 20

function XpBar({ progress }) {
  const { xp, levelXp, nextLevelXp } = progress
  const share = nextLevelXp ? (xp - levelXp) / (nextLevelXp - levelXp) : 1
  const filled = Math.round(share * SEGMENTS)
  const t = useT()
  return (
    <div
      role="progressbar"
      aria-label={t('app.xpBar')}
      aria-valuemin={levelXp}
      aria-valuemax={nextLevelXp ?? xp}
      aria-valuenow={xp}
      className="flex gap-[3px] border-2 border-ink bg-white p-[3px]"
    >
      {Array.from({ length: SEGMENTS }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative segments
        <span key={index} className={`h-4 flex-1 ${index < filled ? (index % 2 ? 'bg-secondary' : 'bg-primary') : 'bg-mist'}`} />
      ))}
    </div>
  )
}

// [message key under app.progress.earn, XP]
const EARN = [
  ['case', XP.case],
  ['pass', XP.pass],
  ['cleanPass', `+${XP.cleanPass}`],
  ['solved', XP.solved],
  ['note', XP.note],
  ['studyMinute', XP.studyMinute],
  ['mission', `${Math.min(...Object.values(MISSION_XP))}-${Math.max(...Object.values(MISSION_XP))}`],
  ['trail', `+${TRAIL_BONUS_XP}`],
  ['daily', `${DAILY_XP.easy} / ${DAILY_XP.medium} / ${DAILY_XP.hard}`],
  ['global', DAILY_XP.global],
  ['glitchdle', `${RIDDLE_XP.at(-1).xp}-${RIDDLE_XP[0].xp}`],
  ['article', COMMUNITY_XP.article],
  ['validRating', COMMUNITY_XP.validReceived],
  ['like', COMMUNITY_XP.likeReceived],
  ['comment', COMMUNITY_XP.comment],
  ['interrogation', INTERROGATION_XP],
  ['review', REVIEW_XP.card],
]

export default function ProgressPage() {
  const progress = useProgressData()
  const refresh = useProgressRefresh()
  const t = useT()
  const labels = useLabels()

  useEffect(() => {
    refresh()
  }, [refresh])

  const earnedCount = progress?.badges.filter((badge) => badge.earned).length ?? 0
  const earnedIds = new Set(progress?.badges.filter((badge) => badge.earned).map((badge) => badge.id))

  return (
    <AppShell>
      <PageHeader
        kicker={t('app.progress.kicker')}
        title={t('app.progress.title')}
        lead={t('app.progress.lead')}
        actions={
          <PixelButton as={Link} to="/people" variant="ghost" className="px-4 py-3">
            {t('app.progress.findPeople')}
          </PixelButton>
        }
      />

      {!progress ? (
        <ProgressPageSkeleton badges={BADGES.length} earn={EARN.length} />
      ) : (
        <>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <PixelCard className="relative overflow-hidden p-6 sm:p-8">
              <div aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/3 opacity-25" />
              <div className="relative">
                <p className="font-label text-xs text-primary">{t('app.progress.level', { level: progress.level })}</p>
                <h2 className="mt-2 font-pixel text-4xl font-bold text-ink">{labels.level(progress.level)}</h2>
                <p className="mt-1 text-muted">
                  <strong className="font-label text-ink">{progress.xp} XP</strong>
                  {progress.nextLevelXp
                    ? ` · ${t('app.progress.toNext', { xp: progress.nextLevelXp - progress.xp, level: progress.level + 1 })}`
                    : ` · ${t('app.progress.top')}`}
                </p>
                <div className="mt-5">
                  <XpBar progress={progress} />
                </div>
                <div className="mt-6 border-t-2 border-dashed border-line pt-4">
                  <p className="font-label text-[10px] text-muted">{t('app.progress.onFile')}</p>
                  {earnedCount ? (
                    <ul aria-label={t('app.progress.earnedList')} className="mt-3 flex flex-wrap gap-2">
                      {BADGES.filter((badge) => earnedIds.has(badge.id)).map((badge, index) => (
                        <li key={badge.id} title={labels.badgeName(badge.id)} className="grid size-10 place-items-center border-2 border-ink bg-white">
                          <BadgeIcon id={badge.id} accent={index % 2 ? 'secondary' : 'primary'} className="size-7" />
                          <span className="sr-only">{labels.badgeName(badge.id)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">{t('app.progress.noBadges')}</p>
                  )}
                </div>
              </div>
            </PixelCard>

            <ul aria-label={t('app.progress.summary')} className="grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink lg:grid-cols-1">
              {[
                { id: 'streak', label: t('app.progress.streak'), value: `${progress.streak}d`, tone: 'text-primary', note: t('app.progress.streakNote') },
                { id: 'today', label: t('app.progress.today'), value: formatDuration(progress.todaySeconds), tone: 'text-secondary', note: t('app.progress.studied') },
                { id: 'total', label: t('app.progress.total'), value: formatDuration(progress.totalSeconds), tone: 'text-ink', note: t('app.progress.studied') },
              ].map((item) => (
                <li key={item.id} className="bg-white px-4 py-3">
                  <span className="font-label text-xs text-muted">{item.label}</span>
                  <strong className={`mt-1 block whitespace-nowrap font-pixel font-bold text-lg leading-none pt-1 sm:text-2xl ${item.tone}`}>{item.value}</strong>
                  <span className="text-xs text-muted">{item.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {progress.activity && <ActivityGraph activity={progress.activity} today={localDay()} title={t('app.progress.activity')} className="mt-14" />}

          {progress.skills && <SkillMap skills={progress.skills} className="mt-14" />}

          {/* The badges take the page; how XP is earned is reference, so it rides along on the side. */}
          <div className="mt-14 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section aria-labelledby="badges-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="badges-title" className="font-pixel text-2xl font-bold text-ink">
                  {t('app.progress.badges')}
                </h2>
                <p className="font-label text-xs text-muted">
                  {t('app.progress.earnedCount', { earned: earnedCount, total: BADGES.length })}
                </p>
              </div>
              <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {BADGES.map((badge, index) => {
                  const earned = earnedIds.has(badge.id)
                  return (
                    <li
                      key={badge.id}
                      className={`relative flex flex-col items-center border-2 p-4 text-center ${
                        earned ? 'border-ink bg-white shadow-pixel-ink' : 'border-dashed border-muted/60 bg-mist'
                      }`}
                    >
                      {!earned && <span aria-hidden="true" className="dither-primary absolute inset-0 opacity-10" />}
                      <span className={`relative grid size-16 place-items-center border-2 ${earned ? 'border-ink bg-primary-soft' : 'border-muted/50 bg-white'}`}>
                        <BadgeIcon id={badge.id} earned={earned} accent={index % 2 ? 'secondary' : 'primary'} className="size-11" />
                      </span>
                      <strong className={`relative mt-3 font-pixel text-lg leading-tight ${earned ? 'text-ink' : 'text-muted'}`}>{labels.badgeName(badge.id)}</strong>
                      <span className="relative mt-1 text-xs text-muted">{labels.badgeHow(badge.id)}</span>
                      <span
                        className={`relative mt-3 px-1.5 py-0.5 font-label text-[10px] ${earned ? 'bg-primary text-white' : 'border border-muted/50 text-muted'}`}
                      >
                        {earned ? t('app.progress.earned') : t('app.progress.locked')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <aside aria-labelledby="xp-title" className="lg:sticky lg:top-6">
              <h2 id="xp-title" className="flex min-h-8 items-end font-label text-sm text-primary">
                {t('app.progress.howXp')}
              </h2>
              <ul className="mt-6 divide-y-2 divide-dashed divide-line border-2 border-ink bg-white">
                {EARN.map(([id, points]) => (
                  <li key={id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-ink">
                    <span>{t(`app.progress.earn.${id}`)}</span>
                    <strong className="shrink-0 font-label text-xs text-secondary">{points} XP</strong>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </>
      )}
    </AppShell>
  )
}
