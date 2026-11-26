import { useId } from 'react'
import { SETS, UNIQUES, gemStats, gemTierOf, itemStats } from '../../../../shared/game/items.js'
import GameIcon from '../icons/game-icon.jsx'
import Frame from '../ui/frame.jsx'
import { RARITY_COLORS, gemColors, iconOf, statDiff, useItemText } from './item-text.js'

// The item card (the mockup's .tip), a Frame whose bevel wears the rarity color: name in that color, "Epic relic, item level 14", base stats
// (with the upgrade bonus), affixes, sockets, set progress, the unique effect and a compare line.
// item: gear or a gem from the View. equipped: what the hero wears in that slot (for the compare line).
// worn: every equipped item, to count set pieces.
export default function ItemTooltip({ item, equipped, worn = [], className = '' }) {
  const text = useItemText()
  const { t } = text
  const headId = useId()
  const isGem = item.kind === 'gem'
  const isSupport = item.kind === 'support'
  const colors = gemColors(item) ?? RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common
  const name = text.name(item)

  return (
    <Frame
      as="section"
      aria-labelledby={headId}
      className={`px-3 py-2.5 font-mono text-[11px] leading-[1.4] text-[#e9e4ff] ${className}`}
      style={{ '--f-hi': colors.border, '--f-lo': `color-mix(in srgb, ${colors.border} 40%, #0a0818)` }}
    >
      <div className="mb-2 flex items-center gap-2.5 border-b-2 border-[#0a0818] pb-2 shadow-[0_2px_0_#3e3170]">
        <span className="grid size-10 shrink-0 place-items-center border-2 border-[#120c22] bg-[#100c20] shadow-[inset_2px_2px_0_#0a0818]">
          <GameIcon name={iconOf(item)} size={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <b id={headId} className="block font-pixel text-[12px] font-normal leading-tight" style={{ color: colors.text }}>
            {name}
          </b>
          <small className="text-[#a89fd0]">{isGem ? t('game.item.gem') : isSupport ? t('game.item.supportKind') : text.line(item)}</small>
        </div>
      </div>
      {isSupport ? <SupportBody item={item} text={text} /> : isGem ? <GemBody item={item} text={text} /> : <GearBody item={item} equipped={equipped} worn={worn} text={text} />}
    </Frame>
  )
}

function SupportBody({ item, text }) {
  return (
    <>
      <p className="m-0 mb-1 text-white">{text.supportDesc(item)}</p>
      <p className="m-0 text-[#a89fd0]">{text.t('game.item.supportHint')}</p>
    </>
  )
}

function GemBody({ item, text }) {
  return (
    <ul className="m-0 list-none p-0 text-white">
      {Object.entries(gemStats(item.gem, gemTierOf(item))).map(([stat, value]) => (
        <li key={stat}>{text.statLine(stat, value)}</li>
      ))}
    </ul>
  )
}

function GearBody({ item, equipped, worn, text }) {
  const { t } = text
  // Base stats alone: the same math as itemStats, with no affixes or sockets.
  const base = itemStats({ base: item.base, upgrade: item.upgrade })
  const set = item.set && SETS.find((each) => each.id === item.set)
  const unique = item.unique && UNIQUES.find((each) => each.id === item.unique)
  const diffs = equipped && equipped.id !== item.id ? statDiff(item, equipped) : null

  return (
    <>
      <ul aria-label={t('game.item.baseStats')} className="m-0 mb-1 list-none p-0 text-white">
        {Object.entries(base).map(([stat, value]) => (
          <li key={stat}>{text.statLine(stat, value)}</li>
        ))}
      </ul>

      {item.affixes.length > 0 && (
        <ul aria-label={t('game.item.affixes')} className="m-0 mb-1.5 list-disc pl-3.5 text-[#8fb8ff]">
          {item.affixes.map((affix, at) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: affixes are positions (a reroll swaps one in place).
            <li key={`${affix.id}-${at}`} className={affix.value < 0 ? 'text-[#ff9aa6]' : undefined}>
              {text.affixLine(affix)}
            </li>
          ))}
        </ul>
      )}

      {item.sockets.length > 0 && (
        <ul aria-label={t('game.item.sockets')} className="m-0 mb-1.5 flex list-none flex-col gap-1 p-0">
          {item.sockets.map((value, at) => {
            const socketed = text.socketGem(value)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: sockets are positions, the index is their identity.
              <li key={at} className="flex items-center gap-1.5">
                {socketed ? (
                <>
                  <span className="grid size-[22px] place-items-center border-2 border-[#4fd1c5] bg-[#0b1f2a]">
                    <GameIcon name="gem" size={1} />
                  </span>
                  {t('game.item.socketGem', { gem: socketed.name, line: socketed.line })}
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="size-[22px] border-2 border-[#2a2250] bg-[#100c20] shadow-[inset_2px_2px_0_#0a0818]" />
                  {t('game.item.socketEmpty')}
                </>
              )}
              </li>
            )
          })}
        </ul>
      )}

      {set && <SetProgress set={set} count={worn.filter((each) => each.set === set.id).length} text={text} />}

      {unique && <p className="m-0 mb-1.5 text-[#ffb347]">{text.effect(unique.effect)}</p>}

      {diffs && (
        <p className="m-0 border-t-2 border-[#0a0818] pt-1.5 shadow-[inset_0_2px_0_#3e3170]">
          <span className="text-[#a89fd0]">{t('game.item.compare')}</span>{' '}
          {diffs.length === 0
            ? t('game.item.same')
            : diffs.map(([stat, value]) => (
                <span key={stat} data-trend={value > 0 ? 'up' : 'down'} className={`mr-1.5 inline-block ${value > 0 ? 'text-[#6fe39a]' : 'text-[#ff9aa6]'}`}>
                  {text.statLine(stat, value)}
                </span>
              ))}
        </p>
      )}
    </>
  )
}

function SetProgress({ set, count, text }) {
  const { t } = text
  const tiers = Object.entries(set.bonus)
    .map(([need, bonus]) => [Number(need), bonus])
    .sort((a, b) => a[0] - b[0])
  return (
    <div className="mb-1.5 flex flex-col">
      <b className="text-[#6fe39a]">{t('game.item.set', { set: t(`game.set.${set.id}`), count, total: set.pieces.length })}</b>
      {tiers.map(([need, bonus]) => {
        const parts = [text.statsLine(bonus), bonus.effect ? text.effect(bonus.effect) : ''].filter(Boolean).join(', ')
        const active = count >= need
        return (
          <span key={need} data-active={String(active)} className={active ? 'text-[#6fe39a]' : 'text-[#7d8196]'}>
            {t('game.item.setTier', { count: need, bonus: parts })}
          </span>
        )
      })}
    </div>
  )
}
