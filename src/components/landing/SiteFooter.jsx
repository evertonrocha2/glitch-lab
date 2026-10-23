import { useT } from '../../lib/i18n/I18nProvider.jsx'

export default function SiteFooter() {
  const t = useT()
  return (
    <footer className="border-t-2 border-ink bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-label text-xs text-ink">Glitch Lab · GLITCHATHON 2026 · Glitch Detective</p>
        <p className="text-sm text-muted">{t('landing.footer.ai')}</p>
      </div>
    </footer>
  )
}
