import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import { zoneInfo } from './zone-info.js'

// How long the label stays after the hero enters a zone or a town.
export const TOAST_MS = 3500

const DANGER_TONE = { safe: 'text-[#8fd19e]', risky: 'text-[#e8c35a]', deadly: 'text-[#ff9aa6]' }

// The small label over the stage when the hero walks into a zone (fase 3): the zone, its tier and
// danger for this hero, its suggested level and about what an hour there pays; in a town, that it is
// safe. It names the place once per arrival and fades on its own; screen readers hear it.
export default function ZoneToast({ view, world, zone, difficulty }) {
  const { t, locale } = useI18n()
  const key = `${world}:${zone ?? ''}`
  const [shown, setShown] = useState(key)
  useEffect(() => {
    setShown(key)
    const timer = setTimeout(() => setShown(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [key])
  const fmt = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const info = useMemo(() => (zone ? zoneInfo(view, world, zone, difficulty) : null), [view, world, zone, difficulty])
  if (shown !== key) return null

  const title = info
    ? t('world.toast.zone', { zone: t(`game.zone.${info.def.name}`), tier: t('world.tier', { n: info.tier }) })
    : `${t(`world.name.${world}`)} · ${t('world.safe')}`
  const detail = info
    ? t('world.toast.detail', { level: info.level, xp: info.xpHour === null ? '?' : fmt.format(info.xpHour) })
    : t('world.toast.town')
  return (
    <output
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-11 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-0.5 border-2 border-[#0d1017] bg-[rgba(20,24,33,0.9)] px-3 py-1.5 text-center shadow-[inset_0_0_0_1px_rgba(91,127,166,0.55)]"
    >
      <span className="font-pixel text-[11px] leading-tight text-[#e8c35a]">{title}</span>
      <span className="font-mono text-[11px] leading-tight text-[#d5dde8]">
        {detail}
        {info && <b className={`ml-2 font-normal ${DANGER_TONE[info.danger]}`}>{t('gameOpen.danger.label', { danger: t(`gameOpen.danger.${info.danger}`) })}</b>}
      </span>
    </output>
  )
}
