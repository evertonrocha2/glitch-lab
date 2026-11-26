import { useCallback, useEffect, useMemo, useState } from 'react'
import GameView from '../../components/game/game-view.jsx'
import { StudyWindowProvider } from '../../components/game/study-window/study-window-provider.jsx'
import { studyHref } from '../../components/game/study-cta.js'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import { placeIn } from '../../components/world/enem-worlds.js'
import {
  allocateTalents,
  AuthError,
  buyPotions,
  buySkill,
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
  respecTalents,
  saveLoadout,
  saveLook,
  saveWorldPosition,
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
})
const GAME_CALLS = [
  'syncGame',
  'startHunt',
  'stopHunt',
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
// The town keepers (shops, quest board) only answer "opening soon" for now: GameView's onNpc hook is
// where their panels plug in.
export default function WorldPage() {
  const { t, locale } = useI18n()
  const { getToken, signOut } = useAuth()
  const [start, setStart] = useState(null)
  const [world, setWorld] = useState(null)
  const [message, setMessage] = useState('')
  const doneToday = useDoneToday(getToken, Boolean(start))

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const data = await getWorld(await getToken())
        if (!live) return
        // Where ENEM is hidden, a hero saved in an ENEM region starts in the town instead.
        const position = placeIn(data.position, locale)
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
  }, [getToken, signOut, locale])

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
        {start && <GameView start={start} api={gameApi} onSave={save} onWorldChange={setWorld} studyHref={studyHref({ locale, doneToday })} />}
      </StudyWindowProvider>
    </AppShell>
  )
}
