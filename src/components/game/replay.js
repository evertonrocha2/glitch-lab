// What the HUD shows `ms` into a fight replay (a boss fight or a hunt sample pack), read back from the
// fight log alone (pure, tested). The log format is documented at the top of shared/game/combat.js.
// The View only has max hp and mana, so the hero starts full and the log's hits, heals and potions
// move the bars; mana also pays each cast and regenerates as combat.js does. Each enemy's hp comes
// from its spawn event and drops with every hit that names it.
// Logs from before packs (no spawn events, no hits lists) still read: their damage goes to enemy 0.
import { HP_POTION, MANA_REGEN, MP_POTION, POTION_COOLDOWN_MS } from '../../../shared/game/combat.js'
import { EFFECT } from '../../../shared/game/combat-effects.js'
import { ENEMIES } from '../../../shared/game/enemies.js'
import { SKILLS } from '../../../shared/game/skills.js'

const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]))
const DEFAULT_ENRAGE_MS = 90000
const DAMAGE = new Set(['hit', 'crit', 'skill', 'dot'])
const CASTS = new Set(['skill', 'cast', 'heal', 'shield', 'buff'])
// Events that only move pieces on the stage: no log line.
const SILENT = new Set(['spawn', 'arrive'])

const clamp = (value, max) => Math.min(max, Math.max(0, value))

// fight: { log, enemy?: { id, base } } (a boss fight carries its enemy). stats: the hero's final stats.
// Answers { hp, mana, cooldowns, potions, buffs, boss: { hp, maxHp, phase, phases, enrageSec }, enemies, log }.
// potions: { hp, mp } seconds until that kind can be drunk again (POTION_COOLDOWN_MS after the last).
// enemies: [{ id, hp, maxHp, alive, elite?, boss? }] by spawn index; boss reads the boss (or enemy 0).
export function replayAt(fight, ms, { stats }) {
  const doubleMana = (stats.effects ?? []).includes(EFFECT.recursion)
  const foes = []
  // A log from before packs has no spawn: enemy 0 is fight.enemy.
  const legacyDef = ENEMIES.find((enemy) => enemy.id === fight.enemy?.id)
  const legacyHp = fight.enemy?.base?.hp ?? legacyDef?.base.hp ?? 1
  const foe = (i = 0) => {
    if (!foes[i]) foes[i] = { id: i === 0 ? fight.enemy?.id : undefined, hp: legacyHp, maxHp: legacyHp, alive: true }
    return foes[i]
  }
  const hasSpawns = (fight.log ?? []).some((ev) => ev.type === 'spawn')
  if (!hasSpawns) foe(0)
  let hp = stats.hp
  let mana = stats.mana
  let phase = 1
  let last = 0
  const readyAt = {}
  const potionAt = { hp: -Infinity, mp: -Infinity }
  const buffs = {}
  const log = []
  for (const ev of fight.log ?? []) {
    if (ev.t > ms) break
    if (!SILENT.has(ev.type)) log.push(ev)
    mana = clamp(mana + stats.mana * MANA_REGEN * ((ev.t - last) / 1000), stats.mana)
    last = ev.t
    const amount = ev.amount ?? 0
    if (ev.type === 'spawn') {
      foes[ev.src] = { id: ev.id, hp: ev.hp, maxHp: ev.hp, alive: true, ...(ev.elite ? { elite: true } : {}), ...(ev.boss ? { boss: true } : {}) }
    } else if (ev.who === 'enemy') {
      if (ev.type === 'hit' || ev.type === 'skill') hp -= amount
      else if (ev.type === 'heal') foe(ev.src).hp += amount
      else if (ev.type === 'phase') phase = ev.phase ?? phase + 1
      else if (ev.type === 'death') {
        foe(ev.src).hp = 0
        foe(ev.src).alive = false
      }
    } else if (ev.who === 'hero') {
      if (DAMAGE.has(ev.type)) {
        if (ev.hits) for (const hit of ev.hits) foe(hit.target).hp -= hit.amount ?? 0
        else foe(0).hp -= amount
      }
      if (ev.type === 'heal') hp += amount
      if (ev.type === 'potion') {
        if (ev.skill === 'mp') mana += amount
        else hp += amount
        potionAt[ev.skill === 'mp' ? 'mp' : 'hp'] = ev.t
      }
      if (ev.type === 'death') hp = 0
      const skill = CASTS.has(ev.type) && SKILL_BY_ID[ev.skill]
      if (skill && !ev.recast) {
        mana -= skill.mana * (doubleMana ? 2 : 1)
        readyAt[skill.id] = ev.t + skill.cooldownMs
        if (skill.kind === 'buff') buffs[skill.id] = { icon: skill.icon, until: ev.t + skill.durationMs }
      }
    }
    hp = clamp(hp, stats.hp)
    mana = clamp(mana, stats.mana)
    for (const each of foes) if (each) each.hp = clamp(each.hp, each.maxHp)
  }
  const ended = log.some((ev) => ev.type === 'death' && (ev.who === 'hero' || foes[ev.src ?? 0]?.boss || !foes.some((f) => f?.alive)))
  if (!ended) mana = clamp(mana + stats.mana * MANA_REGEN * ((ms - last) / 1000), stats.mana)
  const cooldowns = Object.fromEntries(Object.entries(readyAt).map(([id, at]) => [id, Math.max(0, (at - ms) / 1000)]))
  const potionLeft = (kind) => Math.max(0, (potionAt[kind] + POTION_COOLDOWN_MS - ms) / 1000)
  const potions = { hp: potionLeft('hp'), mp: potionLeft('mp') }
  const active = Object.entries(buffs)
    .filter(([, buff]) => buff.until > ms)
    .map(([id, buff]) => ({ id, icon: buff.icon, seconds: Math.ceil((buff.until - ms) / 1000) }))
  const boss = foes.find((each) => each?.boss) ?? foe(0)
  const def = ENEMIES.find((enemy) => enemy.id === boss.id) ?? legacyDef
  const enrageMs = def?.enrageMs ?? DEFAULT_ENRAGE_MS
  return {
    hp,
    mana,
    cooldowns,
    potions,
    buffs: active,
    boss: {
      hp: boss.hp,
      maxHp: boss.maxHp,
      phase,
      phases: (def?.phases?.length ?? 2) + 1,
      enrageSec: Math.max(0, Math.ceil((enrageMs - Math.max(0, ms)) / 1000)),
    },
    enemies: foes.map((each) => ({ ...each })),
    log,
  }
}

// Keys 5 and 6: the fight with a potion drunk by hand put into its log, after every event at or before
// its time (ev: { t, who: 'hero', type: 'potion', skill: 'hp' | 'mp', amount, manual: true }). The fight
// given is left as it was.
export function withPotion(fight, ev) {
  const log = [...(fight.log ?? [])]
  let at = log.length
  while (at > 0 && log[at - 1].t > ev.t) at--
  log.splice(at, 0, ev)
  return { ...fight, log }
}

// What a potion of kind restores now, as combat.js drinks one: a share of the max, never past it.
// live: replayAt's answer (or { hp, mana }). stats: the hero's final stats.
export function potionAmount(live, stats, kind) {
  const [current, max, share] = kind === 'mp' ? [live.mana, stats.mana, MP_POTION] : [live.hp, stats.hp, HP_POTION]
  return Math.max(0, Math.round(Math.min(max - current, max * share)))
}
