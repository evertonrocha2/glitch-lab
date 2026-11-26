import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import GameIcon from '../icons/game-icon.jsx'
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
// - treeTab, worldTab: the content of the Árvore and Mundo tabs (Tasks 19 and 20), any node.
// - target (optional): { world, zone, difficulty } the power bar measures against. Defaults to the
//   running hunt, else the first open zone not yet beaten on Normal.
// - portrait (optional): the hero portrait and its "edit look" button, shown at the top of the Hero tab.
// - studyHref (optional): where the study call to action links.
export default function GamePanel({ view, tab = 'hero', onTab, actions, treeTab = null, worldTab = null, target, portrait = null, studyHref }) {
  const { t, locale } = useI18n()
  const fmt = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const baseId = useId()
  const tabRefs = useRef({})
  const focusNext = useRef(false)
  const [selectedId, setSelectedId] = useState(null)
  const runner = useActionRunner()
  const { setNotice } = runner
  const free = view.talentPoints?.free ?? 0
  const active = TABS.some((each) => each.id === tab) ? tab : 'hero'

  // A tab change clears the last message, and an arrow key moves focus to the new tab.
  useEffect(() => {
    setNotice(null)
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
    hero: <HeroTab {...shared} target={target} portrait={portrait} studyHref={studyHref} />,
    tree: treeTab,
    bag: <BagTab {...shared} />,
    forge: <ForgeTab {...shared} />,
    world: worldTab,
  }

  return (
    <section
      aria-label={t('game.panel.label')}
      className="flex flex-col gap-2.5 border-l-[3px] border-[#0a0818] bg-linear-to-b from-[#1a1433] to-[#120e26] p-2.5 font-mono text-xs text-[#ece8ff]"
    >
      <div role="tablist" aria-label={t('game.panel.label')} className="grid grid-cols-3 gap-1" onKeyDown={onKeyDown}>
        {TABS.map(({ id, icon }) => {
          const on = id === active
          const label = t(`game.tab.${id}`)
          const badge = id === 'tree' && free > 0
          return (
            <button
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
              className={`relative flex min-h-11 cursor-pointer items-center gap-1 border-2 px-1 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f2c14e] ${on ? 'border-[#f2c14e] bg-[#2a1f5a] text-white' : 'border-[#2e2650] bg-[#1e1838] text-[#b9b0de]'}`}
            >
              <GameIcon name={icon} size={1} />
              {label}
              {badge && (
                <b className="absolute -right-1.5 -top-1.5 border border-[#0a0818] bg-[#ff5a6e] px-1 text-[9px] text-white">
                  <span aria-hidden="true">{fmt.format(free)}</span>
                  <span className="sr-only">, {t('game.tab.free', { count: free })}</span>
                </b>
              )}
            </button>
          )
        })}
      </div>

      <ul aria-label={t('game.cur.wallet')} className="flex flex-wrap gap-3 text-[11px]">
        {WALLET.map(({ field, icon }) => (
          <li key={field} className="flex items-center gap-1">
            <GameIcon name={icon} size={1} label={t(`game.cur.${field}`)} />
            <b className="text-white">{fmt.format(view.hero[field] ?? 0)}</b>
          </li>
        ))}
      </ul>

      <div className="min-h-4 text-[11px]">
        <p role="status" className="m-0 text-[#6fe39a]">
          {runner.busy ? t('game.busy') : runner.notice?.kind === 'ok' ? runner.notice.text : ''}
        </p>
        <p role="alert" className="m-0 text-[#ff9aa6]">
          {runner.notice?.kind === 'error' ? runner.notice.text : ''}
        </p>
      </div>

      {TABS.map(({ id }) => (
        <div
          key={id}
          role="tabpanel"
          id={`${baseId}-panel-${id}`}
          aria-labelledby={`${baseId}-tab-${id}`}
          hidden={id !== active}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the tabs pattern makes a panel focusable when its first content may not be.
          tabIndex={0}
          className="flex flex-col gap-2.5 focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
        >
          {id === active ? content[id] : null}
        </div>
      ))}
    </section>
  )
}
