// Fight log -> animation timeline. Pure (no DOM), so it is unit-tested. The log format lives at the top
// of shared/game/combat.js. Event.who is the side doing the thing: the attacker for hits, the dodger
// for dodges, the one who dies.
// Packs (fase 2b): until the scene draws a whole pack, it draws one foe, the first one still standing
// (spawn order). Frames about other enemies are kept but sample() leaves them out.
//   Frame = { at (ms), actor: 'hero'|'enemy', anim, ms (how long the anim runs), floater?, target?,
//             spawn? }. target: the enemy a frame is about (none: the one on stage). spawn: { sprite,
//             elite } on a marker frame that says the enemy exists.
// anim: 'attack' | 'hurt' | 'death' (actors.js), 'enrage' | 'phase' (a flash over the foe), or 'idle'
// (the frame only carries a floater and does not interrupt what the actor is doing).
import { elementColor, FLOATER_MS, KIND_COLORS } from './floaters.js'

export const HURT_LAG_MS = 120 // the victim reacts this long after the swing starts
export const WALK_MS = 1500 // the hero walks this long between fights in the hunt loop
export const END_HOLD_MS = 900 // a beat after the last event before the next fight
export const ANIM_MS = { attack: 420, hurt: 260, death: 800, enrage: 700, phase: 600, idle: 0 }

export const BOSS_SPEED = 1
export const HUNT_SPEED = 3

const other = (who) => (who === 'hero' ? 'enemy' : 'hero')
const num = (n) => String(Math.max(0, Math.round(n ?? 0)))

function floaterFor(ev) {
  const { type, amount, element } = ev
  const crit = type === 'crit' || ev.crit === true
  if (type === 'dodge') return { kind: 'dodge', key: 'game.fx.dodge', color: KIND_COLORS.dodge, big: false }
  if (type === 'heal') return { kind: 'heal', text: `+${num(amount)}`, color: KIND_COLORS.heal, big: false }
  if (type === 'potion') {
    const mp = ev.skill === 'mp'
    return { kind: 'heal', text: `+${num(amount)}`, color: mp ? KIND_COLORS.mana : KIND_COLORS.heal, big: false }
  }
  if (type === 'shield') return { kind: 'shield', text: `+${num(amount)}`, color: KIND_COLORS.shield, big: false }
  if (type === 'enrage') return { kind: 'enrage', key: 'game.fx.enrage', color: KIND_COLORS.enrage, big: true }
  if (type === 'phase') return { kind: 'phase', key: 'game.fx.phase', color: KIND_COLORS.phase, big: true }
  if (type === 'dot') return { kind: 'dot', text: num(amount), color: elementColor(element), big: false }
  if (amount === undefined) return null
  if (crit) return { kind: 'crit', text: num(amount), color: KIND_COLORS.crit, big: true }
  // The hero's damage is white or in the skill element. Damage on the hero is red.
  if (ev.who === 'enemy') return { kind: 'hit', text: num(amount), color: element ? elementColor(element) : KIND_COLORS.enemyHit, big: false, hurt: true }
  return { kind: type === 'skill' ? 'skill' : 'hit', text: num(amount), color: type === 'skill' ? elementColor(element) : KIND_COLORS.hit, big: false }
}

export function timeline(fight, { speed = BOSS_SPEED } = {}) {
  const k = speed > 0 ? speed : 1
  const life = FLOATER_MS / Math.min(k, 2)
  const frames = []
  const add = (at, actor, anim, floater, target) => {
    const frame = { at: at / k, actor, anim, ms: ANIM_MS[anim] / k }
    if (floater) frame.floater = { ...floater, ms: life }
    if (actor === 'enemy' && target !== undefined) frame.target = target
    frames.push(frame)
  }
  for (const ev of fight?.log ?? []) {
    const { t, who, type, src } = ev
    if (type === 'spawn') {
      frames.push({ at: t / k, actor: 'enemy', anim: 'idle', ms: 0, target: src, spawn: { sprite: ev.sprite, elite: Boolean(ev.elite) } })
    } else if (type === 'arrive' || type === 'buff' || type === 'cast') {
      if (type === 'cast') add(t, 'hero', 'attack')
    } else if (type === 'death') {
      add(t + HURT_LAG_MS, who, 'death', null, src)
    } else if (type === 'enrage') {
      add(t, 'enemy', 'enrage', floaterFor(ev), src)
    } else if (type === 'phase') {
      add(t, 'enemy', 'phase', floaterFor(ev), src)
    } else if (type === 'dodge') {
      add(t, other(who), 'attack', null, src)
      add(t + HURT_LAG_MS, who, 'idle', floaterFor(ev))
    } else if (type === 'heal' || type === 'shield' || type === 'potion') {
      add(t, who, 'idle', floaterFor(ev), src)
    } else if (who === 'hero' && ev.hits) {
      // A hero hit, skill or dot on one or more enemies: each target is hurt and shows its number.
      if (type !== 'dot') add(t, 'hero', 'attack')
      for (const hit of ev.hits) {
        const floater = floaterFor({ ...ev, type: type === 'dot' ? 'dot' : hit.crit ? 'crit' : type === 'crit' ? 'hit' : type, amount: hit.amount, crit: hit.crit })
        add(t + (type === 'dot' ? 0 : HURT_LAG_MS), 'enemy', 'hurt', floater, hit.target)
      }
    } else if (type === 'dot') {
      add(t, other(who), 'hurt', floaterFor(ev))
    } else {
      // hit, crit, skill: the attacker swings, the victim is hurt and shows the number.
      add(t, who, 'attack', null, src)
      const floater = floaterFor(ev)
      if (floater) add(t + HURT_LAG_MS, other(who), 'hurt', floater)
    }
  }
  // Array.sort is stable: events at the same time keep their log order.
  return frames.sort((a, b) => a.at - b.at)
}

// Total playback time of a fight in ms (already divided by speed).
export function duration(fight, { speed = BOSS_SPEED } = {}) {
  const k = speed > 0 ? speed : 1
  const last = (fight?.log ?? []).reduce((max, ev) => Math.max(max, ev.t), 0)
  return (Math.max(fight?.ms ?? 0, last) + HURT_LAG_MS + ANIM_MS.death + END_HOLD_MS) / k
}

// Which enemy is on stage `ms` in: the first (spawn order) whose death has not finished playing; once
// all are down, the last one to fall (it holds its death pose). null when the log names no enemy.
function onStage(frames, ms) {
  const known = new Map()
  const doneAt = new Map()
  for (const frame of frames) {
    if (frame.actor !== 'enemy' || frame.target === undefined) continue
    if (!known.has(frame.target)) known.set(frame.target, frame.spawn ?? null)
    if (frame.spawn) known.set(frame.target, frame.spawn)
    if (frame.anim === 'death') doneAt.set(frame.target, frame.at + frame.ms)
  }
  if (known.size === 0) return null
  const order = [...known.keys()].sort((a, b) => a - b)
  const standing = order.find((i) => !(doneAt.has(i) && doneAt.get(i) <= ms))
  const index = standing ?? [...doneAt.entries()].sort((a, b) => a[1] - b[1]).at(-1)[0]
  return { index, look: known.get(index) }
}

// The scene state `ms` into the fight. frames come from timeline().
//   hero/enemy: { anim: 'idle'|'attack'|'hurt'|'death'|'enrage'|'phase', p: 0..1 }
//   floaters: [{ floater, actor, age 0..1 }]. A death holds on its last pose (p = 1).
//   foe (packs): { index, sprite, elite } of the enemy on stage, when the log has spawn events.
export function sample(frames, ms) {
  const state = { hero: { anim: 'idle', p: 0 }, enemy: { anim: 'idle', p: 0 }, floaters: [] }
  const stage = onStage(frames, ms)
  if (stage?.look) state.foe = { index: stage.index, ...stage.look }
  for (const frame of frames) {
    if (frame.at > ms) break
    // Another enemy than the one on stage: not drawn yet.
    if (stage && frame.actor === 'enemy' && frame.target !== undefined && frame.target !== stage.index) continue
    if (frame.floater) {
      const age = (ms - frame.at) / frame.floater.ms
      if (age < 1) state.floaters.push({ floater: frame.floater, actor: frame.actor, age })
    }
    if (frame.anim === 'idle') continue
    const p = frame.ms > 0 ? (ms - frame.at) / frame.ms : 1
    if (p < 1) state[frame.actor] = { anim: frame.anim, p }
    else if (frame.anim === 'death') state[frame.actor] = { anim: 'death', p: 1 }
    else state[frame.actor] = { anim: 'idle', p: 0 }
  }
  return state
}
