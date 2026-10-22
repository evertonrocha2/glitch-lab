import { useEffect } from 'react'
import { Link } from 'react-router'
import { BADGES } from '../../shared/badges.js'
import { DAILY_XP } from '../../shared/daily.js'
import { XP } from '../../shared/progress.js'
import { MISSION_XP, TRAIL_BONUS_XP } from '../../shared/trails.js'
import AppShell from '../components/AppShell.jsx'
import BadgeIcon from '../components/pixel/BadgeIcon.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import { formatDuration } from '../lib/day.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

const SEGMENTS = 20

function XpBar({ progress }) {
  const { xp, levelXp, nextLevelXp } = progress
  const share = nextLevelXp ? (xp - levelXp) / (nextLevelXp - levelXp) : 1
  const filled = Math.round(share * SEGMENTS)
  return (
    <div
      role="progressbar"
      aria-label="Experience toward the next level"
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

const EARN = [
  ['Investigate an error', XP.case],
  ['Pass a gym challenge', XP.pass],
  ['...without hints', `+${XP.cleanPass}`],
  ['Solve a case', XP.solved],
  ['Write a note', XP.note],
  ['Study one minute', XP.studyMinute],
  ['Finish a trail mission', `${Math.min(...Object.values(MISSION_XP))}-${Math.max(...Object.values(MISSION_XP))}`],
  ['...and the whole trail', `+${TRAIL_BONUS_XP}`],
  ['Solve a daily: easy, medium, hard', `${DAILY_XP.easy} / ${DAILY_XP.medium} / ${DAILY_XP.hard}`],
  ['Solve the weekly global challenge', DAILY_XP.global],
]

export default function ProgressPage() {
  const { progress, refresh } = useProgress()

  useEffect(() => {
    refresh()
  }, [refresh])

  const earnedCount = progress?.badges.filter((badge) => badge.earned).length ?? 0
  const earnedIds = new Set(progress?.badges.filter((badge) => badge.earned).map((badge) => badge.id))

  return (
    <AppShell>
      <p className="font-label text-xs text-secondary">
        &gt; detective file<span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Your progress</h1>
      <p className="mt-2 text-muted">Every case, fix, note and minute of study earns XP. Badges mark the milestones.</p>
      <Link to="/people" className="mt-3 inline-block font-label text-xs text-secondary underline underline-offset-4 hover:text-primary">
        Find detectives
      </Link>

      {!progress ? (
        <p role="status" className="mt-10 font-label text-xs text-muted">
          Loading your progress...
        </p>
      ) : (
        <>
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <PixelCard className="relative overflow-hidden p-6 sm:p-8">
              <div aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/3 opacity-25" />
              <div className="relative">
                <p className="font-label text-xs text-primary">Level {progress.level}</p>
                <h2 className="mt-2 font-pixel text-4xl font-bold text-ink">{progress.title}</h2>
                <p className="mt-1 text-muted">
                  <strong className="font-label text-ink">{progress.xp} XP</strong>
                  {progress.nextLevelXp
                    ? ` · ${progress.nextLevelXp - progress.xp} XP to level ${progress.level + 1}`
                    : ' · Top level reached'}
                </p>
                <div className="mt-5">
                  <XpBar progress={progress} />
                </div>
                <div className="mt-6 border-t-2 border-dashed border-line pt-4">
                  <p className="font-label text-[10px] text-muted">Badges on your file</p>
                  {earnedCount ? (
                    <ul aria-label="Earned badges" className="mt-3 flex flex-wrap gap-2">
                      {BADGES.filter((badge) => earnedIds.has(badge.id)).map((badge, index) => (
                        <li key={badge.id} title={badge.name} className="grid size-10 place-items-center border-2 border-ink bg-white">
                          <BadgeIcon id={badge.id} accent={index % 2 ? 'secondary' : 'primary'} className="size-7" />
                          <span className="sr-only">{badge.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">None yet. Investigate your first error to earn one.</p>
                  )}
                </div>
              </div>
            </PixelCard>

            <ul aria-label="Study summary" className="grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink lg:grid-cols-1">
              {[
                { label: 'Streak', value: `${progress.streak}d`, tone: 'text-primary', note: 'days in a row' },
                { label: 'Today', value: formatDuration(progress.todaySeconds), tone: 'text-secondary', note: 'studied' },
                { label: 'Total', value: formatDuration(progress.totalSeconds), tone: 'text-ink', note: 'studied' },
              ].map((item) => (
                <li key={item.label} className="bg-white px-4 py-3">
                  <span className="font-label text-xs text-muted">{item.label}</span>
                  <strong className={`mt-1 block font-label text-2xl leading-none pt-1 ${item.tone}`}>{item.value}</strong>
                  <span className="text-xs text-muted">{item.note}</span>
                </li>
              ))}
            </ul>
          </div>

          <section aria-labelledby="badges-title" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="badges-title" className="font-pixel text-2xl font-bold text-ink">
                Badges
              </h2>
              <p className="font-label text-xs text-muted">
                {earnedCount}/{BADGES.length} earned
              </p>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
                    <strong className={`relative mt-3 font-pixel text-lg leading-tight ${earned ? 'text-ink' : 'text-muted'}`}>{badge.name}</strong>
                    <span className="relative mt-1 text-xs text-muted">{badge.how}</span>
                    <span
                      className={`relative mt-3 px-1.5 py-0.5 font-label text-[10px] ${earned ? 'bg-primary text-white' : 'border border-muted/50 text-muted'}`}
                    >
                      {earned ? 'Earned' : 'Locked'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-labelledby="xp-title" className="mt-14 max-w-xl">
            <h2 id="xp-title" className="font-label text-sm text-primary">
              How to earn XP
            </h2>
            <ul className="mt-4 divide-y-2 divide-dashed divide-line border-2 border-ink bg-white">
              {EARN.map(([label, points]) => (
                <li key={label} className="flex items-center justify-between px-4 py-2.5 text-sm text-ink">
                  <span>{label}</span>
                  <strong className="font-label text-xs text-secondary">{points} XP</strong>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </AppShell>
  )
}
