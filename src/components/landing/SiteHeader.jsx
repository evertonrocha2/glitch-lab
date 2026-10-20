import Logo from '../Logo.jsx'

export default function SiteHeader() {
  return (
    <header className="border-b border-line/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-ink">
          <Logo className="size-8 text-ink" />
          <span>Glitch Detective</span>
        </a>
        <nav aria-label="Main" className="flex items-center gap-7 text-sm font-medium">
          <a href="#how" className="hidden text-muted transition-colors hover:text-ink sm:inline">
            How it works
          </a>
          <a
            href="#try"
            className="rounded-full bg-ink px-4 py-2 text-white transition-colors duration-200 hover:bg-primary"
          >
            Try it
          </a>
        </nav>
      </div>
    </header>
  )
}
