import { BADGES } from '../../../shared/badges.js'
import { TRAIL_BONUS_XP } from '../../../shared/trails.js'
import BadgeIcon from '../pixel/BadgeIcon.jsx'
import KindIcon from '../trail/KindIcon.jsx'

// Small drawings of the real screens. They're decoration: each card's heading and text say the same thing.

function MiniBoard() {
  const columns = [
    { title: 'New', stripe: 'bg-muted', cards: ['TypeError', 'IndentationError'] },
    { title: 'Training', stripe: 'bg-secondary', cards: ['IndexError'] },
    { title: 'Solved', stripe: 'bg-primary', cards: ['ReferenceError', 'KeyError'] },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {columns.map((column) => (
        <div key={column.title} className="border-2 border-ink bg-mist p-1.5">
          <p className="mb-1.5 font-label text-[9px] text-ink">{column.title}</p>
          <div className="space-y-1.5">
            {column.cards.map((card) => (
              <div key={card} className="flex overflow-hidden border-2 border-ink bg-white">
                <span className={`w-1 shrink-0 ${column.stripe}`} />
                <span className="truncate px-1.5 py-1 font-pixel text-[11px] font-bold text-ink">{card}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniGym() {
  return (
    <div className="space-y-2">
      <div className="border-2 border-ink bg-white font-mono text-[11px] leading-relaxed">
        <p className="px-2 text-muted">1 scores = [7, 9, 4]</p>
        <p className="bg-primary-soft px-2 text-ink">2 for i in range(1, len(scores) + 1):</p>
        <p className="px-2 text-muted">3 &nbsp;&nbsp;&nbsp;print(scores[i])</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="border-2 border-ink bg-secondary-soft px-1.5 py-0.5 font-label text-[9px] text-secondary">Hint 1/3</span>
        <span className="border-2 border-ink bg-primary px-1.5 py-0.5 font-label text-[9px] text-white">Passed 2/2</span>
      </div>
    </div>
  )
}

function MiniNote() {
  return (
    <div className="space-y-1.5 border-2 border-ink bg-white p-2.5">
      <p className="font-pixel text-sm font-bold text-ink">Things I keep getting wrong</p>
      <p className="text-xs text-ink/80">
        Check the object first <span className="bg-primary-soft px-1 font-semibold text-primary">@TypeError</span>
      </p>
      <div className="flex overflow-hidden border-2 border-ink">
        <span className="w-1 bg-secondary" />
        <span className="px-1.5 py-1 font-pixel text-[11px] font-bold text-ink">TypeError</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted line-through">
        <span className="grid size-3 place-items-center bg-primary text-[8px] text-white no-underline">✓</span>
        Try optional chaining
      </p>
    </div>
  )
}

function MiniTimer() {
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-ink bg-white p-3 shadow-pixel-secondary">
      <span className="flex items-center gap-2">
        <span className="size-2.5 border border-ink bg-primary motion-safe:animate-blink" />
        <span className="font-label text-2xl leading-none text-ink">25:00</span>
      </span>
      <span className="text-right text-xs text-muted">
        3-day streak
        <br />
        <strong className="text-ink">Today 1h 05m</strong>
      </span>
    </div>
  )
}

function MiniBadges() {
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
        <span>Lv 3 · Detective</span>
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
          <span key={app} className="border-2 border-ink bg-white px-1.5 py-0.5 font-label text-[9px] text-ink">
            {app}
          </span>
        ))}
      </span>
    </div>
  )
}

function MiniWeakSpot() {
  return (
    <div className="border-2 border-ink bg-primary-soft p-3">
      <p className="font-label text-[10px] text-primary">Weak spot</p>
      <p className="mt-1 text-lg font-semibold text-ink">Reading undefined</p>
      <p className="text-xs text-muted">3 open cases of this kind</p>
    </div>
  )
}

function MiniTrail() {
  const steps = [
    { kind: 'train', label: 'Train', done: true },
    { kind: 'note', label: 'Write', done: true },
    { kind: 'study', label: 'Study', next: true },
    { kind: 'investigate', label: 'Investigate' },
    { kind: 'reflect', label: 'Reflect' },
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
            <span className={`truncate font-label text-[9px] ${step.next ? 'text-secondary' : 'text-ink'}`}>{step.label}</span>
          </span>
          {index < steps.length - 1 && (
            <span className="mt-5 h-1 w-3 shrink-0 bg-[repeating-linear-gradient(to_right,var(--color-ink)_0_4px,transparent_4px_7px)] sm:w-8" />
          )}
        </li>
      ))}
    </ol>
  )
}

const FEATURES = [
  {
    title: 'A board of your own bugs',
    body: 'Every error becomes a case with what happened, why, the fix and a practice exercise. Cards move from New to Training to Solved.',
    visual: MiniBoard,
    span: 'lg:col-span-2',
  },
  {
    title: 'A gym, not a cheat sheet',
    body: 'The AI writes new code with the same kind of bug. You fix it. It judges your fix, and hints get more direct only if you ask.',
    visual: MiniGym,
  },
  {
    title: 'A notebook that knows your cases',
    body: 'Headings, text and to-dos. Type @ to drop a case into the page, so your notes and your bugs stay linked.',
    visual: MiniNote,
  },
  {
    title: 'A study timer that keeps going',
    body: 'Start it on any page. It survives reloads, counts each day on your clock, and builds your streak.',
    visual: MiniTimer,
  },
  {
    title: 'Take it anywhere',
    body: 'Export the whole board or one note as Markdown, ready for Notion, Obsidian or a GitHub repo.',
    visual: MiniExport,
  },
  {
    title: 'Levels and badges for real progress',
    body: `Cases, passed challenges, notes and study minutes earn XP. Climb six detective ranks and collect ${BADGES.length} pixel badges.`,
    visual: MiniBadges,
    span: 'lg:col-span-2',
  },
  {
    title: 'Know your weak spot',
    body: 'The board names the bug type you hit most, so you know exactly what to train next.',
    visual: MiniWeakSpot,
  },
  {
    title: 'A study trail made from your cases',
    body: `The AI reads your cases and notes and builds 5 to 7 missions, weak spot first: train, write, study, investigate, reflect. They tick themselves as you go, and a finished trail earns a ${TRAIL_BONUS_XP} XP bonus.`,
    visual: MiniTrail,
    span: 'lg:col-span-3',
  },
]

export default function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-4 border-b-2 border-ink bg-mist">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-label text-[11px] text-primary">Inside the app</p>
          <h2 id="features-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            Your detective kit
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Everything you need to turn the errors you hit into skills you keep.
          </p>
        </div>
        <ul aria-label="Features" className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, body, visual: Visual, span = '' }, index) => (
            <li
              key={title}
              className={`flex flex-col border-2 border-ink bg-white p-6 ${index % 3 === 1 ? 'shadow-pixel-secondary' : 'shadow-pixel'} ${span}`}
            >
              <div aria-hidden="true" className="relative mb-6 overflow-hidden border-2 border-dashed border-line bg-mist/60 p-4">
                <Visual />
              </div>
              <h3 className="font-pixel text-xl font-bold text-ink">{title}</h3>
              <p className="mt-2 leading-relaxed text-ink/75">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
