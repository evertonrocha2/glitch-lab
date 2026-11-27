import { useCallback, useEffect, useMemo, useState } from 'react'
import GameView from '../../components/game/game-view.jsx'
import { StudyWindowProvider } from '../../components/game/study-window/study-window-provider.jsx'
import { studyHref } from '../../components/game/study-cta.js'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import { placeIn } from '../../components/world/enem-worlds.js'
import { takeWorldPrefetch } from '../../components/world/world-prefetch.js'
import {
  allocateTalents,
  AuthError,
  buyElixir,
  buyJewel,
  buyMarketItem,
  buyPotions,
  buySkill,
  claimQuest,
  combineGems,
  drinkPotion,
  equipItem,
  fightBoss,
  forgeReroll,
  forgeSalvage,
  forgeSocket,
  forgeUpgrade,
  getDaily,
  getHunt,
  getWorld,
  openChest,
  rerollMarket,
  respecTalents,
  saveLoadout,
  saveLook,
  saveWorldPosition,
  sellItems,
  socketSupport,
  startHunt,
  stopHunt,
  syncGame,
  unequipSlot,
  unsocketSupport,
  upgradeSkill,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import WorldPageSkeleton from './world-page-skeleton.jsx'

// The game calls GameView makes; the page adds the token as the last argument. Read when a call
// runs, not when this module loads.
const gameCalls = () => ({
  syncGame,
  startHunt,
  stopHunt,
  drinkPotion,
  fightBoss,
  equipItem,
  unequipSlot,
  forgeUpgrade,
  forgeSalvage,
  forgeReroll,
  forgeSocket,
  openChest,
  buyPotions,
  allocateTalents,
  respecTalents,
  socketSupport,
  unsocketSupport,
  buySkill,
  upgradeSkill,
  saveLoadout,
  saveLook,
  buyMarketItem,
  sellItems,
  rerollMarket,
  buyElixir,
  buyJewel,
  combineGems,
  claimQuest,
})
const GAME_CALLS = [
  'syncGame',
  'startHunt',
  'stopHunt',
  'drinkPotion',
  'fightBoss',
  'equipItem',
  'unequipSlot',
  'forgeUpgrade',
  'forgeSalvage',
  'forgeReroll',
  'forgeSocket',
  'openChest',
  'buyPotions',
  'allocateTalents',
  'respecTalents',
  'socketSupport',
  'unsocketSupport',
  'buySkill',
  'upgradeSkill',
  'saveLoadout',
  'saveLook',
  'buyMarketItem',
  'sellItems',
  'rerollMarket',
  'buyElixir',
  'buyJewel',
  'combineGems',
  'claimQuest',
]

// What the student already finished today, for the study box's link. Unknown counts as not done.
function useDoneToday(getToken, enabled) {
  const [done, setDone] = useState({})
  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    ;(async () => {
      try {
        const token = await getToken()
        const [daily, hunt] = await Promise.allSettled([getDaily(token), getHunt(token)])
        if (!live) return
        const puzzles = daily.status === 'fulfilled' ? (daily.value?.puzzles ?? []) : []
        setDone({
          daily: puzzles.length > 0 && puzzles.every((puzzle) => puzzle.status === 'passed'),
          hunt: hunt.status === 'fulfilled' && Boolean(hunt.value?.run?.finished),
        })
      } catch {
        // No token (signed out meanwhile): the link keeps its default.
      }
    })()
    return () => {
      live = false
    }
  }, [getToken, enabled])
  return done
}

// /mundo: Glitch World, an open world (fase 3). The hero walks from the town along the roads into
// every region; standing in a zone hunts there. The server keeps where the hero stands and is the
// judge of every fight; the game view does the walking.
// The town keepers (shops, quest board) open in the panel's Cidade tab (GameView does it on Enter).
export default function WorldPage() {
  const { t, locale } = useI18n()
  const { user, getToken, signOut } = useAuth()
  const [start, setStart] = useState(null)
  const [firstView, setFirstView] = useState(null)
  const [world, setWorld] = useState(null)
  const [message, setMessage] = useState('')
  const doneToday = useDoneToday(getToken, Boolean(start))
  const userId = user?.id ?? null

  useEffect(() => {
    let live = true
    // The shell may have asked already (world-prefetch.js): a failed prefetch only means asking again.
    const prefetched = takeWorldPrefetch(userId)
    ;(async () => {
      try {
        const data = prefetched ? await prefetched.world.catch(async () => getWorld(await getToken())) : await getWorld(await getToken())
        const view = prefetched ? await prefetched.game.catch(() => null) : null
        if (!live) return
        // Where ENEM is hidden, a hero saved in an ENEM region starts in the town instead.
        const position = placeIn(data.position, locale)
        if (view?.hero) setFirstView(view)
        setStart(position)
        setWorld(position.world)
      } catch (err) {
        if (!live) return
        if (err instanceof AuthError) await signOut()
        else setMessage(err.message)
      }
    })()
    return () => {
      live = false
    }
  }, [getToken, signOut, locale, userId])

  // A failed save only means the hero may start a few tiles back next time: the game goes on.
  const save = useCallback(async (position, options) => saveWorldPosition(position, await getToken(), options), [getToken])

  const gameApi = useMemo(() => {
    const bound = {}
    for (const name of GAME_CALLS) {
      bound[name] = async (...args) => {
        try {
          return await gameCalls()[name](...args, await getToken())
        } catch (err) {
          if (err instanceof AuthError) await signOut()
          throw err
        }
      }
    }
    return bound
  }, [getToken, signOut])

  return (
    <AppShell>
      <PageHeader kicker={t('world.page.kicker')} title={world ? t(`world.name.${world}`) : t('world.nav')} />
      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}
      {!start && !message && <WorldPageSkeleton />}
      <StudyWindowProvider>
        {start && <GameView start={start} initialView={firstView} api={gameApi} onSave={save} onWorldChange={setWorld} studyHref={studyHref({ locale, doneToday })} />}
      </StudyWindowProvider>
    </AppShell>
  )
}
