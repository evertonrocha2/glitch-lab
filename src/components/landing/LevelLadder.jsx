import { LEVELS, XP } from '../../../shared/progress.js'

const EARN = [
  ['Investigate an error', `+${XP.case}`],
  ['Pass a gym challenge', `+${XP.pass}`],
  ['Pass it without hints', `+${XP.cleanPass}`],
  ['Solve a case', `+${XP.solved}`],
  ['Write a note', `+${XP.note}`],
  ['Study one minute', `+${XP.studyMinute}`],
]

export default function LevelLadder() {
  return (
    <section id="levels" aria-labelledby="levels-title" className="relative scroll-mt-4 overflow-hidden border-b-2 border-ink bg-primary-soft">
      <div aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/2 opacity-20" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:py-24">
        <div>
          <p className="font-label text-xs text-primary">Level up</p>
          <h2 id="levels-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            From Rookie to Bug Whisperer
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Progress you can see. Every case, fix, note and minute of study moves you up the ranks.
          </p>
          <ol aria-label="Detective ranks" className="mt-10 space-y-2">
            {LEVELS.map((level, index) => (
              <li key={level.title} className="flex items-center gap-3" style={{ paddingLeft: `${index * 0.9}rem` }}>
                <span
                  className={`grid size-9 shrink-0 place-items-center border-2 border-ink font-label text-xs ${index === LEVELS.length - 1 ? 'bg-primary text-white' : 'bg-white text-ink'}`}
                >
                  {index + 1}
                </span>
                <span className="flex flex-1 items-center justify-between gap-3 border-2 border-ink bg-white px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]">
                  <span className="font-pixel text-lg font-bold text-ink">{level.title}</span>
                  <span className="font-label text-[10px] text-muted">{level.min} XP</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="self-end">
          <div className="border-2 border-ink bg-white shadow-pixel">
            <p className="border-b-2 border-ink bg-primary px-4 py-2.5 font-label text-xs text-white">How you earn XP</p>
            <ul className="divide-y-2 divide-dashed divide-line">
              {EARN.map(([label, points]) => (
                <li key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-ink">
                  <span>{label}</span>
                  <strong className="font-label text-xs text-secondary">{points} XP</strong>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-sm text-muted">Study 5 minutes a day to keep your streak alive.</p>
        </div>
      </div>
    </section>
  )
}
