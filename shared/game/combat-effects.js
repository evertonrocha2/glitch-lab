// Damage math and the effect / elite mod rules for combat.js, kept apart so the fight loop stays short.
// Effects (hero, from items, sets and talents):
// - recursion: a cast skill has a 25% chance to cast again for free; every skill costs double mana.
// - chainBolt: raio hits deal +50% (the fight is single target, so the chain lands on the same enemy).
// - strongTyping: the hero can't be stunned (its stats part lives in talents.js).
// - bugSplash (Excalibug): each basic attack has a 20% chance to splash bugs for 50% of attack as poison.
// - rootAccess (Amuleto do Root): the hero's physical damage ignores half of the enemy armor.
// - selfCall (Anel Recursivo): each basic attack has a 15% chance to call itself again right away.
// Elite mods (by id, as enemyFor writes them):
// - reflete: the hero takes 15% of the damage it deals. regenera: heals 2% of max hp per second.
// - imune-fogo / imune-gelo: that element does 0. acelerado: x1.5 attack speed. blindado: +100 armor.

export const RES_CAP = 75

export const EFFECT = {
  recursion: 'recursion',
  chainBolt: 'chainBolt',
  strongTyping: 'strongTyping',
  bugSplash: 'bugSplash',
  rootAccess: 'rootAccess',
  selfCall: 'selfCall',
}

export const MOD = {
  reflect: 'reflete',
  regen: 'regenera',
  immuneFire: 'imune-fogo',
  immuneIce: 'imune-gelo',
  haste: 'acelerado',
  armored: 'blindado',
}

// Roll chances and rates read by combat.js.
export const CHANCE = { recursion: 0.25, bugSplash: 0.2, selfCall: 0.15 }
export const RATE = { bugSplash: 0.5, reflect: 0.15, regen: 0.02, haste: 1.5 }

const IMMUNE = { fire: MOD.immuneFire, ice: MOD.immuneIce }
const ARMORED_BONUS = 100
const ROOT_ARMOR = 0.5
const CHAIN_BOLT = 1.5

export const isImmune = (element, mods) => Boolean(IMMUNE[element] && mods.has(IMMUNE[element]))

// The armor the hero's physical damage meets.
export const enemyArmor = (armor, mods, effects) =>
  (armor + (mods.has(MOD.armored) ? ARMORED_BONUS : 0)) * (effects.has(EFFECT.rootAccess) ? 1 - ROOT_ARMOR : 1)

// Extra multiplier on a hero hit skill.
export const heroHitMult = (skillId, effects) => (skillId === 'raio' && effects.has(EFFECT.chainBolt) ? CHAIN_BOLT : 1)

// Damage after armor (physical) or resistance (elemental). res is the target's percent for that element.
export function mitigate(raw, element, { armor = 0, res = 0, immune = false } = {}) {
  if (element === 'physical') return (raw * 100) / (100 + Math.max(0, armor))
  if (immune) return 0
  return raw * (1 - Math.min(RES_CAP, res ?? 0) / 100)
}
