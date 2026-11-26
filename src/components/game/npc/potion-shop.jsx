import { useId, useState } from 'react'
import { MAX_POTION_BUY, POTION_PRICE } from '../../../../shared/game/items.js'
import GameIcon from '../icons/game-icon.jsx'
import { ActionButton } from '../panel/panel-ui.jsx'
import Frame, { SectionTitle } from '../ui/frame.jsx'

// The potion shop (it lived in the Bag tab until fase 3; the Alquimista sells it now): pick a kind,
// an amount (1 to 20) and buy for POTION_PRICE gold each.
export default function PotionShop({ view, actions, runner, text }) {
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
      <SectionTitle id={titleId} level={4}>
        {t('game.shop.title')}
      </SectionTitle>
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
        <label htmlFor={countId} className="flex min-h-11 items-center gap-1.5 text-[#b0b6c1]">
          {t('game.shop.count')}
          <input
            id={countId}
            type="number"
            min={1}
            max={MAX_POTION_BUY}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => setTyped(String(count))}
            className="h-11 w-16 border-2 border-[#0e1116] bg-[#12151b] px-2 font-pixel text-[11px] text-white shadow-[inset_2px_2px_0_#0e1116,inset_-2px_-2px_0_#2c3340] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f2c14e]"
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
