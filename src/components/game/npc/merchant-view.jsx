import { useId, useRef, useState } from 'react'
import { BAG_SIZE } from '../../../../shared/game/items.js'
import { sellValue } from '../../../../shared/game/shop.js'
import { ItemPopover, ItemTip, cellIn, useItemPeek } from '../item-popover/item-popover.jsx'
import ItemTooltip from '../item-tooltip/item-tooltip.jsx'
import { RARITY_COLORS } from '../item-tooltip/item-text.js'
import ItemCell from '../panel/item-cell.jsx'
import { ActionButton, ConfirmButton } from '../panel/panel-ui.jsx'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import { Price, Warning } from './npc-ui.jsx'

const QUICK_RARITIES = ['common', 'uncommon', 'rare']

// The Mercador: today's stock (bought with gold) and, in Sell mode, the bag's gear for gold. Prices
// come from the View (npc.market, priced by shared/game/shop.js on the server).
export default function MerchantView(props) {
  const { text } = props
  const { t } = text
  const [mode, setMode] = useState('buy')
  return (
    <>
      <fieldset className="m-0 flex gap-1.5 border-0 p-0">
        <legend className="sr-only">{t('gameNpc.merchant.mode')}</legend>
        {['buy', 'sell'].map((id) => (
          <ActionButton key={id} pressed={mode === id} tone={mode === id ? 'gold' : 'default'} onClick={() => setMode(id)}>
            {t(`gameNpc.merchant.${id}Tab`)}
          </ActionButton>
        ))}
      </fieldset>
      {mode === 'buy' ? <Stock {...props} /> : <Sell {...props} />}
    </>
  )
}

function Stock({ view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const list = useRef(null)
  const tip = useItemPeek()
  const [openId, setOpenId] = useState(null)
  const market = view.npc.market
  const worn = view.hero.items.filter((item) => item.equipped)
  const bagFull = view.hero.items.filter((item) => !item.equipped).length >= BAG_SIZE
  const wornIn = (item) => worn.find((each) => each.equipped === item.slot)
  const whyOf = (price) => (bagFull ? t('game.why.bagFull') : view.hero.gold < price ? t('game.why.gold') : null)
  const rerollWhy = view.hero.fragments < market.reroll.fragments ? t('game.why.fragments') : null
  const open = market.stock.find((each) => each.item.id === openId)
  const peeked = open ? undefined : market.stock.find((each) => each.item.id === tip.id)

  const buy = ({ item, price }) =>
    runner.run(
      () => actions.buyMarketItem(item.id, market.tier),
      (result) => {
        setOpenId(null)
        const got = result?.bought ?? { item, price }
        return t('gameNpc.merchant.bought', { name: text.name(got.item), gold: text.number(got.price) })
      },
    )
  const buyButton = (entry) => (
    <ActionButton tone="gold" busy={runner.busy} why={whyOf(entry.price)} onClick={() => buy(entry)}>
      <Price icon="coins" amount={text.number(entry.price)} />
      <span className="sr-only">{t('gameNpc.merchant.buyFor', { name: text.name(entry.item), gold: text.number(entry.price) })}</span>
    </ActionButton>
  )

  return (
    <Frame as="section" aria-labelledby={titleId} className="flex flex-col gap-2 p-2.5">
      <div className="flex items-center gap-2">
        <SectionTitle id={titleId} className="min-w-0 flex-1">
          {t('gameNpc.merchant.stock')}
        </SectionTitle>
        <Chip tone="ink">{t('gameNpc.merchant.ilvl', { ilvl: market.ilvl })}</Chip>
      </div>
      {market.stock.length === 0 ? (
        <p className="m-0 text-[11px] text-[#b0b6c1]">{t('gameNpc.merchant.soldOut')}</p>
      ) : (
        <ul ref={list} aria-labelledby={titleId} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {market.stock.map((entry) => {
            const { item } = entry
            return (
              <li key={item.id} className="flex items-start gap-2 border-b-2 border-[#0e1116] pb-1.5 shadow-[0_2px_0_#2c3340] last:border-0 last:pb-0 last:shadow-none">
                <span className="w-11 shrink-0">
                  <ItemCell
                    item={item}
                    label={text.cellLabel(item)}
                    popup
                    expanded={item.id === openId}
                    selected={item.id === openId}
                    onPeek={(on) => tip.peek(item.id, on)}
                    describedBy={item.id === peeked?.item.id ? tip.tipId : undefined}
                    onClick={() => setOpenId(item.id === openId ? null : item.id)}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                  <b className="truncate font-pixel text-[10px] font-normal leading-tight" style={{ color: (RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common).text }}>
                    {text.name(item)}
                  </b>
                  <small className="text-[10px] leading-snug text-[#b0b6c1]">{text.line(item)}</small>
                </span>
                <span className="shrink-0">{buyButton(entry)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t-2 border-[#0e1116] pt-2 shadow-[inset_0_2px_0_#2c3340]">
        <ActionButton busy={runner.busy} why={rerollWhy} onClick={() => runner.run(() => actions.rerollMarket(market.tier), () => t('gameNpc.merchant.rerolled'))}>
          {t('gameNpc.merchant.reroll', { fragments: text.number(market.reroll.fragments) })}
        </ActionButton>
        <small className="min-w-32 flex-1 text-[10px] leading-snug text-[#b0b6c1]">{t('gameNpc.merchant.rerollHint')}</small>
      </div>

      {peeked && <ItemTip id={tip.tipId} item={peeked.item} anchor={cellIn(list, peeked.item.id)} equipped={wornIn(peeked.item)} hint={t('gamePopover.hint')} />}
      {open && (
        <ItemPopover key={open.item.id} label={text.name(open.item)} anchor={cellIn(list, open.item.id)} closeLabel={t('gamePopover.close')} onClose={() => setOpenId(null)}>
          <ItemTooltip item={open.item} equipped={wornIn(open.item)} worn={worn} />
          <div className="flex flex-wrap gap-1.5">{buyButton(open)}</div>
        </ItemPopover>
      )}
    </Frame>
  )
}

function Sell({ view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const grid = useRef(null)
  const tip = useItemPeek()
  const [picked, setPicked] = useState([])
  const prices = view.npc.market.sell ?? {}
  const gear = view.hero.items.filter((item) => item.kind === 'gear' && !item.equipped)
  const worn = view.hero.items.filter((item) => item.equipped)
  const priceOf = (item) => prices[item.id] ?? sellValue(item)
  const chosen = gear.filter((item) => picked.includes(item.id))
  const gold = chosen.reduce((sum, item) => sum + priceOf(item), 0)
  const socketed = chosen.filter((item) => item.sockets?.some(Boolean)).length
  const peeked = gear.find((item) => item.id === tip.id)
  const vars = { count: chosen.length, gold: text.number(gold) }

  const toggle = (id) => setPicked((now) => (now.includes(id) ? now.filter((each) => each !== id) : [...now, id]))
  const rarityIds = (rarity) => gear.filter((item) => item.rarity === rarity).map((item) => item.id)
  const allPicked = (rarity) => rarityIds(rarity).every((id) => picked.includes(id))
  const toggleRarity = (rarity) => {
    const ids = rarityIds(rarity)
    setPicked((now) => (ids.every((id) => now.includes(id)) ? now.filter((id) => !ids.includes(id)) : [...new Set([...now, ...ids])]))
  }
  const sell = () =>
    runner.run(
      () => actions.sellItems(chosen.map((item) => item.id)),
      (result) => {
        const sold = result?.sold ?? { gold, count: chosen.length }
        setPicked([])
        return t('gameNpc.merchant.sold', { count: sold.count, gold: text.number(sold.gold) })
      },
    )

  return (
    <Frame as="section" aria-labelledby={titleId} className="flex flex-col gap-2 p-2.5">
      <SectionTitle id={titleId}>{t('gameNpc.merchant.sellTitle')}</SectionTitle>
      {gear.length === 0 ? (
        <p className="m-0 text-[11px] text-[#b0b6c1]">{t('gameNpc.merchant.sellNone')}</p>
      ) : (
        <>
          <p className="m-0 text-[11px] leading-snug text-[#b0b6c1]">{t('gameNpc.merchant.sellPick')}</p>
          <ul ref={grid} aria-label={t('gameNpc.merchant.sellList')} className="m-0 grid list-none grid-cols-6 gap-1 p-0">
            {gear.map((item) => (
              <li key={item.id}>
                <ItemCell
                  item={item}
                  label={text.cellLabel(item)}
                  pressed={picked.includes(item.id)}
                  onPeek={(on) => tip.peek(item.id, on)}
                  describedBy={item.id === peeked?.id ? tip.tipId : undefined}
                  onClick={() => toggle(item.id)}
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_RARITIES.filter((rarity) => rarityIds(rarity).length > 0).map((rarity) => (
              <ActionButton key={rarity} pressed={allPicked(rarity)} onClick={() => toggleRarity(rarity)}>
                {t(`game.bag.allOf.${rarity}`)}
              </ActionButton>
            ))}
          </div>
          {socketed > 0 && <Warning>{t('gameNpc.merchant.socketWarn', { count: socketed })}</Warning>}
          {chosen.length > 0 ? (
            // A new pick disarms the confirm (the key changes), so it always sells what it names.
            <span>
              <ConfirmButton
                key={picked.join()}
                busy={runner.busy}
                confirmLabel={t('gameNpc.merchant.sellConfirm')}
                cancelLabel={t('game.act.cancel')}
                onConfirm={sell}
              >
                {t('gameNpc.merchant.sellMany', vars)}
              </ConfirmButton>
            </span>
          ) : (
            <small className="text-[10px] text-[#b0b6c1]">{t('gameNpc.merchant.sellEmpty')}</small>
          )}
        </>
      )}
      {peeked && (
        <ItemTip
          id={tip.tipId}
          item={peeked}
          anchor={cellIn(grid, peeked.id)}
          equipped={worn.find((each) => each.equipped === peeked.slot)}
          hint={t('gameNpc.merchant.sellsFor', { gold: text.number(priceOf(peeked)) })}
        />
      )}
    </Frame>
  )
}
