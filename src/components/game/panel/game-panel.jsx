import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import GameIcon from '../icons/game-icon.jsx'
import Frame, { Chip } from '../ui/frame.jsx'
import BagTab from './bag-tab.jsx'
import ForgeTab from './forge-tab.jsx'
import HeroTab from './hero-tab.jsx'
import { useActionRunner } from './use-action.js'

export const TABS = [
  { id: 'hero', icon: 'helm' },
  { id: 'tree', icon: 'tree' },
  { id: 'bag', icon: 'bag' },
  { id: 'forge', icon: 'hammer' },
  { id: 'world', icon: 'map' },
]

// A tab's box: icon over label, in pixel type. The closed phone drawer's buttons wear it too.
export const TAB_LOOK = 'flex min-h-13 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 px-1 pb-2 pt-1.5 font-pixel text-[11px] leading-none'

const slot = (content, shared) => (typeof content === 'function' ? content(shared) : content)

const WALLET = [
  { field: 'gold', icon: 'coins' },
  { field: 'scrap', icon: 'scrap' },
  { field: 'fragments', icon: 'fragment' },
]

// The right-side panel of layout B (the mockup's .panel): five tabs on the WAI-ARIA tabs pattern
// (roving tabindex, arrow keys wrap, Home / End, automatic activation), the wallet and the active tab.
//
// Props:
// - view: the server View. tab / onTab(id): the open tab, controlled by the page
//   ('hero' | 'tree' | 'bag' | 'forge' | 'world').
// - actions: the Task 13 calls bound to the token, each answering the server response (the new View
//   plus extras): { equipItem(itemId), unequipSlot(slot), forgeUpgrade(itemId), forgeSalvage(itemIds),
//   forgeReroll(itemId, affix), forgeSocket(itemId, gemId, socket), openChest(), buyPotions(kind, count) }.
//   The page applies the View it gets back; the panel only reads the extras for its messages.
// - treeTab, worldTab: the content of the Árvore and Mundo tabs (Tasks 19 and 20), any node, or a
//   function (shared) => node that gets { view, actions, runner, ... }, so the tab shares the panel's
//   one-action-at-a-time runner and its message line. The tree wants
//   (shared) => <TreeTab {...shared} />, with allocateTalents, respecTalents, buySkill, upgradeSkill and
//   saveLoadout in actions.
// - target (optional): { world, zone, difficulty } the power bar measures against. Defaults to the
//   running hunt, else the first open zone not yet beaten on Normal.
// - onEditLook (optional): opens the character creator from the Hero tab's Appearance button (hidden
//   without it).
// - studyHref (optional): where the study call to action links.
// - fill (optional): the panel takes its parent's height and the tab content scrolls inside the frame
//   (the desktop console); off, it grows with its content (the phone drawer scrolls it).
export default function GamePanel({ view, tab = 'hero', onTab, actions, treeTab = null, worldTab = null, target, onEditLook, studyHref, fill = false }) {
  const { t, locale } = useI18n()
  const fmt = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const baseId = useId()
  const tabRefs = useRef({})
  const body = useRef(null)
  const focusNext = useRef(false)
  const [selectedId, setSelectedId] = useState(null)
  const runner = useActionRunner()
  const { setNotice } = runner
  const free = view.talentPoints?.free ?? 0
  const active = TABS.some((each) => each.id === tab) ? tab : 'hero'

  // A tab change clears the last message, and an arrow key moves focus to the new tab.
  useEffect(() => {
    setNotice(null)
    if (body.current) body.current.scrollTop = 0
    if (focusNext.current) {
      focusNext.current = false
      tabRefs.current[active]?.focus()
    }
  }, [active, setNotice])

  function onKeyDown(event) {
    const at = TABS.findIndex((each) => each.id === active)
    const moves = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: TABS.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const next = TABS[(moves[event.key] + TABS.length) % TABS.length].id
    focusNext.current = true
    if (next === active) tabRefs.current[next]?.focus()
    else onTab?.(next)
  }

  const forge = (id) => {
    setSelectedId(id)
    onTab?.('forge')
  }
  const shared = { view, actions, runner, selectedId, onSelect: setSelectedId, onForge: forge }

  const content = {
    hero: <HeroTab {...shared} target={target} onEditLook={onEditLook} studyHref={studyHref} />,
    tree: slot(treeTab, shared),
    bag: <BagTab {...shared} />,
    forge: <ForgeTab {...shared} />,
    world: slot(worldTab, shared),
  }

  return (
    <section aria-label={t('game.panel.label')} className={`flex min-w-0 flex-col gap-2 font-mono text-xs text-[#e9e4ff] ${fill ? 'h-full w-full' : ''}`}>
      <div role="tablist" aria-label={t('game.panel.label')} className="grid grid-cols-5 gap-1" onKeyDown={onKeyDown}>
        {TABS.map(({ id, icon }) => {
          const on = id === active
          const label = t(`game.tab.${id}`)
          const badge = id === 'tree' && free > 0
          return (
            <Frame
              as="button"
              tone={on ? 'raised' : 'inset'}
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={on}
              aria-controls={`${baseId}-panel-${id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onTab?.(id)}
              className={`${TAB_LOOK} ${on ? 'text-white' : 'text-[#a89fd0] hover:text-[#e9e4ff]'}`}
            >
              <GameIcon name={icon} size={1} className={on ? '' : 'opacity-70'} />
              <span className="max-w-full truncate leading-[1.35]">{label}</span>
              {on && <i aria-hidden="true" className="absolute inset-x-1 bottom-1 block h-0.5 bg-[#f2c14e]" />}
              {badge && (
                <Chip tone="danger" className="absolute right-1 top-1 z-10">
                  <span aria-hidden="true">{fmt.format(free)}</span>
                  <span className="sr-only">, {t('game.tab.free', { count: free })}</span>
                </Chip>
              )}
            </Frame>
          )
        })}
      </div>

      <Frame tone="inset" className={`flex min-w-0 flex-col p-1 ${fill ? 'min-h-0 flex-1' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b-2 border-[#0a0818] px-1.5 pb-2 pt-1.5 shadow-[0_2px_0_#2a2250]">
          <ul aria-label={t('game.cur.wallet')} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {WALLET.map(({ field, icon }) => (
              <li key={field} className="flex items-center gap-1 border-2 border-[#120c22] bg-[#1b1433] py-0.5 pl-1 pr-1.5 shadow-[inset_2px_2px_0_#2e2560]">
                <GameIcon name={icon} size={1} label={t(`game.cur.${field}`)} />
                <b className="font-pixel text-[11px] font-normal text-white">{fmt.format(view.hero[field] ?? 0)}</b>
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1 basis-40 text-right text-[11px] leading-tight">
            <p role="status" className="m-0 text-[#6fe39a]">
              {runner.busy ? t('game.busy') : runner.notice?.kind === 'ok' ? runner.notice.text : ''}
            </p>
            <p role="alert" className="m-0 text-[#ff9aa6]">
              {runner.notice?.kind === 'error' ? runner.notice.text : ''}
            </p>
          </div>
        </div>
        <div ref={body} className={`gw-scroll flex min-w-0 flex-col gap-2.5 px-1.5 pb-1.5 pt-2.5 ${fill ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}>
          {TABS.map(({ id }) => (
            <div
              key={id}
              role="tabpanel"
              id={`${baseId}-panel-${id}`}
              aria-labelledby={`${baseId}-tab-${id}`}
              hidden={id !== active}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: the tabs pattern makes a panel focusable when its first content may not be.
              tabIndex={0}
              className="flex flex-col gap-2.5 focus-visible:rounded-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#f2c14e]"
            >
              {id === active ? content[id] : null}
            </div>
          ))}
        </div>
      </Frame>
    </section>
  )
}
