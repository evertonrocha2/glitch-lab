import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { TRAIL_BONUS_XP, TRAIL_KINDS } from '../../../shared/trails.js'
import AppShell from '../../components/AppShell.jsx'
import ErrorNotice from '../../components/ErrorNotice.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import BadgeIcon from '../../components/pixel/BadgeIcon.jsx'
import PixelButton from '../../components/pixel/PixelButton.jsx'
import PixelCard from '../../components/pixel/PixelCard.jsx'
import Working from '../../components/pixel/Working.jsx'
import KindIcon from '../../components/trail/KindIcon.jsx'
import TrailMap from '../../components/trail/TrailMap.jsx'
import { AuthError, buildTrail, createNote, getTrail, setTrailMission, startChallenge } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import { localDay } from '../../lib/day.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import { useLabels } from '../../lib/i18n/labels.js'
import { newBlock } from '../../lib/notes/blocks.js'
import { useProgress } from '../../lib/progress/ProgressProvider.jsx'
import { useStudyTimer } from '../../lib/timer/StudyTimerProvider.jsx'

// One block per mission, filled as they get done.
function MissionBar({ trail }) {
  const t = useT()
  return (
    <div
      role="progressbar"
      aria-label={t('notes.trail.missionsDone')}
      aria-valuemin={0}
      aria-valuemax={trail.total}
      aria-valuenow={trail.doneCount}
      className="flex gap-0.75 border-2 border-ink bg-white p-0.75"
    >
      {trail.missions.map((mission, index) => (
        <span key={mission.id} className={`h-4 flex-1 ${mission.status === 'done' ? (index % 2 ? 'bg-secondary' : 'bg-primary') : 'bg-mist'}`} />
      ))}
    </div>
  )
}

function EmptyState({ sources, onBuild }) {
  const t = useT()
  const labels = useLabels()
  const ready = sources.cases > 0
  return (
    <PixelCard className="relative mt-8 overflow-hidden p-6 sm:p-8">
      <div aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/3 opacity-20" />
      <div className="relative max-w-2xl">
        <p className="font-label text-xs text-primary">{t('notes.trail.emptyKicker')}</p>
        <h2 className="mt-2 font-pixel text-3xl font-bold text-ink">{t('notes.trail.emptyTitle')}</h2>
        {ready ? (
          <p className="mt-3 text-muted">
            {t('notes.trail.emptyReady', { cases: t('notes.cases', { count: sources.cases }), notes: t('notes.notes', { count: sources.notes }) })}
          </p>
        ) : (
          <p className="mt-3 text-muted">{t('notes.trail.emptyNotReady')}</p>
        )}
        <ul aria-label={t('notes.trail.kinds')} className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {TRAIL_KINDS.map((kind, index) => (
            <li key={kind.id} className="flex items-center gap-2 border-2 border-ink bg-white px-2.5 py-2">
              <KindIcon kind={kind.id} accent={index % 2 ? 'secondary' : 'primary'} className="size-5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-label text-[10px] text-ink">{labels.trailKind(kind.id)}</span>
                <span className="block text-xs text-muted">+{kind.xp} XP</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">{t('notes.trail.bonus', { xp: TRAIL_BONUS_XP, badge: labels.badgeName('trailblazer') })}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <PixelButton onClick={onBuild} disabled={!ready}>
            {t('notes.trail.build')}
          </PixelButton>
          {!ready && (
            <PixelButton as={Link} to="/board" variant="ghost">
              {t('notes.trail.toBoard')}
            </PixelButton>
          )}
        </div>
      </div>
    </PixelCard>
  )
}

function Celebration({ onBuild }) {
  const t = useT()
  const labels = useLabels()
  return (
    <PixelCard tone="secondary" className="relative mt-8 overflow-hidden p-6 sm:p-8">
      <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-20" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid size-20 shrink-0 place-items-center border-2 border-ink bg-primary-soft shadow-pixel-ink">
          <BadgeIcon id="trailblazer" className="size-14" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-pixel text-3xl font-bold text-ink">{t('notes.trail.complete')}</h2>
          <p className="mt-1 text-muted">{t('notes.trail.completeText', { xp: TRAIL_BONUS_XP, badge: labels.badgeName('trailblazer') })}</p>
        </div>
        <PixelButton onClick={onBuild} className="self-start sm:self-center">
          {t('notes.trail.buildNew')}
        </PixelButton>
      </div>
    </PixelCard>
  )
}

function TrailHeader({ trail, confirming, onAskNew, onCancel, onBuild }) {
  const t = useT()
  const { timeAgo } = useFormat()
  return (
    <PixelCard className="relative mt-8 overflow-hidden p-6 sm:p-8">
      <div aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/4 opacity-20" />
      <div className="relative">
        <p className="font-label text-xs text-primary">{t('notes.trail.active', { time: timeAgo(trail.createdAt) })}</p>
        <h2 className="mt-2 font-pixel text-3xl font-bold text-ink sm:text-4xl">{trail.title}</h2>
        {trail.summary && <p className="mt-2 max-w-2xl text-muted">{trail.summary}</p>}
        <div className="mt-5">
          <MissionBar trail={trail} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="border-2 border-ink bg-white px-2 py-1 font-label text-xs text-ink">
              {t('notes.trail.missionCount', { done: trail.doneCount, total: trail.total })}
            </span>
            <span className="border-2 border-ink bg-primary-soft px-2 py-1 font-label text-xs text-primary">
              {trail.xp}/{trail.xpTotal} XP
            </span>
          </div>
          {!confirming && (
            <PixelButton variant="ghost" onClick={trail.complete ? onBuild : onAskNew}>
              {t('notes.trail.buildNew')}
            </PixelButton>
          )}
        </div>
        {confirming && (
          <div role="group" aria-label={t('notes.trail.replace')} className="mt-4 border-2 border-dashed border-ink bg-mist p-4">
            <p className="text-sm text-ink">{t('notes.trail.replaceText')}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <PixelButton onClick={onBuild}>{t('notes.trail.replaceYes')}</PixelButton>
              <PixelButton variant="ghost" onClick={onCancel}>
                {t('notes.trail.replaceNo')}
              </PixelButton>
            </div>
          </div>
        )}
      </div>
    </PixelCard>
  )
}

function History({ history }) {
  const t = useT()
  const { timeAgo } = useFormat()
  if (!history.length) return null
  return (
    <section aria-labelledby="history-title" className="mt-14 max-w-xl">
      <h2 id="history-title" className="font-label text-sm text-primary">
        {t('notes.trail.history')}
      </h2>
      <ul aria-label={t('notes.trail.history')} className="mt-4 divide-y-2 divide-dashed divide-line border-2 border-ink bg-white">
        {history.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-ink">{item.title}</span>
              <span className="block text-xs text-muted">{t('notes.trail.started', { time: timeAgo(item.createdAt) })}</span>
            </span>
            <strong className={`shrink-0 font-label text-xs ${item.complete ? 'text-primary' : 'text-secondary'}`}>
              {item.complete ? t('notes.trail.historyComplete') : t('notes.trail.historyDone', { done: item.doneCount, total: item.total })}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

// A study plan from the student's own cases and notes, laid out as a path of missions.
export default function TrailPage() {
  const t = useT()
  const { getToken, signOut } = useAuth()
  const { refresh: refreshProgress } = useProgress()
  const { running, start } = useStudyTimer()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [building, setBuilding] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  // Double clicks must not start two slow AI calls.
  const buildBusy = useRef(false)

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  useEffect(() => {
    let alive = true
    getToken()
      .then(getTrail)
      .then((next) => alive && setData(next))
      .catch((err) => alive && handleError(err))
    return () => {
      alive = false
    }
  }, [getToken, handleError])

  const build = useCallback(async () => {
    if (buildBusy.current) return
    buildBusy.current = true
    setBuilding(true)
    setConfirming(false)
    setMessage('')
    try {
      setData(await buildTrail(localDay(), await getToken()))
      refreshProgress()
    } catch (err) {
      await handleError(err)
    } finally {
      buildBusy.current = false
      setBuilding(false)
    }
  }, [getToken, handleError, refreshProgress])

  // Each mission kind does its own thing; busy holds the mission being started.
  const run = useCallback(
    async (mission, work) => {
      if (busy) return
      setBusy(mission.id)
      setMessage('')
      try {
        await work(await getToken())
      } catch (err) {
        await handleError(err)
      } finally {
        setBusy(null)
      }
    },
    [busy, getToken, handleError],
  )

  const actions = {
    train: (mission) =>
      run(mission, async (token) => {
        const challenge = await startChallenge(mission.caseId, token)
        navigate(`/gym/${challenge.id}`)
      }),
    note: (mission) =>
      run(mission, async (token) => {
        const note = await createNote({ title: mission.title, blocks: [newBlock('case', { caseId: mission.caseId }), newBlock('text')] }, token)
        refreshProgress()
        navigate(`/notes/${note.id}`)
      }),
    study: start,
    reflect: (mission, done) =>
      run(mission, async (token) => {
        const trail = await setTrailMission({ trailId: data.trail.id, missionId: mission.id, done }, token)
        setData((current) => ({ ...current, trail }))
        refreshProgress()
      }),
  }

  const trail = data?.trail

  return (
    <AppShell>
      <PageHeader kicker={t('notes.trail.prompt')} title={t('notes.trail.title')} lead={t('notes.trail.lede')} />

      {message && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {building ? (
        <div className="mt-8 max-w-xl">
          <Working label={t('notes.trail.building')} />
        </div>
      ) : !data ? (
        !message && (
          <p role="status" className="mt-8 font-label text-xs text-muted">
            {t('notes.trail.loading')}
          </p>
        )
      ) : !trail ? (
        <EmptyState sources={data.sources} onBuild={build} />
      ) : (
        <>
          <TrailHeader trail={trail} confirming={confirming} onAskNew={() => setConfirming(true)} onCancel={() => setConfirming(false)} onBuild={build} />
          {trail.complete && <Celebration onBuild={build} />}
          <TrailMap missions={trail.missions} actions={actions} busy={busy} timerRunning={running} />
        </>
      )}

      {data && !building && <History history={data.history} />}
    </AppShell>
  )
}
