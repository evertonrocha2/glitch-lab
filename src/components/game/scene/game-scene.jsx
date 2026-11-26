import { useEffect, useRef } from 'react'
import { ZONES } from '../../../../shared/game/zones.js'
import { isSolid } from '../../../../shared/world/tiles.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { SPRITE } from '../hero/draw-hero.js'
import { heroSprite } from '../hero/hero-cache.js'
import { useReducedMotion } from '../use-reduced-motion.js'
import { drawFoe, drawHealthBar, enemyLight, foeColors, foeHeight, heroLight } from './actors.js'
import { createAmbient } from './ambient.js'
import { activeFloaters, buildPack, packAt, shakeAt, stackFloaters } from './pack.js'
import { paintLight } from './light.js'
import { nudge, orient, rotate } from './placement.js'
import { BOSS_SPEED, duration, HUNT_SPEED, WALK_MS } from './playback.js'
import { ellipse, SHADOW } from './pixels.js'
import { mapLights, paintAnimated, paintBase, readMap, TS } from './tiles.js'
import { drawNpc, nameTag, npcLights, roadSign } from './town.js'
import { drawAilment, drawFx, fxLight, fxProgress } from './vfx.js'

const sameRect = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

// The zone's number from its id (z1, z2, z3), 1 when the rect is no zone of the world.
function zoneNumber(world, rect) {
  const zone = (world.zones ?? []).find((each) => sameRect(each.rect, rect))
  return zone ? Number(zone.id.slice(1)) : 1
}

// Where the hero starts in a zone: the walkable tile nearest the zone's middle with room two tiles right.
export function fightSpot(world, rect) {
  const rows = world.rows ?? []
  const r = rect ?? { x: 0, y: 0, w: rows[0]?.length ?? 0, h: rows.length }
  const walk = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && rows[y]?.[x] !== undefined && !isSolid(rows[y][x])
  const cx = r.x + Math.floor(r.w / 2) - 1
  const cy = r.y + Math.floor(r.h / 2)
  let best = null
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!walk(x, y) || !walk(x + 1, y) || !walk(x + 2, y)) continue
      const d = (x - cx) ** 2 + (y - cy) ** 2
      if (!best || d < best.d) best = { d, x, y }
    }
  }
  const hero = best ?? world.spawn ?? { x: cx, y: cy }
  return { hero: { x: hero.x, y: hero.y }, enemy: { x: hero.x + 2, y: hero.y } }
}

// Lays the playback's fights end to end: [walk, fight], [walk, fight], ... Built once per `fights`
// array; each fight's pack is read from its log the first time it plays.
function schedule(playback, fallback) {
  const speed = playback.speed ?? (playback.loop ? HUNT_SPEED : BOSS_SPEED)
  let at = 0
  const runs = playback.fights.map((fight) => {
    const walk = playback.walk === false ? 0 : WALK_MS
    const run = { start: at + walk, len: duration(fight, { speed }), fight, speed, pack: null, fallback: fight.enemy?.sprite ? fight.enemy : fallback }
    at = run.start + run.len
    return run
  })
  return { runs, total: at }
}

// Where the playback is `ms` in: { walking, index, cycle, run, local (ms into the fight) }.
function stateAt(plan, ms, loop, out) {
  const cycle = loop ? Math.floor(ms / plan.total) : 0
  const t = loop ? ms % plan.total : Math.min(ms, plan.total)
  let index = plan.runs.length - 1
  for (let i = 0; i < plan.runs.length; i++) {
    if (t < plan.runs[i].start + plan.runs[i].len) {
      index = i
      break
    }
  }
  const run = plan.runs[index]
  if (!run.pack) run.pack = buildPack(run.fight, { speed: run.speed, fallback: run.fallback })
  out.walking = t < run.start
  out.index = index
  out.cycle = cycle
  out.run = run
  out.local = t - run.start
  return out
}

// The hero doll's pose for an anim: idle swaps frames every 500 ms, walking steps faster with a 1px bob,
// attacks run wind up, slash, follow through. dx: pixels toward the foe (an attack lunges up to 3px,
// peaking mid swing; a hit knocks the hero 2px back). Reduced motion holds idle0, no bob, no dx. t: seconds.
const LUNGE = 3
const KNOCKBACK = 2
export function heroFrame(anim, p, t, reduced) {
  const q = Math.min(Math.max(Number(p) || 0, 0), 1)
  if (anim === 'death') return { pose: 'dead', bob: 0, dx: 0 }
  if (anim === 'hurt') return { pose: 'hurt', bob: 0, dx: reduced ? 0 : q < 0.6 ? -KNOCKBACK : q < 0.85 ? -1 : 0 }
  if (anim === 'attack') {
    const dx = reduced ? 0 : Math.round(LUNGE * Math.sin(Math.PI * q))
    return { pose: q < 0.33 ? 'atk1' : q < 0.66 ? 'atk2' : 'atk3', bob: 0, dx }
  }
  if (reduced) return { pose: 'idle0', bob: 0, dx: 0 }
  const step = Math.floor(t * (anim === 'walk' ? 5 : 2)) % 2 === 1
  return { pose: step ? 'idle1' : 'idle0', bob: anim === 'walk' && step ? 1 : 0, dx: 0 }
}

// Where the doll's top left lands for a hero standing on the tile at (x, y): the feet on the tile's
// last row, the 32x32 body box centered on the tile (as the old 16px hero was).
export const dollAt = (x, y) => ({ x: x + 8 - (SPRITE.ox + 16), y: y + 16 - (SPRITE.oy + 32) })

function layer(width, height, paint) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext?.('2d') ?? null
  if (!ctx) return null
  paint(ctx)
  return canvas
}

// How fast the pack trails a hero walking away mid fight, and how fast an enemy slides when the
// ground pushes it to another tile, in tiles a second.
const FOLLOW = 3
// The log stands enemies 1.3 tiles from the hero; drawn at 2x they would pile onto the hero, so the
// scene spreads the whole pack (spots, areas, radii) this much wider. The fight itself is unchanged.
export const SPREAD = 1.6
const SLIDE = 10
const LEVEL_UP_MS = 1800
// The idle monsters of a hunt region (ambient.js) are drawn this much fainter than the live pack, so
// the fight still reads. In the draw order they are AMBIENT + their index.
export const AMBIENT_ALPHA = 0.72
const AMBIENT = 10000

// A region in lit 16px pixel art, one canvas pixel per art pixel, scaled up by CSS to fit the width.
// Static art goes to an offscreen layer once per region; water, actors, the town's keepers, road signs,
// effects and the light pass are drawn each frame. With prefers-reduced-motion: still water, no
// fireflies, no shake, effects as short still flashes.
//   world: a map from shared/world/maps/. zoneRect: the zone being hunted, in tiles (packs stand in it;
//   the whole map when null). Changing it never repaints the map. Nothing is locked or fogged.
//   look: the hero's six field look. gear: { slot: { b, r } } from gearOf.
//   playback: { fights, loop, speed? } plays pack fight logs (pack.js): a loop walks 1.5 s between fights,
//   and each pack spawns around wherever the hero stands. enemy: { sprite, elite } for a log without spawns.
//   walker: a hunt-walker.js walker (the player walks the hero; it strolls on its own between packs).
//   onCamera(pos): the hero's drawn spot in tiles, each time it moves, for a camera to follow.
//   level: the hero's level; when it goes up a golden column and "Level X!" play over the hero.
//   zoneName: overrides the label.
export default function GameScene({ world, zoneRect, look, gear, playback, enemy, walker, onCamera, level, zoneName, onReady }) {
  const t = useT()
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const cols = world.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const rows = world.rows.length

  // Props read each frame, so a new look or foe never rebuilds the static layers.
  const live = useRef({})
  const tr = useRef(t)
  tr.current = t
  live.current = { look, gear, enemy, playback, onReady, walker, onCamera, level, zoneRect }
  const ready = useRef(false)
  const levelRef = useRef({ from: null, at: -1, n: 0 })
  // Kept across effect runs of the same region, so starting a hunt never snaps them back.
  const ambientRef = useRef({ key: null, ambient: null })

  const playing = Boolean(playback?.fights?.length)
  const walking = Boolean(walker)

  useEffect(() => {
    const canvas = ref.current
    let ctx = null
    try {
      ctx = canvas?.getContext?.('2d') ?? null
    } catch {
      ctx = null
    }
    let frame = 0
    const markReady = () => {
      if (ready.current) return
      ready.current = true
      live.current.onReady?.()
    }
    if (!ctx) {
      markReady()
      return undefined
    }
    const map = readMap(world)
    const whole = { x: 0, y: 0, w: map.W, h: map.H }
    // Packs stand in the hunted zone, read each frame so a new zone never repaints the map.
    let rect = live.current.zoneRect ?? whole
    const spot = fightSpot(world, rect)
    const base = layer(canvas.width, canvas.height, (c) => paintBase(c, world))
    const motes = map.outdoor ? 'fireflies' : 'dust'
    // The dusk over the map: the town under a steel slate evening (Ardósia), the regions as before.
    const tint = world.kind === 'town' ? '#aab4c8' : world.id === 'caverna-sql' ? '#8a80c4' : '#9d93cf'

    // Playback keeps its own clock, so it still runs with reduced motion (the environment stays frozen).
    let plan = null
    let planKey = null
    let startedAt = 0
    const now = { walking: true, index: 0, cycle: 0, run: null, local: 0 }
    const play = (time) => {
      const pb = live.current.playback
      if (!pb?.fights?.length) return null
      if (planKey !== pb.fights) {
        planKey = pb.fights
        plan = schedule(pb, live.current.enemy)
        startedAt = time
      }
      return stateAt(plan, (time - startedAt) * 1000, Boolean(pb.loop), now)
    }

    // The fight on screen: where its pack is anchored and how it is turned, each enemy's drawn spot.
    const fight = { key: null, anchor: { x: 0, y: 0 }, rot: null, spots: [], state: undefined }
    const rel = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    const heroPx = { x: 0, y: 0 }
    const floaterList = []
    const lightOut = []
    const order = []
    // Kept across effect runs (a hunt starting rebuilds the loop), so a level gained then still shows.
    const levelUp = levelRef.current
    let lastTime = 0
    let cameraX = Number.NaN
    let cameraY = Number.NaN
    // Idle monsters (none in the town): cosmetic, not solid, never sent to the server.
    const ambientKey = `${world.id}|${reduced}`
    if (ambientRef.current.key !== ambientKey) {
      ambientRef.current = { key: ambientKey, ambient: createAmbient({ world, zones: ZONES[world.id], seed: world.id, reducedMotion: reduced }) }
    }
    const ambient = ambientRef.current.ambient
    // The tiles they keep clear of, rebuilt each frame from a pool (no garbage per frame).
    const avoid = []
    const avoidPool = []
    const keep = (k, x, y) => {
      const tile = avoidPool[k] ?? (avoidPool[k] = { x: 0, y: 0 })
      tile.x = Math.round(x)
      tile.y = Math.round(y)
      avoid[k] = tile
    }

    // Ground px of a hero relative tile offset in this fight (turned, anchored, kept on floor).
    const spotPx = (at, out) => {
      rotate(fight.rot, at, rel)
      rel.x *= SPREAD
      rel.y *= SPREAD
      nudge(world, rect, fight.anchor.x + rel.x, fight.anchor.y + rel.y, target)
      out.x = Math.round(target.x * TS + 8)
      out.y = Math.round(target.y * TS + 15)
      return out
    }
    const env = {
      hero: heroPx,
      reduced,
      t: 0,
      ms: 0,
      foe: (i, out) => {
        const s = fight.spots[i]
        if (!s) return null
        out.x = Math.round(s.x * TS + 8)
        out.y = Math.round(s.y * TS + 15)
        return out
      },
      spot: spotPx,
      spread: SPREAD,
      colors: (i) => foeColors(fight.state?.foes[i]?.sprite),
      elite: (i) => Boolean(fight.state?.foes[i]?.elite),
    }

    // time: seconds since the scene started; clock: the same moment in performance.now() ms, the
    // walker's clock (input handlers stamp with performance.now()).
    const npcs = world.npcs ?? []
    const draw = (time, clock) => {
      rect = live.current.zoneRect ?? whole
      const te = reduced ? 0 : time
      const dt = Math.max(0, Math.min(0.1, time - lastTime))
      lastTime = time
      const { look: heroLook, gear: heroGear, walker: w, onCamera: report } = live.current
      const state = play(time)
      const inFight = state && !state.walking
      w?.update(clock, { roam: Boolean(live.current.playback?.loop) && (!state || state.walking) })
      const pos = w ? w.pos : spot.hero
      heroPx.x = Math.round(pos.x * TS + 8)
      heroPx.y = Math.round(pos.y * TS + 15)
      if (report && (pos.x !== cameraX || pos.y !== cameraY)) {
        cameraX = pos.x
        cameraY = pos.y
        report(pos)
      }

      // A new fight: the pack comes in around the hero's tile, turned to fit the ground there.
      let pack = null
      if (inFight) {
        pack = state.run.pack
        const key = `${state.cycle}:${state.index}`
        if (fight.key !== key) {
          const tile = w ? w.tile : spot.hero
          fight.key = key
          fight.anchor.x = tile.x
          fight.anchor.y = tile.y
          const wide = (p) => ({ x: p.x * SPREAD, y: p.y * SPREAD })
          fight.rot = orient(world, rect, tile, pack.foes.map((f) => ({ from: wide(f.from), to: wide(f.to) })))
          fight.spots = pack.foes.map(() => null)
        }
        // The pack trails a hero who walks away, and settles around the new spot.
        const step = reduced ? Infinity : FOLLOW * dt
        fight.anchor.x += Math.sign(pos.x - fight.anchor.x) * Math.min(step, Math.abs(pos.x - fight.anchor.x))
        fight.anchor.y += Math.sign(pos.y - fight.anchor.y) * Math.min(step, Math.abs(pos.y - fight.anchor.y))
        fight.state = packAt(pack, state.local, fight.state)
        for (let i = 0; i < pack.foes.length; i++) {
          const f = fight.state.foes[i]
          rotate(fight.rot, f, rel)
          rel.x *= SPREAD
          rel.y *= SPREAD
          nudge(world, rect, fight.anchor.x + rel.x, fight.anchor.y + rel.y, target)
          const s = fight.spots[i]
          if (!s || reduced) fight.spots[i] = { x: target.x, y: target.y }
          else {
            const max = SLIDE * dt
            const gap = Math.hypot(target.x - s.x, target.y - s.y)
            // Walking in from -> to moves faster than SLIDE: follow it exactly; only jumps slide.
            const k = gap <= 0.6 || gap <= max ? 1 : max / gap
            s.x += (target.x - s.x) * k
            s.y += (target.y - s.y) * k
          }
        }
      } else fight.key = null
      // The idle monsters keep clear of the hero's tile and the live pack's.
      avoid.length = 0
      keep(0, pos.x, pos.y)
      if (pack) {
        for (let i = 0; i < pack.foes.length; i++) {
          const s = fight.spots[i]
          if (s && fight.state.foes[i].visible) keep(avoid.length, s.x, s.y)
        }
      }
      ambient.update(clock, avoid)
      const idle = ambient.monsters()
      const ms = inFight ? state.local : 0
      const shake = pack ? shakeAt(pack, ms, reduced) : null

      ctx.imageSmoothingEnabled = false
      ctx.setTransform?.(1, 0, 0, 1, shake?.x ?? 0, shake?.y ?? 0)
      if (base) ctx.drawImage(base, 0, 0)
      else paintBase(ctx, world)
      paintAnimated(ctx, world, te)

      // Actors back to front: the hero, the town's keepers (-2, -3, ...) and every enemy standing,
      // sorted by their feet.
      order.length = 0
      order.push(-1)
      for (let i = 0; i < npcs.length; i++) order.push(-2 - i)
      for (let i = 0; i < idle.length; i++) order.push(AMBIENT + i)
      if (pack) {
        for (let i = 0; i < pack.foes.length; i++) if (fight.state.foes[i].visible && fight.spots[i]) order.push(i)
      }
      order.sort(byFeet)

      const heroAnim = pack ? fight.state.hero : null
      for (const who of order) {
        if (who === -1) drawHero(heroAnim)
        else if (who < -1) drawNpc(ctx, npcs[-2 - who], { t: te, reduced, side: npcs[-2 - who].x * TS + 8 > heroPx.x ? -1 : 1 })
        else if (who >= AMBIENT) drawIdle(who - AMBIENT)
        else drawEnemyAt(who)
      }

      // The light pass, then the effects over it so they glow.
      lightOut.length = 0
      for (const l of mapLights(world, te)) lightOut.push(l)
      for (const l of npcLights(world)) lightOut.push(l)
      lightOut.push(heroLight(heroPx.x - 8, heroPx.y - 15))
      if (pack) {
        for (const i of order) {
          if (i < 0 || i >= AMBIENT) continue
          const f = fight.state.foes[i]
          if ((f.elite || f.boss) && f.anim !== 'death') {
            env.foe(i, rel)
            lightOut.push(enemyLight(rel.x - 8, rel.y - 22, f))
          }
        }
        env.t = te
        for (const fx of pack.fx) {
          if (fx.at > ms) break
          const p = fxProgress(fx, ms, reduced)
          if (p === null) continue
          const light = fxLight(fx, p, env, {})
          if (light) lightOut.push(light)
        }
      }
      paintLight(ctx, te, { lights: lightOut, reduced, motes, tint })
      paintLabels()

      let overlay = null
      if (pack) {
        for (const fx of pack.fx) {
          if (fx.at > ms) break
          drawFx(ctx, fx, ms, env)
          if (fx.kind === 'roar' || fx.kind === 'enrage' || fx.kind === 'heroDeath') {
            const p = fxProgress(fx, ms, reduced)
            if (p !== null) overlay = { kind: fx.kind, p }
          }
        }
        // Hp bars and the floating numbers stay readable over everything.
        for (const i of order) {
          if (i < 0 || i >= AMBIENT) continue
          const f = fight.state.foes[i]
          if (f.anim === 'death') continue
          env.foe(i, rel)
          const w0 = f.boss ? 40 : f.elite ? 26 : 20
          drawHealthBar(ctx, rel.x - w0 / 2, rel.y - foeHeight(f.sprite) - 4, w0, f.hp)
        }
        paintNumbers(ms)
      } else if (live.current.enemy?.sprite && !playing) {
        drawFoe(ctx, heroPx.x + 2 * TS, heroPx.y - 1, { sprite: live.current.enemy.sprite, elite: live.current.enemy.elite, t: te })
      }
      paintLevelUp(clock)
      if (overlay) {
        // Phase: a white flash. Enrage: a red pulse. The hero falling: the world dims. Softer and steady with reduced motion.
        const pulse = overlay.kind === 'enrage' && !reduced ? 0.5 + 0.5 * Math.sin(overlay.p * Math.PI * 4) : 1
        ctx.globalAlpha = (reduced ? 0.12 : 0.26) * (1 - overlay.p) * pulse
        ctx.fillStyle = overlay.kind === 'enrage' ? '#ff2a2a' : overlay.kind === 'roar' ? '#ffffff' : '#1a0f2a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.globalAlpha = 1
      }
      ctx.setTransform?.(1, 0, 0, 1, 0, 0)

      function byFeet(a, b) {
        return feetY(a) - feetY(b)
      }
      function feetY(i) {
        if (i === -1) return heroPx.y
        if (i < -1) return npcs[-2 - i].y * TS + 15
        if (i >= AMBIENT) return Math.round(idle[i - AMBIENT].y * TS + 15)
        return Math.round(fight.spots[i].y * TS + 15)
      }

      // An idle monster: the live pack's drawing, a little fainter, facing where it last stepped.
      function drawIdle(j) {
        const m = idle[j]
        ctx.globalAlpha = AMBIENT_ALPHA * m.fade
        drawFoe(ctx, Math.round(m.x * TS + 8), Math.round(m.y * TS + 15) - 1, { sprite: m.enemy, anim: m.anim, t: te + j * 0.53, facing: m.facing })
        ctx.globalAlpha = 1
      }

      // Over the light: each keeper's name and, at each road, where it leads.
      function paintLabels() {
        const say = tr.current
        const width = map.W * TS
        for (const npc of npcs) nameTag(ctx, say(`world.npc.${npc.id}`), npc.x * TS + 8, npc.y * TS - (npc.id === 'quests' ? 7 : 19), { tone: 'gold', width })
        for (const road of world.roads ?? []) {
          const sign = roadSign(world, road)
          nameTag(ctx, say('world.road.sign', { arrow: sign.arrow, world: say(`world.name.${road.to}`) }), sign.x, sign.y, { width })
        }
      }

      function drawHero(anim) {
        const a = anim ?? { anim: 'idle', p: 0 }
        const moving = w?.moving && a.anim === 'idle'
        const { pose, bob, dx } = heroFrame(moving ? 'walk' : a.anim, a.p, te, reduced)
        // Mid fight and standing, the hero faces the nearest enemy; walking, the way it walks.
        let side = w ? w.side : 1
        if (pack && !w?.moving) {
          let best = Infinity
          for (let i = 0; i < pack.foes.length; i++) {
            const s = fight.spots[i]
            const f = fight.state.foes[i]
            if (!s || !f.visible || f.anim === 'death') continue
            const d = Math.abs(s.x - pos.x) + Math.abs(s.y - pos.y)
            if (d < best) {
              best = d
              side = s.x < pos.x - 0.05 ? -1 : 1
            }
          }
        }
        const hx = heroPx.x - 8
        const hy = heroPx.y - 15
        const shift = dx * side
        const doll = dollAt(hx, hy)
        ellipse(ctx, hx + 8 + shift, hy + 15, 8, 2, SHADOW)
        const img = heroSprite(heroLook, heroGear, pose)
        // A dodge leaves a ghost behind.
        const ghost = pack ? dodgeGhost(ms) : 0
        if (ghost > 0) {
          ctx.globalAlpha = 0.35 * ghost
          paintDoll(img, doll, hx, side, -8 * side, bob)
          ctx.globalAlpha = 1
        }
        paintDoll(img, doll, hx, side, shift, bob)
      }

      function paintDoll(img, doll, hx, side, shift, bob) {
        if (side === -1) {
          ctx.save()
          ctx.translate(hx + 8 + shift, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(img, doll.x - (hx + 8), doll.y + bob)
          ctx.restore()
        } else ctx.drawImage(img, doll.x + shift, doll.y + bob)
      }

      function dodgeGhost(at) {
        let best = 0
        for (const fx of pack.fx) {
          if (fx.at > at) break
          if (fx.kind !== 'dodge' || reduced) continue
          const p = (at - fx.at) / fx.ms
          if (p >= 0 && p < 1) best = Math.max(best, 1 - p)
        }
        return best
      }

      function drawEnemyAt(i) {
        const f = fight.state.foes[i]
        env.foe(i, rel)
        const s = fight.spots[i]
        // Enemies face the hero.
        const facing = s.x < pos.x ? 1 : -1
        // An enemy fades in over its first moments (it steps out of the spawn portal).
        const fadeIn = reduced ? 1 : Math.min(1, f.age / 200)
        ctx.globalAlpha = fadeIn
        drawFoe(ctx, rel.x, rel.y - 1, { sprite: f.sprite, anim: f.anim, p: f.p, t: te + i * 0.37, elite: f.elite, facing, slowed: f.slowed })
        ctx.globalAlpha = 1
        if (f.burning && f.anim !== 'death') drawAilment(ctx, rel.x, rel.y, f.burning, te, reduced, i)
      }

      function paintNumbers(at) {
        activeFloaters(pack, at, floaterList)
        const list = stackFloaters(floaterList, { reduced })
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.lineJoin = 'round'
        for (const entry of list) {
          const f = entry.floater
          let x = heroPx.x
          let y = heroPx.y - 38
          if (entry.target >= 0) {
            if (!env.foe(entry.target, rel)) continue
            x = rel.x
            y = rel.y - foeHeight(fight.state.foes[entry.target]?.sprite) - 8
          }
          const text = f.key ? tr.current(f.key) : (f.text ?? '')
          ctx.globalAlpha = entry.age < 0.65 ? 1 : Math.max(0, 1 - (entry.age - 0.65) / 0.35)
          ctx.font = `bold ${f.big ? 15 : 10}px monospace`
          ctx.lineWidth = 3
          ctx.strokeStyle = '#1a1030'
          ctx.strokeText?.(text, x, y + entry.dy)
          ctx.fillStyle = f.color
          ctx.fillText(text, x, y + entry.dy)
        }
        ctx.globalAlpha = 1
      }

      function paintLevelUp(nowMs) {
        const lv = live.current.level
        if (typeof lv === 'number') {
          if (levelUp.from !== null && lv > levelUp.from) {
            levelUp.at = nowMs
            levelUp.n = lv
          }
          levelUp.from = lv
        }
        if (levelUp.at < 0) return
        const fx = { kind: 'levelUp', at: levelUp.at, ms: LEVEL_UP_MS }
        if (!drawFx(ctx, fx, nowMs, env)) return
        const p = (nowMs - levelUp.at) / LEVEL_UP_MS
        ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'center'
        ctx.lineWidth = 3
        ctx.strokeStyle = '#3a2a0a'
        const text = tr.current('game.fx.levelUp', { n: levelUp.n })
        const y = heroPx.y - 40 - (reduced ? 0 : Math.round(Math.min(1, p * 3) * 4))
        ctx.strokeText?.(text, heroPx.x, y)
        ctx.fillStyle = '#ffd23f'
        ctx.fillText(text, heroPx.x, y)
        ctx.globalAlpha = 1
      }
    }

    const start = typeof performance !== 'undefined' ? performance.now() : 0
    draw(0, start)
    markReady()
    // Without an offscreen layer every frame would repaint the whole map: keep the still frame instead.
    if (base && (!reduced || playing || walking)) {
      const loop = (ms) => {
        draw((ms - start) / 1000, ms)
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [world, reduced, playing, walking])

  // A click on the map walks the hero there (the canvas is the whole map, so no camera math).
  function onClick(event) {
    const w = live.current.walker
    if (!w) return
    const box = event.currentTarget.getBoundingClientRect()
    if (!(box.width > 0) || !(box.height > 0)) return
    const x = Math.floor(((event.clientX - box.left) / box.width) * cols)
    const y = Math.floor(((event.clientY - box.top) / box.height) * rows)
    w.walkTo(x, y, typeof performance !== 'undefined' ? performance.now() : 0)
  }

  const worldName = t(`world.name.${world.id}`)
  const zone = zoneName ?? t('world.zone', { world: worldName, n: zoneNumber(world, zoneRect) })

  return (
    <canvas
      ref={ref}
      width={cols * TS}
      height={rows * TS}
      role="img"
      aria-label={t('game.scene.label', { zone })}
      onClick={onClick}
      className={`block h-auto w-full select-none ${walker ? 'cursor-pointer touch-manipulation' : ''}`}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
