const STEPS = [
  {
    title: 'Paste the error',
    body: 'Copy the message from your terminal or browser console. Add the code around it if you have it.',
    tone: 'text-muted',
    dot: 'bg-muted',
    card: 'border-line bg-white',
  },
  {
    title: 'Read the why',
    body: 'Get a plain-English explanation and the concept behind the bug. The fix stays hidden until you ask for it.',
    tone: 'text-primary',
    dot: 'bg-primary',
    card: 'border-primary/20 bg-primary-soft',
  },
  {
    title: 'Practice on a tiny bug',
    body: 'Solve a short challenge with the same kind of mistake, then check your answer.',
    tone: 'text-secondary',
    dot: 'bg-secondary',
    card: 'border-secondary/20 bg-secondary-soft',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-y border-line bg-mist">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">How it works</p>
          <h2 id="how-title" className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-[2.6rem] sm:leading-[1.1]">
            Fixes are easy to copy. Understanding isn't.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Most tools hand you the fix. You paste it, it works, and next week the same error is back. Glitch Detective
            starts with why.
          </p>
        </div>
        <ol aria-label="How it works" className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className={`rounded-2xl border p-6 sm:p-7 ${step.card}`}>
              <p className={`flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] ${step.tone}`}>
                <span aria-hidden="true" className={`size-1.5 rounded-full ${step.dot}`} />
                Step {index + 1}
              </p>
              <h3 className="mt-4 font-display text-xl font-bold tracking-[-0.01em] text-ink">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-ink/75">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
