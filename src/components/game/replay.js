// What the HUD shows `ms` into a boss fight replay, read back from the fight log alone (pure, tested).
// The View only has max hp and mana, so the hero starts full and the log's hits, heals and potions
// move the bars; mana also pays each cast and regenerates as combat.js does.
import { MANA_REGEN } from '../../../shared/game/combat.js'
import { EFFECT } from '../../../shared/game/combat-effects.js'
import { ENEMIES } from '../../../shared/game/enemies.js'
import { SKILLS } from '../../../shared/game/skills.js'

const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]))
const DEFAULT_ENRAGE_MS = 90000
const DAMAGE = new Set(['hit', 'crit', 'skill', 'dot'])
const CASTS = new Set(['skill', 'heal', 'shield'])

const clamp = (value, max) => Math.min(max, Math.max(0, value))

// fight: the server's boss fight ({ log, enemy: { id, base } }). stats: the hero's final stats.
// Answers { hp, mana, cooldowns, buffs, boss: { hp, maxHp, phase, phases, enrageSec }, log }.
export function replayAt(fight, ms, { stats }) {
  const def = ENEMIES.find((enemy) => enemy.id === fight.enemy?.id)
  const maxBoss = fight.enemy?.base?.hp ?? def?.base.hp ?? 1
  const doubleMana = (stats.effects ?? []).includes(EFFECT.recursion)
  let hp = stats.hp
  let mana = stats.mana
  let bossHp = maxBoss
  let phase = 1
  let last = 0
  const readyAt = {}
  const buffs = {}
  const log = []
  for (const ev of fight.log ?? []) {
    if (ev.t > ms) break
    log.push(ev)
    mana = clamp(mana + stats.mana * MANA_REGEN * ((ev.t - last) / 1000), stats.mana)
    last = ev.t
    const amount = ev.amount ?? 0
    if (ev.who === 'enemy') {
      if (ev.type === 'hit' || ev.type === 'skill') hp -= amount
      else if (ev.type === 'heal') bossHp += amount
      else if (ev.type === 'phase') phase = ev.phase ?? phase + 1
    } else if (ev.who === 'hero') {
      if (DAMAGE.has(ev.type)) bossHp -= amount
      if (ev.type === 'heal') hp += amount
      if (ev.type === 'potion') {
        if (ev.skill === 'mp') mana += amount
        else hp += amount
      }
      const skill = CASTS.has(ev.type) && SKILL_BY_ID[ev.skill]
      if (skill && !ev.recast) {
        mana -= skill.mana * (doubleMana ? 2 : 1)
        readyAt[skill.id] = ev.t + skill.cooldownMs
        if (skill.kind === 'buff') buffs[skill.id] = { icon: skill.icon, until: ev.t + skill.durationMs }
      }
    }
    if (ev.type === 'death') {
      if (ev.who === 'hero') hp = 0
      else bossHp = 0
    }
    hp = clamp(hp, stats.hp)
    mana = clamp(mana, stats.mana)
    bossHp = clamp(bossHp, maxBoss)
  }
  if (log.at(-1)?.type !== 'death') mana = clamp(mana + stats.mana * MANA_REGEN * ((ms - last) / 1000), stats.mana)
  const cooldowns = Object.fromEntries(Object.entries(readyAt).map(([id, at]) => [id, Math.max(0, (at - ms) / 1000)]))
  const active = Object.entries(buffs)
    .filter(([, buff]) => buff.until > ms)
    .map(([id, buff]) => ({ id, icon: buff.icon, seconds: Math.ceil((buff.until - ms) / 1000) }))
  const enrageMs = def?.enrageMs ?? DEFAULT_ENRAGE_MS
  return {
    hp,
    mana,
    cooldowns,
    buffs: active,
    boss: {
      hp: bossHp,
      maxHp: maxBoss,
      phase,
      phases: (def?.phases?.length ?? 2) + 1,
      enrageSec: Math.max(0, Math.ceil((enrageMs - Math.max(0, ms)) / 1000)),
    },
    log,
  }
}
