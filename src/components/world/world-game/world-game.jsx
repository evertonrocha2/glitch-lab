import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { topicById } from '../../../../shared/exams/catalog.js'
import { ENEM } from '../../../../shared/exams/enem.js'
import { canEnter, pathTo, portalAt, terminalNear, tileAt, zoneAt } from '../../../../shared/world/map.js'
import { isSolid } from '../../../../shared/world/tiles.js'
import { openZones } from '../../../../shared/world/unlocks.js'
import { worldById } from '../../../../shared/world/worlds.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import { viewportFor } from '../camera.js'
import DPad from '../d-pad/d-pad.jsx'
import TileMap from '../tile-map/tile-map.jsx'

// About 8 steps a second while a key, a pad button or a click path keeps the hero walking.
export const STEP_MS = 125
// A walk is saved at most this often; changing worlds and opening a terminal save right away.
export const SAVE_DELAY_MS = 5000

const DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
const directionOf = (key) => KEYS[key] ?? KEYS[key.toLowerCase()] ?? null
const directionBetween = (from, to) => Object.keys(DIRECTIONS).find((dir) => from.x + DIRECTIONS[dir].x === to.x && from.y + DIRECTIONS[dir].y === to.y) ?? null

const areaName = (id) => ENEM.areas.find((area) => area.id === id)?.shortName ?? id

// Where a terminal takes the student.
const PAGES = { daily: '/daily', glitchdle: '/glitchdle', hunt: '/hunt' }
const terminalHref = (terminal) => (terminal.kind === 'topic' ? `/exams/enem/${terminal.topicId}` : PAGES[terminal.kind])
const PAGE_NAMES = { daily: 'app.nav.daily', glitchdle: 'app.nav.glitchdle', hunt: 'hunt.title' }

// Where to go to open a lock: ENEM practice for right answers, the daily puzzle for programming.
const studyHref = (requirement) => (requirement.signal === 'enemCorrect' ? '/exams/enem' : '/daily')

// The hero walking a Glitch World map. state is GET /api/world ({ worlds, zones, position }): what's open
// comes from the server, the walking happens here. onSave(position, { keepalive }) keeps the place to
// come back to (its failures are ignored: the game goes on); onWorldChange(worldId) follows portals.
export default function WorldGame({ state, heroColor, onSave, onWorldChange }) {
  const t = useT()
  const navigate = useNavigate()
  const helpId = useId()
  const frameRef = useRef(null)
  const [hero, setHero] = useState(() => ({ ...state.position, facing: 'down', frame: 0 }))
  // What the hero just ran into: { kind: 'locked', lock } or { kind: 'travel', world }.
  const [notice, setNotice] = useState(null)
  const [viewport, setViewport] = useState(() => viewportFor(720))

  // The walking runs on timers, so it reads the latest values through refs.
  const heroRef = useRef(hero)
  const stateRef = useRef(state)
  const saveRef = useRef(onSave)
  const worldChangeRef = useRef(onWorldChange)
  const timers = useRef({ repeat: null, walk: null, save: null })
  const held = useRef(null)
  const path = useRef([])
  useEffect(() => {
    stateRef.current = state
    saveRef.current = onSave
    worldChangeRef.current = onWorldChange
  })

  const persist = useCallback((keepalive) => {
    const { world, x, y } = heroRef.current
    return Promise.resolve(saveRef.current({ world, x, y }, { keepalive })).catch(() => {})
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
      const world = worldById(current.world)
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
      const found = pathTo(worldById(current.world), current, { x, y }, openZones(stateRef.current, current.world))
      if (!found?.length) return
      path.current = found
      const next = () => {
        const target = path.current.shift()
        const dir = target && directionBetween(heroRef.current, target)
        if (!dir || !step(dir) || path.current.length === 0) stopPath()
      }
      next()
      if (path.current.length > 0) timers.current.walk = setInterval(next, STEP_MS)
    },
    [release, step, stopPath],
  )

  const terminal = terminalNear(worldById(hero.world), hero.x, hero.y)

  const openTerminal = useCallback(async () => {
    const current = heroRef.current
    const found = terminalNear(worldById(current.world), current.x, current.y)
    if (!found) return
    release()
    stopPath()
    await saveNow()
    navigate(terminalHref(found))
  }, [navigate, release, saveNow, stopPath])

  // Stop every timer when the game goes away, and keep the last tile if a save was still waiting.
  useEffect(() => {
    const pending = timers.current
    return () => {
      clearInterval(pending.repeat)
      clearInterval(pending.walk)
      if (pending.save) {
        clearTimeout(pending.save)
        pending.save = null
        persist(true)
      }
    }
  }, [persist])

  // As many tiles as fit the map's frame.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = viewportFor(entry.contentRect.width)
      setViewport((current) => (current.cols === next.cols && current.rows === next.rows ? current : next))
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  function onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Enter') {
      if (terminal) {
        event.preventDefault()
        openTerminal()
      }
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

  const world = worldById(hero.world)
  const worldName = t(`world.name.${hero.world}`)
  const lockedZones = new Set(world.zones.map((zone) => zone.id).filter((id) => !openZones(state, hero.world).has(id)))
  const progressOf = ({ requirement, have, need }) =>
    t(`world.need.${requirement.signal}`, { have, need, area: requirement.area ? areaName(requirement.area) : '' })
  const terminalLabel =
    terminal &&
    (terminal.kind === 'topic'
      ? t('world.terminal.topic', { name: topicById('enem', terminal.topicId)?.name ?? terminal.topicId })
      : t('world.terminal.page', { name: t(PAGE_NAMES[terminal.kind]) }))

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={frameRef}
        role="application"
        tabIndex={0}
        aria-label={t('world.map.label', { world: worldName })}
        aria-describedby={helpId}
        data-place={`${hero.world} ${hero.x} ${hero.y}`}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => release()}
        className="w-full overflow-hidden border-2 border-ink bg-ink shadow-pixel"
      >
        <TileMap
          world={world}
          hero={hero}
          heroColor={heroColor}
          lockedZones={lockedZones}
          viewport={viewport}
          onTileClick={(x, y) => {
            frameRef.current?.focus({ preventScroll: true })
            walkTo(x, y)
          }}
        />
      </div>
      <p id={helpId} className="text-sm text-muted">
        {t('world.map.help')}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Always there, so screen readers hear what changes in it. Its height is kept so nothing jumps. */}
        <div role="status" className="min-h-10 min-w-0 flex-1">
          {notice?.kind === 'locked' && notice.lock && (
            <p>
              {t('world.locked', { progress: progressOf(notice.lock) })}{' '}
              <Link to={studyHref(notice.lock.requirement)} className="font-label text-secondary underline underline-offset-4">
                {t('world.locked.study')}
              </Link>
            </p>
          )}
          {notice?.kind === 'travel' && <p>{t('world.announce.travel', { world: t(`world.name.${notice.world}`) })}</p>}
        </div>
        {terminal && (
          <PixelButton variant="secondary" onClick={openTerminal}>
            {terminalLabel}
            <kbd className="border border-white/60 px-1 font-mono text-[10px]">Enter</kbd>
          </PixelButton>
        )}
      </div>
      <DPad className="mx-auto sm:hidden" onPress={press} onRelease={() => release()} onStep={step} />
    </div>
  )
}
