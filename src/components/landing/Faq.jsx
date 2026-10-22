const QUESTIONS = [
  {
    q: 'Is it free?',
    a: 'Yes. Each account gets a daily number of AI calls so the free quota lasts. Studying your board, writing notes and the timer never use it.',
  },
  {
    q: 'Which languages does it understand?',
    a: 'Anything with an error message: JavaScript, TypeScript, Python, Java, C#, PHP and more. The gym writes challenges in the same language as your case.',
  },
  {
    q: 'Will it just give me the answer?',
    a: 'Only when you ask. The fix on each case is hidden behind a button, and in the gym you never see the solution. You get up to 3 hints, each one a bit more direct.',
  },
  {
    q: 'How does the AI judge my fix?',
    a: "It compares your code with a reference solution it wrote but never shows you. Any fix that removes the bug passes, even if it's not the same as the reference.",
  },
  {
    q: 'Is my code safe?',
    a: "Your cases and notes are only visible to you. Don't paste passwords or API keys: the error and code are sent to the AI to be explained.",
  },
  {
    q: 'Can I take my notes with me?',
    a: 'Yes. Export your whole board or a single note as a Markdown file. Notion, Obsidian and GitHub all open it.',
  },
  {
    q: 'Do I need an account?',
    a: 'To keep a board, yes: sign up with email and password. Just looking? Press "Use demo account" on the sign-in page to get a board that is already filled in.',
  },
]

export default function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 border-b-2 border-ink bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-24">
        <div>
          <p className="font-label text-[11px] text-secondary">Questions</p>
          <h2 id="faq-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            Before you start
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">The things people ask first.</p>
        </div>
        <div className="space-y-3">
          {QUESTIONS.map(({ q, a }) => (
            <details key={q} className="group border-2 border-ink bg-white open:shadow-pixel">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center border-2 border-ink font-label text-xs text-ink group-open:bg-primary group-open:text-white"
                >
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">-</span>
                </span>
              </summary>
              <p className="border-t-2 border-dashed border-line px-5 py-4 leading-relaxed text-ink/80">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
