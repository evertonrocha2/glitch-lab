import { useId } from 'react'
import { useItemText } from '../item-tooltip/item-text.js'
import { ActionButton } from '../panel/panel-ui.jsx'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import AlchemistView from './alchemist-view.jsx'
import { activeElixirs } from './elixir-time.js'
import JewelerView from './jeweler-view.jsx'
import MerchantView from './merchant-view.jsx'
import NpcPortrait from './npc-portrait.jsx'
import { NPC_IDS, NPCS } from './npcs.js'
import QuestsView from './quests-view.jsx'

// The views a keeper opens inside the tab (the smith opens the Forge tab instead, npcs.js npcTarget).
const VIEWS = { merchant: MerchantView, alchemist: AlchemistView, jeweler: JewelerView, quests: QuestsView }

// What each card says the keeper has right now, and a gold chip when something waits (a quest to collect).
function cardOf(id, view, t) {
  const npc = view.npc
  if (!npc) return { status: t(`gameNpc.role.${id}`) }
  if (id === 'merchant') return { status: t('gameNpc.card.merchant', { count: npc.market.stock.length }) }
  if (id === 'alchemist') {
    const count = activeElixirs(view.hero.elixirs, Date.now()).length
    return { status: count > 0 ? t('gameNpc.card.elixirs', { count }) : t('gameNpc.role.alchemist') }
  }
  if (id === 'jeweler') return { status: t('gameNpc.card.jeweler', { count: view.hero.items.filter((item) => item.kind === 'gem').length }) }
  if (id === 'quests') {
    const { quests } = npc.quests
    const ready = quests.filter((quest) => quest.done && !quest.collected).length
    return {
      status: t('gameNpc.card.quests', { done: quests.filter((quest) => quest.collected).length, total: quests.length }),
      badge: ready > 0 ? t('gameNpc.card.claim', { count: ready }) : null,
    }
  }
  return { status: t('gameNpc.card.smith') }
}

// The Cidade tab: the town's five keepers as portrait cards, or the one open (npc) with a way back.
// The same keepers stand in Lab City on the map, and the map opens them here (GamePanel npc / onNpc).
//   npc: the open keeper id or null. onOpen(id): opens one (the smith switches to the Forge tab).
//   onBack(): back to the list. The rest is the panel's shared props (view, actions, runner, onTab...).
export default function TownTab({ npc, onOpen, onBack, ...shared }) {
  const text = useItemText()
  const { t } = text
  const listId = useId()
  const Body = VIEWS[npc]

  if (Body) {
    return (
      <NpcScreen id={npc} t={t} onBack={onBack}>
        {shared.view.npc ? <Body {...shared} text={text} /> : <p className="m-0 text-[11px] text-[#b0b6c1]">{t('gameNpc.loading')}</p>}
      </NpcScreen>
    )
  }

  return (
    <>
      <SectionTitle id={listId}>{t('gameNpc.town.title')}</SectionTitle>
      <p className="m-0 -mt-1 text-[11px] leading-snug text-[#b0b6c1]">{t('gameNpc.town.hint')}</p>
      <ul aria-labelledby={listId} className="m-0 flex list-none flex-col gap-1.5 p-0">
        {NPC_IDS.map((id) => {
          const name = t(`gameNpc.name.${id}`)
          const card = cardOf(id, shared.view, t)
          return (
            <li key={id}>
              <Frame
                as="button"
                type="button"
                tone="raised"
                aria-label={`${name}: ${card.status}`}
                onClick={() => onOpen(id)}
                className="flex w-full cursor-pointer items-center gap-2.5 p-1.5 pr-2.5 text-left hover:brightness-110"
              >
                <NpcPortrait id={id} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <b className="font-pixel text-[11px] font-normal leading-tight" style={{ color: NPCS[id].accent }}>
                    {name}
                  </b>
                  <small className="text-[11px] leading-snug text-[#b0b6c1]">{t(`gameNpc.role.${id}`)}</small>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <small className="text-[10px] text-[#e8eaee]">{card.status}</small>
                    {card.badge && <Chip tone="gold">{card.badge}</Chip>}
                  </span>
                </span>
                <span aria-hidden="true" className="font-pixel text-[14px] text-[#6b7587]">
                  {id === 'smith' ? '»' : '›'}
                </span>
              </Frame>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// One keeper's screen: back to the town, the bust with the name in the accent and a greeting, then
// the keeper's own view.
function NpcScreen({ id, t, onBack, children }) {
  const headId = useId()
  return (
    <section aria-labelledby={headId} className="flex flex-col gap-2.5">
      <span>
        <ActionButton onClick={onBack}>
          <span aria-hidden="true">‹ </span>
          {t('gameNpc.back')}
        </ActionButton>
      </span>
      <Frame className="flex items-center gap-3 p-2" style={{ '--f-hi': `color-mix(in srgb, ${NPCS[id].accent} 55%, #363e4c)` }}>
        <NpcPortrait id={id} scale={3} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 id={headId} className="m-0 font-pixel text-[14px] font-normal uppercase leading-none tracking-[0.06em] [text-shadow:2px_2px_0_#0e1116]" style={{ color: NPCS[id].accent }}>
            {t(`gameNpc.name.${id}`)}
          </h3>
          <p className="m-0 text-[11px] leading-snug text-[#e8eaee]">{t(`gameNpc.hello.${id}`)}</p>
        </div>
      </Frame>
      {children}
    </section>
  )
}
