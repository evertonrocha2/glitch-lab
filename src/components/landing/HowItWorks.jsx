import PixelCard from '../pixel/PixelCard.jsx'
import StepIcon from './StepIcon.jsx'

const STEPS = [
  {
    title: 'Investigate an error',
    body: 'Paste the error from your terminal or console. Get what happened and why, in plain English. The fix stays hidden until you ask.',
    icon: 'investigate',
    tone: 'muted',
    label: 'text-muted',
  },
  {
    title: 'Study your board',
    body: 'Every error you investigate becomes a card. It moves from New to Training to Solved as you practice.',
    icon: 'board',
    tone: 'primary',
    label: 'text-primary',
  },
  {
    title: 'Train in the gym',
    body: 'The AI breaks fresh code with the same kind of bug, and you fix it. Hints if you ask, never the answer.',
    icon: 'gym',
    tone: 'secondary',
    label: 'text-secondary',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-b-2 border-ink bg-mist">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-label text-xs text-muted">How it works</p>
          <h2 id="how-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            Fixes are easy to copy. Understanding isn't.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Most tools hand you the fix. You paste it, it works, and next week the same error is back. Glitch Detective
            starts with why, then makes you practice.
          </p>
        </div>
        <ol aria-label="How it works" className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <PixelCard as="li" key={step.title} tone={step.tone} className="p-6">
              <div className={`flex items-center justify-between ${step.label}`}>
                <p className="font-label text-xs">Step {index + 1}</p>
                <StepIcon kind={step.icon} className="h-7 w-auto" />
              </div>
              <h3 className="mt-5 font-pixel text-xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-ink/75">{step.body}</p>
            </PixelCard>
          ))}
        </ol>
      </div>
    </section>
  )
}
