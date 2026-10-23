import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthError, startChallenge } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'
import ErrorNotice from '../../ui/error-notice/error-notice.jsx'
import PixelButton, { buttonClasses } from '../../ui/pixel-button/pixel-button.jsx'

// The activity graph's purple ramp: gray for "not met", then light to dark by mastery.
export const LEVEL_FILL = ['#e3e5ec', '#b19bf9', '#8f6ff5', '#6a3df0', '#4a1fc4']
const SEGMENTS = 20
const SEGMENT = 5

// One bar of 20 pixel segments; the filled ones take the concept's mastery color.
function Bar({ mastery, level }) {
  const filled = Math.round((mastery / 100) * SEGMENTS)
  return (
    <svg viewBox={`0 0 ${SEGMENTS * SEGMENT} 6`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true" className="block h-4 w-full">
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed segments
          key={index}
          x={index * SEGMENT}
          y={0}
          width={SEGMENT - 1}
          height={6}
          fill={index < filled ? LEVEL_FILL[Math.max(level, 1)] : '#f4f5f8'}
        />
      ))}
    </svg>
  )
}

function TrainButton({ caseId }) {
  const t = useT()
  const { getToken, signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const sending = useRef(false)

  // No case of its own (met through a daily puzzle): the daily page has more.
  if (!caseId) {
    return (
      <Link to="/daily" className={buttonClasses('secondary', 'px-5 py-3')}>
        {t('skills.train')}
      </Link>
    )
  }

  async function train() {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setMessage('')
    try {
      const challenge = await startChallenge(caseId, await getToken())
      navigate(`/gym/${challenge.id}`)
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <PixelButton variant="secondary" onClick={train} disabled={busy} className="px-5 py-3">
        {busy ? t('skills.training') : t('skills.train')}
      </PixelButton>
      {message && <ErrorNotice message={message} />}
    </div>
  )
}

// Mastery per bug type on the progress page: a pixel bar chart, with a table for screen readers
// and the weakest bug type called out with a way to train it.
export default function SkillMap({ skills, className = '' }) {
  const t = useT()
  const labels = useLabels()
  const [hover, setHover] = useState(null)
  const met = skills.concepts.filter((item) => item.met)
  const average = met.length ? Math.round(met.reduce((sum, item) => sum + item.mastery, 0) / met.length) : 0
  const weakest = skills.concepts.find((item) => item.concept === skills.weakest) ?? null
  const summary = t('skills.summary', { met: met.length, total: skills.concepts.length, average })
  const detail = (item) =>
    item.box ? t('skills.detail', { box: item.box, solved: item.solved, passes: item.passes }) : t('skills.detailNoBox', { solved: item.solved, passes: item.passes })

  return (
    <section aria-labelledby="skills-title" className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="skills-title" className="font-pixel text-2xl font-bold text-ink">
          {t('skills.title')}
        </h2>
        {met.length > 0 && <p className="text-sm text-muted">{summary}</p>}
      </div>
      <p className="mt-2 max-w-2xl text-muted">{t('skills.lead')}</p>

      <div className="mt-5 border-2 border-ink bg-white p-4 shadow-pixel sm:p-5">
        {met.length === 0 ? (
          <p className="text-ink">{t('skills.empty')}</p>
        ) : (
          <>
            {weakest && (
              <div className="mb-5 flex flex-col gap-3 border-2 border-ink bg-secondary-soft p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-ink">{t('skills.weakest', { name: labels.concept(weakest.concept), mastery: weakest.mastery })}</p>
                <TrainButton caseId={skills.trainCaseId} />
              </div>
            )}

            <div role="img" aria-label={`${t('skills.title')}: ${summary}.`} className="relative">
              <ul aria-hidden="true" className="space-y-2.5">
                {skills.concepts.map((item) => {
                  const isWeakest = item.concept === skills.weakest
                  return (
                    <li
                      key={item.concept}
                      onMouseEnter={() => setHover(item.concept)}
                      onMouseLeave={() => setHover(null)}
                      className="relative grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_3rem]"
                    >
                      <span className={`col-span-2 flex items-center gap-2 text-sm sm:col-span-1 ${item.met ? 'text-ink' : 'text-muted'}`}>
                        <span className="truncate">{labels.concept(item.concept)}</span>
                        {isWeakest && <span className="shrink-0 bg-secondary px-1.5 py-0.5 font-label text-[10px] text-white">{t('skills.weakestTag')}</span>}
                      </span>
                      <span className={isWeakest ? 'outline-2 outline-offset-2 outline-secondary' : ''}>
                        <Bar mastery={item.mastery} level={item.level} />
                      </span>
                      <span className="text-right font-label text-xs text-ink tabular-nums">{item.met ? `${item.mastery}%` : '-'}</span>
                      {hover === item.concept && (
                        <span className="pointer-events-none absolute right-12 bottom-full z-10 mb-1 border-2 border-ink bg-white px-2 py-1 text-xs whitespace-nowrap text-ink shadow-pixel-ink">
                          {item.met ? `${labels.concept(item.concept)}: ${item.mastery}%. ${detail(item)}.` : `${labels.concept(item.concept)}: ${t('skills.notMet')}.`}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div aria-hidden="true" className="mt-4 flex items-center justify-end gap-1.5 font-label text-[10px] text-muted">
              {t('app.activity.less')}
              {LEVEL_FILL.map((fill) => (
                <span key={fill} className="size-[11px]" style={{ backgroundColor: fill }} />
              ))}
              {t('app.activity.more')}
            </div>
          </>
        )}
      </div>

      <table className="sr-only">
        <caption>{t('skills.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('skills.col.concept')}</th>
            <th scope="col">{t('skills.col.mastery')}</th>
            <th scope="col">{t('skills.col.box')}</th>
            <th scope="col">{t('skills.col.solved')}</th>
            <th scope="col">{t('skills.col.passes')}</th>
          </tr>
        </thead>
        <tbody>
          {skills.concepts.map((item) => (
            <tr key={item.concept}>
              <th scope="row">{labels.concept(item.concept)}</th>
              <td>{item.met ? `${item.mastery}%` : t('skills.notMet')}</td>
              <td>{item.box ?? t('skills.noBox')}</td>
              <td>{item.solved}</td>
              <td>{item.passes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
