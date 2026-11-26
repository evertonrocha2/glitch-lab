import { useCallback, useEffect, useMemo, useState } from 'react'
import { HUNT_WORLDS } from '../../../shared/game/zones.js'
import { besidePortal } from '../../../shared/world/map.js'
import { HUB_ID, worldById } from '../../../shared/world/worlds.js'
import GameView from '../../components/game/game-view.jsx'
import { studyHref } from '../../components/game/study-cta.js'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import WorldGame from '../../components/world/world-game/world-game.jsx'
import WorldPanel from '../../components/world/world-panel/world-panel.jsx'
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
  getGame,
  getHunt,
  getWorld,
  openChest,
  respecTalents,
  saveLoadout,
  saveWorldPosition,
  startHunt,
  stopHunt,
  syncGame,
  unequipSlot,
  upgradeSkill,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import { useMyProfile } from '../../lib/profile/my-profile.js'
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
  buySkill,
  upgradeSkill,
  saveLoadout,
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
  'buySkill',
  'upgradeSkill',
  'saveLoadout',
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

// The running hunt's world, or null (no hunt, or the game can't be read: the hub shows as usual).
async function huntWorldOf(token) {
  try {
    const world = (await getGame(token))?.hero?.hunt?.world
    return HUNT_WORLDS.includes(world) ? world : null
  } catch {
    return null
  }
}

// /mundo: Glitch World. The hero walks the worlds the student's study opened; the server says
// what's open and keeps where the hero stands. A hunt world (the Forest) is the idle RPG instead.
export default function WorldPage() {
  const { t, locale } = useI18n()
  const { getToken, signOut } = useAuth()
  const heroColor = useMyProfile()?.profile.avatar?.color ?? 'violet'
  const [state, setState] = useState(null)
  const [world, setWorld] = useState(null)
  const [message, setMessage] = useState('')
  const inGame = HUNT_WORLDS.includes(world)
  const doneToday = useDoneToday(getToken, inGame)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const token = await getToken()
        // A hero saved in a hunt world comes back in the hub, but a running hunt opens the hunt view
        // right away, so its away summary shows without stepping into the portal.
        const [data, hunting] = await Promise.all([getWorld(token), huntWorldOf(token)])
        if (!live) return
        setState(data)
        setWorld(hunting ?? data.position.world)
      } catch (err) {
        if (!live) return
        if (err instanceof AuthError) await signOut()
        else setMessage(err.message)
      }
    })()
    return () => {
      live = false
    }
  }, [getToken, signOut])

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

  // Back from a hunt world: the hero stands beside its portal in the Lab.
  const leave = useCallback(() => {
    const position = { world: HUB_ID, ...besidePortal(worldById(HUB_ID), world) }
    setState((current) => ({ ...current, position }))
    setWorld(HUB_ID)
    save(position).catch(() => {})
  }, [world, save])

  return (
    <AppShell>
      <PageHeader kicker={t('world.page.kicker')} title={world ? t(`world.name.${world}`) : t('world.nav')} />
      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}
      {!state && !message && <WorldPageSkeleton />}
      {state && inGame && <GameView worldId={world} api={gameApi} onLeave={leave} studyHref={studyHref({ locale, doneToday })} />}
      {state && !inGame && (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <WorldGame state={state} heroColor={heroColor} onSave={save} onWorldChange={setWorld} />
          <WorldPanel state={state} currentWorld={world} />
        </div>
      )}
    </AppShell>
  )
}
