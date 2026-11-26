// What changes a skill (fase 2c): the skill passives of the talent tree (their ids ride in the hero's
// effects, like keystones) and the support gems socketed in the tree. Pure data plus tuneSkill, which
// combat.js runs on each loadout skill once per fight and the panel runs to show the changed numbers.
// Ids only, labels live in i18n (game-tree.js).
//
// Passives (one notable each, talents.js places them):
// - golpeTwice: golpe strikes again right after, at 60% power (one more cleave).
// - breadthFirst: raio jumps to 2 more foes.
// - divideConquer: chama throws a second burning patch at the next thickest spot.
// - fork: veneno spits a second line.
// - endlessWinter: nevasca radius +40%.
// - globalScope: +20% area (radius, or a line's width) for every around, area and pierce skill.
// - quickCache: every skill cooldown recovers 15% faster.
// - memoryLeak: dots last 30% longer.
// - critBlast: a skill hit that crits explodes for 30% of that hit on the other foes within 1.5 tiles.
// - tryCatch: while barreira holds, 40% of the damage it absorbs hits the attacker back.
// - garbageCollector: cura also heals 4% of max hp every second for 5 s.
// Support gems (each counts once, however many sockets hold it):
// - projeteis: area and pierce skills throw 1 more area or line, 15% less damage.
// - encadear: chain skills jump to 2 more foes.
// - areaAmpla: +30% area. concentrado: -30% area, +35% damage (around, area, pierce).
// - rapido: cooldowns recover 25% faster, skills cost 20% more mana.
// - fogo: hit skills add 20% of each hit as fire (fire res and immunity apply).
// - vampiro: hit skills heal the hero for 5% of the damage they deal.
// - frio: hit and dot skills slow what they land on by 20% for 2 s.
// - persistencia: dots and buffs last 40% longer.
// More areas or lines never hit a foe twice in one cast: each extra one goes where foes not hit yet stand.
import { SKILLS } from './skills.js'

export const PASSIVES = {
  golpeTwice: { skill: 'golpe', icon: 'sword', echo: 0.6 },
  breadthFirst: { skill: 'raio', icon: 'bolt', targets: 2 },
  divideConquer: { skill: 'chama', icon: 'flame', extra: 1 },
  fork: { skill: 'veneno', icon: 'poison', extra: 1 },
  endlessWinter: { skill: 'nevasca', icon: 'snow', area: 0.4 },
  globalScope: { icon: 'map', area: 0.2 },
  quickCache: { icon: 'clock', cooldown: 0.15 },
  memoryLeak: { icon: 'scroll', duration: 0.3, kinds: ['dot'] },
  critBlast: { icon: 'target', blast: { pct: 0.3, radius: 1.5 } },
  tryCatch: { skill: 'barreira', icon: 'barrier', reflect: 0.4 },
  garbageCollector: { skill: 'cura', icon: 'heart', hot: { pct: 0.04, ms: 5000 } },
}

// color: the gem's tint (slot fill and its pixel icon, a recipe named support-<id>).
export const SUPPORTS = {
  projeteis: { color: '#ff9a1f', extra: 1, more: -0.15 },
  encadear: { color: '#ffd23e', targets: 2 },
  areaAmpla: { color: '#4fa3ff', area: 0.3 },
  concentrado: { color: '#ff5a6e', area: -0.3, more: 0.35 },
  rapido: { color: '#7fffe9', cooldown: 0.25, mana: 0.2 },
  fogo: { color: '#ff6a2a', addedFire: 0.2 },
  vampiro: { color: '#c8324a', leech: 0.05 },
  frio: { color: '#9fd8ff', slow: { pct: 0.2, ms: 2000 } },
  persistencia: { color: '#a98bff', duration: 0.4, kinds: ['dot', 'buff'] },
}
export const SUPPORT_IDS = Object.keys(SUPPORTS)

const AREA_SHAPES = new Set(['around', 'area', 'pierce'])
const DAMAGE_KINDS = new Set(['hit', 'dot'])

// Does this mod change this skill? Each number a mod carries says where it applies.
function applies(mod, def) {
  if (mod.skill && mod.skill !== def.id) return false
  if (mod.skill) return true
  if (mod.extra) return def.shape === 'area' || def.shape === 'pierce'
  if (mod.targets) return def.shape === 'chain'
  if (mod.area) return AREA_SHAPES.has(def.shape)
  if (mod.cooldown) return def.cooldownMs > 0
  if (mod.duration) return mod.kinds.includes(def.kind) && def.durationMs > 0
  if (mod.blast || mod.addedFire || mod.leech) return def.kind === 'hit'
  if (mod.slow) return DAMAGE_KINDS.has(def.kind)
  return false
}

const own = (table, id) => (Object.hasOwn(table, id) ? table[id] : null)

// The skill as it fights. Adds to the def: more (damage multiplier), extra (more areas or lines),
// echo? (golpe again, at that share), blast?, reflect?, hot?, addedFire?, leech?, and mods (what
// changed it: [{ kind: 'passive' | 'support', id }]). Changes radius, width, targets, cooldownMs,
// mana, durationMs, slow and slowMs.
export function tuneSkill(def, { effects = [], supports = [] } = {}) {
  const mods = []
  for (const id of new Set(effects)) if (own(PASSIVES, id) && applies(PASSIVES[id], def)) mods.push({ kind: 'passive', id })
  for (const id of new Set(supports)) if (own(SUPPORTS, id) && applies(SUPPORTS[id], def)) mods.push({ kind: 'support', id })
  let area = 0
  let cooldown = 0
  let duration = 0
  let more = 1
  let mana = 0
  const out = { ...def, more: 1, extra: 0, mods }
  for (const { kind, id } of mods) {
    const mod = kind === 'passive' ? PASSIVES[id] : SUPPORTS[id]
    area += mod.area ?? 0
    cooldown += mod.cooldown ?? 0
    duration += mod.duration ?? 0
    mana += mod.mana ?? 0
    more *= 1 + (mod.more ?? 0)
    out.extra += mod.extra ?? 0
    if (mod.targets) out.targets += mod.targets
    if (mod.echo) out.echo = mod.echo
    if (mod.blast) out.blast = { ...mod.blast }
    if (mod.reflect) out.reflect = mod.reflect
    if (mod.hot) out.hot = { ...mod.hot }
    if (mod.addedFire) out.addedFire = (out.addedFire ?? 0) + mod.addedFire
    if (mod.leech) out.leech = (out.leech ?? 0) + mod.leech
    if (mod.slow && mod.slow.pct >= (out.slow ?? 0)) {
      out.slow = mod.slow.pct
      out.slowMs = Math.max(mod.slow.ms, def.slow ? def.slowMs : 0)
    }
  }
  out.more = Math.round(more * 1000) / 1000
  if (area && def.radius) out.radius = def.radius * (1 + area)
  if (area && def.width) out.width = def.width * (1 + area)
  if (cooldown) out.cooldownMs = Math.round(def.cooldownMs / (1 + cooldown))
  if (duration) out.durationMs = Math.round(def.durationMs * (1 + duration))
  if (mana) out.mana = Math.round(def.mana * (1 + mana))
  return out
}

// What changes each skill, by skill id: { [skillId]: [{ kind, id }] }.
export function modsFor({ effects = [], supports = [] } = {}, skills = SKILLS) {
  return Object.fromEntries(skills.map((def) => [def.id, tuneSkill(def, { effects, supports }).mods]))
}
