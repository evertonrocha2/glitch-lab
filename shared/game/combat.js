// Seeded, tick-based pack fight simulation (fase 2b). The server runs it as the authority, the client
// replays `log`. Pure: all randomness comes from createRng(seed), split into a hero stream, an enemy
// stream and a layout stream (no unseeded randomness).
//
// Rules:
// - The hero fights a pack (1 to 6 enemies; a boss calls more in its phases). The hero stands still at
//   { x: 0, y: 0 }; enemies spawn a few tiles away and walk straight in until they stand STOP tiles
//   from the hero, then attack on their attackSpeed cadence. Everything is relative to the hero: the
//   map, and where the player walks the hero, never change the outcome.
// - Basic attacks: every 1000 / attackSpeed ms at the nearest enemy within HERO_REACH (ties: lowest
//   index). With nobody in reach the swing waits for one.
// - Skills autocast on their own: every tick, each equipped skill (loadout order) that is off cooldown,
//   has its mana and has a useful target fires, independent of the basic attacks and of each other.
//   Shapes (skills.js): around (every enemy within radius of the hero), area (the spot in range that
//   covers the most enemies, then every enemy within radius of it), chain (the nearest enemy in range,
//   then jumps to the nearest enemy not hit yet within `jump`, up to `targets`, each jump `falloff`
//   weaker), pierce (a line toward the enemy in range that lines up the most, `width` wide), single,
//   self (heal, shield, buff). A dot skill puts its burn on every enemy it lands on; it ticks each second.
// - Hero hits roll crit per target. Enemy hits roll the hero's dodge.
// - Physical damage x 100 / (100 + armor). Elemental damage x (1 - res / 100), res capped at 75.
// - A boss enters a phase at 66% and 33% hp: +25% attack, a special skill every 8 s in its element
//   that stuns for 1 s, and it calls its adds. The fight is won when the boss dies (adds or not); a
//   pack fight when every enemy is dead. Bosses enrage at enrageMs (the hero dies). Pack fights stop
//   at TRASH_TIMEOUT_MS (a loss). Kills made before a loss still count (result.kills).
// - Potions: hp when hp < thresholds.hp x max hp, mp when mana < thresholds.mp x max mana.
// - opts.cooldowns ({ skillId: ms left }) starts skills mid cooldown; result.cooldowns says what is
//   left at the end, so a hunt carries cooldowns from one pack to the next.
// - Fase 2c: each loadout skill fights as tuneSkill (skill-mods.js) makes it, from the hero's effects
//   (skill passives ride there) and hero.supports (support gem ids). Extra areas or lines land where
//   foes no earlier one hit stand (an area a radius away from the others): one hit or burn per foe per
//   cast. golpeTwice strikes again right away at its share; critBlast explodes on each crit target;
//   vampiro heals once per cast; tryCatch answers each absorbed hit; garbageCollector heals every second.
//
// LOG FORMAT (the contract the scene draws from). Every event: { t, type, who, ... }
//   t      ms since the fight began (a multiple of TICK_MS). Events at the same t keep their order.
//   who    'hero' | 'enemy': the side doing the thing (the attacker for hits, the dodger for dodges,
//          the one who dies, the one who spawns).
//   src    on enemy-side events (and dodges): the index of the enemy acting, in spawn order. A boss is
//          0; adds continue the count.
//   Positions are { x, y } in tiles relative to the hero (+x is where packs come from), rounded to
//   0.01. Never absolute map tiles: the client places them around wherever it draws the hero.
// Types:
//   spawn   who 'enemy', src, id, sprite, element, hp (max), elite?, boss?, mods? (elite mods),
//           summoner? (the boss index, for adds), from { x, y } (where it appears), to { x, y } (where
//           it will stand and fight), speed (tiles/s). It walks the straight line from -> to.
//   arrive  who 'enemy', src: it reached `to` and starts attacking (later than from/speed says when
//           a slow held it back).
//   hit     who 'hero': a basic attack. crit is the same with a crit. skill? is 'selfCall' for the
//           extra swing of Anel Recursivo.
//   skill   who 'hero': a damage skill (or bugSplash).
//   cast    who 'hero': a dot skill landing (no damage yet; its ticks come as dot events).
//           hit, crit, skill and cast carry: skill (id; none on a plain basic attack), shape, element,
//           target (the main target's index), hits [{ target, amount, crit? }] (cast: [{ target }]),
//           amount (sum of the hits),
//           at? { x, y } (area: the center; pierce: the far end of the line), radius? (around, area),
//           width? (pierce: the line's width), slow? { pct, ms } (every target hit is slowed), dot?
//           { ms } (cast), recast? (a free recast from recursion: no mana, no cooldown), extra? (1, 2..:
//           one more area or line of the same cast, same t, right after the first), echo? (golpeTwice's
//           second strike), added? ('fire': the hits carry the fogo support's fire).
//   skill   who 'hero', skill 'critBlast', shape 'area', at, radius: a crit target exploding on the
//           foes around it. skill 'tryCatch', shape 'single', target (the attacker): barreira answering
//           a hit it absorbed.
//   dot     who 'hero', skill, element, hits [{ target, amount }], amount: one tick of a burn on every
//           enemy carrying it.
//   heal    who 'hero', skill, shape 'self', amount, hot? (cura's garbageCollector tick, each second).
//           skill 'vampiro': the life a cast's hits leeched. who 'enemy', src, skill 'regenera': an
//           elite regen.
//   shield  who 'hero', skill, shape 'self', amount (the shield it now has).
//   buff    who 'hero', skill, shape 'self', amount (percent), ms (how long).
//   potion  who 'hero', skill 'hp' | 'mp', amount.
//   hit     who 'enemy', src, amount, absorbed? (taken by the shield): an enemy basic attack on the
//           hero. skill 'reflete': damage an elite reflects back.
//   skill   who 'enemy', src, skill, element, amount, absorbed?, stun? (ms): a boss phase skill.
//   dodge   who 'hero', src, skill?: the hero dodged that enemy's attack (or its special).
//   phase   who 'enemy', src, skill, phase (2 or 3). Its adds spawn right after, at the same t.
//   enrage  who 'enemy', src. The hero dies right after.
//   death   who 'hero', or who 'enemy' with src.
import { createRng } from './rng.js'
import { tuneSkill } from './skill-mods.js'
import { SKILLS, skillPower } from './skills.js'
import { CHANCE, EFFECT, MOD, RATE, enemyArmor, heroHitMult, isImmune, mitigate } from './combat-effects.js'

export const TICK_MS = 100
export const TRASH_TIMEOUT_MS = 60000
export const POTION_COOLDOWN_MS = 10000
export const MANA_REGEN = 0.02 // of max mana, per second

// Geometry, in tiles and tiles per second.
export const HERO_REACH = 1.8
export const STOP = 1.3
export const MOVE_SPEED = 2.5
export const BOSS_MOVE_SPEED = 1.5
export const SPAWN_DIST = 4
const SPAWN_JITTER = 1
const BOSS_DIST = 3
const ADD_DIST = 4.5
const SPLASH_RADIUS = 1.5
// chainBolt: raio jumps this many more times.
const CHAIN_BOLT_JUMPS = 2

const HP_POTION = 0.35
const MP_POTION = 0.4
const BOSS_SKILL_MS = 8000
const BOSS_SKILL_MULT = 2
const STUN_MS = 1000
const DEFAULT_ENRAGE_MS = 90000
const HERO_RES = { fire: 'resFire', ice: 'resIce', lightning: 'resLightning', poison: 'resPoison' }
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]))
// Where each spawn slot comes from: unit vectors 0.6 rad apart, fanning out from +x. Literal numbers,
// so no engine's Math.cos can make two runs disagree.
const SLOTS = [
  [1, 0], [0.8253, 0.5646], [0.8253, -0.5646], [0.3624, 0.932], [0.3624, -0.932], [-0.2272, 0.9738], [-0.2272, -0.9738],
]

const interval = (speed) => (speed > 0 ? 1000 / speed : Infinity)
const round2 = (n) => Math.round(n * 100) / 100
const spot = (x, y) => ({ x: round2(x), y: round2(y) })
const dist = (ax, ay, bx = 0, by = 0) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
const EPS = 1e-9

// hero: { stats, skills: [{ id, level }], supports?: [support id], potions, thresholds }. enemies: enemy defs from enemies.js
// (enemy: one def, as before). An enemy may carry spawn { x, y } (tests) and base.speed.
export function simulateFight({ hero, enemies, enemy, seed, cooldowns = {} }) {
  const root = createRng(seed)
  const heroRng = root.fork('hero')
  const enemyRng = root.fork('enemy')
  const layoutRng = root.fork('layout')
  const stats = hero.stats
  const effects = new Set(stats.effects ?? [])
  const stock = { hp: hero.potions?.hp ?? 0, mp: hero.potions?.mp ?? 0 }
  const thresholds = { hp: hero.thresholds?.hp ?? 0, mp: hero.thresholds?.mp ?? 0 }
  const tuning = { effects: stats.effects ?? [], supports: hero.supports ?? [] }
  const loadout = (hero.skills ?? [])
    .filter((s) => s && SKILL_BY_ID[s.id])
    .map((s) => ({ def: tuneSkill(SKILL_BY_ID[s.id], tuning), level: s.level ?? 1, readyAt: Math.max(0, cooldowns[s.id] ?? 0) }))
  // tryCatch: the share of each absorbed hit barreira sends back.
  const reflectShare = loadout.find((slot) => slot.def.reflect)?.def.reflect ?? 0
  const manaCost = (def) => def.mana * (effects.has(EFFECT.recursion) ? 2 : 1)
  const defs = enemies ?? (enemy ? [enemy] : [])
  const bossFight = defs.some((d) => d.boss)
  const boss = defs.find((d) => d.boss)
  const limit = bossFight ? (boss.enrageMs ?? DEFAULT_ENRAGE_MS) : TRASH_TIMEOUT_MS

  const log = []
  const h = {
    hp: stats.hp, mana: stats.mana, shield: 0, next: interval(stats.attackSpeed), buff: 0, buffUntil: 0, stunUntil: 0,
    hotAmount: 0, hotNext: 0, hotUntil: -1,
  }
  const used = { hp: 0, mp: 0 }
  const potionAt = { hp: 0, mp: 0 }
  const foes = []
  let kills = 0
  let elites = 0
  let t = 0
  let outcome = null

  const push = (event) => log.push({ t, ...event })
  const heroSpeed = () => stats.attackSpeed * (t < h.buffUntil ? 1 + h.buff : 1)
  const slowed = (e) => (t < e.slowUntil ? 1 - e.slow : 1)
  const enemySpeed = (e) => e.base.attackSpeed * (e.mods.has(MOD.haste) ? RATE.haste : 1) * slowed(e)
  const alive = () => foes.filter((e) => e.alive)
  const away = (e) => dist(e.x, e.y)

  // Puts an enemy on the field. slot picks its direction; far is how far away it appears.
  const spawn = (def, far, summoner) => {
    const i = foes.length
    const [ux, uy] = def.spawn ? [def.spawn.x, def.spawn.y] : SLOTS[i % SLOTS.length]
    const d0 = def.spawn ? dist(ux, uy) : far
    const dir = def.spawn ? (d0 > 0 ? [ux / d0, uy / d0] : [1, 0]) : [ux, uy]
    const speed = def.base.speed ?? (def.boss ? BOSS_MOVE_SPEED : MOVE_SPEED)
    const mods = new Set(def.mods ?? [])
    const e = {
      i, def, base: def.base, mods, elite: Boolean(def.elite), boss: Boolean(def.boss),
      hp: def.base.hp, alive: true, dir, d: d0, x: dir[0] * d0, y: dir[1] * d0, speed,
      arrived: false, next: 0, attackPct: 0, phase: 0, skill: null, skillAt: 0, slow: 0, slowUntil: 0, dots: [],
      armor: enemyArmor(def.base.armor, mods, effects),
    }
    const end = speed > 0 && d0 > STOP ? STOP : d0
    if (d0 <= STOP + EPS) {
      e.arrived = true
      e.next = t + interval(enemySpeed(e))
    }
    foes.push(e)
    const mod = def.mods?.length ? { mods: [...def.mods] } : {}
    push({
      who: 'enemy', src: i, type: 'spawn', id: def.id, sprite: def.sprite, element: def.element ?? 'physical', hp: def.base.hp,
      ...(e.elite ? { elite: true } : {}), ...(e.boss ? { boss: true } : {}), ...mod,
      ...(summoner !== undefined ? { summoner } : {}),
      from: spot(e.x, e.y), to: spot(dir[0] * end, dir[1] * end), speed,
    })
    return e
  }

  const finish = (won, reason) => {
    outcome = { won, reason }
  }
  const heroDies = () => {
    h.hp = 0
    push({ who: 'hero', type: 'death' })
    finish(false, 'died')
  }

  const hurtHero = (raw, src, event) => {
    let left = Math.max(0, Math.round(raw))
    const absorbed = Math.min(h.shield, left)
    h.shield -= absorbed
    left -= absorbed
    h.hp -= left
    push({ who: 'enemy', src, ...event, amount: left, ...(absorbed > 0 ? { absorbed } : {}) })
    if (h.hp <= 0) heroDies()
    else if (absorbed > 0 && reflectShare > 0 && event.skill !== MOD.reflect && foes[src]?.alive) {
      const hits = strike([{ e: foes[src], raw: absorbed * reflectShare, crit: false }], 'physical')
      land({ who: 'hero', type: 'skill', skill: 'tryCatch', shape: 'single', element: 'physical', target: src, hits, amount: sum(hits) })
    }
  }

  const enterPhases = (e) => {
    const phases = e.def.phases ?? []
    while (e.alive && e.phase < phases.length && e.hp / e.base.hp < phases[e.phase].at) {
      const phase = phases[e.phase]
      e.phase++
      e.attackPct += phase.attackPct
      e.skill = phase.skill
      e.skillAt = t
      push({ who: 'enemy', src: e.i, type: 'phase', skill: phase.skill, phase: e.phase + 1 })
      for (const add of phase.adds ?? []) spawn(add, ADD_DIST, e.i)
    }
  }

  const kill = (e) => {
    e.alive = false
    e.hp = 0
    e.dots = []
    kills++
    if (e.elite) elites++
    push({ who: 'enemy', src: e.i, type: 'death' })
    if (bossFight ? e.boss : alive().length === 0) finish(true, 'killed')
  }

  // One hero action's damage: list [{ e, raw, crit }]. Answers the hits for the log.
  // fire: the fogo support's added fire, mitigated on its own.
  const strike = (list, element) =>
    list.map(({ e, raw, crit, fire = 0 }) => {
      let amount = Math.max(0, Math.round(mitigate(raw, element, { armor: e.armor, res: e.base.res?.[element], immune: isImmune(element, e.mods) })))
      if (fire > 0) amount += Math.max(0, Math.round(mitigate(fire, 'fire', { res: e.base.res?.fire, immune: isImmune('fire', e.mods) })))
      e.hp -= amount
      return { target: e.i, amount, ...(crit ? { crit: true } : {}) }
    })

  // Logs a hero damage event, then what follows from it: phases, deaths, reflected damage.
  const land = (event) => {
    push(event)
    for (const hit of event.hits) {
      if (outcome) return
      const e = foes[hit.target]
      if (!e.alive) continue
      enterPhases(e)
      if (e.hp <= 0) kill(e)
      else if (hit.amount > 0 && e.mods.has(MOD.reflect)) hurtHero(hit.amount * RATE.reflect, e.i, { type: 'hit', skill: MOD.reflect })
    }
  }

  const sum = (hits) => hits.reduce((total, hit) => total + (hit.amount ?? 0), 0)
  const crit = () => heroRng.chance(stats.critChance / 100)
  const critMult = (isCrit) => (isCrit ? stats.critDamage / 100 : 1)

  // The nearest living enemy within reach of a point (ties: lowest index), skipping `not`.
  const nearest = (reach, x = 0, y = 0, not = null) => {
    let best = null
    let bestD = Infinity
    for (const e of foes) {
      if (!e.alive || not?.has(e)) continue
      const d = dist(e.x, e.y, x, y)
      if (d <= reach + EPS && d < bestD - EPS) {
        best = e
        bestD = d
      }
    }
    return best
  }
  const within = (x, y, radius) => alive().filter((e) => dist(e.x, e.y, x, y) <= radius + EPS)

  // The best spot (area) or line (pierce) for each of 1 + def.extra throws. The first is the one that
  // covers the most foes (ties: the nearer main target). Each extra one lands on the most foes no earlier
  // throw hit (at least one, its main target among them), an area a radius away from the earlier
  // centers; when none fits there are no more throws. Each plan lists only foes not hit before.
  const throws = (def) => {
    const candidates = alive().filter((e) => away(e) <= def.range + EPS)
    const hit = new Set()
    const centers = []
    const plans = []
    for (let k = 0; k <= def.extra; k++) {
      let best = null
      for (const c of candidates) {
        if (hit.has(c)) continue
        let targets
        let at
        if (def.shape === 'area') {
          if (centers.some((p) => dist(c.x, c.y, p.x, p.y) <= def.radius + EPS)) continue
          targets = within(c.x, c.y, def.radius)
          at = spot(c.x, c.y)
        } else {
          // pierce: a line from the hero through c, def.range long.
          const d = away(c) || 1
          const ux = c.x / d
          const uy = c.y / d
          targets = alive().filter((e) => {
            const along = e.x * ux + e.y * uy
            const off = Math.abs(e.x * uy - e.y * ux)
            return along >= 0 && along <= def.range + EPS && off <= def.width / 2 + EPS
          })
          at = spot(ux * def.range, uy * def.range)
        }
        const fresh = targets.filter((e) => !hit.has(e))
        const better = !best || fresh.length > best.fresh.length || (fresh.length === best.fresh.length && away(c) < away(best.main) - EPS)
        if (better) best = { main: c, fresh, at, center: { x: c.x, y: c.y } }
      }
      if (!best) break
      for (const e of best.fresh) hit.add(e)
      centers.push(best.center)
      // The main target leads the hits.
      const shape = def.shape === 'area' ? { radius: def.radius } : { width: def.width }
      plans.push({ targets: [best.main, ...best.fresh.filter((e) => e !== best.main)], extra: { at: best.at, ...shape, ...(k > 0 ? { extra: k } : {}) } })
    }
    return plans.length ? plans : null
  }

  // Who a skill would hit right now, as a list of plans (one per area or line; one for the other
  // shapes), or null when it has no useful target.
  const aim = (def) => {
    if (def.shape === 'self') {
      if (def.kind === 'heal') return h.hp < stats.hp ? [{}] : null
      if (def.kind === 'shield') return h.shield <= 0 && alive().length > 0 ? [{}] : null
      return nearest(HERO_REACH) ? [{}] : null
    }
    if (def.shape === 'around') {
      const targets = within(0, 0, def.radius)
      return targets.length ? [{ targets, extra: { radius: def.radius } }] : null
    }
    if (def.shape === 'single') {
      const first = nearest(def.range)
      return first ? [{ targets: [first] }] : null
    }
    if (def.shape === 'chain') {
      const first = nearest(def.range)
      if (!first) return null
      const targets = [first]
      const hit = new Set(targets)
      const count = def.targets + (def.id === 'raio' && effects.has(EFFECT.chainBolt) ? CHAIN_BOLT_JUMPS : 0)
      while (targets.length < count) {
        const last = targets.at(-1)
        const next = nearest(def.jump, last.x, last.y, hit)
        if (!next) break
        targets.push(next)
        hit.add(next)
      }
      return [{ targets }]
    }
    return throws(def)
  }

  // A slow never cuts short a stronger one still running.
  const slowFoe = (e, pct, ms) => {
    if (t >= e.slowUntil || pct >= e.slow) {
      e.slow = pct
      e.slowUntil = t + ms
    }
  }

  // critBlast: each crit target explodes on the living foes around it (not itself).
  const blast = (def, hits) => {
    for (const hit of hits) {
      if (outcome) return
      if (!hit.crit) continue
      const center = foes[hit.target]
      const around = within(center.x, center.y, def.blast.radius).filter((e) => e !== center)
      if (!around.length) continue
      const list = strike(around.map((e) => ({ e, raw: hit.amount * def.blast.pct, crit: false })), def.element)
      land({
        who: 'hero', type: 'skill', skill: 'critBlast', shape: 'area', element: def.element, target: around[0].i,
        at: spot(center.x, center.y), radius: def.blast.radius, hits: list, amount: sum(list),
      })
    }
  }

  // One plan of a hit skill: rolls crit per target, logs the event, then any crit blasts. share scales
  // the power (golpeTwice's echo). Answers the damage dealt.
  const strikePlan = (slot, plan, tag, share) => {
    const { def } = slot
    const magic = def.element === 'physical' ? 1 : 1 + (stats.magicPct ?? 0) / 100
    const mult = stats.attack * skillPower(def, slot.level) * magic * heroHitMult(def.id, effects) * def.more * share
    const list = plan.targets.map((e, k) => {
      const isCrit = crit()
      const falloff = def.shape === 'chain' ? (1 - def.falloff) ** k : 1
      const raw = mult * falloff * critMult(isCrit)
      return { e, raw, crit: isCrit, ...(def.addedFire ? { fire: raw * def.addedFire } : {}) }
    })
    const hits = strike(list, def.element)
    const slow = def.slow ? { slow: { pct: def.slow, ms: def.slowMs } } : {}
    if (def.slow) for (const e of plan.targets) slowFoe(e, def.slow, def.slowMs)
    const anyCrit = hits.some((hit) => hit.crit) ? { crit: true } : {}
    const added = def.addedFire ? { added: 'fire' } : {}
    land({ who: 'hero', type: 'skill', ...tag, element: def.element, target: plan.targets[0].i, ...plan.extra, hits, amount: sum(hits), ...anyCrit, ...slow, ...added })
    if (def.blast) blast(def, hits)
    return sum(hits)
  }

  const cast = (slot, plans, recast) => {
    const { def } = slot
    const strength = skillPower(def, slot.level)
    const tag = { skill: def.id, shape: def.shape, ...(recast ? { recast: true } : {}) }
    const magic = def.element === 'physical' ? 1 : 1 + (stats.magicPct ?? 0) / 100
    if (def.kind === 'hit') {
      let dealt = 0
      for (const plan of plans) if (!outcome) dealt += strikePlan(slot, plan, tag, 1)
      if (def.echo && !outcome) {
        for (const plan of aim(def) ?? []) if (!outcome) dealt += strikePlan(slot, plan, { ...tag, echo: true }, def.echo)
      }
      if (def.leech && !outcome) {
        const amount = Math.round(Math.min(stats.hp - h.hp, dealt * def.leech))
        if (amount > 0) {
          h.hp += amount
          push({ who: 'hero', type: 'heal', skill: 'vampiro', shape: 'self', amount })
        }
      }
    } else if (def.kind === 'dot') {
      const slow = def.slow ? { slow: { pct: def.slow, ms: def.slowMs } } : {}
      for (const plan of plans) {
        for (const e of plan.targets) {
          e.dots = e.dots.filter((d) => d.skill !== def.id)
          e.dots.push({ skill: def.id, element: def.element, perTick: stats.attack * strength * magic * def.more, nextAt: t + 1000, until: t + def.durationMs })
          if (def.slow) slowFoe(e, def.slow, def.slowMs)
        }
        const hits = plan.targets.map((e) => ({ target: e.i }))
        push({ who: 'hero', type: 'cast', ...tag, element: def.element, target: plan.targets[0].i, ...plan.extra, hits, amount: 0, dot: { ms: def.durationMs }, ...slow })
      }
    } else if (def.kind === 'shield') {
      h.shield = Math.max(h.shield, Math.round(stats.hp * strength))
      push({ who: 'hero', type: 'shield', ...tag, amount: h.shield })
    } else if (def.kind === 'heal') {
      const amount = Math.round(Math.min(stats.hp - h.hp, stats.hp * strength))
      h.hp += amount
      push({ who: 'hero', type: 'heal', ...tag, amount })
      if (def.hot) {
        h.hotAmount = Math.round(stats.hp * def.hot.pct)
        h.hotNext = t + 1000
        h.hotUntil = t + def.hot.ms
      }
    } else if (def.kind === 'buff') {
      h.buff = strength
      h.buffUntil = t + def.durationMs
      push({ who: 'hero', type: 'buff', ...tag, amount: Math.round(strength * 100), ms: def.durationMs })
    }
  }

  // garbageCollector: cura's heal over time, one tick a second.
  const healOverTime = () => {
    if (t < h.hotNext || h.hotNext > h.hotUntil) return
    h.hotNext += 1000
    const amount = Math.round(Math.min(stats.hp - h.hp, h.hotAmount))
    if (amount <= 0) return
    h.hp += amount
    push({ who: 'hero', type: 'heal', skill: 'cura', shape: 'self', amount, hot: true })
  }

  const castSkills = () => {
    if (t < h.stunUntil) return
    for (const slot of loadout) {
      if (outcome) return
      if (t < slot.readyAt || h.mana + EPS < manaCost(slot.def)) continue
      const plans = aim(slot.def)
      if (!plans) continue
      h.mana -= manaCost(slot.def)
      slot.readyAt = t + slot.def.cooldownMs
      cast(slot, plans, false)
      if (outcome || !effects.has(EFFECT.recursion) || !heroRng.chance(CHANCE.recursion)) continue
      const again = aim(slot.def)
      if (again) cast(slot, again, true)
    }
  }

  const swing = (e, tag = {}) => {
    const isCrit = crit()
    const hits = strike([{ e, raw: stats.attack * critMult(isCrit), crit: isCrit }], 'physical')
    land({ who: 'hero', type: isCrit ? 'crit' : 'hit', ...tag, shape: 'single', element: 'physical', target: e.i, hits, amount: sum(hits) })
  }

  // One basic attack (plus what the uniques add). false when nobody is in reach.
  const basic = () => {
    const e = nearest(HERO_REACH)
    if (!e) return false
    swing(e)
    if (!outcome && effects.has(EFFECT.bugSplash) && heroRng.chance(CHANCE.bugSplash)) {
      const targets = [e, ...within(e.x, e.y, SPLASH_RADIUS).filter((o) => o !== e)].filter((o) => o.alive)
      if (targets.length) {
        const hits = strike(targets.map((o) => ({ e: o, raw: stats.attack * RATE.bugSplash, crit: false })), 'poison')
        land({ who: 'hero', type: 'skill', skill: EFFECT.bugSplash, shape: 'area', element: 'poison', target: targets[0].i, at: spot(e.x, e.y), radius: SPLASH_RADIUS, hits, amount: sum(hits) })
      }
    }
    if (!outcome && effects.has(EFFECT.selfCall) && heroRng.chance(CHANCE.selfCall)) {
      const other = nearest(HERO_REACH, 0, 0, new Set([e])) ?? (e.alive ? e : nearest(HERO_REACH))
      if (other) swing(other, { skill: EFFECT.selfCall })
    }
    return true
  }

  const enemyAct = (e) => {
    const attack = e.base.attack * (1 + e.attackPct / 100)
    const special = e.skill && t >= e.skillAt
    if (enemyRng.chance(stats.dodge / 100)) {
      push({ who: 'hero', type: 'dodge', src: e.i, ...(special ? { skill: e.skill } : {}) })
      if (special) e.skillAt = t + BOSS_SKILL_MS
      return
    }
    if (!special) {
      hurtHero(mitigate(attack, 'physical', { armor: stats.armor }), e.i, { type: 'hit' })
      return
    }
    e.skillAt = t + BOSS_SKILL_MS
    const element = e.def.element ?? 'physical'
    const dealt = mitigate(attack * BOSS_SKILL_MULT, element, { armor: stats.armor, res: stats[HERO_RES[element]] })
    const stun = effects.has(EFFECT.strongTyping) ? {} : { stun: STUN_MS }
    hurtHero(dealt, e.i, { type: 'skill', skill: e.skill, element, ...stun })
    if (!outcome && stun.stun) {
      h.next = Math.max(h.next, t + STUN_MS)
      h.stunUntil = t + STUN_MS
    }
  }

  const drink = (kind, low, max, restore) => {
    if (!low || used[kind] >= stock[kind] || t < potionAt[kind]) return
    used[kind]++
    potionAt[kind] = t + POTION_COOLDOWN_MS
    const current = kind === 'hp' ? h.hp : h.mana
    const amount = Math.round(Math.min(max - current, max * restore))
    if (kind === 'hp') h.hp += amount
    else h.mana += amount
    push({ who: 'hero', type: 'potion', skill: kind, amount })
  }

  const walk = () => {
    for (const e of foes) {
      if (!e.alive || e.arrived || e.speed <= 0) continue
      e.d = Math.max(STOP, e.d - e.speed * slowed(e) * (TICK_MS / 1000))
      e.x = e.dir[0] * e.d
      e.y = e.dir[1] * e.d
      if (e.d <= STOP + EPS) {
        e.arrived = true
        e.next = t + interval(enemySpeed(e))
        push({ who: 'enemy', src: e.i, type: 'arrive' })
      }
    }
  }

  const tickDots = () => {
    const due = []
    for (const e of foes) {
      for (const dot of e.dots) if (e.alive && t >= dot.nextAt && dot.nextAt <= dot.until && !due.includes(dot.skill)) due.push(dot.skill)
    }
    for (const skill of due) {
      if (outcome) return
      const list = []
      let element = 'physical'
      for (const e of foes) {
        const dot = e.alive && e.dots.find((d) => d.skill === skill && t >= d.nextAt && d.nextAt <= d.until)
        if (!dot) continue
        dot.nextAt += 1000
        element = dot.element
        list.push({ e, raw: dot.perTick, crit: false })
      }
      const hits = strike(list, element).map(({ target, amount }) => ({ target, amount }))
      land({ who: 'hero', type: 'dot', skill, element, hits, amount: sum(hits) })
    }
    for (const e of foes) e.dots = e.dots.filter((d) => d.nextAt <= d.until)
  }

  for (const def of defs) spawn(def, def.boss ? BOSS_DIST : SPAWN_DIST + layoutRng.next() * SPAWN_JITTER)
  if (defs.length === 0) finish(true, 'killed')

  while (!outcome) {
    t += TICK_MS
    if (t >= limit) {
      if (!bossFight) {
        finish(false, 'timeout')
        break
      }
      push({ who: 'enemy', src: boss ? foes.find((e) => e.boss).i : 0, type: 'enrage' })
      heroDies()
      outcome.reason = 'enrage'
      break
    }
    h.mana = Math.min(stats.mana, h.mana + stats.mana * MANA_REGEN * (TICK_MS / 1000))
    healOverTime()
    if (t % 1000 === 0) {
      for (const e of foes) {
        if (!e.alive || !e.mods.has(MOD.regen)) continue
        const amount = Math.round(Math.min(e.base.hp - e.hp, e.base.hp * RATE.regen))
        e.hp += amount
        if (amount > 0) push({ who: 'enemy', src: e.i, type: 'heal', skill: MOD.regen, amount })
      }
    }
    tickDots()
    if (outcome) break
    walk()
    castSkills()
    while (!outcome && t >= h.next) {
      if (!basic()) {
        h.next = t + TICK_MS
        break
      }
      h.next += interval(heroSpeed())
    }
    for (const e of foes) {
      while (!outcome && e.alive && e.arrived && t >= e.next) {
        enemyAct(e)
        e.next += interval(enemySpeed(e))
      }
    }
    if (outcome) break
    drink('hp', h.hp < thresholds.hp * stats.hp, stats.hp, HP_POTION)
    drink('mp', h.mana < thresholds.mp * stats.mana, stats.mana, MP_POTION)
  }

  const left = Object.fromEntries(loadout.map((slot) => [slot.def.id, Math.max(0, slot.readyAt - t)]))
  return { ...outcome, ms: t, heroHpLeft: Math.max(0, Math.round(h.hp)), potionsUsed: used, kills, elites, cooldowns: left, log }
}
