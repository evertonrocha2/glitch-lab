import { BADGES } from '../../../shared/badges.js'
import { TRAIL_BONUS_XP } from '../../../shared/trails.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { conceptName, levelTitle, statusName, trailKindName } from '../../lib/i18n/labels.js'
import BadgeIcon from '../pixel/BadgeIcon.jsx'
import KindIcon from '../trail/KindIcon.jsx'

// Small drawings of the real screens. They're decoration: each card's heading and text say the same thing.

function MiniBoard() {
  const t = useT()
  const columns = [
    { status: 'new', stripe: 'bg-muted', cards: ['TypeError', 'IndentationError'] },
    { status: 'training', stripe: 'bg-secondary', cards: ['IndexError'] },
    { status: 'solved', stripe: 'bg-primary', cards: ['ReferenceError', 'KeyError'] },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {columns.map((column) => (
        <div key={column.status} className="min-w-0 border-2 border-ink bg-mist p-1.5">
          <p className="mb-1.5 truncate font-label text-[10px] text-ink">{statusName(t, column.status)}</p>
          <div className="space-y-1.5">
            {column.cards.map((card) => (
              <div key={card} className="flex overflow-hidden border-2 border-ink bg-white">
                <span className={`w-1 shrink-0 ${column.stripe}`} />
                <span className="truncate px-1.5 py-1 font-pixel text-xs font-bold text-ink">{card}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniGym() {
  const t = useT()
  return (
    <div className="space-y-2">
      <div className="border-2 border-ink bg-white font-mono text-xs leading-relaxed">
        <p className="px-2 text-muted">1 scores = [7, 9, 4]</p>
        <p className="bg-primary-soft px-2 text-ink">2 for i in range(1, len(scores) + 1):</p>
        <p className="px-2 text-muted">3 &nbsp;&nbsp;&nbsp;print(scores[i])</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="border-2 border-ink bg-secondary-soft px-1.5 py-0.5 font-label text-[10px] text-secondary">{t('landing.mini.hint')}</span>
        <span className="border-2 border-ink bg-primary px-1.5 py-0.5 font-label text-[10px] text-white">{t('landing.mini.passed')}</span>
      </div>
    </div>
  )
}

function MiniNote() {
  const t = useT()
  return (
    <div className="space-y-1.5 border-2 border-ink bg-white p-2.5">
      <p className="font-pixel text-sm font-bold text-ink">{t('landing.mini.noteTitle')}</p>
      <p className="text-xs text-ink/80">
        {t('landing.mini.noteText')} <span className="bg-primary-soft px-1 font-semibold text-primary">@TypeError</span>
      </p>
      <div className="flex overflow-hidden border-2 border-ink">
        <span className="w-1 bg-secondary" />
        <span className="px-1.5 py-1 font-pixel text-xs font-bold text-ink">TypeError</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted line-through">
        <span className="grid size-3 place-items-center bg-primary text-[10px] text-white no-underline">✓</span>
        {t('landing.mini.noteTodo')}
      </p>
    </div>
  )
}

function MiniTimer() {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-ink bg-white p-3 shadow-pixel-secondary">
      <span className="flex items-center gap-2">
        <span className="size-2.5 border border-ink bg-primary motion-safe:animate-blink" />
        <span className="font-label text-2xl leading-none text-ink">25:00</span>
      </span>
      <span className="text-right text-xs text-muted">
        {t('landing.mini.streak')}
        <br />
        <strong className="text-ink">{t('landing.mini.today')}</strong>
      </span>
    </div>
  )
}

function MiniBadges() {
  const t = useT()
  const ids = ['first-clue', 'fixed-it', 'case-closed', 'sharp-eye', 'note-taker', 'on-a-roll']
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ids.map((id, index) => (
          <span key={id} className="grid size-11 place-items-center border-2 border-ink bg-white">
            <BadgeIcon id={id} accent={index % 2 ? 'secondary' : 'primary'} className="size-7" />
          </span>
        ))}
      </div>
      <p className="mt-3 flex items-center justify-between font-label text-[10px] text-ink">
        <span>{t('landing.mini.level', { title: levelTitle(t, 3) })}</span>
        <span className="text-muted">420 / 600 XP</span>
      </p>
      <div className="mt-1.5 flex gap-[2px] border-2 border-ink bg-white p-[2px]">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => (
          <span key={step} className={`h-2.5 flex-1 ${step < 7 ? (step % 2 ? 'bg-secondary' : 'bg-primary') : 'bg-mist'}`} />
        ))}
      </div>
    </div>
  )
}

function MiniExport() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid h-16 w-13 shrink-0 place-items-end border-2 border-ink bg-white p-1 shadow-pixel-ink">
        <span className="absolute top-0 right-0 size-3 border-b-2 border-l-2 border-ink bg-mist" />
        <span className="font-label text-[10px] text-primary">.md</span>
      </span>
      <span className="font-label text-lg text-ink">→</span>
      <span className="flex flex-col gap-1">
        {['Notion', 'Obsidian', 'GitHub'].map((app) => (
          <span key={app} className="border-2 border-ink bg-white px-1.5 py-0.5 font-label text-[10px] text-ink">
            {app}
          </span>
        ))}
      </span>
    </div>
  )
}

function MiniWeakSpot() {
  const t = useT()
  return (
    <div className="border-2 border-ink bg-primary-soft p-3">
      <p className="font-label text-[10px] text-primary">{t('landing.mini.weakSpot')}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{conceptName(t, 'undefined-access')}</p>
      <p className="text-xs text-muted">{t('landing.mini.openCases')}</p>
    </div>
  )
}

function MiniTrail() {
  const t = useT()
  const steps = [
    { kind: 'train', done: true },
    { kind: 'note', done: true },
    { kind: 'study', next: true },
    { kind: 'investigate' },
    { kind: 'reflect' },
  ]
  return (
    <ol className="flex items-start">
      {steps.map((step, index) => (
        <li key={step.kind} className="flex min-w-0 flex-1 items-start">
          <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              className={`grid size-10 place-items-center border-2 border-ink ${step.done ? 'bg-primary-soft' : step.next ? 'bg-secondary-soft shadow-pixel-secondary' : 'bg-white'}`}
            >
              <KindIcon kind={step.kind} accent={step.next ? 'secondary' : 'primary'} className="size-6" />
            </span>
            <span className={`max-w-full truncate font-label text-[10px] ${step.next ? 'text-secondary' : 'text-ink'}`}>
              {trailKindName(t, step.kind)}
            </span>
          </span>
          {index < steps.length - 1 && (
            <span className="mt-5 h-1 w-3 shrink-0 bg-[repeating-linear-gradient(to_right,var(--color-ink)_0_4px,transparent_4px_7px)] sm:w-8" />
          )}
        </li>
      ))}
    </ol>
  )
}

// Each card's text is landing.features.<id>.title and landing.features.<id>.body.
const FEATURES = [
  { id: 'board', visual: MiniBoard, span: 'lg:col-span-2' },
  { id: 'gym', visual: MiniGym },
  { id: 'notes', visual: MiniNote },
  { id: 'timer', visual: MiniTimer },
  { id: 'export', visual: MiniExport },
  { id: 'levels', visual: MiniBadges, span: 'lg:col-span-2' },
  { id: 'weak', visual: MiniWeakSpot },
  { id: 'trail', visual: MiniTrail, span: 'lg:col-span-3' },
]

export default function Features() {
  const t = useT()
  const vars = { count: BADGES.length, xp: TRAIL_BONUS_XP }
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-4 border-b-2 border-ink bg-mist">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-label text-xs text-primary">{t('landing.features.kicker')}</p>
          <h2 id="features-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            {t('landing.features.title')}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{t('landing.features.body')}</p>
        </div>
        <ul aria-label={t('landing.features.list')} className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ id, visual: Visual, span = '' }, index) => (
            <li
              key={id}
              className={`flex flex-col border-2 border-ink bg-white p-6 ${index % 3 === 1 ? 'shadow-pixel-secondary' : 'shadow-pixel'} ${span}`}
            >
              <div aria-hidden="true" className="relative mb-6 overflow-hidden border-2 border-dashed border-line bg-mist/60 p-4">
                <Visual />
              </div>
              <h3 className="font-pixel text-xl font-bold text-ink">{t(`landing.features.${id}.title`)}</h3>
              <p className="mt-2 leading-relaxed text-ink/75">{t(`landing.features.${id}.body`, vars)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
