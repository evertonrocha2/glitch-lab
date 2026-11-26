import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ZONES } from '../../../shared/game/zones.js'
import { worldById } from '../../../shared/world/worlds.js'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import DPad from '../world/d-pad/d-pad.jsx'
import AwayDialog, { useCounts } from './away-dialog.jsx'
import GameHud from './hud/game-hud.jsx'
import { gearOf } from './hero/gear.js'
import GameIcon from './icons/game-icon.jsx'
import LookDialog from './look-dialog.jsx'
import GamePanel, { TAB_LOOK, TABS } from './panel/game-panel.jsx'
import { ActionButton } from './panel/panel-ui.jsx'
import TreeTab from './panel/tree-tab.jsx'
import WorldTab from './panel/world-tab.jsx'
import { replayAt } from './replay.js'
import GameScene, { fightSpot } from './scene/game-scene.jsx'
import { createWalker } from './scene/hunt-walker.js'
import { duration, HUNT_SPEED, WALK_MS } from './scene/playback.js'
import { cameraOn, directionOf } from './scene/walk.js'
import Frame from './ui/frame.jsx'
import { StudyWindowProvider, useStudyWindow } from './study-window/study-window-provider.jsx'
import { useFullscreen } from './use-fullscreen.js'
import { useReducedMotion } from './use-reduced-motion.js'

export const SYNC_MS = 60_000
// While the study window is open the View syncs this often, so new acertos show in the HUD and the
// quest card while the student answers.
export const STUDY_SYNC_MS = 20_000
const TICK_MS = 200
// The closed drawer's height when it can't be measured (handle 44 + tab row 52 + padding and frame).
const DOCK_PX = 102
const WIDE = '(min-width: 1024px)'
// The part of the map the scene shows, in tiles, per zoom level. Far shows the whole forest on a
// desktop, near is the old close-up. The HUD's - and + buttons (keys - and +) move between them.
export const ZOOMS = ['far', 'mid', 'near']
const CROP = {
  far: { wide: { w: 32, h: 20 }, narrow: { w: 16, h: 20 } },
  mid: { wide: { w: 24, h: 15 }, narrow: { w: 13, h: 16 } },
  near: { wide: { w: 16, h: 10 }, narrow: { w: 10, h: 12 } },
}
const ZOOM_KEY = 'gd:game-zoom'

// The zoom level, remembered per browser. Storage can be missing or blocked: then it is just far.
function useZoom() {
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = window.localStorage.getItem(ZOOM_KEY)
      return ZOOMS.includes(saved) ? saved : 'far'
    } catch {
      return 'far'
    }
  })
  const change = useCallback((step) => {
    setZoom((current) => {
      const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(current) + step))]
      try {
        window.localStorage.setItem(ZOOM_KEY, next)
      } catch {
        // Not remembered, still applied.
      }
      return next
    })
  }, [])
  return [zoom, change]
}

// Every panel action: the page binds each to the token; each resolves to the new View plus extras.
const ACTIONS = [
  'startHunt',
  'stopHunt',
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
  'saveLook',
]

const isConflict = (err) => err?.status === 409 || err?.code === 'GAME_CONFLICT'
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
// The View without the extras an action answers with.
const viewOf = ({ away: _away, studyClaimed: _claimed, fight: _fight, ...view }) => view

function useMediaQuery(query) {
  const read = () => {
    try {
      return window.matchMedia ? window.matchMedia(query).matches : true
    } catch {
      return true
    }
  }
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    let list = null
    try {
      list = window.matchMedia?.(query) ?? null
    } catch {
      list = null
    }
    if (!list?.addEventListener) return undefined
    const onChange = () => setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// The window of the map around the fight spot, kept inside the map.
function cropFor(world, rect, { w, h }) {
  const cols = world.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const rows = world.rows.length
  const spot = fightSpot(world, rect)
  return {
    x: clamp(Math.round(spot.hero.x + 1.5 - w / 2), 0, Math.max(0, cols - w)),
    y: clamp(Math.round(spot.hero.y + 0.5 - h / 2), 0, Math.max(0, rows - h)),
    w,
    h,
    cols,
    rows,
  }
}

// Where the map sits in the stage for a camera on the hero at pos (tiles): the map's left and top as
// percents of the crop, snapped to whole art pixels so the pixels stay crisp.
export function stageOffset(world, pos, crop) {
  const camera = cameraOn(world, pos, crop)
  const snap = (n) => Math.round(n * 16) / 16
  return { left: (-snap(camera.x) / crop.w) * 100, top: (-snap(camera.y) / crop.h) * 100 }
}

const isTyping = (target) => {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true
}
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// The zone the scene shows: the boss being fought, the hunt, else the first open zone not yet beaten.
function shownZone(view, worldId, replay) {
  if (replay) return replay.target.zone
  if (view.hero.hunt?.world === worldId) return view.hero.hunt.zone
  const list = view.zones?.[worldId]?.normal ?? []
  const open = list.filter((zone) => zone.unlocked)
  return (open.find((zone) => !zone.beaten) ?? open.at(-1) ?? list[0])?.id ?? 'z1'
}

// Layout B on /mundo for a hunt world: the lit scene with the HUD on the left, the panel on the right
// (a bottom drawer under lg). Syncs on mount, every minute while hunting and when the tab comes back;
// shows the away summary, loops the hunt's sample fights and replays a boss fight before its result.
//   worldId: the hunt world. api: the game calls bound to the token (syncGame, startHunt, stopHunt,
//   fightBoss and the panel actions), each resolving to the server answer. onLeave: back to the Lab.
//   studyHref: the study page the "Estudar" entries open, in the study window over the game.
// GameView carries its own StudyWindowProvider; a page that mounts one above it shares that one.
export default function GameView(props) {
  return (
    <StudyWindowProvider>
      <GameScreen {...props} />
    </StudyWindowProvider>
  )
}

function GameScreen({ worldId, api, onLeave, studyHref }) {
  const { t } = useI18n()
  const studyWindow = useStudyWindow()
  const studyOpen = studyWindow.isOpen
  const counts = useCounts()
  const world = worldById(worldId)
  const [view, setView] = useState(null)
  const [tab, setTab] = useState('hero')
  const [drawer, setDrawer] = useState(false)
  const [away, setAway] = useState(null)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const [replay, setReplay] = useState(null)
  const [lookOpen, setLookOpen] = useState(false)
  const wide = useMediaQuery(WIDE)
  const [zoom, changeZoom] = useZoom()
  const reduced = useReducedMotion()

  const apiRef = useRef(api)
  apiRef.current = api
  const replayRef = useRef(null)
  replayRef.current = replay
  const viewRef = useRef(null)
  viewRef.current = view
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Every server call (sync and each action) waits for the one before it, so the answers land in the
  // order the calls went out: an older hero never overwrites a newer one, and two calls never race
  // for the same hero version (which would answer a false 409).
  const queue = useRef(Promise.resolve())
  // A 409 means another tab saved the hero first: only a reload shows the real hero again.
  const guard = useCallback((call) => {
    const run = queue.current.then(async () => {
      try {
        return await call()
      } catch (err) {
        if (isConflict(err) && mounted.current) setConflict(true)
        throw err
      }
    })
    queue.current = run.catch(() => {})
    return run
  }, [])

  // At most one sync waits in the queue: asking again while one waits adds nothing.
  const syncWaiting = useRef(false)
  const sync = useCallback(async () => {
    if (replayRef.current || syncWaiting.current) return
    syncWaiting.current = true
    try {
      const res = await guard(() => {
        syncWaiting.current = false
        return apiRef.current.syncGame()
      })
      if (replayRef.current || !mounted.current) return
      setError('')
      setView(viewOf(res))
      if (res.away || res.studyClaimed)
        setAway({
          away: res.away ?? null,
          studyClaimed: res.studyClaimed ?? null,
        })
    } catch (err) {
      syncWaiting.current = false
      if (!isConflict(err) && mounted.current) setError(err?.message || String(err))
    }
  }, [guard])

  useEffect(() => {
    sync()
  }, [sync])

  const hunting = Boolean(view?.hero.hunt)
  useEffect(() => {
    if (!hunting) return undefined
    // A hidden tab waits: visibilitychange syncs when it comes back.
    const timer = setInterval(() => {
      if (!document.hidden) sync()
    }, SYNC_MS)
    return () => clearInterval(timer)
  }, [hunting, sync])

  // The study window is open: sync every 20 s (also while hunting, on top of the minute's sync; a
  // waiting sync is never doubled), and once more when it closes.
  const studied = useRef(false)
  useEffect(() => {
    if (!studyOpen) {
      if (studied.current) sync()
      studied.current = false
      return undefined
    }
    studied.current = true
    const timer = setInterval(() => {
      if (!document.hidden) sync()
    }, STUDY_SYNC_MS)
    return () => clearInterval(timer)
  }, [studyOpen, sync])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sync])

  // The boss fight plays first; the View it brought (zone beaten, potions drunk) shows with the result.
  const finish = useCallback(() => {
    const current = replayRef.current
    if (!current || current.done) return
    setReplay({ ...current, done: true })
    setView(current.next)
  }, [])

  const actions = useMemo(() => {
    const bound = {}
    for (const name of ACTIONS) {
      bound[name] = async (...args) => {
        const res = await guard(() => apiRef.current[name](...args))
        if (!mounted.current) return res
        setView(viewOf(res))
        // Mid boss replay (equipping, say), this is also the View the result must show.
        setReplay((current) => (current && !current.done ? { ...current, next: viewOf(res) } : current))
        return res
      }
    }
    bound.fightBoss = async (target) => {
      const res = await guard(() => apiRef.current.fightBoss(target))
      if (!mounted.current) return res
      setReplay({
        fight: res.fight,
        target,
        next: viewOf(res),
        before: viewRef.current,
        startedAt: Date.now(),
        done: false,
      })
      return res
    }
    return bound
  }, [guard])

  // A hero that never picked a look meets the creator once, on the first View of the visit. Later
  // syncs never reopen it, even if the look is still unset (the save behind Depois failed).
  const lookAsked = useRef(false)
  useEffect(() => {
    if (!view || lookAsked.current) return
    lookAsked.current = true
    if (view.hero.lookSet === false) setLookOpen(true)
  }, [view])

  // Depois: close now and save the look the hero has, so the creator does not ask again next visit.
  // A failed save only shows in the status line; the creator stays reachable from the Hero tab.
  const lookLater = useCallback(() => {
    setLookOpen(false)
    const look = viewRef.current?.hero.look
    actions.saveLook(look).catch((err) => {
      if (!isConflict(err) && mounted.current) setError(err?.message || String(err))
    })
  }, [actions])

  // GameScene compares playback.fights by identity: a new array would restart the fight.
  const replayFight = replay?.fight
  const gear = useMemo(() => gearOf(view?.hero.items), [view?.hero.items])
  const replayFights = useMemo(() => (replayFight ? [replayFight] : null), [replayFight])
  const samplesKey = view?.huntPreview?.samples ? JSON.stringify(view.huntPreview.samples) : ''
  const samples = useMemo(() => (samplesKey ? JSON.parse(samplesKey) : null), [samplesKey])

  // The hero walks the shown zone (presentation only: nothing goes to the server). A new zone, or the
  // reduced motion setting changing, starts a new walker at the zone's middle.
  const walkZone = view ? shownZone(view, worldId, replay) : null
  const walker = useMemo(() => {
    if (!walkZone) return null
    const rect = ZONES[worldId][walkZone].rect
    return createWalker({ world, rect, start: fightSpot(world, rect).hero, reduced })
  }, [world, worldId, walkZone, reduced])
  const walkerRef = useRef(walker)
  walkerRef.current = walker

  // Arrows and WASD walk the hero while the page itself (or the stage) has the keyboard: a focused
  // tab list, input or open dialog keeps its keys.
  useEffect(() => {
    const ours = (event) => {
      const target = event.target
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(target)) return false
      if (document.querySelector('[aria-modal="true"]')) return false
      return target === document.body || target === document.documentElement || Boolean(stageRef.current?.contains(target))
    }
    const onDown = (event) => {
      const dir = directionOf(event.key)
      if (!dir || !walkerRef.current || !ours(event)) return
      event.preventDefault()
      if (!event.repeat) walkerRef.current.press(dir, clock())
    }
    const onUp = (event) => {
      const dir = directionOf(event.key)
      if (dir) walkerRef.current?.release(dir)
    }
    const onBlur = () => walkerRef.current?.release()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // The camera follows the hero: the scene reports where it draws the hero and the map slides under
  // the stage without a React render. The last spot is kept so a render puts the map back there.
  const mapRef = useRef(null)
  const cameraRef = useRef(null)
  const cropRef = useRef(null)
  const onCamera = useCallback(
    (pos) => {
      cameraRef.current = { x: pos.x, y: pos.y }
      const node = mapRef.current
      const crop = cropRef.current
      if (!node || !crop) return
      const at = stageOffset(world, pos, crop)
      node.style.left = `${at.left}%`
      node.style.top = `${at.top}%`
    },
    [world],
  )

  // Under lg the panel is a drawer docked at the bottom. While it shows, the page learns its closed
  // height (--dock-h), so the study timer sits above it instead of under it.
  const dock = useRef(null)
  const handle = useRef(null)
  const focusTab = useRef(false)
  const docked = !wide && Boolean(view)
  useLayoutEffect(() => {
    if (!docked) return undefined
    const root = document.documentElement
    const height = dock.current?.getBoundingClientRect().height
    root.style.setProperty('--dock-h', `${Math.round(height > 0 ? height : DOCK_PX)}px`)
    return () => root.style.removeProperty('--dock-h')
  }, [docked])

  // On a phone the study sheet covers the lower 3/4: the drawer closes and the scene moves to the
  // top, so the hunt stays in sight above the page being studied.
  const stageRef = useRef(null)
  useEffect(() => {
    if (!studyOpen || wide) return
    setDrawer(false)
    stageRef.current?.scrollIntoView?.({ block: 'start' })
  }, [studyOpen, wide])

  const openTab = useCallback((id) => {
    setTab(id)
    setDrawer(true)
    focusTab.current = true
  }, [])

  // Opened on a tab, the drawer puts focus on that tab.
  useEffect(() => {
    if (!drawer || !focusTab.current) return
    focusTab.current = false
    dock.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus()
  }, [drawer])

  function onDockKey(event) {
    if (event.key !== 'Escape' || !drawer) return
    event.stopPropagation()
    setDrawer(false)
    handle.current?.focus()
  }

  if (!view) {
    return (
      <div className="mt-8 grid gap-3">
        {conflict ? (
          <Conflict t={t} />
        ) : error ? (
          <p role="alert" className="border-2 border-ink bg-white p-3 text-sm text-danger">
            {error}
          </p>
        ) : (
          <div role="status" className="grid aspect-[16/10] place-items-center border-2 border-ink bg-[#120e26] font-pixel text-sm text-[#c3b2ff]">
            {t('game.view.loading')}
          </div>
        )}
      </div>
    )
  }

  const zoneId = shownZone(view, worldId, replay)
  const zones = ZONES[worldId]
  const zoneRect = zones[zoneId].rect
  const difficulty = replay?.target.difficulty ?? view.hero.hunt?.difficulty ?? 'normal'
  const locked = (view.zones?.[worldId]?.[difficulty] ?? []).filter((zone) => !zone.unlocked && zone.id !== 'z1').map((zone) => zones[zone.id].rect)
  const crop = cropFor(world, zoneRect, wide ? CROP[zoom].wide : CROP[zoom].narrow)
  cropRef.current = crop
  const mapAt = cameraRef.current ? stageOffset(world, cameraRef.current, crop) : { left: (-crop.x / crop.w) * 100, top: (-crop.y / crop.h) * 100 }
  // The fog is soft and the padlocked door may sit outside the crop, so a small sign says it too.
  const lockedAhead = locked.length > 0
  const zoneLabel = t(`game.zone.${zones[zoneId].name}`)
  const bossName = replay ? t(`game.boss.${zones[replay.target.zone].boss}`) : ''

  const playback = replay ? { fights: replayFights, loop: false } : hunting && samples ? { fights: samples, loop: true } : undefined

  const panel = (
    <GamePanel
      view={view}
      tab={tab}
      onTab={setTab}
      actions={actions}
      studyHref={studyHref}
      treeTab={(shared) => <TreeTab {...shared} />}
      worldTab={(shared) => <WorldTab {...shared} replaying={Boolean(replay && !replay.done)} onLeave={onLeave} />}
      fill={wide}
      onEditLook={() => setLookOpen(true)}
    />
  )

  const stage = (
    <div ref={stageRef} className="flex min-w-0 flex-col gap-2">
      {conflict && <Conflict t={t} />}
      <StageFrame>
        {(fullscreen) => (
          <section
            aria-label={t('game.view.label')}
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: `${crop.w} / ${crop.h}`,
              maxWidth: fullscreen.active ? `calc(100vh * ${crop.w / crop.h})` : undefined,
            }}
          >
            <div
              ref={mapRef}
              className="absolute"
              style={{
                width: `${(crop.cols / crop.w) * 100}%`,
                left: `${mapAt.left}%`,
                top: `${mapAt.top}%`,
              }}
            >
              <GameScene
                world={world}
                zoneRect={zoneRect}
                lockedRects={locked}
                look={view.hero.look}
                gear={gear}
                playback={playback}
                walker={walker}
                onCamera={onCamera}
                level={view.level?.level}
                zoneName={`${t(`world.name.${worldId}`)}, ${zoneLabel}`}
              />
            </div>
            <StageHud
              view={view}
              replay={replay && !replay.done ? replay : null}
              samples={playback?.loop ? samples : null}
              bossName={bossName}
              onReplayEnd={finish}
              onKey={openTab}
              onFullscreen={fullscreen.toggle}
              fullscreenSupported={fullscreen.supported}
              fullscreenActive={fullscreen.active}
              zoom={zoom}
              onZoom={changeZoom}
            />
            {lockedAhead && (
              <p className="pointer-events-none absolute right-2 top-[126px] m-0 flex items-center sm:top-[100px] gap-1 border-2 border-[#0a0818] bg-[rgba(16,12,36,0.82)] px-1.5 py-1 font-pixel text-[10px] text-[#c3b2ff]">
                <GameIcon name="key" size={1} />
                <span className="sr-only sm:not-sr-only">{t('game.view.lockedAhead')}</span>
              </p>
            )}
            {replay?.done && <ResultBanner replay={replay} t={t} counts={counts} onClose={() => setReplay(null)} />}
          </section>
        )}
      </StageFrame>
      <p className="sr-only">{t('game.walk.label')}</p>
      {/* On phones a pad under the scene walks the hero (desktop has the arrows, WASD and clicks). */}
      <DPad
        className="mx-auto sm:hidden"
        onPress={(dir) => walker?.press(dir, clock())}
        onRelease={() => walker?.release()}
        onStep={(dir) => walker?.tap(dir, clock())}
      />
      <StatusLine
        t={t}
        counts={counts}
        view={view}
        replay={replay}
        bossName={bossName}
        zoneLabel={zoneLabel}
        difficulty={difficulty}
        onSkip={finish}
        error={error}
      />
    </div>
  )

  return (
    // On a phone with the study sheet open, room below lets the scene scroll up to the top.
    <div className={`mt-6 lg:pb-0 ${studyOpen && !wide ? 'pb-[75dvh]' : 'pb-16'}`}>
      {wide ? (
        // The console: scene, status line and panel in one dark frame, so the game reads as one screen.
        // The scene column sets the height; the panel fills it and scrolls its tab inside.
        <Frame tone="panel" className="grid grid-cols-[minmax(0,1fr)_400px] gap-2 p-2 shadow-pixel">
          {stage}
          <div className="relative min-h-[440px]">
            <div className="absolute inset-0 flex">{panel}</div>
          </div>
        </Frame>
      ) : (
        <>
          <Frame tone="panel" className="p-1.5 shadow-pixel">
            {stage}
          </Frame>
          <Frame
            tone="panel"
            ref={dock}
            onKeyDown={onDockKey}
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col px-1.5 pb-1.5 shadow-[0_-4px_0_rgba(5,4,12,.45)]"
          >
            <button
              ref={handle}
              type="button"
              aria-expanded={drawer}
              aria-label={drawer ? t('game.view.closePanel') : t('game.view.openPanel')}
              onClick={() => setDrawer((open) => !open)}
              className="flex min-h-11 cursor-pointer items-center justify-center gap-2.5 font-pixel text-[11px] uppercase tracking-[0.08em] text-[#a89fd0] hover:text-white focus-visible:rounded-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#f2c14e]"
            >
              <Chevron up={!drawer} />
              {t('game.view.panel')}
              <Chevron up={!drawer} />
            </button>
            {drawer ? (
              <div className="gw-scroll min-h-0 overflow-y-auto pt-1.5">{panel}</div>
            ) : (
              // Closed, the drawer still offers the tabs: one tap opens it on that tab.
              <div className="grid grid-cols-5 gap-1">
                {TABS.map(({ id, icon }) => (
                  <Frame as="button" tone="inset" key={id} type="button" onClick={() => openTab(id)} className={`${TAB_LOOK} text-[#a89fd0] hover:text-[#e9e4ff]`}>
                    <GameIcon name={icon} size={1} />
                    <span className="max-w-full truncate leading-[1.35]">{t(`game.tab.${id}`)}</span>
                  </Frame>
                ))}
              </div>
            )}
          </Frame>
        </>
      )}

      {lookOpen && (
        <LookDialog
          look={view.hero.look}
          gear={gear}
          first={view.hero.lookSet === false}
          onSave={actions.saveLook}
          onClose={() => setLookOpen(false)}
          onLater={lookLater}
        />
      )}
      {away && !lookOpen && (
        <AwayDialog
          away={away.away}
          studyClaimed={away.studyClaimed}
          onClose={() => setAway(null)}
          onStudy={() => {
            setAway(null)
            studyWindow.open(studyHref)
          }}
        />
      )}
    </div>
  )
}

// The HUD with its own clock, so the page around it doesn't redraw every tick. During a boss replay it
// reads the fight log at the playback's time (bars, boss bar, cooldowns, log) and calls onReplayEnd
// when the fight is over; during a hunt it follows the looping sample fights the same way.
function StageHud({ view, replay, samples, bossName, onReplayEnd, ...hud }) {
  const [now, setNow] = useState(() => Date.now())
  // The loop restarts when a new samples array arrives, as GameScene's does.
  const loop = useRef({ samples: null, start: 0 })
  if (loop.current.samples !== samples) loop.current = { samples, start: Date.now() }
  const ticking = Boolean(replay || samples)

  useEffect(() => {
    if (!ticking) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [ticking])

  const fightMs = replay ? now - replay.startedAt - WALK_MS : 0
  const over = Boolean(replay) && fightMs >= duration(replay.fight)
  useEffect(() => {
    if (over) onReplayEnd()
  }, [over, onReplayEnd])

  let live = null
  let boss
  if (replay) {
    if (fightMs >= 0) {
      live = replayAt(replay.fight, fightMs, { stats: view.stats })
      boss = { name: bossName, ...live.boss }
    }
  } else if (samples?.length) {
    const at = loopAt(samples, now - loop.current.start)
    if (at) live = replayAt(at.fight, at.ms, { stats: view.stats })
  }
  return <GameHud view={view} live={live ?? undefined} boss={boss} log={live?.log ?? []} {...hud} />
}

// Where the hunt loop is `ms` in, as GameScene lays it out: a walk, then each fight at HUNT_SPEED.
// null while walking; else the fight and the time into its log.
function loopAt(fights, ms) {
  const runs = []
  let total = 0
  for (const fight of fights) {
    const start = total + WALK_MS
    const len = duration(fight, { speed: HUNT_SPEED })
    runs.push({ fight, start, len })
    total = start + len
  }
  if (total <= 0) return null
  const t = ms % total
  const run = runs.find((r) => t < r.start + r.len) ?? runs.at(-1)
  if (t < run.start) return null
  return { fight: run.fight, ms: (t - run.start) * HUNT_SPEED }
}

// The box that goes fullscreen. It mounts with the loaded scene, so useFullscreen finds its element.
function StageFrame({ children }) {
  const ref = useRef(null)
  const fullscreen = useFullscreen(ref)
  return (
    <div ref={ref} className="relative flex items-center justify-center border-2 border-[#120c22] bg-[#05040c] shadow-[-2px_-2px_0_#0a0818,2px_2px_0_#3e3170]">
      {children(fullscreen)}
    </div>
  )
}

function Conflict({ t }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-[#2e0f1a] p-2 font-mono text-xs text-[#ffd3d9]">
      <span>{t('game.view.conflict')}</span>
      <ActionButton tone="gold" onClick={() => window.location.reload()}>
        {t('game.view.reload')}
      </ActionButton>
    </div>
  )
}

// Under the scene: what the hero is doing (and the hunt so far), or the boss fight with its skip button.
function StatusLine({ t, counts, view, replay, bossName, zoneLabel, difficulty, onSkip, error }) {
  const preview = view.huntPreview
  let text = t('game.view.idle')
  if (replay && !replay.done) text = t('game.view.fighting', { boss: bossName })
  else if (view.hero.hunt)
    text = t('game.view.hunting', {
      zone: zoneLabel,
      difficulty: t(`game.diff.${difficulty}`),
    })
  const list = preview
    ? counts.list([
        ['kills', preview.kills],
        ['gold', preview.gold],
      ])
    : ''
  return (
    <Frame tone="inset" className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-3 py-1.5 font-mono text-xs text-[#e9e4ff]">
      <p className="m-0">
        <b className="font-pixel text-[12px] font-normal text-white">{text}</b>
        {!replay && view.hero.hunt && preview && list && (
          <span className="ml-2 text-[#a89fd0]">
            {t('game.view.preview', {
              time: counts.time(preview.elapsedMs),
              list,
            })}
          </span>
        )}
        {error && <span className="ml-2 text-[#ff9aa6]">{error}</span>}
      </p>
      {replay && !replay.done && <ActionButton onClick={onSkip}>{t('game.view.skip')}</ActionButton>}
    </Frame>
  )
}

// The boss fight's outcome over the scene: the win (and what opened, or the loot), or why it was lost.
function ResultBanner({ replay, t, counts, onClose }) {
  const { fight, target, next, before } = replay
  const zones = next.zones?.[target.world]?.[target.difficulty] ?? []
  const at = zones.findIndex((zone) => zone.id === target.zone)
  const wasBeaten = before?.zones?.[target.world]?.[target.difficulty]?.[at]?.beaten ?? false
  const following = zones[at + 1]
  const boss = ZONES[target.world][target.zone].boss
  const lines = []
  if (fight.won) {
    let headline = t(`game.result.win.${boss}`)
    if (!wasBeaten && following) {
      headline += following.unlocked ? ` ${t('game.result.opened', { n: at + 2 })}` : ` ${t('game.result.opensAt', { n: at + 2, level: following.minLevel })}`
    }
    lines.push(headline)
    const loot = counts.list([
      ['items', fight.loot?.items ?? 0],
      ['gems', fight.loot?.gems ?? 0],
      ['scrap', fight.loot?.scrap ?? 0],
    ])
    lines.push(loot ? t('game.result.loot', { list: loot }) : t('game.result.again'))
  } else {
    let line = t('game.result.lose', {
      reason: t(`game.result.${fight.reason}`),
    })
    if (fight.loot?.goldLost > 0) line += `. ${t('game.result.goldLost', { n: counts.fmt.format(fight.loot.goldLost) })}`
    lines.push(line)
  }
  return (
    <output className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 border-2 border-[#0a0818] bg-[rgba(16,12,36,0.92)] p-3 text-center font-pixel text-white shadow-[inset_0_0_0_1px_rgba(160,130,255,0.35)]">
      {lines.map((line, i) => (
        <p key={line} className={`m-0 ${i === 0 ? `text-sm font-bold ${fight.won ? 'text-[#ffd76a]' : 'text-[#ff9aa6]'}` : 'text-xs text-[#c3b2ff]'}`}>
          {line}
        </p>
      ))}
      <ActionButton tone="gold" onClick={onClose}>
        {t('game.result.close')}
      </ActionButton>
    </output>
  )
}

// A pixel chevron for the drawer handle: five 2px squares, pointing up (opens) or down (closes).
function Chevron({ up }) {
  const y = up ? -1 : 1
  const dots = [
    [2, 2 * y],
    [4, 4 * y],
    [6, 2 * y],
    [8, 0],
  ]
  const shadow = dots.map(([x, dy]) => `${x}px ${dy}px 0 currentColor`).join(', ')
  return <i aria-hidden="true" className={`mr-2 block size-0.5 bg-current ${up ? 'translate-y-0.5' : '-translate-y-0.5'}`} style={{ boxShadow: shadow }} />
}
