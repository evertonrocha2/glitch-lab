import { BADGES } from '../../../../shared/badges.js'
import { TRAIL_BONUS_XP } from '../../../../shared/trails.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { conceptName, levelTitle, statusName, trailKindName } from '../../../lib/i18n/labels.js'
import KindIcon from '../../trail/kind-icon/kind-icon.jsx'
import BadgeIcon from '../../ui/badge-icon/badge-icon.jsx'
import SectionHead, { WRAP } from '../section-head/section-head.jsx'

// Small drawings of the real screens, in the game's dark kit. They're decoration: each card's
// heading and text say the same thing.

const chip = 'border-2 border-(--lp-void) bg-(--lp-raised) shadow-[inset_1px_1px_0_var(--lp-line-hi)]'

function MiniBoard() {
  const t = useT()
  const columns = [
    { status: 'new', stripe: 'bg-(--lp-muted)', cards: ['TypeError', 'IndentationError'] },
    { status: 'training', stripe: 'bg-(--lp-mana)', cards: ['IndexError'] },
    { status: 'solved', stripe: 'bg-(--lp-ok)', cards: ['ReferenceError', 'KeyError'] },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {columns.map((column) => (
        <div key={column.status} className="lp-inset min-w-0 p-1.5">
          <p className="mb-1.5 truncate font-mono text-[10px] uppercase tracking-[0.06em] text-(--lp-muted)">{statusName(t, column.status)}</p>
          <div className="space-y-1.5">
            {column.cards.map((card) => (
              <div key={card} className={`flex overflow-hidden ${chip}`}>
                <span className={`w-1 shrink-0 ${column.stripe}`} />
                <span className="truncate px-1.5 py-1 font-pixel text-xs">{card}</span>
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
      <div className="lp-inset font-mono text-xs leading-relaxed">
        <p className="px-2 text-(--lp-muted)">1 scores = [7, 9, 4]</p>
        <p className="bg-[rgb(255_90_110/0.14)] px-2 text-(--lp-text)">2 for i in range(1, len(scores) + 1):</p>
        <p className="px-2 text-(--lp-muted)">3 &nbsp;&nbsp;&nbsp;print(scores[i])</p>
      </div>
      <div className="flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em]">
        <span className={`${chip} px-1.5 py-0.5 text-(--lp-mana)`}>{t('landing.mini.hint')}</span>
        <span className="border-2 border-(--lp-void) bg-[#1c4a30] px-1.5 py-0.5 text-(--lp-ok)">{t('landing.mini.passed')}</span>
      </div>
    </div>
  )
}

function MiniNote() {
  const t = useT()
  return (
    <div className="lp-inset space-y-1.5 p-2.5">
      <p className="font-pixel text-sm">{t('landing.mini.noteTitle')}</p>
      <p className="text-xs text-(--lp-muted)">
        {t('landing.mini.noteText')} <span className="bg-[rgb(138_92_255/0.25)] px-1 font-semibold text-(--lp-arcane-hi)">@TypeError</span>
      </p>
      <div className={`flex overflow-hidden ${chip}`}>
        <span className="w-1 bg-(--lp-mana)" />
        <span className="px-1.5 py-1 font-pixel text-xs">TypeError</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-(--lp-muted) line-through">
        <span className="grid size-3 place-items-center bg-(--lp-ok) text-[9px] text-(--lp-void) no-underline">✓</span>
        {t('landing.mini.noteTodo')}
      </p>
    </div>
  )
}

function MiniTimer() {
  const t = useT()
  return (
    <div className="lp-inset flex items-center justify-between gap-3 p-3">
      <span className="flex items-center gap-2">
        <span className="size-2.5 bg-(--lp-ember) shadow-[0_0_8px_var(--lp-ember)] motion-safe:animate-blink" />
        <span className="font-pixel text-2xl leading-none text-(--lp-gold)">25:00</span>
      </span>
      <span className="text-right text-xs text-(--lp-muted)">
        {t('landing.mini.streak')}
        <br />
        <strong className="text-(--lp-text)">{t('landing.mini.today')}</strong>
      </span>
    </div>
  )
}

function MiniBadges() {
  const t = useT()
  const ids = ['first-clue', 'fixed-it', 'case-closed', 'sharp-eye', 'note-taker', 'on-a-roll']
  return (
    <div>
      <div className="lp-glyphs flex flex-wrap gap-2">
        {ids.map((id, index) => (
          <span key={id} className="lp-inset grid size-11 place-items-center">
            <BadgeIcon id={id} accent={index % 2 ? 'secondary' : 'primary'} className="size-7" />
          </span>
        ))}
      </div>
      <p className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.06em]">
        <span>{t('landing.mini.level', { title: levelTitle(t, 3) })}</span>
        <span className="text-(--lp-muted)">420 / 600 XP</span>
      </p>
      <div className="lp-xptrack mt-1.5 h-3.5" style={{ '--v': '70%' }}>
        <i />
      </div>
    </div>
  )
}

function MiniExport() {
  return (
    <div className="flex items-center gap-3">
      <span className={`relative grid h-16 w-13 shrink-0 place-items-end p-1 ${chip}`}>
        <span className="absolute top-0 right-0 size-3 border-b-2 border-l-2 border-(--lp-void) bg-(--lp-inset)" />
        <span className="font-mono text-[10px] text-(--lp-gold)">.md</span>
      </span>
      <span className="font-pixel text-lg text-(--lp-gold)">→</span>
      <span className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.06em]">
        {['Notion', 'Obsidian', 'GitHub'].map((app) => (
          <span key={app} className={`${chip} px-1.5 py-0.5`}>
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
    <div className="lp-inset p-3 shadow-[inset_2px_2px_0_rgb(255_90_110/0.5)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-(--lp-danger)">{t('landing.mini.weakSpot')}</p>
      <p className="mt-1 text-lg font-semibold">{conceptName(t, 'undefined-access')}</p>
      <p className="text-xs text-(--lp-muted)">{t('landing.mini.openCases')}</p>
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
    <ol className="lp-glyphs flex items-start">
      {steps.map((step, index) => (
        <li key={step.kind} className="flex min-w-0 flex-1 items-start">
          <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              className={`grid size-10 place-items-center border-2 border-(--lp-void) ${step.done ? 'bg-[#1c4a30]' : step.next ? 'bg-(--lp-raised) shadow-[0_0_0_2px_var(--lp-gold)]' : 'bg-(--lp-inset)'}`}
            >
              <KindIcon kind={step.kind} accent={step.next ? 'secondary' : 'primary'} className="size-6" />
            </span>
            <span className={`max-w-full truncate font-mono text-[10px] uppercase tracking-[0.04em] ${step.next ? 'text-(--lp-gold)' : 'text-(--lp-muted)'}`}>
              {trailKindName(t, step.kind)}
            </span>
          </span>
          {index < steps.length - 1 && (
            <span className="mt-5 h-1 w-3 shrink-0 bg-[repeating-linear-gradient(to_right,var(--lp-line-hi)_0_4px,transparent_4px_7px)] sm:w-8" />
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
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 py-20 sm:py-28">
      <div className={WRAP}>
        <SectionHead id="features-title" kicker={t('landing.features.kicker')} title={t('landing.features.title')} body={t('landing.features.body')} />
        <ul aria-label={t('landing.features.list')} className="mt-12 grid gap-6 sm:mt-14 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ id, visual: Visual, span = '' }) => (
            <li key={id} className={`lp-frame flex flex-col p-6 ${span}`}>
              <div aria-hidden="true" className="relative mb-6 overflow-hidden border border-dashed border-(--lp-line) bg-[rgb(10_8_24/0.35)] p-4">
                <Visual />
              </div>
              <h3 className="font-pixel text-xl leading-tight">{t(`landing.features.${id}.title`)}</h3>
              <p className="mt-2 leading-relaxed text-(--lp-muted)">{t(`landing.features.${id}.body`, vars)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
