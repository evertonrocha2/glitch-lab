// A pack fight log -> what the scene draws: every enemy (where it walks, its anims, hp, burns and
// slows), the hero's anims, one visual effect per event, the floating numbers per enemy and the
// screen shakes. Pure (no DOM), so it is unit-tested. The log format is the contract at the top of
// shared/game/combat.js; positions stay hero relative here (the scene turns and places the pack).
// Times are playback ms: log ms divided by speed. Effects that only flash last fixed real ms so they
// read at any speed; effects that last as long as the log says (a burning patch, an aura) scale.
import { elementColor, FLOATER_MS, KIND_COLORS } from './floaters.js'
import { ANIM_MS, BOSS_SPEED, duration, HURT_LAG_MS } from './playback.js'

// Every effect kind the scene knows how to draw (vfx.js).
export const FX_KINDS = [
  'slash', 'critBurst', 'echo', 'cleave', 'chain', 'fireball', 'venom', 'frost', 'splash', 'bubble', 'mend', 'fury',
  'zap', 'dodge', 'potion', 'impact', 'thorns', 'bossBlast', 'roar', 'enrage', 'spawn', 'summon', 'poof', 'loot',
  'heroDeath', 'regen', 'levelUp',
]

// How long each flash plays, in real ms.
export const FX_MS = {
  slash: 230, critBurst: 380, echo: 260, cleave: 360, chain: 420, fireball: 420, venom: 520, frost: 620, splash: 380,
  bubble: 360, mend: 900, fury: 500, zap: 300, dodge: 380, potion: 700, impact: 220, thorns: 260, bossBlast: 650,
  roar: 800, enrage: 900, spawn: 420, summon: 520, poof: 620, loot: 900, heroDeath: 1200, regen: 600, levelUp: 1800,
}

const SHAKE_MS = 260
const BIG_CRIT = 0.35 // a crit taking this share of the target's max hp shakes the screen
const MAX_LANE = 4 // numbers kept per enemy at once
const LINE_PX = 9

const DAMAGE = new Set(['hit', 'crit', 'skill'])
const num = (n) => String(Math.max(0, Math.round(n ?? 0)))

// The effects one log event produces: [{ kind, ...params }]. params: target / targets (enemy
// indexes), src (the enemy acting), at { x, y } (hero relative), radius, width, element, crit,
// span (log ms the effect lasts, for the ones that linger).
export function fxFor(ev) {
  const { type, who, skill } = ev
  const hits = ev.hits ?? []
  const targets = hits.map((h) => h.target)
  if (who === 'enemy') {
    if (type === 'spawn') return [{ kind: ev.summoner !== undefined ? 'summon' : 'spawn', target: ev.src }]
    if (type === 'death') return [{ kind: 'poof', target: ev.src ?? 0 }, { kind: 'loot', target: ev.src ?? 0 }]
    if (type === 'hit') return [{ kind: skill === 'reflete' ? 'thorns' : 'impact', src: ev.src ?? 0 }]
    if (type === 'skill') return [{ kind: 'bossBlast', src: ev.src ?? 0, element: ev.element ?? 'physical' }]
    if (type === 'phase') return [{ kind: 'roar', src: ev.src ?? 0 }]
    if (type === 'enrage') return [{ kind: 'enrage', src: ev.src ?? 0 }]
    if (type === 'heal') return [{ kind: 'regen', target: ev.src ?? 0 }]
    return []
  }
  if (type === 'death') return [{ kind: 'heroDeath' }]
  if (type === 'dodge') return [{ kind: 'dodge', src: ev.src ?? 0 }]
  if (type === 'potion') return [{ kind: 'potion', mp: skill === 'mp' }]
  if (type === 'shield') return [{ kind: 'bubble' }]
  if (type === 'heal') return [{ kind: 'mend' }]
  if (type === 'buff') return [{ kind: 'fury', span: ev.ms ?? 0 }]
  if (type === 'dot') return []
  const target = ev.target ?? targets[0] ?? 0
  if ((type === 'hit' || type === 'crit') && !skill) {
    const crit = type === 'crit' || hits.some((h) => h.crit)
    return crit ? [{ kind: 'slash', target, crit: true }, { kind: 'critBurst', target }] : [{ kind: 'slash', target, crit: false }]
  }
  if (skill === 'selfCall') return [{ kind: 'echo', target, crit: type === 'crit' }]
  const base = { target, targets, element: ev.element ?? 'physical', crit: Boolean(ev.crit) }
  if (skill === 'golpe') return [{ kind: 'cleave', ...base, radius: ev.radius ?? 1.8 }]
  if (skill === 'raio') return [{ kind: 'chain', ...base }]
  if (skill === 'chama') return [{ kind: 'fireball', ...base, spot: ev.at, radius: ev.radius ?? 1.6, span: ev.dot?.ms ?? 0 }]
  if (skill === 'veneno') return [{ kind: 'venom', ...base, spot: ev.at, width: 1.2 }]
  if (skill === 'nevasca') return [{ kind: 'frost', ...base, radius: ev.radius ?? 3 }]
  if (skill === 'bugSplash') return [{ kind: 'splash', ...base, spot: ev.at, radius: ev.radius ?? 1.5 }]
  // A skill this file does not know yet: drawn by its shape.
  const shape = ev.shape
  if (shape === 'chain') return [{ kind: 'chain', ...base }]
  if (shape === 'around') return [{ kind: 'cleave', ...base, radius: ev.radius ?? 1.8 }]
  if (shape === 'area') return [{ kind: 'splash', ...base, spot: ev.at, radius: ev.radius ?? 1.5 }]
  if (shape === 'pierce') return [{ kind: 'venom', ...base, spot: ev.at, width: 1.2 }]
  if (DAMAGE.has(type) || type === 'cast') return [{ kind: 'zap', ...base }]
  return []
}

// The floating text for an event on one target, or null.
function floaterFor(ev, amount, crit) {
  const { type, element } = ev
  if (type === 'dodge') return { kind: 'dodge', key: 'game.fx.dodge', color: KIND_COLORS.dodge, big: false }
  if (type === 'heal') return { kind: 'heal', text: `+${num(amount)}`, color: KIND_COLORS.heal, big: false }
  if (type === 'potion') return { kind: 'heal', text: `+${num(amount)}`, color: ev.skill === 'mp' ? KIND_COLORS.mana : KIND_COLORS.heal, big: false }
  if (type === 'shield') return { kind: 'shield', text: `+${num(amount)}`, color: KIND_COLORS.shield, big: false }
  if (type === 'buff') return { kind: 'buff', text: `+${num(amount)}%`, color: '#ff6b5a', big: false }
  if (type === 'enrage') return { kind: 'enrage', key: 'game.fx.enrage', color: KIND_COLORS.enrage, big: true }
  if (type === 'phase') return { kind: 'phase', key: 'game.fx.phase', color: KIND_COLORS.phase, big: true }
  if (type === 'dot') return { kind: 'dot', text: num(amount), color: elementColor(element), big: false }
  if (amount === undefined) return null
  if (ev.who === 'enemy') {
    if (amount <= 0 && ev.absorbed > 0) return { kind: 'shield', text: num(ev.absorbed), color: KIND_COLORS.shield, big: false }
    return { kind: 'hurt', text: num(amount), color: element && element !== 'physical' ? elementColor(element) : KIND_COLORS.enemyHit, big: false }
  }
  if (crit) return { kind: 'crit', text: num(amount), color: KIND_COLORS.crit, big: true }
  if (type === 'skill') return { kind: 'skill', text: num(amount), color: elementColor(element), big: false }
  return { kind: 'hit', text: num(amount), color: KIND_COLORS.hit, big: false }
}

// fight: { log, ms }. speed: playback speed. fallback: { sprite, elite } for a log without spawns.
export function buildPack(fight, { speed = BOSS_SPEED, fallback = null } = {}) {
  const k = speed > 0 ? speed : 1
  const log = fight?.log ?? []
  const len = duration(fight, { speed: k })
  const end = len
  const foes = []
  const hero = { acts: [] }
  const fx = []
  const floaters = []
  const shakes = []
  const life = FLOATER_MS / Math.min(k, 2)
  const at = (t) => t / k

  const foe = (src) => {
    const i = src ?? 0
    if (!foes[i]) {
      foes[i] = {
        src: i, sprite: fallback?.sprite ?? 'slime', elite: Boolean(fallback?.elite), boss: false, add: false, maxHp: 0,
        from: { x: 2, y: 0 }, to: { x: 2, y: 0 }, spawnAt: 0, arriveAt: 0, deathAt: null, hp: [], acts: [], slows: [], burns: [],
      }
    }
    return foes[i]
  }
  const float = (t, target, floater) => {
    if (floater) floaters.push({ at: at(t), ms: life, target, ...floater })
  }
  const act = (list, t, anim) => list.push({ at: at(t), anim, ms: ANIM_MS[anim] / k })
  const shake = (t, power) => shakes.push({ at: at(t), power })
  const addFx = (t, item) => {
    const { span, ...rest } = item
    const ms = Math.max(FX_MS[item.kind] ?? 300, span ? span / k : 0)
    fx.push({ at: at(t), ms, ...rest })
  }
  // Damage on an enemy, applied when it flinches. Its hp list stores the hp after each change.
  const damage = []

  if (!log.some((ev) => ev.type === 'spawn')) foe(0)
  let shieldLeft = 0
  let bubble = null
  for (const ev of log) {
    const { t, who, type } = ev
    for (const item of fxFor(ev)) {
      if (item.kind === 'bubble') {
        bubble = { t, item }
        continue
      }
      addFx(t, item)
    }
    if (type === 'spawn') {
      const f = foe(ev.src)
      Object.assign(f, {
        sprite: ev.sprite ?? f.sprite, elite: Boolean(ev.elite), boss: Boolean(ev.boss), add: ev.summoner !== undefined,
        maxHp: ev.hp ?? 0, from: ev.from ?? f.from, to: ev.to ?? ev.from ?? f.to, spawnAt: at(t),
      })
      const far = Math.hypot(f.from.x - f.to.x, f.from.y - f.to.y)
      f.arriveAt = at(t + (ev.speed > 0 ? (far / ev.speed) * 1000 : 0))
      f.hp.push({ at: at(t), hp: f.maxHp })
      continue
    }
    if (type === 'arrive') {
      foe(ev.src).arriveAt = at(t)
      continue
    }
    if (who === 'enemy') {
      const f = foe(ev.src)
      if (type === 'death') {
        f.deathAt = at(t)
        act(f.acts, t + HURT_LAG_MS, 'death')
      } else if (type === 'hit' || type === 'skill') {
        if (ev.skill !== 'reflete') act(f.acts, t, 'attack')
        if (ev.amount > 0) act(hero.acts, t + HURT_LAG_MS, 'hurt')
        float(t + HURT_LAG_MS, -1, floaterFor(ev, ev.amount, false))
        if (ev.absorbed > 0) shieldLeft -= ev.absorbed
        if (type === 'skill') shake(t, f.boss ? 3 : 2)
      } else if (type === 'heal') {
        damage.push({ t, target: f.src, amount: -(ev.amount ?? 0) })
        float(t, f.src, floaterFor(ev, ev.amount, false))
      } else if (type === 'phase') {
        float(t, f.src, floaterFor(ev))
        shake(t, 3)
      } else if (type === 'enrage') {
        float(t, f.src, floaterFor(ev))
        shake(t, 4)
      }
      continue
    }
    // The hero's side.
    if (type === 'death') {
      act(hero.acts, t + HURT_LAG_MS, 'death')
      shake(t, 3)
      continue
    }
    if (type === 'dodge') {
      act(foe(ev.src).acts, t, 'attack')
      float(t + HURT_LAG_MS, -1, floaterFor(ev))
      continue
    }
    if (type === 'potion' || type === 'heal' || type === 'buff') {
      if (type !== 'potion') act(hero.acts, t, 'attack')
      float(t, -1, floaterFor(ev, ev.amount, false))
      continue
    }
    if (type === 'shield') {
      act(hero.acts, t, 'attack')
      shieldLeft = ev.amount ?? 0
      float(t, -1, floaterFor(ev, ev.amount, false))
      continue
    }
    // Damage, casts and dot ticks on enemies. A log from before packs has no hits list: enemy 0.
    const hits = ev.hits ?? (ev.amount !== undefined ? [{ target: 0, amount: ev.amount, crit: type === 'crit' }] : [])
    const lag = type === 'dot' ? 0 : HURT_LAG_MS
    if (type !== 'dot') act(hero.acts, t, 'attack')
    for (const hit of hits) {
      const f = foe(hit.target)
      if (type === 'cast') {
        f.burns.push({ at: at(t), until: at(t + (ev.dot?.ms ?? 0)), element: ev.element ?? 'fire' })
        continue
      }
      if (hit.amount > 0 && type !== 'dot') act(f.acts, t + lag, 'hurt')
      damage.push({ t: t + lag, target: f.src, amount: hit.amount ?? 0 })
      const crit = Boolean(hit.crit) || (type === 'crit' && !ev.hits)
      float(t + lag, f.src, floaterFor(ev, hit.amount, crit))
      if (crit && f.maxHp > 0 && hit.amount >= f.maxHp * BIG_CRIT) shake(t, 2)
      if (ev.slow) f.slows.push({ at: at(t), until: at(t + ev.slow.ms) })
    }
    // A shield lasts until enemy hits use it up (or the fight ends).
    if (bubble && shieldLeft <= 0 && bubble.t < t) bubble = closeBubble(bubble, t)
  }
  if (bubble) closeBubble(bubble, null)

  function closeBubble(open, t) {
    const until = t === null ? end : at(t)
    fx.push({ at: at(open.t), ms: Math.max(FX_MS.bubble, until - at(open.t)), kind: 'bubble' })
    return null
  }

  // Legacy foes have no max hp: their bar reads from the damage they took.
  for (const f of foes) {
    if (f && !f.maxHp) f.maxHp = Math.max(1, damage.reduce((sum, d) => sum + (d.target === f.src ? Math.max(0, d.amount) : 0), 0))
  }
  // hp after each change, per enemy, in time order.
  damage.sort((a, b) => a.t - b.t)
  for (const d of damage) {
    const f = foes[d.target]
    if (!f) continue
    const last = f.hp.length ? f.hp.at(-1).hp : f.maxHp
    f.hp.push({ at: at(d.t), hp: Math.min(f.maxHp, Math.max(0, last - d.amount)) })
  }
  for (const f of foes) {
    if (!f) continue
    if (f.deathAt !== null) {
      f.arriveAt = Math.min(f.arriveAt, Math.max(f.spawnAt, f.deathAt))
      for (const b of f.burns) b.until = Math.min(b.until, f.deathAt)
    }
    f.acts.sort((a, b) => a.at - b.at)
  }
  hero.acts.sort((a, b) => a.at - b.at)
  fx.sort((a, b) => a.at - b.at)
  floaters.sort((a, b) => a.at - b.at)
  shakes.sort((a, b) => a.at - b.at)
  return { k, len, foes: foes.filter(Boolean), hero, fx, floaters, shakes }
}

// The anim an actor plays at ms from its sorted acts, written into out { anim, p }.
function animAt(acts, ms, out, rest = 'idle') {
  out.anim = rest
  out.p = 0
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i]
    if (a.at > ms) break
    const p = a.ms > 0 ? (ms - a.at) / a.ms : 1
    if (p < 1) {
      out.anim = a.anim
      out.p = p
    } else if (a.anim === 'death') {
      out.anim = 'death'
      out.p = 1
    } else if (out.anim !== 'death') {
      out.anim = rest
      out.p = 0
    }
  }
  return out
}

const within = (list, ms) => {
  for (let i = 0; i < list.length; i++) if (list[i].at <= ms && ms < list[i].until) return list[i]
  return null
}

// The pack `ms` into the fight. Reuses `state` between frames (no allocation once it has grown).
//   hero: { anim, p }. foes[i]: { visible, x, y (hero relative), anim, p, hp (0..1), slowed,
//   burning (element or null), age (ms since it appeared), elite, boss, sprite }.
export function packAt(pack, ms, state = { hero: { anim: 'idle', p: 0 }, foes: [] }) {
  animAt(pack.hero.acts, ms, state.hero)
  for (let i = 0; i < pack.foes.length; i++) {
    const f = pack.foes[i]
    if (!state.foes[i]) state.foes[i] = { visible: false, x: 0, y: 0, anim: 'idle', p: 0, hp: 1, slowed: false, burning: null, age: 0 }
    const s = state.foes[i]
    s.sprite = f.sprite
    s.elite = f.elite
    s.boss = f.boss
    s.index = i
    const deathEnd = f.deathAt === null ? Infinity : f.deathAt + (HURT_LAG_MS + ANIM_MS.death) / (pack.k ?? 1) + 400
    s.visible = ms >= f.spawnAt && ms < deathEnd
    s.age = ms - f.spawnAt
    const stop = f.deathAt === null ? ms : Math.min(ms, f.deathAt)
    const walkMs = f.arriveAt - f.spawnAt
    const u = walkMs > 0 ? Math.min(1, Math.max(0, (stop - f.spawnAt) / walkMs)) : 1
    s.x = f.from.x + (f.to.x - f.from.x) * u
    s.y = f.from.y + (f.to.y - f.from.y) * u
    animAt(f.acts, ms, s, u < 1 && ms >= f.spawnAt ? 'walk' : 'idle')
    let hp = f.maxHp
    for (let j = 0; j < f.hp.length && f.hp[j].at <= ms; j++) hp = f.hp[j].hp
    s.hp = f.maxHp > 0 ? hp / f.maxHp : 1
    s.slowed = within(f.slows, ms) !== null
    s.burning = within(f.burns, ms)?.element ?? null
  }
  state.foes.length = pack.foes.length
  return state
}

// The floaters showing at ms, pushed into out (cleared first): [{ floater, target, age, at }].
export function activeFloaters(pack, ms, out) {
  out.length = 0
  for (const f of pack.floaters) {
    if (f.at > ms) break
    const age = (ms - f.at) / f.ms
    if (age < 1) out.push({ floater: f, target: f.target, age, at: f.at })
  }
  return out
}

// Lays the active floaters out: per target, the newest at lane 0 and each older one a line above,
// at most 4 per target (the oldest go). rise: px drifted up with age (0 with reduced motion).
// Answers the kept entries with lane and rise set.
export function stackFloaters(active, { reduced = false, rise = 12 } = {}) {
  const kept = []
  const lanes = new Map()
  for (let i = active.length - 1; i >= 0; i--) {
    const entry = active[i]
    const lane = lanes.get(entry.target) ?? 0
    if (lane >= MAX_LANE) continue
    lanes.set(entry.target, lane + 1)
    entry.lane = lane
    entry.rise = reduced ? 0 : Math.round(rise * entry.age)
    entry.dy = -(lane * LINE_PX) - entry.rise
    kept.push(entry)
  }
  return kept
}

// The screen's shake offset in px at ms: a short decaying jolt after big crits, boss skills, phases.
// Always { 0, 0 } with reduced motion.
export function shakeAt(pack, ms, reduced) {
  if (reduced) return { x: 0, y: 0 }
  let power = 0
  let since = 0
  for (const s of pack.shakes) {
    if (s.at > ms) break
    const q = (ms - s.at) / SHAKE_MS
    if (q >= 1) continue
    const p = s.power * (1 - q)
    if (p > power) {
      power = p
      since = ms - s.at
    }
  }
  if (power <= 0) return { x: 0, y: 0 }
  const flip = Math.floor(since / 40) % 2 ? -1 : 1
  return { x: flip * Math.max(1, Math.round(power)), y: Math.round(power / 2) * (Math.floor(since / 60) % 2 ? 1 : -1) }
}
