export default function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-label text-[11px] text-ink">Glitch Detective · GLITCHATHON 2026</p>
        <p className="text-sm text-muted">Explanations by Gemini. AI can be wrong, so test the fix yourself.</p>
      </div>
    </footer>
  )
}
