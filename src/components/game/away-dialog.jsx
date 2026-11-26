import { useId, useMemo } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import GameIcon from './icons/game-icon.jsx'
import { ActionButton, GameDialog } from './panel/panel-ui.jsx'

// Counts in words ("212 inimigos, 3.400 de ouro, 4 itens") and durations ("2 h 15 min").
export function useCounts() {
  const { t, locale } = useI18n()
  return useMemo(() => {
    const fmt = new Intl.NumberFormat(locale)
    const part = (key, count) => t(`game.count.${key}`, { count, n: fmt.format(count) })
    // pairs: [[key, count]]; zeros are left out.
    const list = (pairs) =>
      pairs
        .filter(([, count]) => count > 0)
        .map(([key, count]) => part(key, count))
        .join(', ')
    const time = (ms) => {
      const seconds = Math.max(0, Math.floor(ms / 1000))
      if (seconds < 60) return t('game.time.s', { s: seconds })
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return t('game.time.m', { m: minutes })
      return t('game.time.hm', { h: Math.floor(minutes / 60), m: minutes % 60 })
    }
    return { t, fmt, list, time }
  }, [t, locale])
}

// What a sync paid: the hunt while the student was away (AwaySummary) and the study rewards claimed.
// Either may be missing. onClose hides it.
export default function AwayDialog({ away, studyClaimed, onClose }) {
  const { t, list, time } = useCounts()
  const titleId = useId()
  const hunt = away ? list([['kills', away.kills], ['gold', away.gold], ['items', away.items], ['gems', away.gems], ['scrap', away.scrap], ['deaths', away.deaths]]) : ''
  const study = studyClaimed
    ? list([
        ['fragments', studyClaimed.fragments],
        ['potions', studyClaimed.potions],
        ['chests', studyClaimed.chests?.length ?? 0],
        ['keys', studyClaimed.keys],
        ['honor', studyClaimed.honor],
      ])
    : ''

  return (
    <GameDialog titleId={titleId} title={t('game.away.title')} closeLabel={t('game.tree.close')} onClose={onClose} width="w-[min(440px,95vw)]">
      <div className="flex flex-col gap-2 p-1 text-[13px] leading-snug">
        {away && <p className="m-0 text-[#b9b0de]">{t('game.away.time', { time: time(away.elapsedMs) })}</p>}
        {hunt && (
          <p className="m-0 flex items-start gap-2">
            <GameIcon name="sword" size={2} />
            <span>{t('game.away.hunt', { list: hunt })}</span>
          </p>
        )}
        {study && (
          <p className="m-0 flex items-start gap-2">
            <GameIcon name="book" size={2} />
            <span>{t('game.away.study', { list: study })}</span>
          </p>
        )}
        <span className="self-end">
          <ActionButton tone="gold" onClick={onClose}>
            {t('game.away.close')}
          </ActionButton>
        </span>
      </div>
    </GameDialog>
  )
}
