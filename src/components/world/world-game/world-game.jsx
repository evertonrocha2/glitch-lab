import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { topicById } from '../../../../shared/exams/catalog.js'
import { canEnter, pathTo, portalAt, terminalNear, tileAt, zoneAt } from '../../../../shared/world/map.js'
import { isSolid } from '../../../../shared/world/tiles.js'
import { openZones } from '../../../../shared/world/unlocks.js'
import { worldById } from '../../../../shared/world/worlds.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { ActionButton } from '../../game/panel/panel-ui.jsx'
import { useStudyWindow } from '../../game/study-window/study-window-provider.jsx'
import Frame, { Chip } from '../../game/ui/frame.jsx'
import DPad from '../d-pad/d-pad.jsx'
import { visibleWorld } from '../enem-worlds.js'
import HubScene from '../hub-scene/hub-scene.jsx'
import { useHubZoom, useMediaQuery, useStageBox } from '../hub-scene/hub-hooks.js'
import { cropFor, fitCrop, lockedPortals, lockedRects, STEP_MS } from '../hub-scene/hub-view.js'
import { progressText, studyHref } from '../requirement-text.js'

export { STEP_MS }
// A walk is saved at most this often; changing worlds and opening a terminal save right away.
export const SAVE_DELAY_MS = 5000

const DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
const directionOf = (key) => KEYS[key] ?? KEYS[key.toLowerCase()] ?? null
// The stage is desktop-sized from lg up, as the hunt's.
const WIDE = '(min-width: 1024px)'
const directionBetween = (from, to) => Object.keys(DIRECTIONS).find((dir) => from.x + DIRECTIONS[dir].x === to.x && from.y + DIRECTIONS[dir].y === to.y) ?? null

// Where a terminal takes the student.
const PAGES = { daily: '/daily', glitchdle: '/glitchdle', hunt: '/hunt' }
const terminalHref = (terminal) => (terminal.kind === 'topic' ? `/exams/enem/${terminal.topicId}` : PAGES[terminal.kind])
const PAGE_NAMES = { daily: 'app.nav.daily', glitchdle: 'app.nav.glitchdle', hunt: 'hunt.title' }

// The hero walking a Glitch World map, drawn like the hunt (hub-scene.jsx). state is GET /api/world
// ({ worlds, zones, position }): what's open comes from the server, the walking happens here.
// look, gear: the hero's look and gearOf(items), from the game View. onSave(position, { keepalive })
// keeps the place to come back to (its failures are ignored: the game goes on); onWorldChange(worldId)
// follows portals.
export default function WorldGame({ state, look, gear, onSave, onWorldChange }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  // The study window over the game, when the page has one; else a terminal leaves for its page.
  const studyWindow = useStudyWindow()
  const helpId = useId()
  const mapRef = useRef(null)
  const stageRef = useRef(null)
  const [hero, setHero] = useState(() => ({ ...state.position, facing: 'down', frame: 0 }))
  // What the hero just ran into: { kind: 'locked', lock } or { kind: 'travel', world }.
  const [notice, setNotice] = useState(null)
  const [zoom, changeZoom] = useHubZoom()
  const wide = useMediaQuery(WIDE)
  const box = useStageBox(stageRef)

  // The walking runs on timers, so it reads the latest values through refs.
  const heroRef = useRef(hero)
  const stateRef = useRef(state)
  const saveRef = useRef(onSave)
  const worldChangeRef = useRef(onWorldChange)
  const timers = useRef({ repeat: null, walk: null, save: null })
  const held = useRef(null)
  const path = useRef([])
  // Saves go out one after another, so an older one can never land after a newer one.
  const saving = useRef(Promise.resolve())
  const inFlight = useRef(0)
  // A terminal opens once, and only while the game is still on screen.
  const opening = useRef(false)
  const mounted = useRef(true)
  // The map as this locale sees it: outside pt-BR the ENEM portals are plain floor.
  const localeRef = useRef(locale)
  const mapOf = useCallback((id) => visibleWorld(worldById(id), localeRef.current), [])
  useEffect(() => {
    stateRef.current = state
    saveRef.current = onSave
    worldChangeRef.current = onWorldChange
    localeRef.current = locale
  })

  // keepalive saves are the page going away: they go out right now instead of waiting their turn.
  const persist = useCallback((keepalive) => {
    const { world, x, y } = heroRef.current
    const send = () => Promise.resolve(saveRef.current({ world, x, y }, { keepalive })).catch(() => {})
    if (keepalive) return send()
    const run = () => {
      inFlight.current++
      return send().finally(() => inFlight.current--)
    }
    // Nothing out: go now. Otherwise wait for the saves still out.
    saving.current = inFlight.current === 0 ? run() : saving.current.then(run)
    return saving.current
  }, [])

  const saveNow = useCallback(() => {
    clearTimeout(timers.current.save)
    timers.current.save = null
    return persist(false)
  }, [persist])

  const saveSoon = useCallback(() => {
    if (timers.current.save) return
    timers.current.save = setTimeout(() => {
      timers.current.save = null
      persist(false)
    }, SAVE_DELAY_MS)
  }, [persist])

  const place = useCallback((next) => {
    heroRef.current = next
    setHero(next)
  }, [])

  const stopPath = useCallback(() => {
    clearInterval(timers.current.walk)
    timers.current.walk = null
    path.current = []
  }, [])

  const release = useCallback((dir) => {
    if (dir && held.current !== dir) return
    held.current = null
    clearInterval(timers.current.repeat)
    timers.current.repeat = null
  }, [])

  const travel = useCallback(
    (portal) => {
      const lock = stateRef.current.worlds.find((world) => world.id === portal.to)
      if (!lock?.unlocked) {
        setNotice({ kind: 'locked', lock })
        saveSoon()
        return
      }
      release()
      stopPath()
      place({ world: portal.to, ...portal.at, facing: heroRef.current.facing, frame: 0 })
      setNotice({ kind: 'travel', world: portal.to })
      worldChangeRef.current?.(portal.to)
      saveNow()
    },
    [place, release, saveNow, saveSoon, stopPath],
  )

  // One tile in a direction. false when something is in the way.
  const step = useCallback(
    (dir) => {
      const current = heroRef.current
      const world = mapOf(current.world)
      const open = openZones(stateRef.current, current.world)
      const x = current.x + DIRECTIONS[dir].x
      const y = current.y + DIRECTIONS[dir].y
      if (!canEnter(world, x, y, open)) {
        if (current.facing !== dir) place({ ...current, facing: dir })
        const zone = zoneAt(world, x, y)
        if (zone && !open.has(zone.id) && !isSolid(tileAt(world, x, y))) {
          setNotice({ kind: 'locked', lock: stateRef.current.zones[world.id].find((item) => item.id === zone.id) })
        }
        return false
      }
      place({ world: current.world, x, y, facing: dir, frame: 1 - current.frame })
      setNotice(null)
      const portal = portalAt(world, x, y)
      if (portal) travel(portal)
      else saveSoon()
      return true
    },
    [place, saveSoon, travel],
  )

  const press = useCallback(
    (dir) => {
      stopPath()
      release()
      held.current = dir
      step(dir)
      timers.current.repeat = setInterval(() => held.current && step(held.current), STEP_MS)
    },
    [release, step, stopPath],
  )

  const walkTo = useCallback(
    (x, y) => {
      release()
      stopPath()
      const current = heroRef.current
      const found = pathTo(mapOf(current.world), current, { x, y }, openZones(stateRef.current, current.world))
      if (!found) return
      // Next to a tile it can't stand on (a terminal, a locked door), the hero turns to it, bumping
      // into it: that picks the clicked terminal and says what a locked door asks for.
      const arrive = () => {
        const here = heroRef.current
        const dir = here.world === current.world && directionBetween(here, { x, y })
        if (dir) step(dir)
      }
      path.current = found
      const next = () => {
        const target = path.current.shift()
        const dir = target && directionBetween(heroRef.current, target)
        if (!dir || !step(dir)) return stopPath()
        if (path.current.length === 0) {
          stopPath()
          arrive()
        }
      }
      if (found.length === 0) return arrive()
      next()
      if (path.current.length > 0) timers.current.walk = setInterval(next, STEP_MS)
    },
    [release, step, stopPath],
  )

  const terminal = terminalNear(visibleWorld(worldById(hero.world), locale), hero.x, hero.y, hero.facing)

  const openTerminal = useCallback(async () => {
    const current = heroRef.current
    const found = terminalNear(mapOf(current.world), current.x, current.y, current.facing)
    if (!found || opening.current) return
    opening.current = true
    release()
    stopPath()
    await saveNow()
    opening.current = false
    // The player may have gone somewhere else while the save was out.
    if (!mounted.current) return
    if (studyWindow) studyWindow.open(terminalHref(found))
    else navigate(terminalHref(found))
  }, [navigate, release, saveNow, stopPath, studyWindow])

  // Stop every timer when the game goes away, and keep the last tile if a save was still waiting.
  // Closing the tab or the app doesn't unmount anything: pagehide is the last word the page gets.
  useEffect(() => {
    const pending = timers.current
    const flush = () => {
      if (!pending.save) return
      clearTimeout(pending.save)
      pending.save = null
      persist(true)
    }
    mounted.current = true
    window.addEventListener('pagehide', flush)
    return () => {
      mounted.current = false
      window.removeEventListener('pagehide', flush)
      clearInterval(pending.repeat)
      clearInterval(pending.walk)
      flush()
    }
  }, [persist])

  function onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Enter') {
      if (terminal && !event.repeat) {
        event.preventDefault()
        openTerminal()
      }
      return
    }
    // - and + (or =) move the camera, as in the hunt.
    if (event.key === '-' || event.key === '+' || event.key === '=') {
      event.preventDefault()
      if (!event.repeat) changeZoom(event.key === '-' ? -1 : 1)
      return
    }
    const dir = directionOf(event.key)
    if (!dir) return
    event.preventDefault()
    if (!event.repeat) press(dir)
  }

  function onKeyUp(event) {
    const dir = directionOf(event.key)
    if (dir) release(dir)
  }

  const world = visibleWorld(worldById(hero.world), locale)
  const worldName = t(`world.name.${hero.world}`)
  const open = openZones(state, hero.world)
  // The zoom's crop, widened to fill the stage at the tile size its height allows.
  const fit = fitCrop(world, zoom, cropFor(world, zoom, wide), box)
  const crop = { w: fit.w, h: fit.h }
  const terminalLabel =
    terminal &&
    (terminal.kind === 'topic'
      ? t('world.terminal.topic', { name: topicById('enem', terminal.topicId)?.name ?? terminal.topicId })
      : t('world.terminal.page', { name: t(PAGE_NAMES[terminal.kind]) }))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative flex flex-col gap-2">
        {/* The dark stage the hunt draws in. */}
        <div ref={stageRef} className="relative flex items-center justify-center border-2 border-[#120c22] bg-[#05040c] shadow-[-2px_-2px_0_#0a0818,2px_2px_0_#3e3170]">
          <div
            ref={mapRef}
            role="application"
            tabIndex={0}
            aria-label={t('world.map.label', { world: worldName })}
            aria-describedby={helpId}
            data-place={`${hero.world} ${hero.x} ${hero.y}`}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onBlur={() => release()}
            className="w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#f2c14e]"
            style={{ maxWidth: fit.tile ? `${Math.floor(fit.tile * fit.w)}px` : `${crop.w * 48}px` }}
          >
            <HubScene
              world={world}
              hero={hero}
              look={look}
              gear={gear}
              crop={crop}
              lockedRects={lockedRects(world, open)}
              lockedPortals={lockedPortals(world, state)}
              onTileClick={(x, y) => {
                mapRef.current?.focus({ preventScroll: true })
                walkTo(x, y)
              }}
            />
          </div>
        </div>
        {/* On phones the pad and the zoom sit right under the map (above the study timer at the bottom of
            the screen), so nothing covers the map; from sm up the zoom floats in the stage's corner. */}
        <div className="flex items-center justify-center gap-6 sm:contents">
          <DPad className="sm:hidden" onPress={press} onRelease={() => release()} onStep={step} />
          <div className="flex flex-col gap-1 sm:absolute sm:bottom-2 sm:right-2">
            <ZoomButton label={t('game.hud.zoomIn')} disabled={zoom === 'near'} onClick={() => changeZoom(1)}>
              +
            </ZoomButton>
            <ZoomButton label={t('game.hud.zoomOut')} disabled={zoom === 'far'} onClick={() => changeZoom(-1)}>
              -
            </ZoomButton>
          </div>
        </div>
      </div>
      <Frame tone="inset" className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 font-mono text-xs text-[#e9e4ff]">
        <div className="min-w-0 flex-1 leading-relaxed">
          {/* Always there, so screen readers hear what changes in it. */}
          <div role="status">
            {notice?.kind === 'locked' && notice.lock && (
              <p className="m-0">
                {t('world.locked', { progress: progressText(t, notice.lock) })}{' '}
                <Link to={studyHref(notice.lock.requirement)} className="font-pixel text-[11px] text-[#f2c14e] underline underline-offset-4 hover:text-[#ffd76a]">
                  {t('world.locked.study')}
                </Link>
              </p>
            )}
            {notice?.kind === 'travel' && <p className="m-0 font-pixel text-[12px] text-white">{t('world.announce.travel', { world: t(`world.name.${notice.world}`) })}</p>}
          </div>
          {/* How to play: in the status line while nothing happens, always the map's description. */}
          <p id={helpId} className={notice ? 'sr-only' : 'm-0 text-[#a89fd0]'}>
            {t('world.map.help')}
          </p>
        </div>
        {terminal && (
          <ActionButton tone="gold" onClick={openTerminal}>
            <span className="inline-flex items-center gap-2">
              {terminalLabel}
              <Chip tone="ink">Enter</Chip>
            </span>
          </ActionButton>
        )}
      </Frame>
    </div>
  )
}

// One camera zoom step, as the hunt's HUD draws it: a raised pixel button with a big - or +.
function ZoomButton({ label, disabled, onClick, children }) {
  return (
    <Frame
      as="button"
      tone="raised"
      type="button"
      // aria-disabled, not disabled: the button keeps keyboard focus when it reaches the limit.
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      aria-label={label}
      className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center font-pixel text-base text-[#e9e4ff] aria-disabled:cursor-default aria-disabled:opacity-40"
    >
      <span aria-hidden="true">{children}</span>
    </Frame>
  )
}
