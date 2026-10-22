import { useEffect, useRef, useState } from 'react'
import { activityLevel, calendarDay, WEEKS } from '../../shared/activity.js'
import { useT } from '../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../lib/i18n/format.js'

// One purple, light to dark (checked: lightness rises step by step, and the lightest step still
// stands out from white). Empty days use the neutral line gray, so "nothing" never reads as a level.
const LEVEL_FILL = ['#e3e5ec', '#b19bf9', '#8f6ff5', '#6a3df0', '#4a1fc4']
const CELL = 11
const GAP = 3
const STEP = CELL + GAP
const LEFT = 30
const TOP = 18
// Rows 1, 3 and 5 (Monday, Wednesday, Friday): the calendar starts on a Sunday.
const WEEKDAY_ROWS = [1, 3, 5]
// Any Sunday will do to name the weekdays.
const A_SUNDAY = '2023-01-01'

// "seg." -> "Seg", "out." -> "Out": short labels without the dot, capitalized, in any language.
const short = (text) => text.replace(/\.$/, '').replace(/^\p{Ll}/u, (letter) => letter.toUpperCase())

// Month labels sit over the first week that starts in that month.
function monthLabels(start, format) {
  const labels = []
  let last = null
  for (let week = 0; week < WEEKS; week++) {
    const month = short(format.day(calendarDay(start, week * 7), { month: 'short' }))
    if (month !== last && week < WEEKS - 2) labels.push({ week, month })
    last = month
  }
  return labels
}

// Totals per month, for the table screen readers get instead of 371 squares.
function monthTotals(activity, today, format) {
  const totals = new Map()
  activity.days.forEach((count, index) => {
    const day = calendarDay(activity.start, index)
    if (day > today) return
    const key = format.day(day, { month: 'long', year: 'numeric' })
    totals.set(key, (totals.get(key) ?? 0) + count)
  })
  return [...totals]
}

// A GitHub-style year of activity: each square is a day, darker means more done that day.
export default function ActivityGraph({ activity, today, title: titleProp, className = '' }) {
  const t = useT()
  const format = useFormat()
  const title = titleProp ?? t('app.activity.title')
  const longDate = (day) => format.day(day)
  const scroller = useRef(null)
  const [hover, setHover] = useState(null)
  const lastDay = today ?? calendarDay(activity.start, activity.days.length - 1)

  // On a narrow screen the newest weeks matter most: start scrolled to the right end.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])

  const width = LEFT + WEEKS * STEP
  const height = TOP + 7 * STEP
  const summary = activity.total
    ? t('app.activity.summary', {
        activities: t('app.activity.count', { count: activity.total }),
        days: t('app.activity.days', { count: activity.activeDays }),
      })
    : t('app.activity.summaryNone')
  const describe = (count, day) =>
    t('app.activity.onDay', { what: count ? t('app.activity.count', { count }) : t('app.activity.none'), day: longDate(day) })

  function onMove(event) {
    const index = event.target.dataset?.index
    if (index === undefined) return setHover(null)
    const box = event.target.getBoundingClientRect()
    const frame = scroller.current.getBoundingClientRect()
    setHover({ index: Number(index), x: box.left - frame.left + scroller.current.scrollLeft + CELL / 2, y: box.top - frame.top })
  }

  return (
    <section aria-labelledby="activity-title" className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="activity-title" className="font-pixel text-2xl font-bold text-ink">
          {title}
        </h2>
        <p className="text-sm text-muted">
          {summary}
          {activity.best && <span className="hidden sm:inline"> · {t('app.activity.best', { day: longDate(activity.best.day) })}</span>}
        </p>
      </div>

      <div className="mt-5 border-2 border-ink bg-white p-4 shadow-pixel">
        <div ref={scroller} className="relative overflow-x-auto pb-1">
          {/* Fills the card on wide screens; on a phone it keeps a readable size and scrolls. */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ minWidth: width }}
            shapeRendering="crispEdges"
            role="img"
            aria-label={`${title}: ${summary}.`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            className="block h-auto w-full"
          >
            {monthLabels(activity.start, format).map(({ week, month }) => (
              <text key={`${week}-${month}`} x={LEFT + week * STEP} y={10} className="fill-muted font-label text-[10px]">
                {month}
              </text>
            ))}
            {WEEKDAY_ROWS.map((row) => (
              <text key={row} x={0} y={TOP + row * STEP + CELL - 2} className="fill-muted font-label text-[10px]">
                {short(format.day(calendarDay(A_SUNDAY, row), { weekday: 'short' }))}
              </text>
            ))}
            {activity.days.map((count, index) => {
              const day = calendarDay(activity.start, index)
              if (day > lastDay) return null
              const week = Math.floor(index / 7)
              return (
                <rect
                  // biome-ignore lint/suspicious/noArrayIndexKey: one fixed cell per day position
                  key={index}
                  data-index={index}
                  x={LEFT + week * STEP}
                  y={TOP + (index % 7) * STEP}
                  width={CELL}
                  height={CELL}
                  fill={LEVEL_FILL[activityLevel(count)]}
                  stroke={hover?.index === index ? 'var(--color-ink)' : 'none'}
                  strokeWidth={hover?.index === index ? 1.5 : 0}
                />
              )
            })}
          </svg>
          {hover && (
            <p
              role="status"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full border-2 border-ink bg-white px-2 py-1 text-xs whitespace-nowrap text-ink shadow-pixel-ink"
              style={{ left: hover.x, top: hover.y - 6 }}
            >
              {describe(activity.days[hover.index], calendarDay(activity.start, hover.index))}
            </p>
          )}
        </div>

        <div aria-hidden="true" className="mt-3 flex items-center justify-end gap-1.5 font-label text-[10px] text-muted">
          {t('app.activity.less')}
          {LEVEL_FILL.map((fill) => (
            <span key={fill} className="size-[11px]" style={{ backgroundColor: fill }} />
          ))}
          {t('app.activity.more')}
        </div>
      </div>

      <table className="sr-only">
        <caption>{t('app.activity.caption', { title })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('app.activity.month')}</th>
            <th scope="col">{t('app.activity.activities')}</th>
          </tr>
        </thead>
        <tbody>
          {monthTotals(activity, lastDay, format).map(([month, total]) => (
            <tr key={month}>
              <th scope="row">{month}</th>
              <td>{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
