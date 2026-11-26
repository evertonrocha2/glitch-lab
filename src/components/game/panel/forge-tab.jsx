import { useId, useState } from 'react'
import { rerollCost, upgradeCost } from '../../../../shared/game/items.js'
import ItemTooltip from '../item-tooltip/item-tooltip.jsx'
import { useItemText } from '../item-tooltip/item-text.js'
import Frame, { SectionTitle } from '../ui/frame.jsx'
import { scrapOf } from './bag-tab.jsx'
import ItemCell from './item-cell.jsx'
import { ActionButton, ConfirmButton } from './panel-ui.jsx'

// One affix to reroll: a sunk row, gold edged when picked.
const AFFIX_ROW =
  'flex min-h-11 cursor-pointer items-center gap-2 border-2 px-2 text-[#8fb8ff] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#f2c14e]'

// A forge step: a framed box under a section title.
function Step({ titleId, title, label, children }) {
  return (
    <Frame as="section" aria-labelledby={label ? undefined : titleId} aria-label={label} className="flex flex-col gap-2 p-2.5">
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {children}
    </Frame>
  )
}

// The first reason the hero can't pay, or null. costs: [[have, need, whyKey]].
const shortOf = (t, costs) => {
  const missing = costs.find(([have, need]) => have < need)
  return missing ? t(missing[2]) : null
}

// The Forja tab: the selected gear (worn or in the bag) with Upgrade, Reroll, Socket and Salvage.
// Every cost comes from shared/game/items.js, so the numbers match what the server charges.
export default function ForgeTab({ view, actions, runner, selectedId, onSelect }) {
  const text = useItemText()
  const { t } = text
  const pickId = useId()
  const gear = view.hero.items.filter((item) => item.kind === 'gear').sort((a, b) => Boolean(b.equipped) - Boolean(a.equipped))
  const worn = gear.filter((item) => item.equipped)
  const selected = gear.find((item) => item.id === selectedId)
  const [choosing, setChoosing] = useState(false)

  if (!selected || choosing) {
    return (
      <>
        <SectionTitle id={pickId}>{t('game.forge.pick')}</SectionTitle>
        <ul aria-labelledby={pickId} className="m-0 grid list-none grid-cols-6 gap-1 p-0">
          {gear.map((item) => (
            <li key={item.id}>
              <ItemCell
                item={item}
                label={text.cellLabel(item)}
                selected={item.id === selectedId}
                onClick={() => {
                  onSelect(item.id)
                  setChoosing(false)
                }}
              />
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <ItemTooltip item={selected} worn={worn} />
      <span>
        <ActionButton busy={runner.busy} onClick={() => setChoosing(true)}>
          {t('game.forge.change')}
        </ActionButton>
      </span>
      <Upgrade item={selected} view={view} actions={actions} runner={runner} text={text} />
      <Reroll key={selected.id} item={selected} view={view} actions={actions} runner={runner} text={text} />
      <Socket item={selected} view={view} actions={actions} runner={runner} text={text} />
      <Step label={t('game.forge.salvage')} title={t('game.forge.salvage')}>
        <span>
          <ConfirmButton
            key={selected.id}
            busy={runner.busy}
            why={selected.equipped ? t('game.why.equipped') : null}
            confirmLabel={t('game.act.confirm')}
            cancelLabel={t('game.act.cancel')}
            onConfirm={() =>
              runner
                .run(
                  () => actions.forgeSalvage([selected.id]),
                  (result) => t('game.bag.salvaged', { scrap: text.number(result?.salvage?.scrap ?? scrapOf(selected)) }),
                )
                .then((done) => done && onSelect(null))
            }
          >
            {t('game.act.salvage', { scrap: text.number(scrapOf(selected)) })}
          </ConfirmButton>
        </span>
      </Step>
    </>
  )
}

// The item's upgrade level in the View an action answered.
const levelIn = (result, id) => result?.hero?.items?.find((item) => item.id === id)?.upgrade ?? 0

function Upgrade({ item, view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const cost = upgradeCost(item)
  const why = cost
    ? shortOf(t, [
        [view.hero.gold, cost.gold, 'game.why.gold'],
        [view.hero.scrap, cost.scrap, 'game.why.scrap'],
      ])
    : t('game.why.maxUpgrade')
  const upgrade = () =>
    runner.run(
      () => actions.forgeUpgrade(item.id),
      (result) => {
        const level = levelIn(result, item.id)
        return result?.forge?.ok ? t('game.forge.up', { level }) : t('game.forge.fail', { level })
      },
    )
  return (
    <Step titleId={titleId} title={t('game.forge.upgrade')}>
      {cost && (
        <small className="text-[11px] text-[#a89fd0]">
          {t('game.forge.upgradeCost', { gold: text.number(cost.gold), scrap: text.number(cost.scrap), chance: Math.round(cost.chance * 100) })}
        </small>
      )}
      <span>
        <ActionButton tone="gold" busy={runner.busy} why={why} onClick={upgrade}>
          {t('game.forge.upgrade')}
        </ActionButton>
      </span>
    </Step>
  )
}

function Reroll({ item, view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const name = useId()
  const [index, setIndex] = useState(0)
  const cost = rerollCost(item)
  const hasAffix = item.affixes.length > 0
  const why = hasAffix
    ? shortOf(t, [
        [view.hero.gold, cost.gold, 'game.why.gold'],
        [view.hero.fragments, cost.fragments, 'game.why.fragments'],
      ])
    : t('game.why.noAffix')
  const at = Math.min(index, Math.max(0, item.affixes.length - 1))
  const reroll = () =>
    runner.run(
      () => actions.forgeReroll(item.id, at),
      (result) => {
        const fresh = result?.hero?.items?.find((each) => each.id === item.id)?.affixes?.[at]
        return fresh ? t('game.forge.rerolled', { line: text.affixNamed(fresh) }) : null
      },
    )
  return (
    <Step titleId={titleId} title={t('game.forge.reroll')}>
      {hasAffix && (
        <>
          <small className="text-[11px] text-[#a89fd0]">{t('game.forge.rerollCost', { gold: text.number(cost.gold), fragments: text.number(cost.fragments) })}</small>
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="sr-only">{t('game.forge.reroll')}</legend>
            {item.affixes.map((affix, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: affixes are positions, the index is what the server takes.
              <label key={`${affix.id}-${i}`} className={`${AFFIX_ROW} ${at === i ? 'border-[#f2c14e] bg-[#241c44]' : 'border-[#120c22] bg-[#100c20]'}`}>
                <input type="radio" name={name} checked={at === i} onChange={() => setIndex(i)} className="size-4 accent-[#f2c14e]" />
                {text.affixNamed(affix)}
              </label>
            ))}
          </fieldset>
        </>
      )}
      <span>
        <ActionButton tone="gold" busy={runner.busy} why={why} onClick={reroll}>
          {t('game.forge.rerollGo')}
        </ActionButton>
      </span>
    </Step>
  )
}

function Socket({ item, view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const empty = item.sockets.indexOf(null)
  const gems = view.hero.items.filter((each) => each.kind === 'gem')
  const why = empty < 0 ? t('game.why.noSocket') : gems.length === 0 ? t('game.why.noGems') : null
  // One button per kind of gem (the bag can hold many of one).
  const kinds = [...new Map(gems.map((each) => [each.gem, each])).values()]
  return (
    <Step titleId={titleId} title={t('game.forge.socket')}>
      {why ? (
        <small className="text-[#ff9aa6]">{why}</small>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((each) => (
            <ActionButton
              key={each.gem}
              busy={runner.busy}
              onClick={() => runner.run(() => actions.forgeSocket(item.id, each.id, empty), () => t('game.forge.socketed', { gem: text.gemName(each.gem) }))}
            >
              {t('game.forge.socketGo', { gem: text.gemName(each.gem) })}
            </ActionButton>
          ))}
        </div>
      )}
    </Step>
  )
}
