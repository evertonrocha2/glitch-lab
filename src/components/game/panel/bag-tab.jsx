import { useId, useRef, useState } from 'react'
import { GEM_SALVAGE_SCRAP } from '../../../../shared/game/hunt.js'
import { BAG_SIZE, MAX_POTION_BUY, POTION_PRICE, RARITIES, SLOTS, SUPPORT_SALVAGE_SCRAP, salvageValue } from '../../../../shared/game/items.js'
import GameIcon from '../icons/game-icon.jsx'
import { ItemPopover, ItemTip, cellIn, useItemPeek } from '../item-popover/item-popover.jsx'
import ItemTooltip from '../item-tooltip/item-tooltip.jsx'
import { isGear, useItemText } from '../item-tooltip/item-text.js'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import ItemCell, { EmptyCell } from './item-cell.jsx'
import { ActionButton, ConfirmButton } from './panel-ui.jsx'

// Scrap one bag item gives back (gear by rarity and upgrade, a gem a flat amount), as the server pays.
export const scrapOf = (item) => (item.kind === 'support' ? SUPPORT_SALVAGE_SCRAP : item.kind === 'gem' ? GEM_SALVAGE_SCRAP : salvageValue(item).scrap)

// Gear first; then gems, then support gems (each kept in its server order: sort is stable).
const FAMILY = { gem: 1, support: 2 }
const family = (item) => FAMILY[item.kind] ?? 0
const rank = (item) => (isGear(item) ? RARITIES.indexOf(item.rarity) : -1)
const byRarity = (a, b) => family(a) - family(b) || rank(b) - rank(a) || (b.ilvl ?? 0) - (a.ilvl ?? 0)
const slotRank = (item) => (isGear(item) ? SLOTS.indexOf(item.slot) : SLOTS.length)
const SORTS = {
  rarity: byRarity,
  slot: (a, b) => family(a) - family(b) || slotRank(a) - slotRank(b) || byRarity(a, b),
}

// The Bolsa tab: the 60-cell grid (sorted by rarity or slot), a tooltip on hover or focus, a popover
// beside the clicked item with its card and Equip, Forge and Salvage, multi-select salvage (clicks pick,
// no popover), the chests and the potion shop.
const QUICK_RARITIES = ['common', 'uncommon', 'rare']

export default function BagTab({ view, actions, runner, onSelect, onForge }) {
  const text = useItemText()
  const { t } = text
  const gridId = useId()
  const grid = useRef(null)
  const [sort, setSort] = useState('rarity')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState([])
  // The item whose popover is open (one at a time), and the one the tooltip is on.
  const [openId, setOpenId] = useState(null)
  const tip = useItemPeek()
  const worn = view.hero.items.filter((item) => item.equipped)
  const items = view.hero.items.filter((item) => !item.equipped).sort(SORTS[sort])
  const selected = picking ? undefined : items.find((item) => item.id === openId)
  const peeked = selected ? undefined : items.find((item) => item.id === tip.id)
  const wornIn = (item) => (isGear(item) ? worn.find((each) => each.equipped === item.slot) : undefined)
  // Opening one also selects it for the panel, so the Forge tab starts on it.
  const show = (id) => {
    setOpenId(id)
    if (id) onSelect(id)
  }
  const dropSalvaged = () => {
    setOpenId(null)
    onSelect(null)
  }
  const pickedItems = items.filter((item) => picked.includes(item.id))
  const manyVars = { count: pickedItems.length, scrap: text.number(pickedItems.reduce((sum, item) => sum + scrapOf(item), 0)) }

  const togglePick = (id) => setPicked((now) => (now.includes(id) ? now.filter((each) => each !== id) : [...now, id]))
  // One click picks every bag item of a rarity (only the lower three: nobody bulk-salvages epics),
  // a second click lets them all go.
  const rarityIds = (rarity) => items.filter((item) => isGear(item) && item.rarity === rarity).map((item) => item.id)
  const quickRarities = QUICK_RARITIES.filter((rarity) => rarityIds(rarity).length > 0)
  const allPicked = (rarity) => rarityIds(rarity).every((id) => picked.includes(id))
  const toggleRarity = (rarity) => {
    const ids = rarityIds(rarity)
    setPicked((now) => (ids.every((id) => now.includes(id)) ? now.filter((id) => !ids.includes(id)) : [...new Set([...now, ...ids])]))
  }
  const startPicking = () => {
    setPicking(true)
    setOpenId(null)
  }
  const stopPicking = () => {
    setPicking(false)
    setPicked([])
  }

  const salvage = (list) =>
    runner.run(
      () => actions.forgeSalvage(list.map((item) => item.id)),
      (result) => t('game.bag.salvaged', { scrap: text.number(result?.salvage?.scrap ?? list.reduce((sum, item) => sum + scrapOf(item), 0)) }),
    )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <SectionTitle id={gridId} className="min-w-40 flex-1">
          {t('game.bag.title')}{' '}
          <Chip tone="ink" className="ml-1 align-middle normal-case tracking-normal">
            {t('game.bag.count', { used: items.length, size: BAG_SIZE })}
          </Chip>
        </SectionTitle>
        <fieldset className="m-0 flex items-center gap-1.5 border-0 p-0">
          <legend className="sr-only">{t('game.bag.sort')}</legend>
          <span aria-hidden="true" className="font-pixel text-[9px] text-[#a89fd0]">
            {t('game.bag.sort')}
          </span>
          {['rarity', 'slot'].map((id) => (
            <ActionButton key={id} pressed={sort === id} tone={sort === id ? 'gold' : 'default'} onClick={() => setSort(id)}>
              {t(id === 'rarity' ? 'game.bag.sortRarity' : 'game.bag.sortSlot')}
            </ActionButton>
          ))}
        </fieldset>
      </div>

      <ul ref={grid} aria-labelledby={gridId} className="m-0 grid list-none grid-cols-6 gap-1 p-0">
        {Array.from({ length: BAG_SIZE }, (_, at) => {
          const item = items[at]
          return (
            <li key={item?.id ?? `empty-${at}`}>
              {item ? (
                <ItemCell
                  item={item}
                  label={text.cellLabel(item)}
                  selected={item.id === selected?.id}
                  pressed={picking ? picked.includes(item.id) : undefined}
                  popup={!picking}
                  expanded={item.id === selected?.id}
                  onPeek={(on) => tip.peek(item.id, on)}
                  describedBy={item.id === peeked?.id ? tip.tipId : undefined}
                  onClick={() => (picking ? togglePick(item.id) : show(item.id === selected?.id ? null : item.id))}
                />
              ) : (
                <EmptyCell />
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-start gap-1.5">
        <ActionButton pressed={picking} onClick={() => (picking ? stopPicking() : startPicking())} busy={runner.busy}>
          {t(picking ? 'game.bag.multiDone' : 'game.bag.multi')}
        </ActionButton>
        {picking &&
          quickRarities.map((rarity) => (
            <ActionButton key={rarity} pressed={allPicked(rarity)} onClick={() => toggleRarity(rarity)}>
              {t(`game.bag.allOf.${rarity}`)}
            </ActionButton>
          ))}
        {picking &&
          (pickedItems.length > 0 ? (
            // A new pick disarms the confirm (the key changes), so it always salvages what it names.
            <ConfirmButton
              key={pickedItems.map((item) => item.id).join()}
              busy={runner.busy}
              confirmLabel={t('game.bag.confirmMany', manyVars)}
              cancelLabel={t('game.act.cancel')}
              onConfirm={() => salvage(pickedItems).then((done) => done && stopPicking())}
            >
              {t('game.bag.salvageMany', manyVars)}
            </ConfirmButton>
          ) : (
            <small className="self-center text-[10px] text-[#a89fd0]">{t('game.bag.pickMany')}</small>
          ))}
      </div>

      {peeked && (
        <ItemTip id={tip.tipId} item={peeked} anchor={cellIn(grid, peeked.id)} equipped={wornIn(peeked)} hint={t(picking ? 'gamePopover.hintPick' : 'gamePopover.hint')} />
      )}

      {selected && (
        <ItemPopover key={selected.id} label={text.name(selected)} anchor={cellIn(grid, selected.id)} closeLabel={t('gamePopover.close')} onClose={() => setOpenId(null)}>
          <ItemTooltip item={selected} equipped={wornIn(selected)} worn={worn} />
          <div className="flex flex-wrap gap-1.5">
            {isGear(selected) && (
              <ActionButton busy={runner.busy} tone="gold" onClick={() => runner.run(() => actions.equipItem(selected.id))}>
                {t('game.act.equip')}
              </ActionButton>
            )}
            {isGear(selected) && (
              <ActionButton busy={runner.busy} onClick={() => onForge(selected.id)}>
                {t('game.act.forge')}
              </ActionButton>
            )}
            {/* Keyed by the item: picking another one disarms the confirm. */}
            <ConfirmButton
              key={selected.id}
              busy={runner.busy}
              confirmLabel={t('game.act.confirm')}
              cancelLabel={t('game.act.cancel')}
              onConfirm={() => salvage([selected]).then((done) => done && dropSalvaged())}
            >
              {t('game.act.salvage', { scrap: text.number(scrapOf(selected)) })}
            </ConfirmButton>
          </div>
        </ItemPopover>
      )}

      <Chests view={view} actions={actions} runner={runner} text={text} onGot={show} />
      <PotionShop view={view} actions={actions} runner={runner} text={text} />
    </>
  )
}

// onGot(id): opens the popover of the item the chest gave.
function Chests({ view, actions, runner, text, onGot }) {
  const { t } = text
  const count = view.hero.chests.length
  const open = () =>
    runner.run(
      () => actions.openChest(),
      (result) => {
        const item = result?.chest?.item
        if (result?.overflow) return t('game.bag.overflow', { scrap: text.number(result.overflow.scrap) })
        if (item) onGot(item.id)
        return item ? t('game.bag.got', { name: text.name(item) }) : null
      },
    )
  return (
    <Frame className="flex items-center gap-2.5 p-2">
      <GameIcon name="chest" size={2} className="shrink-0" />
      <b className="font-pixel text-[11px] font-normal text-white">{t('game.bag.chests', { count })}</b>
      <span className="ml-auto">
        <ActionButton tone="gold" busy={runner.busy} why={count === 0 ? t('game.why.noChest') : null} onClick={open}>
          {t('game.bag.open')}
        </ActionButton>
      </span>
    </Frame>
  )
}

function PotionShop({ view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const countId = useId()
  const [kind, setKind] = useState('hp')
  // The field keeps what is typed (it may be empty for a moment); count is that, kept in 1..20.
  const [typed, setTyped] = useState('1')
  const count = Math.min(MAX_POTION_BUY, Math.max(1, Math.floor(Number(typed)) || 1))
  const cost = POTION_PRICE * count
  const short = view.hero.gold < cost
  return (
    <Frame as="section" aria-labelledby={titleId} className="flex flex-col gap-2 p-2.5">
      <SectionTitle id={titleId}>{t('game.shop.title')}</SectionTitle>
      <fieldset className="m-0 flex gap-1.5 border-0 p-0">
        <legend className="sr-only">{t('game.shop.kind')}</legend>
        {['hp', 'mp'].map((id) => (
          <ActionButton key={id} pressed={kind === id} tone={kind === id ? 'gold' : 'default'} onClick={() => setKind(id)}>
            <span className="inline-flex items-center gap-1">
              <GameIcon name={id === 'hp' ? 'hppot' : 'mppot'} size={1} />
              {t(`game.shop.${id}`, { count: view.hero.potions[id] ?? 0 })}
            </span>
          </ActionButton>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-start gap-1.5">
        <label htmlFor={countId} className="flex min-h-11 items-center gap-1.5 text-[#a89fd0]">
          {t('game.shop.count')}
          <input
            id={countId}
            type="number"
            min={1}
            max={MAX_POTION_BUY}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => setTyped(String(count))}
            className="h-11 w-16 border-2 border-[#120c22] bg-[#100c20] px-2 font-pixel text-[11px] text-white shadow-[inset_2px_2px_0_#0a0818,inset_-2px_-2px_0_#2a2250] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f2c14e]"
          />
        </label>
        <ActionButton
          tone="gold"
          busy={runner.busy}
          why={short ? t('game.why.gold') : null}
          onClick={() => runner.run(() => actions.buyPotions(kind, count), () => t('game.shop.bought', { count }))}
        >
          {t('game.shop.buy', { gold: text.number(cost) })}
        </ActionButton>
      </div>
    </Frame>
  )
}
