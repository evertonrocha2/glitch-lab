import { Link } from 'react-router'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import ShaderBackdrop from '../../ui/shader/shader-backdrop.jsx'
import { WRAP } from '../section-head/section-head.jsx'

// The last push, over brasas. Signed in, it points into the game instead of the sign up.
export default function CtaBand() {
  const { user } = useAuth()
  const t = useT()
  return (
    <section
      aria-labelledby="cta-title"
      className="relative overflow-hidden border-y-2 border-(--lp-void) py-28 text-center sm:pt-[150px] sm:pb-[140px]"
    >
      <ShaderBackdrop kind="embers" />
      <div aria-hidden="true" className="lp-cta-scrim pointer-events-none absolute inset-0 z-1" />
      <div className={`${WRAP} relative z-2`}>
        <h2
          id="cta-title"
          className="font-pixel text-[clamp(2.25rem,5.6vw,4.5rem)] leading-[1.02] [text-shadow:0_0_40px_rgb(18_12_34/0.8),0_2px_0_rgb(18_12_34/0.7)]"
        >
          {t('landing.v2.cta.line1')} <span className="text-(--lp-gold)">{t('landing.v2.cta.line2')}</span>
        </h2>
        <p className="mx-auto mt-[18px] max-w-[56ch] text-lg text-[#f0e6ff] [text-shadow:0_1px_12px_rgb(18_12_34/0.9)]">{t('landing.v2.cta.body')}</p>
        <div className="mt-[34px] flex flex-wrap justify-center gap-4">
          {user ? (
            <>
              <Link to="/mundo" className="lp-btn lp-btn-gold max-sm:basis-full">
                {t('landing.v2.cta.world')}
              </Link>
              <Link to="/board" className="lp-btn lp-btn-ghost max-sm:basis-full">
                {t('landing.nav.board')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login?mode=signup" className="lp-btn lp-btn-gold max-sm:basis-full">
                {t('landing.v2.cta.signUp')}
              </Link>
              <a href="#try" className="lp-btn lp-btn-ghost max-sm:basis-full">
                {t('landing.v2.cta.try')}
              </a>
            </>
          )}
        </div>
        {!user && (
          <p className="mt-[26px] font-mono text-xs uppercase tracking-[0.06em] text-(--lp-gold-hi) [text-shadow:0_1px_8px_rgb(0_0_0/0.8)]">
            {t('landing.v2.cta.note')}
          </p>
        )}
      </div>
    </section>
  )
}
