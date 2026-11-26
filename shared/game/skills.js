// The eight skills of Glitch World. Pure data: combat reads kind, element and power, the shop reads
// minLevel and price (in fragments). Labels live in i18n. Icons are recipe names, except 'snow' (new).
// power: a damage multiplier of attack for hit, per second for dot, a share of max hp for shield and heal,
// a share of attack speed for buff.
// shape (fase 2b, combat.js says how each one picks its targets): around (radius around the hero), area
// (radius around a spot within range), chain (targets, each jump within `jump` tiles and `falloff` weaker),
// pierce (a line `range` long and `width` wide), single, self. Distances are tiles.
export const MAX_SKILL_LEVEL = 5
// The loadout has four slots; a potion threshold is a share of max hp or mana, up to 90%.
export const LOADOUT_SIZE = 4
export const MAX_THRESHOLD = 0.9
const UPGRADE_FRAGMENTS = 40
const UPGRADE_POWER = 0.15

const skill = (id, icon, element, minLevel, price, mana, cooldownMs, kind, power, extra = {}) => ({
  id, icon, element, minLevel, price, mana, cooldownMs, kind, power, ...extra,
})

export const SKILLS = [
  // A wide cleave around the hero.
  skill('golpe', 'sword', 'physical', 1, 0, 0, 4000, 'hit', 1.5, { shape: 'around', radius: 1.8 }),
  // A bolt that jumps from foe to foe.
  skill('raio', 'bolt', 'lightning', 3, 30, 20, 6000, 'hit', 1.8, { shape: 'chain', range: 6, targets: 3, jump: 3, falloff: 0.15 }),
  // A fire patch thrown where the pack is thickest: everyone in it burns.
  skill('chama', 'flame', 'fire', 5, 40, 25, 8000, 'dot', 0.5, { durationMs: 6000, shape: 'area', range: 5, radius: 1.6 }),
  skill('barreira', 'barrier', 'physical', 6, 50, 30, 12000, 'shield', 0.2, { shape: 'self' }),
  // A spit that flies through a whole line of foes and poisons each one.
  skill('veneno', 'poison', 'poison', 8, 60, 20, 9000, 'dot', 0.35, { durationMs: 10000, shape: 'pierce', range: 7, width: 1.2 }),
  skill('cura', 'heart', 'physical', 10, 70, 35, 15000, 'heal', 0.25, { shape: 'self' }),
  skill('furia', 'clock', 'physical', 12, 80, 30, 18000, 'buff', 0.3, { durationMs: 6000, shape: 'self' }),
  // A blizzard around the hero that slows everyone it hits.
  skill('nevasca', 'snow', 'ice', 15, 100, 45, 14000, 'hit', 2.6, { shape: 'around', radius: 3, slow: 0.3, slowMs: 4000 }),
]

export const SKILL_ICONS = [...new Set(SKILLS.map((s) => s.icon))]

// Cost of going from `level` to `level + 1`, or null at the max level.
export const skillUpgradeCost = (level) => (level >= MAX_SKILL_LEVEL ? null : { fragments: UPGRADE_FRAGMENTS * level })

// Power of a skill at a given level (1 to 5): +15% of the base power per level above 1.
export const skillPower = (def, level = 1) => def.power * (1 + UPGRADE_POWER * (Math.max(1, level) - 1))
