import { useRef } from 'react'
import { Link } from 'react-router'
import { DAILY_XP } from '../../../../shared/daily.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { HeroCanvas } from '../../game/hero/hero-canvas.jsx'
import { showsEnem } from '../../world/enem-worlds.js'
import { CALENDAR, EXAM, PixelArt, SWORDS } from '../pixel-art/pixel-art.jsx'
import SectionHead, { WRAP } from '../section-head/section-head.jsx'

const HERO_LOOK = { skin: 1, hairStyle: 2, hairColor: 3, eyeStyle: 1, eyeColor: 1, outfit: 0 }
const HERO_GEAR = { weapon: { b: 'espada', r: 'legendary' }, chest: { b: 'armadura', r: 'epic' } }

// Each mode is an item, rarest last. Text: landing.v2.mode.<id>.*. ENEM exists only in pt-BR.
const MODES = [
  { id: 'daily', rarity: 'common', to: '/daily', icon: <PixelArt rows={CALENDAR} className="size-20" />, vars: { xp: DAILY_XP.hard } },
  { id: 'duel', rarity: 'rare', to: '/duel', icon: <PixelArt rows={SWORDS} outline className="size-20" /> },
  { id: 'enem', rarity: 'epic', to: '/exams/enem', icon: <PixelArt rows={EXAM} className="size-20" />, enem: true },
  {
    id: 'world',
    rarity: 'legendary',
    to: '/mundo',
    icon: <HeroCanvas look={HERO_LOOK} gear={HERO_GEAR} crop="head" scale={3} className="size-[72px]" />,
  },
]

// Tilts toward the pointer and moves the foil and glare with it. Plain style writes, no re-render.
// Reduced motion keeps the card flat; the foil still follows.
function tiltHandlers(ref) {
  const set = (name, value) => ref.current?.style.setProperty(name, value)
  return {
    onPointerMove(event) {
      const el = ref.current
      if (!el || event.pointerType === 'touch') return
      const box = el.getBoundingClientRect()
      const x = (event.clientX - box.left) / box.width
      const y = (event.clientY - box.top) / box.height
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      const k = still ? 0 : 1
      set('--mx', `${(x * 100).toFixed(1)}%`)
      set('--my', `${(y * 100).toFixed(1)}%`)
      set('--rx', `${((0.5 - y) * 14 * k).toFixed(2)}deg`)
      set('--ry', `${((x - 0.5) * 18 * k).toFixed(2)}deg`)
      set('--hover', '1')
      el.dataset.hover = ''
    },
    onPointerLeave() {
      set('--rx', '0deg')
      set('--ry', '0deg')
      set('--hover', '0')
      if (ref.current) delete ref.current.dataset.hover
    },
  }
}

function ItemCard({ mode, t }) {
  const ref = useRef(null)
  const key = (part) => `landing.v2.mode.${mode.id}.${part}`
  return (
    <li ref={ref} data-rarity={mode.rarity} className="lp-item" {...tiltHandlers(ref)}>
      <article aria-labelledby={`mode-${mode.id}`} className="lp-item-inner">
        <div className="lp-item-body flex flex-col p-5 sm:p-[22px]">
          <div className="flex items-center justify-between gap-3">
            <span className="lp-rarity px-[7px] pt-[5px] pb-1 font-pixel text-xs uppercase leading-none tracking-[0.08em]">
              {t(`game.rarity.${mode.rarity}`)}
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.06em] text-(--lp-muted)">{t(key('slot'))}</span>
          </div>
          <div aria-hidden="true" className="lp-icon-slot mt-5 mb-5 grid size-28 place-items-center">
            {mode.icon}
          </div>
          <h3 id={`mode-${mode.id}`} className="lp-item-title font-pixel text-[28px] leading-none sm:text-[30px]">
            {t(key('name'))}
          </h3>
          <p className="mt-2 mb-4 font-mono text-xs tracking-[0.04em] text-(--lp-muted)">{t(key('type'))}</p>
          <p className="text-[15px] leading-relaxed text-[#d6cff3]">{t(key('body'), mode.vars)}</p>
          <ul className="lp-stats my-4 grid gap-2 py-3.5 font-mono text-[13px] leading-snug">
            {[1, 2, 3].map((n) => (
              <li key={n}>{t(key(`stat${n}`), mode.vars)}</li>
            ))}
          </ul>
          <p className="text-sm text-(--lp-muted) italic">{t(key('flavor'))}</p>
          <Link
            to={mode.to}
            className="lp-item-rc mt-auto inline-flex w-fit items-center gap-2 pt-5 font-pixel text-[13px] uppercase tracking-[0.06em] underline-offset-4 hover:underline"
          >
            {t(key('cta'))} <span aria-hidden="true">&gt;</span>
          </Link>
        </div>
        <div aria-hidden="true" className="lp-foil" />
        <div aria-hidden="true" className="lp-glare" />
      </article>
    </li>
  )
}

// The modes as an inventory of item cards: common to legendary.
export default function Modes() {
  const { t, locale } = useI18n()
  const modes = MODES.filter((mode) => !mode.enem || showsEnem(locale))
  return (
    <section id="modes" aria-labelledby="modes-title" className="relative scroll-mt-16 py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_45%_at_80%_60%,rgb(255_154_31/0.07),transparent_70%),radial-gradient(45%_50%_at_15%_55%,rgb(138_92_255/0.1),transparent_70%)]"
      />
      <div className={`${WRAP} relative`}>
        <SectionHead id="modes-title" kicker={t('landing.v2.modes.kicker')} title={t('landing.v2.modes.title')} body={t('landing.v2.modes.body')} />
        <ul
          aria-label={t('landing.v2.modes.list')}
          className={`mt-12 grid gap-7 sm:mt-14 md:grid-cols-2 ${modes.length === 4 ? 'xl:grid-cols-4 xl:gap-6' : 'lg:grid-cols-3'}`}
        >
          {modes.map((mode) => (
            <ItemCard key={mode.id} mode={mode} t={t} />
          ))}
        </ul>
      </div>
    </section>
  )
}
