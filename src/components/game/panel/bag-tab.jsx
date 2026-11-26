import { useId, useState } from 'react'
import { GEM_SALVAGE_SCRAP } from '../../../../shared/game/hunt.js'
import { BAG_SIZE, MAX_POTION_BUY, POTION_PRICE, RARITIES, SLOTS, salvageValue } from '../../../../shared/game/items.js'
import GameIcon from '../icons/game-icon.jsx'
import ItemTooltip from '../item-tooltip/item-tooltip.jsx'
import { useItemText } from '../item-tooltip/item-text.js'
import ItemCell, { EmptyCell } from './item-cell.jsx'
import { ActionButton, BlockTitle, ConfirmButton } from './panel-ui.jsx'

// Scrap one bag item gives back (gear by rarity and upgrade, a gem a flat amount), as the server pays.
export const scrapOf = (item) => (item.kind === 'gem' ? GEM_SALVAGE_SCRAP : salvageValue(item).scrap)

const rank = (item) => (item.kind === 'gem' ? -1 : RARITIES.indexOf(item.rarity))
const byRarity = (a, b) => rank(b) - rank(a) || (b.ilvl ?? 0) - (a.ilvl ?? 0)
const slotRank = (item) => (item.kind === 'gem' ? SLOTS.length : SLOTS.indexOf(item.slot))
const SORTS = {
  rarity: byRarity,
  slot: (a, b) => slotRank(a) - slotRank(b) || byRarity(a, b),
}

// The Bolsa tab: the 60-cell grid (sorted by rarity or slot), the selected item's tooltip with Equip,
// Salvage and Forge, multi-select salvage, the chests and the potion shop.
export default function BagTab({ view, actions, runner, selectedId, onSelect, onForge }) {
  const text = useItemText()
  const { t } = text
  const gridId = useId()
  const [sort, setSort] = useState('rarity')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState([])
  const worn = view.hero.items.filter((item) => item.equipped)
  const items = view.hero.items.filter((item) => !item.equipped).sort(SORTS[sort])
  const selected = items.find((item) => item.id === selectedId)
  const pickedItems = items.filter((item) => picked.includes(item.id))

  const togglePick = (id) => setPicked((now) => (now.includes(id) ? now.filter((each) => each !== id) : [...now, id]))
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
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <BlockTitle id={gridId}>
          {t('game.bag.title')} <span className="font-normal normal-case text-[#9a93b8]">{t('game.bag.count', { used: items.length, size: BAG_SIZE })}</span>
        </BlockTitle>
        <fieldset className="m-0 flex items-center gap-1 border-0 p-0">
          <legend className="sr-only">{t('game.bag.sort')}</legend>
          <span aria-hidden="true" className="text-[10px] text-[#9a93b8]">
            {t('game.bag.sort')}
          </span>
          {['rarity', 'slot'].map((id) => (
            <ActionButton key={id} pressed={sort === id} tone={sort === id ? 'gold' : 'default'} onClick={() => setSort(id)}>
              {t(id === 'rarity' ? 'game.bag.sortRarity' : 'game.bag.sortSlot')}
            </ActionButton>
          ))}
        </fieldset>
      </div>

      <ul aria-labelledby={gridId} className="m-0 grid list-none grid-cols-6 gap-1 p-0">
        {Array.from({ length: BAG_SIZE }, (_, at) => {
          const item = items[at]
          return (
            <li key={item?.id ?? `empty-${at}`}>
              {item ? (
                <ItemCell
                  item={item}
                  label={text.cellLabel(item)}
                  selected={!picking && item.id === selectedId}
                  pressed={picking ? picked.includes(item.id) : undefined}
                  onClick={() => (picking ? togglePick(item.id) : onSelect(item.id === selectedId ? null : item.id))}
                />
              ) : (
                <EmptyCell />
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-start gap-1.5">
        <ActionButton pressed={picking} onClick={() => (picking ? stopPicking() : setPicking(true))} busy={runner.busy}>
          {t(picking ? 'game.bag.multiDone' : 'game.bag.multi')}
        </ActionButton>
        {picking &&
          (pickedItems.length > 0 ? (
            <ConfirmButton
              busy={runner.busy}
              confirmLabel={t('game.act.confirm')}
              cancelLabel={t('game.act.cancel')}
              onConfirm={() => salvage(pickedItems).then((done) => done && stopPicking())}
            >
              {t('game.bag.salvageMany', { count: pickedItems.length, scrap: text.number(pickedItems.reduce((sum, item) => sum + scrapOf(item), 0)) })}
            </ConfirmButton>
          ) : (
            <small className="self-center text-[10px] text-[#9a93b8]">{t('game.bag.pickMany')}</small>
          ))}
      </div>

      {selected && !picking && (
        <div className="flex flex-col gap-1.5">
          <ItemTooltip item={selected} equipped={worn.find((item) => item.equipped === selected.slot)} worn={worn} />
          <div className="flex flex-wrap gap-1.5">
            {selected.kind === 'gear' && (
              <ActionButton busy={runner.busy} tone="gold" onClick={() => runner.run(() => actions.equipItem(selected.id))}>
                {t('game.act.equip')}
              </ActionButton>
            )}
            {selected.kind === 'gear' && (
              <ActionButton busy={runner.busy} onClick={() => onForge(selected.id)}>
                {t('game.act.forge')}
              </ActionButton>
            )}
            <ConfirmButton
              busy={runner.busy}
              confirmLabel={t('game.act.confirm')}
              cancelLabel={t('game.act.cancel')}
              onConfirm={() => salvage([selected]).then((done) => done && onSelect(null))}
            >
              {t('game.act.salvage', { scrap: text.number(scrapOf(selected)) })}
            </ConfirmButton>
          </div>
        </div>
      )}

      <Chests view={view} actions={actions} runner={runner} text={text} onSelect={onSelect} />
      <PotionShop view={view} actions={actions} runner={runner} text={text} />
    </>
  )
}

function Chests({ view, actions, runner, text, onSelect }) {
  const { t } = text
  const count = view.hero.chests.length
  const open = () =>
    runner.run(
      () => actions.openChest(),
      (result) => {
        const item = result?.chest?.item
        if (result?.overflow) return t('game.bag.overflow', { scrap: text.number(result.overflow.scrap) })
        if (item) onSelect(item.id)
        return item ? t('game.bag.got', { name: text.name(item) }) : null
      },
    )
  return (
    <div className="flex items-center gap-2 border-2 border-[#2e2650] bg-[#160f2e] p-1.5">
      <GameIcon name="chest" size={2} />
      <b className="text-white">{t('game.bag.chests', { count })}</b>
      <span className="ml-auto">
        <ActionButton tone="gold" busy={runner.busy} why={count === 0 ? t('game.why.noChest') : null} onClick={open}>
          {t('game.bag.open')}
        </ActionButton>
      </span>
    </div>
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
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5 border-2 border-[#2e2650] bg-[#160f2e] p-1.5">
      <BlockTitle id={titleId}>{t('game.shop.title')}</BlockTitle>
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
        <label htmlFor={countId} className="flex min-h-11 items-center gap-1.5">
          {t('game.shop.count')}
          <input
            id={countId}
            type="number"
            min={1}
            max={MAX_POTION_BUY}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => setTyped(String(count))}
            className="h-11 w-16 border-2 border-[#4a4266] bg-[#0d0a1c] px-1.5 text-white"
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
    </section>
  )
}
