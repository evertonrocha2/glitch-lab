export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-8">
        <p>
          <span className="font-display font-bold text-ink">Glitch Detective</span> · Built for GLITCHATHON 2026
        </p>
        <p>Explanations by Gemini. AI can be wrong, so test the fix yourself.</p>
      </div>
    </footer>
  )
}
