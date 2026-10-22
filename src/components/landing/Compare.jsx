const ROWS = [
  ['Hands you the fixed code right away', 'Explains why first. The fix stays hidden until you ask'],
  ['Forgets the error once the chat is gone', 'Saves every error as a case on your board'],
  ['Same bug next week, same copy and paste', 'Trains you with brand-new code that has the same bug'],
  ['Says "great job" to anything', 'Judges your fix against a solution it never shows you'],
  ["Can't tell which mistakes you repeat", 'Shows your weak spot: the bug type you hit most'],
  ['Nothing to show for the hours', 'Study time, a streak, XP, levels and badges'],
]

function Mark({ good }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-ink font-label text-[10px] leading-none ${good ? 'bg-primary text-white' : 'bg-white text-muted'}`}
    >
      {good ? '✓' : '×'}
    </span>
  )
}

export default function Compare() {
  return (
    <section id="why" aria-labelledby="why-title" className="scroll-mt-4 border-b-2 border-ink bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-label text-[11px] text-secondary">Why not just ask a chatbot?</p>
          <h2 id="why-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            A chatbot fixes the bug. We fix the habit.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Pasting errors into a chat works at 2 a.m. before a deadline. It doesn't help in an exam, an interview, or the
            next time the same bug shows up.
          </p>
        </div>

        <div className="mt-12 border-2 border-ink shadow-pixel-ink">
          <div aria-hidden="true" className="hidden grid-cols-2 border-b-2 border-ink sm:grid">
            <p className="border-r-2 border-ink bg-mist px-5 py-3 font-label text-xs text-muted">A chatbot</p>
            <p className="bg-primary px-5 py-3 font-label text-xs text-white">Glitch Detective</p>
          </div>
          <ul aria-label="A chatbot compared with Glitch Detective">
            {ROWS.map(([chatbot, ours]) => (
              <li key={ours} className="grid border-b-2 border-dashed border-line last:border-b-0 sm:grid-cols-2">
                <p className="flex gap-3 px-5 py-4 text-muted sm:border-r-2 sm:border-ink">
                  <Mark />
                  <span>
                    <span className="sr-only">A chatbot: </span>
                    {chatbot}
                  </span>
                </p>
                <p className="flex gap-3 bg-primary-soft/60 px-5 py-4 text-ink">
                  <Mark good />
                  <span>
                    <span className="sr-only">Glitch Detective: </span>
                    {ours}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
