import { useId, useState } from 'react'
import { BAG_SIZE, GEMS, gemStats, gemTierOf } from '../../../../shared/game/items.js'
import { combineCost } from '../../../../shared/game/jeweler.js'
import GameIcon from '../icons/game-icon.jsx'
import { tierMark } from '../item-tooltip/item-text.js'
import { ActionButton } from '../panel/panel-ui.jsx'
import { supportColor, supportIcon } from '../panel/support-gem.js'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import { Price } from './npc-ui.jsx'

const GEM_ORDER = Object.keys(GEMS)
const GEM_TEXT = '#7fe9ff'

// The bag's item gems grouped by kind and tier, in the gem table's order then tier: [{ key, gem, tier, ids }].
function gemGroups(items) {
  const groups = new Map()
  for (const item of items) {
    if (item.kind !== 'gem' || !GEM_ORDER.includes(item.gem)) continue
    const tier = gemTierOf(item)
    const key = `${item.gem}:${tier}`
    if (!groups.has(key)) groups.set(key, { key, gem: item.gem, tier, ids: [] })
    groups.get(key).ids.push(item.id)
  }
  return [...groups.values()].sort((a, b) => GEM_ORDER.indexOf(a.gem) - GEM_ORDER.indexOf(b.gem) || a.tier - b.tier)
}

// The Joalheiro: tier 1 item gems and support gems for fragments, and the combine (3 gems of one
// kind and tier into 1 a tier up, for gold) with a preview of what comes out.
export default function JewelerView(props) {
  return (
    <>
      <Combine {...props} />
      <Catalog {...props} />
    </>
  )
}

function Catalog({ view, actions, runner, text }) {
  const { t } = text
  const gemsId = useId()
  const supportsId = useId()
  const { gems, supports } = view.npc.jeweler
  const bagFull = view.hero.items.filter((item) => !item.equipped).length >= BAG_SIZE
  const whyOf = (fragments) => (bagFull ? t('game.why.bagFull') : view.hero.fragments < fragments ? t('game.why.fragments') : null)
  const buy = (kind, id) => runner.run(() => actions.buyJewel(kind, id), (result) => t('gameNpc.jeweler.bought', { name: result?.jewel ? text.name(result.jewel) : '' }))
  const button = (kind, id, name, fragments) => (
    <ActionButton tone="gold" busy={runner.busy} why={whyOf(fragments)} onClick={() => buy(kind, id)}>
      <Price icon="fragment" amount={text.number(fragments)} />
      <span className="sr-only">{t('gameNpc.jeweler.buyFor', { name, fragments: text.number(fragments) })}</span>
    </ActionButton>
  )
  const row = 'flex items-start gap-2 border-b-2 border-[#0e1116] pb-1.5 shadow-[0_2px_0_#2c3340] last:border-0 last:pb-0 last:shadow-none'

  return (
    <>
      <Frame as="section" aria-labelledby={gemsId} className="flex flex-col gap-2 p-2.5">
        <SectionTitle id={gemsId} level={4}>
          {t('gameNpc.jeweler.gems')}
        </SectionTitle>
        <ul aria-labelledby={gemsId} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {gems.map(({ gem, fragments }) => (
            <li key={gem} className={row}>
              <GameIcon name="gem" size={2} className="shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                <b className="font-pixel text-[10px] font-normal leading-tight" style={{ color: GEM_TEXT }}>
                  {text.gemName(gem)}
                </b>
                <small className="text-[11px] text-white">{text.gemLine(gem)}</small>
              </span>
              <span className="shrink-0">{button('gem', gem, text.gemName(gem), fragments)}</span>
            </li>
          ))}
        </ul>
      </Frame>

      <Frame as="section" aria-labelledby={supportsId} className="flex flex-col gap-2 p-2.5">
        <SectionTitle id={supportsId} level={4}>
          {t('gameNpc.jeweler.supports')}
        </SectionTitle>
        <p className="m-0 -mt-1 text-[11px] leading-snug text-[#b0b6c1]">{t('gameNpc.jeweler.supportsHint')}</p>
        <ul aria-labelledby={supportsId} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {supports.map(({ support, fragments }) => {
            const name = t(`game.support.${support}`)
            return (
              <li key={support} className={row}>
                <GameIcon name={supportIcon(support)} size={2} className="shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                  <b className="font-pixel text-[10px] font-normal leading-tight" style={{ color: supportColor(support) }}>
                    {name}
                  </b>
                  <small className="text-[11px] leading-snug text-white">{text.supportDesc({ kind: 'support', support })}</small>
                </span>
                <span className="shrink-0">{button('support', support, name, fragments)}</span>
              </li>
            )
          })}
        </ul>
      </Frame>
    </>
  )
}

function Combine({ view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const pickId = useId()
  const [pickedKey, setPickedKey] = useState(null)
  const { count, maxTier, gold: fees } = view.npc.jeweler.combine
  const groups = gemGroups(view.hero.items)
  const picked = groups.find((group) => group.key === pickedKey && group.ids.length >= count && group.tier < maxTier)
  const fee = picked ? (fees[picked.tier] ?? combineCost(picked.tier)?.gold ?? 0) : 0
  const why = picked && view.hero.gold < fee ? t('game.why.gold') : null
  const offOf = (group) => (group.tier >= maxTier ? t('gameNpc.jeweler.top') : group.ids.length < count ? t('gameNpc.jeweler.need', { count }) : null)

  const combine = () =>
    runner.run(
      () => actions.combineGems(picked.ids.slice(0, count)),
      (result) => {
        setPickedKey(null)
        const made = result?.combined
        return t('gameNpc.jeweler.combined', { name: made ? text.name(made) : text.gemName(picked.gem, picked.tier + 1) })
      },
    )

  return (
    <Frame as="section" aria-labelledby={titleId} className="flex flex-col gap-2 p-2.5" style={{ '--f-hi': '#4d6f93' }}>
      <SectionTitle id={titleId} level={4}>
        {t('gameNpc.jeweler.combine')}
      </SectionTitle>
      <p className="m-0 -mt-1 text-[11px] leading-snug text-[#b0b6c1]">{t('gameNpc.jeweler.combineHint', { count })}</p>
      {groups.length === 0 ? (
        <p className="m-0 text-[11px] text-[#b0b6c1]">{t('gameNpc.jeweler.noGems')}</p>
      ) : (
        <>
          <ul aria-label={t('gameNpc.jeweler.bagGems')} id={pickId} className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
            {groups.map((group) => {
              const off = offOf(group)
              const name = text.gemName(group.gem, group.tier)
              const on = group.key === picked?.key
              return (
                <li key={group.key} className="flex flex-col gap-0.5">
                  <Frame
                    as="button"
                    type="button"
                    tone={on ? 'gold' : 'raised'}
                    disabled={Boolean(off)}
                    aria-pressed={on}
                    aria-label={t('gameNpc.jeweler.group', { name, count: group.ids.length })}
                    onClick={() => setPickedKey(on ? null : group.key)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-1.5 py-1 text-left disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span className="relative shrink-0">
                      <GameIcon name="gem" size={1} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-pixel text-[9px] leading-tight" style={{ color: GEM_TEXT }}>
                      {name}
                    </span>
                    <Chip tone={on ? 'gold' : 'ink'}>x{group.ids.length}</Chip>
                  </Frame>
                  {off && <small className="text-[10px] text-[#b0b6c1]">{off}</small>}
                </li>
              )
            })}
          </ul>
          {picked ? (
            <section aria-label={t('gameNpc.jeweler.preview')} className="flex flex-col gap-1.5 border-2 border-[#0e1116] bg-[#141c26] p-2 shadow-[inset_2px_2px_0_#0e1116,inset_-2px_-2px_0_#2c3a4c]">
              <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-[#b0b6c1]">
                  {count} × {text.gemName(picked.gem, picked.tier)}
                </span>
                <span aria-hidden="true" className="font-pixel text-[#6fa8dc]">
                  →
                </span>
                <span className="sr-only">{t('gameNpc.jeweler.becomes')}</span>
                <b className="font-pixel text-[10px] font-normal" style={{ color: GEM_TEXT }}>
                  {text.gemName(picked.gem, picked.tier + 1)}
                </b>
                <Chip tone="ink">{tierMark(picked.tier + 1)}</Chip>
              </p>
              <ul className="m-0 list-none p-0 text-[11px] text-white">
                {Object.entries(gemStats(picked.gem, picked.tier + 1)).map(([stat, value]) => (
                  <li key={stat}>{text.statLine(stat, value)}</li>
                ))}
              </ul>
              <span>
                <ActionButton tone="gold" busy={runner.busy} why={why} onClick={combine}>
                  {t('gameNpc.jeweler.go', { gold: text.number(fee) })}
                </ActionButton>
              </span>
            </section>
          ) : (
            <small className="text-[10px] text-[#b0b6c1]">{t('gameNpc.jeweler.pick', { count })}</small>
          )}
        </>
      )}
    </Frame>
  )
}
