import { LEVELS, XP } from '../../../shared/progress.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { levelTitle } from '../../lib/i18n/labels.js'

// Each action is landing.levels.earn.<id>, worth XP[id].
const EARN = ['case', 'pass', 'cleanPass', 'solved', 'note', 'studyMinute']

export default function LevelLadder() {
  const t = useT()
  return (
    <section id="levels" aria-labelledby="levels-title" className="relative scroll-mt-4 overflow-hidden border-b-2 border-ink bg-primary-soft">
      <div aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/2 opacity-20" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:py-24">
        <div>
          <p className="font-label text-xs text-primary">{t('landing.levels.kicker')}</p>
          <h2 id="levels-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            {t('landing.levels.title', { first: levelTitle(t, 1), last: levelTitle(t, LEVELS.length) })}
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t('landing.levels.body')}</p>
          <ol aria-label={t('landing.levels.list')} className="mt-10 space-y-2">
            {LEVELS.map((level, index) => (
              <li key={level.title} className="flex items-center gap-3" style={{ paddingLeft: `${index * 0.9}rem` }}>
                <span
                  className={`grid size-9 shrink-0 place-items-center border-2 border-ink font-label text-xs ${index === LEVELS.length - 1 ? 'bg-primary text-white' : 'bg-white text-ink'}`}
                >
                  {index + 1}
                </span>
                <span className="flex flex-1 items-center justify-between gap-3 border-2 border-ink bg-white px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]">
                  <span className="font-pixel text-lg font-bold text-ink">{levelTitle(t, index + 1)}</span>
                  <span className="font-label text-[10px] whitespace-nowrap text-muted">{level.min} XP</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="self-end">
          <div className="border-2 border-ink bg-white shadow-pixel">
            <p className="border-b-2 border-ink bg-primary px-4 py-2.5 font-label text-xs text-white">{t('landing.levels.earn')}</p>
            <ul className="divide-y-2 divide-dashed divide-line">
              {EARN.map((id) => (
                <li key={id} className="flex items-center justify-between gap-3 px-4 py-3 text-ink">
                  <span>{t(`landing.levels.earn.${id}`)}</span>
                  <strong className="font-label text-xs whitespace-nowrap text-secondary">+{XP[id]} XP</strong>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-sm text-muted">{t('landing.levels.streak')}</p>
        </div>
      </div>
    </section>
  )
}
