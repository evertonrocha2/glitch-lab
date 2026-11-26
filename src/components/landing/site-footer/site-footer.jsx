import { Link } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'
import { WRAP } from '../section-head/section-head.jsx'
import { Wordmark } from '../site-header/site-header.jsx'

const link = 'font-mono text-xs uppercase tracking-[0.06em] text-(--lp-muted) transition-colors hover:text-(--lp-text)'

export default function SiteFooter() {
  const t = useT()
  return (
    <footer className="border-t-2 border-(--lp-void) bg-[#221950] shadow-[inset_0_2px_0_#3b3072]">
      <div className={`${WRAP} flex flex-col gap-6 py-12 sm:py-14 md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-col gap-3">
          <a href="#top" aria-label={t('landing.nav.home')} className="flex w-fit items-center gap-2.5">
            <PixelLogo className="size-8" />
            <Wordmark />
          </a>
          <p className="max-w-md text-sm text-(--lp-muted)">{t('landing.footer.ai')}</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label={t('landing.v2.footer.links')} className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/articles" className={link}>
              {t('landing.nav.articles')}
            </Link>
            <a href="#faq" className={link}>
              {t('landing.nav.faq')}
            </a>
            <Link to="/login" className={link}>
              {t('landing.nav.signIn')}
            </Link>
          </nav>
          <p className="font-mono text-xs text-[#aaa1d8]">{t('landing.v2.footer.made')}</p>
        </div>
      </div>
    </footer>
  )
}
