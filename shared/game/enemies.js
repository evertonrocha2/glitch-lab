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

const FOREST_ENEMIES = [
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

// Fase 3: every region hunts its own enemies. Each is a regional variant of a Forest enemy: the same
// sprite and base stats (zones.js scales them by the zone's item level, so a tier 2 cave slime hits
// far harder than a forest one), its own id, element and resistances. A boss keeps its base boss's
// phases and skills. [id, from, element, res]
const REGION_ENEMIES = (() => {
  const COMMONS = [
    // Biblioteca das Linguagens
    ['cogumelo-verbo', 'cogumelo-bug', 'poison', { poison: 30 }],
    ['morcego-virgula', 'morcego-bug', 'physical', {}],
    ['mosca-acento', 'mosca-null', 'lightning', { lightning: 30 }],
    ['goblin-crase', 'goblin-loop', 'fire', { fire: 30 }],
    ['lobo-rima', 'lobo-syntax', 'physical', { ice: 10 }],
    ['esqueleto-arcaismo', 'esqueleto-array', 'ice', { ice: 40 }],
    ['espectro-metafora', 'espectro-callback', 'lightning', { lightning: 40, fire: 20 }],
    ['golem-gramatica', 'golem-if', 'physical', { poison: 20 }],
    // Cidade das Humanas
    ['goblin-feudo', 'goblin-loop', 'physical', { fire: 20 }],
    ['lobo-imperio', 'lobo-syntax', 'physical', {}],
    ['morcego-boato', 'morcego-bug', 'lightning', { lightning: 20 }],
    ['cogumelo-censo', 'cogumelo-bug', 'poison', { poison: 40 }],
    ['esqueleto-fossil', 'esqueleto-array', 'physical', { ice: 30 }],
    ['mosca-propaganda', 'mosca-null', 'fire', { fire: 30 }],
    ['golem-muralha', 'golem-if', 'physical', { fire: 20, ice: 20 }],
    ['espectro-revolucao', 'espectro-callback', 'fire', { fire: 40, lightning: 20 }],
    // Caverna do SQL
    ['slime-select', 'slime', 'poison', { poison: 50 }],
    ['morcego-join', 'morcego-bug', 'physical', { ice: 10 }],
    ['esqueleto-tabela', 'esqueleto-array', 'ice', { ice: 40 }],
    ['aranha-trigger', 'aranha-fio', 'poison', { poison: 30 }],
    ['mosca-nulo', 'mosca-null', 'lightning', { lightning: 30 }],
    ['golem-indice', 'golem-if', 'physical', { lightning: 20 }],
    ['espectro-deadlock', 'espectro-callback', 'ice', { ice: 40, lightning: 20 }],
    // Jardim da Natureza
    ['slime-celula', 'slime', 'poison', { poison: 50 }],
    ['cogumelo-fungo', 'cogumelo-bug', 'poison', { poison: 40 }],
    ['aranha-teia', 'aranha-fio', 'poison', { poison: 30, ice: 10 }],
    ['mosca-virus', 'mosca-null', 'poison', { poison: 30 }],
    ['lobo-predador', 'lobo-syntax', 'physical', { ice: 20 }],
    ['espectro-mutacao', 'espectro-callback', 'lightning', { lightning: 40, poison: 20 }],
    ['golem-raiz', 'golem-if', 'physical', { poison: 30 }],
    // Torre da Matemática
    ['goblin-divisao', 'goblin-loop', 'fire', { fire: 30 }],
    ['morcego-pi', 'morcego-bug', 'lightning', { lightning: 20 }],
    ['mosca-fracao', 'mosca-null', 'lightning', { lightning: 30 }],
    ['esqueleto-vetor', 'esqueleto-array', 'ice', { ice: 40 }],
    ['golem-equacao', 'golem-if', 'physical', { fire: 20 }],
    ['espectro-infinito', 'espectro-callback', 'ice', { ice: 40, lightning: 30 }],
  ]
  const BOSSES = [
    ['rei-dicionario', 'rei-slime', 'physical', { poison: 30, ice: 20 }],
    ['aranha-metafora', 'aranha-assincrona', 'lightning', { lightning: 50 }],
    ['hidra-ambiguidade', 'hidra-undefined', 'fire', { fire: 40, ice: 20 }],
    ['rei-absoluto', 'rei-slime', 'fire', { fire: 50 }],
    ['aranha-burocracia', 'aranha-assincrona', 'poison', { poison: 50, lightning: 20 }],
    ['hidra-guerra', 'hidra-undefined', 'fire', { fire: 40, lightning: 20 }],
    ['rei-query', 'rei-slime', 'poison', { poison: 60 }],
    ['aranha-join', 'aranha-assincrona', 'ice', { ice: 50, poison: 20 }],
    ['hidra-deadlock', 'hidra-undefined', 'lightning', { lightning: 40, ice: 20 }],
    ['rei-mitose', 'rei-slime', 'poison', { poison: 60 }],
    ['aranha-cadeia', 'aranha-assincrona', 'poison', { poison: 50, ice: 20 }],
    ['hidra-mutante', 'hidra-undefined', 'poison', { poison: 40, fire: 20 }],
    ['rei-matriz', 'rei-slime', 'ice', { ice: 50 }],
    ['aranha-fractal', 'aranha-assincrona', 'lightning', { lightning: 50, ice: 20 }],
    ['hidra-exponencial', 'hidra-undefined', 'fire', { fire: 40, lightning: 30 }],
  ]
  const byId = (id) => FOREST_ENEMIES.find((enemy) => enemy.id === id)
  const like = (from, id, element, res) => ({ ...from, id, element, base: { ...from.base, res: { ...NO_RES, ...res } } })
  return [
    ...COMMONS.map(([id, from, element, res]) => like(byId(from), id, element, res)),
    ...BOSSES.map(([id, from, element, res]) => like(byId(from), id, element, res)),
  ]
})()

export const ENEMIES = [...FOREST_ENEMIES, ...REGION_ENEMIES]

// effect ids are read by combat (Task 8).
export const ELITE_MODS = [
  { id: 'reflete', effect: 'reflect' },
  { id: 'regenera', effect: 'regen' },
  { id: 'imune-fogo', effect: 'immuneFire' },
  { id: 'imune-gelo', effect: 'immuneIce' },
  { id: 'acelerado', effect: 'haste' },
  { id: 'blindado', effect: 'armored' },
]

// Pack members are lighter than a lone foe (fase 2b): several hit the hero at once and area skills hit
// them all. Elites keep their own multipliers on top. Boss adds are pack members too.
export const PACK_HP = 0.6
export const PACK_ATTACK = 0.45
// A boss calls this many of its zone's commons in each phase (fase 2b).
export const BOSS_ADDS = 2
const ELITE_HP = 2.5
const ELITE_ATTACK = 1.4
const ILVL_GROWTH = 0.15

const scale = (base, zone, mult, elite, pack, soften = 1) => {
  const grow = (1 + ILVL_GROWTH * zone.ilvl) * mult
  return {
    ...base,
    hp: Math.round(base.hp * grow * (elite ? ELITE_HP : 1) * (pack ? PACK_HP : 1)),
    attack: Math.round(base.attack * grow * (elite ? ELITE_ATTACK : 1) * (pack ? PACK_ATTACK * soften : 1)),
    armor: Math.round(base.armor * grow),
    res: { ...base.res },
  }
}

// pack: a pack member (PACK_HP, PACK_ATTACK), for packFor and boss adds. soften: a hunt pack member's
// extra attack factor (the zone's packAttack), so a bigger pack doesn't hit much harder in total.
export function enemyFor(zone, difficulty, rng, { elite = false, boss = false, pack = false, soften = 1 } = {}) {
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
  const out = { ...def, base: scale(def.base, zone, mult, isElite, pack && !boss, soften), elite: isElite, mods }
  // Each phase calls BOSS_ADDS of the zone's commons, rolled now so the fight stays pure.
  if (def.phases) {
    out.phases = def.phases.map((phase, k) => ({
      ...phase,
      adds: Array.from({ length: BOSS_ADDS }, (_, j) => enemyFor(zone, difficulty, rng.fork(`add:${k}:${j}`), { pack: true })),
    }))
  }
  return out
}

// A hunt pack: zone.pack [min, max] commons; an elite pack has an elite leading it (index 0). Its
// members hit at the zone's packAttack (fase 4: bigger packs, each member a bit softer).
export function packFor(zone, difficulty, rng, { elite = false } = {}) {
  const [min, max] = zone.pack
  const size = min + rng.int(max - min + 1)
  const soften = zone.packAttack ?? 1
  return Array.from({ length: size }, (_, k) => enemyFor(zone, difficulty, rng.fork(`m:${k}`), { elite: elite && k === 0, pack: true, soften }))
}
