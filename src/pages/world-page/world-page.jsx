import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_LOOK } from '../../../shared/game/look.js'
import { HUNT_WORLDS } from '../../../shared/game/zones.js'
import { besidePortal } from '../../../shared/world/map.js'
import { HUB_ID, worldById } from '../../../shared/world/worlds.js'
import GameView from '../../components/game/game-view.jsx'
import { gearOf } from '../../components/game/hero/gear.js'
import { rememberHero } from '../../components/game/loading/hero-memory.js'
import LookDialog from '../../components/game/look-dialog.jsx'
import { StudyWindowProvider } from '../../components/game/study-window/study-window-provider.jsx'
import { studyHref } from '../../components/game/study-cta.js'
import Frame from '../../components/game/ui/frame.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import WorldGame from '../../components/world/world-game/world-game.jsx'
import { isEnemWorld, showsEnem } from '../../components/world/enem-worlds.js'
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

// The game View, or null when it can't be read (the hub then shows as usual, with the default hero).
async function gameOf(token) {
  try {
    return (await getGame(token)) ?? null
  } catch {
    return null
  }
}

// The running hunt's world, or null.
function huntWorldOf(view) {
  const world = view?.hero?.hunt?.world
  return HUNT_WORLDS.includes(world) ? world : null
}

// /mundo: Glitch World. The hero walks the worlds the student's study opened; the server says
// what's open and keeps where the hero stands. A hunt world (the Forest) is the idle RPG instead.
export default function WorldPage() {
  const { t, locale } = useI18n()
  const { getToken, signOut } = useAuth()
  const [state, setState] = useState(null)
  // The game View for the hub's hero (look and gear); null until read, or when it can't be.
  const [game, setGame] = useState(null)
  const [lookOpen, setLookOpen] = useState(false)
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
        const [data, view] = await Promise.all([getWorld(token), gameOf(token)])
        if (!live) return
        const hunting = huntWorldOf(view)
        setGame(view)
        // Where ENEM is hidden, a hero saved in an ENEM world stands beside its hub portal instead.
        const stranded = !showsEnem(locale) && isEnemWorld(data.position.world)
        const position = stranded ? { world: HUB_ID, ...besidePortal(worldById(HUB_ID), data.position.world) } : data.position
        setState(stranded ? { ...data, position } : data)
        setWorld(hunting ?? position.world)
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

  // Back from a hunt world: the hero stands beside its portal in the Lab. The hunt may have changed
  // its gear or look, so the hub reads the game again.
  const leave = useCallback(() => {
    const position = { world: HUB_ID, ...besidePortal(worldById(HUB_ID), world) }
    setState((current) => ({ ...current, position }))
    setWorld(HUB_ID)
    save(position).catch(() => {})
    ;(async () => {
      const view = await gameOf(await getToken())
      if (view) setGame(view)
    })().catch(() => {})
  }, [world, save, getToken])

  // A hero that never picked a look meets the creator once per visit, in the hub as in the hunt.
  const lookAsked = useRef(false)
  useEffect(() => {
    if (!game || inGame || lookAsked.current) return
    lookAsked.current = true
    if (game.hero?.lookSet === false) setLookOpen(true)
  }, [game, inGame])

  const look = game?.hero?.look ?? DEFAULT_LOOK
  const gear = useMemo(() => gearOf(game?.hero?.items), [game?.hero?.items])
  // The loading screen walks this hero next time: on the way into a hunt, or on the next visit.
  useEffect(() => {
    if (game?.hero) rememberHero(game.hero.look, gear)
  }, [game?.hero, gear])
  const saveHeroLook = useCallback(async (next) => {
    const view = await gameApi.saveLook(next)
    if (view?.hero) setGame(view)
    return view
  }, [gameApi])
  // Depois: close now and keep the look the hero has, so the creator does not ask again next visit.
  // A failed save changes nothing here: the creator stays reachable from the hunt's Hero tab.
  const lookLater = useCallback(() => {
    setLookOpen(false)
    saveHeroLook(look).catch(() => {})
  }, [look, saveHeroLook])

  return (
    <AppShell>
      <PageHeader kicker={t('world.page.kicker')} title={world ? t(`world.name.${world}`) : t('world.nav')} />
      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}
      {!state && !message && <WorldPageSkeleton />}
      {/* One study window for the hub and the hunt, so it stays open across a portal. */}
      <StudyWindowProvider>
        {state && inGame && <GameView worldId={world} api={gameApi} onLeave={leave} studyHref={studyHref({ locale, doneToday })} />}
        {/* The console the hunt plays in: the map with its status line, and the panel beside it from lg up. */}
        {state && !inGame && (
          <Frame tone="panel" className="mt-6 grid items-start gap-2 p-1.5 shadow-pixel lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-2">
            <WorldGame state={state} look={look} gear={gear} onSave={save} onWorldChange={setWorld} />
            <WorldPanel state={state} currentWorld={world} />
          </Frame>
        )}
        {lookOpen && !inGame && (
          <LookDialog look={look} gear={gear} first onSave={saveHeroLook} onClose={() => setLookOpen(false)} onLater={lookLater} />
        )}
      </StudyWindowProvider>
    </AppShell>
  )
}
