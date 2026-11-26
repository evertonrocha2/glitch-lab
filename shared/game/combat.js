// Seeded, tick-based fight simulation. The server runs it as the authority, the client replays `log`.
// Pure: all randomness comes from createRng(seed), split into a hero stream and an enemy stream.
// Rules:
// - The hero acts every 1000 / attackSpeed ms: the first ready skill in loadout order it has mana for, else
//   a basic attack. Hero basic attacks and hit skills roll crit. Enemy hits roll the hero's dodge.
// - Physical damage x 100 / (100 + armor). Elemental damage x (1 - res / 100), res capped at 75.
// - Enemy basic attacks are physical. A boss phase skill uses the boss element and stuns for 1 s.
// - Bosses enrage at enrageMs (the hero dies). Trash fights stop at TRASH_TIMEOUT_MS (a loss).
// - Potions: hp when hp < thresholds.hp x max hp, mp when mana < thresholds.mp x max mana (both fractions).
// Event `who` is the side doing the thing: the attacker for hits, the dodger for dodges, the one who dies.
import { createRng } from './rng.js'
import { SKILLS, skillPower } from './skills.js'
import { CHANCE, EFFECT, MOD, RATE, enemyArmor, heroHitMult, isImmune, mitigate } from './combat-effects.js'

export const TICK_MS = 100
export const TRASH_TIMEOUT_MS = 60000
export const POTION_COOLDOWN_MS = 10000

export const MANA_REGEN = 0.02 // of max mana, per second
const HP_POTION = 0.35
const MP_POTION = 0.4
const BOSS_SKILL_MS = 8000
const BOSS_SKILL_MULT = 2
const STUN_MS = 1000
const DEFAULT_ENRAGE_MS = 90000
const HERO_RES = { fire: 'resFire', ice: 'resIce', lightning: 'resLightning', poison: 'resPoison' }
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]))
const interval = (speed) => (speed > 0 ? 1000 / speed : Infinity)

export function simulateFight({ hero, enemy, seed }) {
  const root = createRng(seed)
  const heroRng = root.fork('hero')
  const enemyRng = root.fork('enemy')
  const stats = hero.stats
  const effects = new Set(stats.effects ?? [])
  const mods = new Set(enemy.mods ?? [])
  const base = enemy.base
  const stock = { hp: hero.potions?.hp ?? 0, mp: hero.potions?.mp ?? 0 }
  const thresholds = { hp: hero.thresholds?.hp ?? 0, mp: hero.thresholds?.mp ?? 0 }
  const loadout = (hero.skills ?? [])
    .filter((s) => s && SKILL_BY_ID[s.id])
    .map((s) => ({ def: SKILL_BY_ID[s.id], level: s.level ?? 1, readyAt: 0 }))
  const manaCost = (def) => def.mana * (effects.has(EFFECT.recursion) ? 2 : 1)
  const limit = enemy.boss ? (enemy.enrageMs ?? DEFAULT_ENRAGE_MS) : TRASH_TIMEOUT_MS
  const armor = enemyArmor(base.armor, mods, effects)

  const log = []
  const h = { hp: stats.hp, mana: stats.mana, shield: 0, next: interval(stats.attackSpeed), buff: 0, buffUntil: 0 }
  const e = { hp: base.hp, next: 0, attackPct: 0, phase: 0, skill: null, skillAt: 0, slow: 0, slowUntil: 0, dots: [] }
  const used = { hp: 0, mp: 0 }
  const potionAt = { hp: 0, mp: 0 }
  let t = 0
  let outcome = null

  const heroSpeed = () => stats.attackSpeed * (t < h.buffUntil ? 1 + h.buff : 1)
  const enemySpeed = () => base.attackSpeed * (mods.has(MOD.haste) ? RATE.haste : 1) * (t < e.slowUntil ? 1 - e.slow : 1)
  e.next = interval(enemySpeed())
  const push = (event) => log.push({ t, ...event })
  const finish = (won, reason, who) => {
    push({ who, type: 'death' })
    outcome = { won, reason }
  }

  const hurtHero = (raw, event) => {
    let left = Math.max(0, Math.round(raw))
    const absorbed = Math.min(h.shield, left)
    h.shield -= absorbed
    left -= absorbed
    h.hp -= left
    push({ who: 'enemy', ...event, amount: left, ...(absorbed > 0 ? { absorbed } : {}) })
    if (h.hp <= 0) finish(false, 'died', 'hero')
  }

  const enterPhases = () => {
    const phases = enemy.phases ?? []
    while (e.phase < phases.length && e.hp / base.hp < phases[e.phase].at) {
      const phase = phases[e.phase]
      e.phase++
      e.attackPct += phase.attackPct
      e.skill = phase.skill
      e.skillAt = t
      push({ who: 'enemy', type: 'phase', skill: phase.skill, phase: e.phase + 1 })
    }
  }

  const hurtEnemy = (raw, element, event) => {
    const amount = Math.max(0, Math.round(mitigate(raw, element, { armor, res: base.res?.[element], immune: isImmune(element, mods) })))
    e.hp -= amount
    push({ who: 'hero', ...event, amount, element })
    enterPhases()
    if (e.hp <= 0) finish(true, 'killed', 'enemy')
    else if (amount > 0 && mods.has(MOD.reflect)) hurtHero(amount * RATE.reflect, { type: 'hit', skill: MOD.reflect })
  }

  const crit = () => heroRng.chance(stats.critChance / 100)
  const basic = () => {
    const isCrit = crit()
    hurtEnemy(stats.attack * (isCrit ? stats.critDamage / 100 : 1), 'physical', { type: isCrit ? 'crit' : 'hit' })
    if (!outcome && effects.has(EFFECT.bugSplash) && heroRng.chance(CHANCE.bugSplash)) {
      hurtEnemy(stats.attack * RATE.bugSplash, 'poison', { type: 'skill', skill: EFFECT.bugSplash })
    }
  }

  const useful = ({ def }) => {
    if (def.kind === 'heal') return h.hp < stats.hp
    if (def.kind === 'shield') return h.shield <= 0
    return true
  }

  const cast = (slot, recast) => {
    const { def } = slot
    const strength = skillPower(def, slot.level)
    const tag = { skill: def.id, ...(recast ? { recast: true } : {}) }
    const magic = def.element === 'physical' ? 1 : 1 + (stats.magicPct ?? 0) / 100
    if (def.kind === 'hit') {
      const isCrit = crit()
      const raw = stats.attack * strength * magic * heroHitMult(def.id, effects) * (isCrit ? stats.critDamage / 100 : 1)
      hurtEnemy(raw, def.element, { type: 'skill', ...tag, ...(isCrit ? { crit: true } : {}) })
      if (def.slow) {
        e.slow = def.slow
        e.slowUntil = t + def.slowMs
      }
    } else if (def.kind === 'dot') {
      e.dots = e.dots.filter((d) => d.skill !== def.id)
      e.dots.push({ skill: def.id, element: def.element, perTick: stats.attack * strength * magic, nextAt: t + 1000, until: t + def.durationMs })
      push({ who: 'hero', type: 'skill', ...tag, element: def.element })
    } else if (def.kind === 'shield') {
      h.shield = Math.max(h.shield, Math.round(stats.hp * strength))
      push({ who: 'hero', type: 'shield', ...tag, amount: h.shield })
    } else if (def.kind === 'heal') {
      const amount = Math.round(Math.min(stats.hp - h.hp, stats.hp * strength))
      h.hp += amount
      push({ who: 'hero', type: 'heal', ...tag, amount })
    } else if (def.kind === 'buff') {
      h.buff = strength
      h.buffUntil = t + def.durationMs
      push({ who: 'hero', type: 'skill', ...tag })
    }
  }

  const heroAct = () => {
    const slot = loadout.find((s) => t >= s.readyAt && h.mana + 1e-9 >= manaCost(s.def) && useful(s))
    if (!slot) {
      basic()
      if (!outcome && effects.has(EFFECT.selfCall) && heroRng.chance(CHANCE.selfCall)) basic()
      return
    }
    h.mana -= manaCost(slot.def)
    slot.readyAt = t + slot.def.cooldownMs
    cast(slot, false)
    if (!outcome && effects.has(EFFECT.recursion) && heroRng.chance(CHANCE.recursion)) cast(slot, true)
  }

  const enemyAct = () => {
    const attack = base.attack * (1 + e.attackPct / 100)
    const special = e.skill && t >= e.skillAt
    if (enemyRng.chance(stats.dodge / 100)) {
      push({ who: 'hero', type: 'dodge', ...(special ? { skill: e.skill } : {}) })
      if (special) e.skillAt = t + BOSS_SKILL_MS
      return
    }
    if (!special) {
      hurtHero(mitigate(attack, 'physical', { armor: stats.armor }), { type: 'hit' })
      return
    }
    e.skillAt = t + BOSS_SKILL_MS
    const element = enemy.element ?? 'physical'
    const raw = attack * BOSS_SKILL_MULT
    const dealt = mitigate(raw, element, { armor: stats.armor, res: stats[HERO_RES[element]] })
    const stun = effects.has(EFFECT.strongTyping) ? {} : { stun: STUN_MS }
    hurtHero(dealt, { type: 'skill', skill: e.skill, element, ...stun })
    if (!outcome && stun.stun) h.next = Math.max(h.next, t + STUN_MS)
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

  while (!outcome) {
    t += TICK_MS
    if (t >= limit) {
      if (!enemy.boss) {
        outcome = { won: false, reason: 'timeout' }
        break
      }
      push({ who: 'enemy', type: 'enrage' })
      h.hp = 0
      finish(false, 'enrage', 'hero')
      break
    }
    h.mana = Math.min(stats.mana, h.mana + stats.mana * MANA_REGEN * (TICK_MS / 1000))
    if (mods.has(MOD.regen) && t % 1000 === 0) {
      const amount = Math.round(Math.min(base.hp - e.hp, base.hp * RATE.regen))
      e.hp += amount
      if (amount > 0) push({ who: 'enemy', type: 'heal', skill: MOD.regen, amount })
    }
    for (const dot of e.dots) {
      if (outcome || t < dot.nextAt || dot.nextAt > dot.until) continue
      dot.nextAt += 1000
      hurtEnemy(dot.perTick, dot.element, { type: 'dot', skill: dot.skill })
    }
    e.dots = e.dots.filter((d) => d.nextAt <= d.until)
    while (!outcome && t >= h.next) {
      heroAct()
      h.next += interval(heroSpeed())
    }
    while (!outcome && t >= e.next) {
      enemyAct()
      e.next += interval(enemySpeed())
    }
    if (outcome) break
    drink('hp', h.hp < thresholds.hp * stats.hp, stats.hp, HP_POTION)
    drink('mp', h.mana < thresholds.mp * stats.mana, stats.mana, MP_POTION)
  }

  return { ...outcome, ms: t, heroHpLeft: Math.max(0, Math.round(h.hp)), potionsUsed: used, log }
}
