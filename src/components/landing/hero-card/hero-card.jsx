import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { HeroCanvas } from '../../game/hero/hero-canvas.jsx'
import { useReducedMotion } from '../../game/use-reduced-motion.js'
import { useInView } from '../use-in-view.js'

// A real Glitch World hero, drawn by the game's own renderer, with a show-off kit.
const LOOK = { skin: 1, hairStyle: 2, hairColor: 3, eyeStyle: 1, eyeColor: 1, outfit: 0 }
const GEAR = {
  weapon: { b: 'espada', r: 'legendary' },
  chest: { b: 'armadura', r: 'epic' },
  offhand: { b: 'escudo', r: 'rare' },
  boots: { b: 'botas', r: 'rare' },
  amulet: { b: 'amuleto', r: 'legendary' },
}
const LEVEL = 12
const XP_MAX = 2400
const XP_START = 1840
const DAMAGE = 30
const IDLE_MS = 520
const HIT_MS = 4200
const SWING = ['atk1', 'atk2', 'atk3', 'idle0']
const SWING_STEP_MS = 110

// The hero card in the hero: it breathes, and every few seconds a right answer lands as a hit and
// XP. It only animates while on screen with the tab shown; reduced motion holds a still pose.
export default function HeroCard() {
  const { t, locale } = useI18n()
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const live = useInView(ref) && !reduced
  const [pose, setPose] = useState('idle0')
  const [hits, setHits] = useState(0)
  const subjects = t('landing.v2.card.subjects').split('|')
  const xp = Math.min(XP_MAX - 1, XP_START + hits * DAMAGE)
  const number = new Intl.NumberFormat(locale)

  useEffect(() => {
    if (!live) {
      setPose('idle0')
      return undefined
    }
    let swinging = false
    let idle = 0
    const timers = new Set()
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id)
        fn()
      }, ms)
      timers.add(id)
    }
    const breathe = setInterval(() => {
      if (swinging) return
      idle ^= 1
      setPose(idle ? 'idle1' : 'idle0')
    }, IDLE_MS)
    const hit = () => {
      swinging = true
      setHits((n) => n + 1)
      SWING.forEach((p, i) => {
        later(() => setPose(p), i * SWING_STEP_MS)
      })
      later(() => {
        swinging = false
      }, SWING.length * SWING_STEP_MS)
    }
    const strikes = setInterval(hit, HIT_MS)
    later(hit, 1400)
    return () => {
      clearInterval(breathe)
      clearInterval(strikes)
      for (const id of timers) clearTimeout(id)
    }
  }, [live])

  const subject = subjects[hits % subjects.length]
  const bars = [
    { label: t('landing.v2.card.hp'), value: '450 / 480', v: '94%', c: '#d0343f' },
    { label: t('landing.v2.card.mana'), value: '108 / 108', v: '100%', c: '#2f7ae0' },
    {
      label: t('landing.v2.card.xp'),
      value: `${number.format(xp)} / ${number.format(XP_MAX)}`,
      v: `${((xp / XP_MAX) * 100).toFixed(1)}%`,
      c: 'linear-gradient(90deg, #5a2fd9, #8a5cff)',
    },
  ]

  return (
    <aside ref={ref} aria-label={t('landing.v2.card.label')} className="lp-bob w-full max-w-[420px] justify-self-start lg:justify-self-end">
      <div className="lp-frame bg-[rgb(27_20_51/0.74)] p-4 backdrop-blur-md sm:p-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-pixel text-[22px] leading-none">Lia</p>
            <p className="mt-1.5 font-mono text-xs uppercase tracking-[0.06em] text-(--lp-muted)">
              {t('landing.v2.card.where', { n: LEVEL, zone: t('game.zone.copas') })}
            </p>
          </div>
          <span className="bg-(--lp-gold) px-[7px] pt-[5px] pb-1 font-pixel text-sm leading-none text-[#2a1606] shadow-[inset_-2px_-2px_0_var(--lp-gold-dark),inset_2px_2px_0_var(--lp-gold-hi)]">
            {t('landing.v2.card.level', { n: LEVEL })}
          </span>
        </div>

        <div className="lp-inset relative mt-3.5 mb-3 grid h-[250px] items-end justify-items-center overflow-hidden bg-[radial-gradient(50%_55%_at_50%_55%,rgb(138_92_255/0.35),transparent_70%),linear-gradient(180deg,rgb(16_12_32/0.2),rgb(16_12_32/0.65))] sm:h-[300px]">
          <div
            aria-hidden="true"
            className="absolute bottom-3 left-1/2 z-1 h-[18px] w-[210px] -translate-x-1/2 bg-[#2b2152] shadow-[inset_0_3px_0_#574a96,0_4px_0_#0a0818] before:absolute before:inset-x-3.5 before:-top-2.5 before:h-2.5 before:bg-[#3e3170] before:shadow-[inset_0_2px_0_#6e5fb8] before:content-['']"
          />
          <HeroCanvas
            look={LOOK}
            gear={GEAR}
            pose={pose}
            scale={6}
            label={t('landing.v2.card.alt')}
            className="relative z-2 mb-1.5 h-auto w-[280px] sm:w-[336px]"
          />
          <p
            key={hits}
            aria-hidden="true"
            data-go={hits ? '' : undefined}
            className="lp-pop absolute top-[26%] left-[58%] z-3 font-pixel text-lg text-(--lp-gold) [text-shadow:2px_2px_0_var(--lp-void)]"
          >
            +{DAMAGE} XP
          </p>
        </div>

        <div className="grid gap-1.5">
          {bars.map((bar) => (
            <div key={bar.label} className="lp-bar" style={{ '--v': bar.v, '--c': bar.c }}>
              <i />
              <span>
                <b className="font-normal">{bar.label}</b>
                <b className="font-normal">{bar.value}</b>
              </span>
            </div>
          ))}
        </div>
        <p className="lp-inset mt-3 min-h-10 px-3 py-2.5 font-mono text-xs leading-normal text-(--lp-muted)">
          {'> '}
          {/* Left without values, t() keeps {subject} and {damage}, so they can be colored. */}
          {t('landing.v2.card.log')
            .split(/(\{subject\}|\{damage\})/)
            .map((part, i) =>
              part === '{subject}' ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: the sentence's parts never move.
                <b key={i} className="font-medium text-(--lp-ok)">
                  {subject}
                </b>
              ) : part === '{damage}' ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: the sentence's parts never move.
                <b key={i} className="font-medium text-(--lp-gold)">
                  {DAMAGE}
                </b>
              ) : (
                part
              ),
            )}
        </p>
      </div>
    </aside>
  )
}
