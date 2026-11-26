import { useId } from 'react'
import GameIcon from '../icons/game-icon.jsx'
import { ActionButton } from '../panel/panel-ui.jsx'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import { activeElixirs, countdown, useNow } from './elixir-time.js'
import { Price } from './npc-ui.jsx'
import PotionShop from './potion-shop.jsx'

const pct = (bonus) => Math.round(bonus * 100)
const minutesOf = (ms) => Math.round(ms / 60_000)

// The Alquimista: the elixirs running now (live countdowns), the three elixirs for gold or
// fragments (drinking one that runs starts it over, never stacks), and the potion shop.
export default function AlchemistView({ view, actions, runner, text }) {
  const { t } = text
  const activeId = useId()
  const shopId = useId()
  const { elixirs } = view.npc.alchemist
  const running = activeElixirs(view.hero.elixirs, Date.now()).length > 0
  const now = useNow(running)
  const active = activeElixirs(view.hero.elixirs, now)
  const leftOf = Object.fromEntries(active.map((each) => [each.type, each.left]))
  const name = (type) => t(`gameNpc.elixir.${type}`)

  const drink = (elixir, currency) =>
    runner.run(
      () => actions.buyElixir(elixir.type, currency),
      () => t('gameNpc.alchemist.drank', { name: name(elixir.type), minutes: minutesOf(elixir.ms) }),
    )
  const whyOf = (elixir, currency) => (view.hero[currency] < elixir[currency] ? t(currency === 'gold' ? 'game.why.gold' : 'game.why.fragments') : null)

  return (
    <>
      <Frame as="section" aria-labelledby={activeId} className="flex flex-col gap-1.5 p-2.5">
        <SectionTitle id={activeId} level={4}>
          {t('gameNpc.alchemist.active')}
        </SectionTitle>
        {active.length === 0 ? (
          <p className="m-0 text-[11px] text-[#b0b6c1]">{t('gameNpc.alchemist.none')}</p>
        ) : (
          <ul aria-labelledby={activeId} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {active.map((each) => (
              <li key={each.type} className="flex items-center gap-1.5 border-2 border-[#0e1116] bg-[#1a2a1f] py-1 pl-1 pr-2 shadow-[inset_2px_2px_0_#2f4a35]">
                <GameIcon name={`elixir-${each.type}`} size={1} />
                <b className="font-pixel text-[10px] font-normal text-[#cfe8c9]">{name(each.type)}</b>
                <span className="font-pixel text-[10px] text-[#8fbf8a]">{t('gameNpc.alchemist.left', { time: countdown(each.left) })}</span>
              </li>
            ))}
          </ul>
        )}
      </Frame>

      <Frame as="section" aria-labelledby={shopId} className="flex flex-col gap-2 p-2.5">
        <SectionTitle id={shopId} level={4}>
          {t('gameNpc.alchemist.elixirs')}
        </SectionTitle>
        <ul aria-labelledby={shopId} className="m-0 flex list-none flex-col gap-2 p-0">
          {elixirs.map((elixir) => {
            const left = leftOf[elixir.type]
            return (
              <li key={elixir.type} className="flex flex-col gap-1.5 border-b-2 border-[#0e1116] pb-2 shadow-[0_2px_0_#2c3340] last:border-0 last:pb-0 last:shadow-none">
                <span className="flex items-center gap-2">
                  <GameIcon name={`elixir-${elixir.type}`} size={2} className="shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <b className="font-pixel text-[11px] font-normal leading-tight text-[#cfe8c9]">{name(elixir.type)}</b>
                    <span className="text-[11px] text-white">{t(`gameNpc.elixirEffect.${elixir.type}`, { pct: pct(elixir.bonus) })}</span>
                    <small className="text-[10px] leading-snug text-[#b0b6c1]">{t('gameNpc.alchemist.lasts', { minutes: minutesOf(elixir.ms) })}</small>
                  </span>
                  {left !== undefined && (
                    <Chip tone="ok" className="shrink-0">
                      {countdown(left)}
                    </Chip>
                  )}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {['gold', 'fragments'].map((currency) => (
                    <ActionButton key={currency} tone="gold" busy={runner.busy} why={whyOf(elixir, currency)} onClick={() => drink(elixir, currency)}>
                      <Price icon={currency === 'gold' ? 'coins' : 'fragment'} amount={text.number(elixir[currency])} />
                      <span className="sr-only">
                        {t(currency === 'gold' ? 'gameNpc.alchemist.payGold' : 'gameNpc.alchemist.payFragments', { name: name(elixir.type), amount: text.number(elixir[currency]) })}
                      </span>
                    </ActionButton>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      </Frame>

      <PotionShop view={view} actions={actions} runner={runner} text={text} />
    </>
  )
}
