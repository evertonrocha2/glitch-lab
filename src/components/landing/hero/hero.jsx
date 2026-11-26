import { Link } from 'react-router'
import { CONCEPTS } from '../../../../shared/concepts.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import ShaderBackdrop from '../../ui/shader/shader-backdrop.jsx'
import { showsEnem } from '../../world/enem-worlds.js'
import HeroCard from '../hero-card/hero-card.jsx'
import { WRAP } from '../section-head/section-head.jsx'

const ARROW = (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
    <path d="M5 2h2v2h2v2h2v4H9v2H7v2H5v-2h2v-2h2V6H7V4H5z" fill="currentColor" />
  </svg>
)

// The first screen: névoa arcana behind, the pitch on the left, a live hero on the right. It slides
// up under the glassy sticky header.
export default function Hero() {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const chips = [
    showsEnem(locale) && { id: 'enem', text: t('landing.v2.hero.chip.enem'), color: 'var(--lp-mana)' },
    { id: 'daily', text: t('landing.v2.hero.chip.daily'), color: 'var(--lp-ok)' },
    { id: 'duel', text: t('landing.v2.hero.chip.duel'), color: 'var(--lp-ember)' },
    !showsEnem(locale) && { id: 'bugs', text: t('landing.v2.hero.chip.bugs', { count: CONCEPTS.length }), color: 'var(--lp-mana)' },
  ].filter(Boolean)

  return (
    <section id="top" className="relative -mt-[61px] flex min-h-[min(860px,100svh)] items-center overflow-hidden pt-[61px] sm:-mt-[69px] sm:pt-[69px]">
      <ShaderBackdrop kind="arcana" interactive />
      <div aria-hidden="true" className="lp-hero-scrim pointer-events-none absolute inset-0 z-1" />
      <div className={`${WRAP} relative z-2 grid items-center gap-10 pt-8 pb-16 sm:pt-10 lg:grid-cols-[1.3fr_0.7fr] lg:pb-24`}>
        <div>
          <p className="mb-6 inline-flex items-center gap-2.5 border border-[rgb(242_193_78/0.35)] bg-[rgb(18_12_34/0.6)] py-[7px] pr-3 pl-2 font-mono text-xs uppercase leading-none tracking-[0.08em] text-(--lp-gold-hi) backdrop-blur-sm">
            <span className="bg-(--lp-gold) px-1.5 pt-1 pb-[3px] font-pixel tracking-[0.04em] text-[#2a1606]">{t('landing.v2.hero.tag')}</span>
            {t('landing.v2.hero.season')}
          </p>
          <h1 className="font-pixel text-[clamp(2.75rem,6.2vw,5.6rem)] leading-[0.95] [text-shadow:0_2px_0_rgb(10_8_24/0.6),0_0_40px_rgb(10_8_24/0.5)]">
            <span className="block">{t('landing.v2.hero.line1')}</span>{' '}
            <span className="lp-h1-gold block">{t('landing.v2.hero.line2')}</span>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-[#d8d0f6] sm:text-[19px]">{t('landing.v2.hero.body')}</p>
          <div className="mt-9 flex flex-wrap gap-4">
            {user ? (
              <Link to="/board" className="lp-btn lp-btn-gold max-sm:basis-full">
                {t('landing.nav.board')} {ARROW}
              </Link>
            ) : (
              <>
                <Link to="/login?mode=signup" className="lp-btn lp-btn-gold max-sm:basis-full">
                  {t('landing.hero.signUp')} {ARROW}
                </Link>
                <Link to="/login" className="lp-btn lp-btn-ghost max-sm:basis-full">
                  {t('landing.hero.signIn')}
                </Link>
              </>
            )}
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[13px] leading-none tracking-[0.04em] text-(--lp-muted)">
            {chips.map((chip) => (
              <li key={chip.id} className="inline-flex items-center gap-2">
                <i aria-hidden="true" className="inline-block size-2" style={{ background: chip.color, boxShadow: `0 0 10px ${chip.color}` }} />
                {chip.text}
              </li>
            ))}
          </ul>
        </div>
        <HeroCard />
      </div>
    </section>
  )
}
