import { useState } from 'react'
import { DAILY_XP } from '../../../../shared/daily.js'
import { DUEL_XP } from '../../../../shared/duel.js'
import { LEVELS, XP } from '../../../../shared/progress.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { levelTitle } from '../../../lib/i18n/labels.js'
import { PixelArt, TICK } from '../pixel-art/pixel-art.jsx'
import SectionHead, { WRAP } from '../section-head/section-head.jsx'

// Real ways to earn XP, with what they really pay. Two start done, as on a day already going.
const QUESTS = [
  { id: 'daily', name: 'landing.v2.quests.daily', tag: 'daily', xp: DAILY_XP.hard },
  { id: 'case', name: 'landing.levels.earn.case', tag: 'board', xp: XP.case, done: true },
  { id: 'pass', name: 'landing.levels.earn.pass', tag: 'gym', xp: XP.pass },
  { id: 'duel', name: 'landing.v2.quests.duel', tag: 'duel', xp: DUEL_XP.win },
  { id: 'solved', name: 'landing.levels.earn.solved', tag: 'board', xp: XP.solved },
  { id: 'note', name: 'landing.levels.earn.note', tag: 'notes', xp: XP.note, done: true },
]

// Where the demo starts: partway through the third level, so a few ticks reach the fourth.
const START_XP = 455

function levelOf(xp) {
  let index = 0
  LEVELS.forEach((level, i) => {
    if (xp >= level.min) index = i
  })
  return index
}

// The badge with the level number: a gold hex medal.
function Medal({ n }) {
  return (
    <span aria-hidden="true" className="relative grid h-[92px] w-[84px] shrink-0 place-items-center">
      <svg aria-hidden="true" viewBox="0 0 21 23" shapeRendering="crispEdges" className="absolute inset-0 size-full">
        <path fill="#12151b" d="M8 0h5v1h3v1h2v2h2v3h1v9h-1v3h-2v2h-2v1h-3v1H8v-1H5v-1H3v-2H1v-3H0V7h1V4h2V2h2V1h3z" />
        <path fill="#9a6a1c" d="M8 1h5v1h3v1h1v1h1v1h1v2h1v9h-1v2h-1v1h-1v1h-1v1h-3v1H8v-1H5v-1H4v-1H3v-1H2v-2H1V7h1V5h1V4h1V3h1V2h3z" />
        <path fill="#f2c14e" d="M8 2h5v1h3v1h1v1h1v2h1v9h-1v2h-1v1h-1v1h-3v1H8v-1H5v-1H4v-1H3v-2H2V7h1V5h1V4h1V3h3z" />
        <path fill="#fff1b0" d="M8 2h5v1H8v1H5v1H4v2H3v4H2V7h1V5h1V4h1V3h3z" />
      </svg>
      <b className="relative mt-1 font-pixel text-[34px] font-normal leading-none text-[#2a1606]">{n}</b>
    </span>
  )
}

// A quest panel to tick, and the level it moves. The XP lands on the bar right away.
export default function Quests() {
  const { t, locale } = useI18n()
  const [done, setDone] = useState(() => new Set(QUESTS.filter((q) => q.done).map((q) => q.id)))
  // How many times each quest was ticked on: the key that replays its "+XP" pop.
  const [pops, setPops] = useState({})
  const number = new Intl.NumberFormat(locale)

  const base = QUESTS.filter((q) => q.done).reduce((sum, q) => sum + q.xp, 0)
  const xp = START_XP - base + QUESTS.filter((q) => done.has(q.id)).reduce((sum, q) => sum + q.xp, 0)
  const index = levelOf(xp)
  const level = LEVELS[index]
  const next = LEVELS[index + 1]
  const startIndex = levelOf(START_XP)
  const progress = next ? ((xp - level.min) / (next.min - level.min)) * 100 : 100

  function toggle(quest, event) {
    const on = event.target.checked
    setDone((current) => {
      const updated = new Set(current)
      if (on) updated.add(quest.id)
      else updated.delete(quest.id)
      return updated
    })
    if (on) setPops((current) => ({ ...current, [quest.id]: (current[quest.id] ?? 0) + 1 }))
  }

  return (
    <section id="quests" aria-labelledby="quests-title" className="relative scroll-mt-16 py-20 sm:py-28">
      <div className={WRAP}>
        <SectionHead id="quests-title" kicker={t('landing.v2.quests.kicker')} title={t('landing.v2.quests.title')} body={t('landing.levels.body')} />
        <div className="mt-12 grid items-start gap-7 sm:mt-14 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="lp-frame">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-(--lp-void) px-5 py-4 shadow-[0_2px_0_#333b49]">
              <h3 className="font-pixel text-xl">{t('landing.v2.quests.panel')}</h3>
              <p className="font-mono text-xs tracking-[0.04em] text-(--lp-muted)">{t('landing.v2.quests.hint')}</p>
            </div>
            <ul className="grid gap-2 p-2.5">
              {QUESTS.map((quest) => {
                const checked = done.has(quest.id)
                return (
                  <li key={quest.id}>
                    <label className="lp-quest relative grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:grid-cols-[auto_1fr_auto]">
                      <input type="checkbox" className="sr-only" checked={checked} onChange={(event) => toggle(quest, event)} />
                      <span aria-hidden="true" className="lp-check grid size-[26px] place-items-center">
                        <PixelArt rows={TICK} className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className={`block font-medium ${checked ? 'text-(--lp-muted) line-through decoration-[rgb(176_182_193/0.6)]' : ''}`}>
                          {t(quest.name)}
                        </span>
                        <span className="mt-2 flex items-center gap-2.5 font-mono text-xs leading-none text-(--lp-muted)">
                          <span className="border border-(--lp-line) px-1.5 py-[3px] tracking-[0.04em] text-(--lp-arcane-hi)">
                            {t(`landing.v2.quests.tag.${quest.tag}`)}
                          </span>
                          <span aria-hidden="true" className="h-1.5 w-[70px] bg-(--lp-inset) shadow-[0_0_0_1px_#333b49] sm:w-[120px]">
                            <i className="block h-full bg-(--lp-ok) transition-[width] duration-500" style={{ width: checked ? '100%' : '0%' }} />
                          </span>
                          <span>{checked ? '1/1' : '0/1'}</span>
                        </span>
                      </span>
                      <span
                        data-xp
                        className={`col-start-2 font-pixel text-[15px] whitespace-nowrap sm:col-start-auto ${checked ? 'text-(--lp-ok)' : 'text-(--lp-gold) [text-shadow:0_0_14px_rgb(242_193_78/0.35)]'}`}
                      >
                        {t('landing.v2.quests.xp', { xp: quest.xp })}
                      </span>
                      {pops[quest.id] ? (
                        <span
                          key={pops[quest.id]}
                          aria-hidden="true"
                          data-go=""
                          className="lp-pop absolute right-4 -top-3 font-pixel text-lg text-(--lp-gold) [text-shadow:2px_2px_0_var(--lp-void)]"
                        >
                          {t('landing.v2.quests.xp', { xp: quest.xp })}
                        </span>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="lp-frame p-5 sm:p-[22px]">
            <p className="lp-eyebrow mb-4">{t('landing.v2.level.kicker')}</p>
            <div className="flex items-center gap-[18px]">
              <Medal n={index + 1} />
              <div>
                <p className="font-pixel text-[22px] leading-tight">{levelTitle(t, index + 1)}</p>
                <p className="mt-1.5 font-mono text-xs tracking-[0.04em] text-(--lp-muted)">{t('landing.v2.level.n', { n: index + 1 })}</p>
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex justify-between font-mono text-xs tracking-[0.04em] text-(--lp-muted)">
                <span>{t('landing.v2.level.track')}</span>
                <span>
                  <b className="font-medium text-(--lp-text)">{number.format(xp)}</b>
                  {next ? ` / ${number.format(next.min)} XP` : ' XP'}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t('landing.v2.level.track')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className="lp-xptrack"
                style={{ '--v': `${progress.toFixed(1)}%` }}
              >
                <i />
              </div>
              <p aria-live="polite" className="mt-2.5 font-mono text-xs leading-snug text-(--lp-muted)">
                {index > startIndex ? (
                  <em className="text-(--lp-gold) not-italic">{t('landing.v2.level.up', { title: levelTitle(t, index + 1) })} </em>
                ) : null}
                {next ? t('landing.v2.level.left', { left: number.format(next.min - xp), title: levelTitle(t, index + 2) }) : t('landing.v2.level.max')}
              </p>
            </div>
            <ol aria-label={t('landing.levels.list')} className="mt-6 grid gap-1.5">
              {LEVELS.map((step, i) => (
                <li
                  key={step.title}
                  className={`flex items-center justify-between gap-3 px-3 py-2 font-mono text-xs ${i === index ? 'lp-frame-gold border-2 border-(--lp-void) text-(--lp-gold-hi)' : i < index ? 'lp-inset text-(--lp-text)' : 'lp-inset text-(--lp-muted)'}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-4 text-right font-pixel text-[13px]">{i + 1}</span>
                    <span className="font-pixel text-sm">{levelTitle(t, i + 1)}</span>
                  </span>
                  <span>{number.format(step.min)} XP</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-(--lp-muted)">{t('landing.levels.streak')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
