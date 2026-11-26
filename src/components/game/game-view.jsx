import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ZONES } from '../../../shared/game/zones.js'
import { worldById } from '../../../shared/world/worlds.js'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import AwayDialog, { useCounts } from './away-dialog.jsx'
import GameHud from './hud/game-hud.jsx'
import GameIcon from './icons/game-icon.jsx'
import GamePanel, { TABS } from './panel/game-panel.jsx'
import { ActionButton } from './panel/panel-ui.jsx'
import TreeTab from './panel/tree-tab.jsx'
import WorldTab from './panel/world-tab.jsx'
import { replayAt } from './replay.js'
import GameScene, { fightSpot } from './scene/game-scene.jsx'
import { duration, HUNT_SPEED, WALK_MS } from './scene/playback.js'
import { useFullscreen } from './use-fullscreen.js'

export const SYNC_MS = 60_000
const TICK_MS = 200
const WIDE = '(min-width: 1024px)'
// The part of the map the scene shows, in tiles: actors and numbers stay readable at panel width.
const CROP = { wide: { w: 16, h: 10 }, narrow: { w: 10, h: 12 } }

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
//   studyHref: where the study box links.
export default function GameView({ worldId, api, onLeave, studyHref }) {
  const { t } = useI18n()
  const counts = useCounts()
  const world = worldById(worldId)
  const [view, setView] = useState(null)
  const [tab, setTab] = useState('hero')
  const [drawer, setDrawer] = useState(false)
  const [away, setAway] = useState(null)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const [replay, setReplay] = useState(null)
  const wide = useMediaQuery(WIDE)

  const apiRef = useRef(api)
  apiRef.current = api
  const replayRef = useRef(null)
  replayRef.current = replay
  const viewRef = useRef(null)
  viewRef.current = view

  // A 409 means another tab saved the hero first: only a reload shows the real hero again.
  const guard = useCallback(async (call) => {
    try {
      return await call()
    } catch (err) {
      if (isConflict(err)) setConflict(true)
      throw err
    }
  }, [])

  const sync = useCallback(async () => {
    if (replayRef.current) return
    try {
      const res = await guard(() => apiRef.current.syncGame())
      if (replayRef.current) return
      setError('')
      setView(viewOf(res))
      if (res.away || res.studyClaimed)
        setAway({
          away: res.away ?? null,
          studyClaimed: res.studyClaimed ?? null,
        })
    } catch (err) {
      if (!isConflict(err)) setError(err?.message || String(err))
    }
  }, [guard])

  useEffect(() => {
    sync()
  }, [sync])

  const hunting = Boolean(view?.hero.hunt)
  useEffect(() => {
    if (!hunting) return undefined
    const timer = setInterval(sync, SYNC_MS)
    return () => clearInterval(timer)
  }, [hunting, sync])

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
        setView(viewOf(res))
        // Mid boss replay (equipping, say), this is also the View the result must show.
        setReplay((current) => (current && !current.done ? { ...current, next: viewOf(res) } : current))
        return res
      }
    }
    bound.fightBoss = async (target) => {
      const res = await guard(() => apiRef.current.fightBoss(target))
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

  // GameScene compares playback.fights by identity: a new array would restart the fight.
  const replayFight = replay?.fight
  const replayFights = useMemo(() => (replayFight ? [replayFight] : null), [replayFight])
  const samplesKey = view?.huntPreview?.samples ? JSON.stringify(view.huntPreview.samples) : ''
  const samples = useMemo(() => (samplesKey ? JSON.parse(samplesKey) : null), [samplesKey])

  const openTab = useCallback((id) => {
    setTab(id)
    setDrawer(true)
  }, [])

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
  const crop = cropFor(world, zoneRect, wide ? CROP.wide : CROP.narrow)
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
    />
  )

  return (
    <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-2">
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
                className="absolute"
                style={{
                  width: `${(crop.cols / crop.w) * 100}%`,
                  left: `${(-crop.x / crop.w) * 100}%`,
                  top: `${(-crop.y / crop.h) * 100}%`,
                }}
              >
                <GameScene
                  world={world}
                  zoneRect={zoneRect}
                  lockedRects={locked}
                  look={view.hero.look}
                  playback={playback}
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

      {wide ? (
        panel
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col border-t-[3px] border-[#0a0818] bg-[#120e26] shadow-[0_-4px_0_rgba(0,0,0,.35)]">
          <button
            type="button"
            aria-expanded={drawer}
            aria-label={drawer ? t('game.view.closePanel') : t('game.view.openPanel')}
            onClick={() => setDrawer((open) => !open)}
            className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 bg-[#1a1433] font-pixel text-[11px] text-[#c3b2ff]"
          >
            <i aria-hidden="true" className="block h-1 w-10 bg-[#4a4266]" />
            {t('game.view.panel')}
          </button>
          {drawer ? (
            <div className="min-h-0 overflow-y-auto">{panel}</div>
          ) : (
            // Closed, the drawer still offers the tabs: one tap opens it on that tab.
            <div className="grid grid-cols-5 gap-1 px-1.5 pb-2 font-mono">
              {TABS.map(({ id, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openTab(id)}
                  className="flex min-h-11 cursor-pointer flex-col items-center justify-center border-2 border-[#2e2650] bg-[#1e1838] text-[10px] text-[#b9b0de]"
                >
                  <GameIcon name={icon} size={1} />
                  {t(`game.tab.${id}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {away && <AwayDialog away={away.away} studyClaimed={away.studyClaimed} onClose={() => setAway(null)} />}
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
    <div ref={ref} className="relative flex items-center justify-center border-2 border-ink bg-[#05040c] shadow-pixel">
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
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 font-mono text-xs text-ink">
      <p className="m-0">
        <b>{text}</b>
        {!replay && view.hero.hunt && preview && list && (
          <span className="ml-2 text-muted">
            {t('game.view.preview', {
              time: counts.time(preview.elapsedMs),
              list,
            })}
          </span>
        )}
        {error && <span className="ml-2 text-danger">{error}</span>}
      </p>
      {replay && !replay.done && <ActionButton onClick={onSkip}>{t('game.view.skip')}</ActionButton>}
    </div>
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
