// Enemies, elites and difficulties. Pure data plus enemyFor. Combat reads the shape from here.
// Enemy base stats use the hero's key names (hp, attack, armor, attackSpeed in attacks/s).
// Resistances live in res: { fire, ice, lightning, poison } (percent), as the brief says.
// Numbers are tuned against the combat sim (tests/shared/game-combat.test.js, balance block).

export const DIFFICULTIES = {
  normal: { mult: 1, ilvl: 0, rarityBoost: 0, minLevel: 0 },
  pesadelo: { mult: 3.2, ilvl: 15, rarityBoost: 0.5, minLevel: 25 },
  inferno: { mult: 9, ilvl: 30, rarityBoost: 1.2, minLevel: 40 },
}

export const SPRITES = [
  'slime', 'cogumelo', 'morcego-bug', 'lobo-syntax', 'goblin-loop', 'mosca-null',
  'esqueleto-array', 'golem-if', 'aranha-fio', 'espectro-callback', 'rei-slime', 'aranha-assincrona', 'hidra-undefined',
]

const NO_RES = { fire: 0, ice: 0, lightning: 0, poison: 0 }
const common = (id, sprite, element, hp, attack, armor, attackSpeed, res = {}) => ({
  id, sprite, element, base: { hp, attack, armor, attackSpeed, res: { ...NO_RES, ...res } },
})

// Bosses are slow heavy hitters with a lot of hp: at zone.suggestedPower a fight lasts about 50 s.
const BOSS_PHASES = (a, b) => [
  { at: 0.66, attackPct: 25, skill: a },
  { at: 0.33, attackPct: 25, skill: b },
]
const boss = (id, sprite, element, hp, attack, armor, attackSpeed, res, skills) => ({
  ...common(id, sprite, element, hp, attack, armor, attackSpeed, res),
  boss: true,
  enrageMs: 90000,
  phases: BOSS_PHASES(...skills),
})

export const ENEMIES = [
  common('slime', 'slime', 'poison', 72, 16, 2, 0.8, { poison: 50 }),
  common('cogumelo-bug', 'cogumelo', 'poison', 90, 16, 4, 0.7, { poison: 30 }),
  common('morcego-bug', 'morcego-bug', 'physical', 55, 16, 1, 1.3),
  common('lobo-syntax', 'lobo-syntax', 'physical', 72, 13, 4, 1.1),
  common('goblin-loop', 'goblin-loop', 'fire', 68, 16, 3, 1, { fire: 30 }),
  common('mosca-null', 'mosca-null', 'lightning', 60, 13, 0, 1.5, { lightning: 30 }),
  common('esqueleto-array', 'esqueleto-array', 'ice', 75, 14, 8, 0.9, { ice: 40 }),
  common('golem-if', 'golem-if', 'physical', 72, 30, 15, 0.6),
  common('aranha-fio', 'aranha-fio', 'poison', 70, 13, 5, 1.2, { poison: 30 }),
  common('espectro-callback', 'espectro-callback', 'lightning', 68, 20, 6, 1, { lightning: 40, ice: 20 }),
  boss('rei-slime', 'rei-slime', 'poison', 1300, 21, 10, 0.5, { poison: 60 }, ['golpe-gosma', 'divisao']),
  boss('aranha-assincrona', 'aranha-assincrona', 'poison', 1000, 23, 20, 0.5, { poison: 50, ice: 20 }, ['teia-promise', 'enxame']),
  boss('hidra-undefined', 'hidra-undefined', 'fire', 870, 23, 25, 0.5, { fire: 40, lightning: 20 }, ['sopro-undefined', 'cabeca-extra']),
]

// effect ids are read by combat (Task 8).
export const ELITE_MODS = [
  { id: 'reflete', effect: 'reflect' },
  { id: 'regenera', effect: 'regen' },
  { id: 'imune-fogo', effect: 'immuneFire' },
  { id: 'imune-gelo', effect: 'immuneIce' },
  { id: 'acelerado', effect: 'haste' },
  { id: 'blindado', effect: 'armored' },
]

const ELITE_HP = 2.5
const ELITE_ATTACK = 1.4
const ILVL_GROWTH = 0.15

const scale = (base, zone, mult, elite) => {
  const grow = (1 + ILVL_GROWTH * zone.ilvl) * mult
  return {
    ...base,
    hp: Math.round(base.hp * grow * (elite ? ELITE_HP : 1)),
    attack: Math.round(base.attack * grow * (elite ? ELITE_ATTACK : 1)),
    armor: Math.round(base.armor * grow),
    res: { ...base.res },
  }
}

export function enemyFor(zone, difficulty, rng, { elite = false, boss = false } = {}) {
  const { mult } = DIFFICULTIES[difficulty]
  const id = boss ? zone.boss : rng.pick(zone.enemies)
  const def = ENEMIES.find((enemy) => enemy.id === id)
  const isElite = elite && !boss
  const mods = []
  if (isElite) {
    const pool = [...ELITE_MODS]
    const count = 1 + rng.int(2)
    for (let i = 0; i < count; i++) mods.push(pool.splice(rng.int(pool.length), 1)[0].id)
  }
  const out = { ...def, base: scale(def.base, zone, mult, isElite), elite: isElite, mods }
  if (def.phases) out.phases = def.phases.map((phase) => ({ ...phase }))
  return out
}
