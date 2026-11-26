// The hunt zones of every region (fase 3: an open world). Each region off the town has a tier, its road
// distance from the town (shared/world/roads.js), and three zones, z1 to z3, whose rects come from its
// map. A zone's numbers come from its tier and its place in the tier (index 0..2), so every harder
// zone pays more: XP per kill grows ZONE_STEP per zone and TIER_STEP per tier (the ladder is strictly
// rising, pinned in tests/shared/game-xp.test.js). Every zone of every difficulty is open from the
// start: danger is the only limit, a weak hero just dies or earns little.
// suggestedPower is tuned against the combat sim: a hero at it beats the boss, a hero at 70% of it does
// not (tests/shared/game-combat.test.js). xp is what one plain kill pays (shared/game/xp.js), tuned so a
// hero with no study goes from level 5 to about 10 in about 1.5 hours in the Forest.
// Fase 4 (fuller hunts): packs of 5 to 7, 6 to 8 and 7 to 9 (were 3 to 4, 3 to 5, 4 to 6), each member
// hitting at the zone's packAttack so a hero at the zone's level still clears them. elitePacks went
// fractional (one elite every 1.75 packs, hunt.js isElitePack) so elites keep their share of the kills,
// and spawnMs grew so kills, gold and drops an hour stay where fase 3 had them. XP_BASE grew 30% (0.8
// to 1.04): XP an hour is about 30% higher in every zone (tests/shared/game-hunt-fill.test.js).
import { WORLDS } from '../world/worlds.js'
import { DIFFICULTIES } from './enemies.js'

export { enemyFor, packFor } from './enemies.js'

export const XP_BASE = 1.04
export const ZONE_STEP = 1.25
export const TIER_STEP = 1.9
const GOLD_STEP = 1.6

// Per zone index, the tier 1 numbers (the Forest's), shared by every tier.
const LADDER = [
  { gold: 4, pack: [5, 7], packAttack: 0.6, spawnMs: 23800, elitePacks: 1.75 },
  { gold: 9, pack: [6, 8], packAttack: 0.75, spawnMs: 32100, elitePacks: 1.75 },
  { gold: 16, pack: [7, 9], packAttack: 0.6, spawnMs: 36000, elitePacks: 1.25 },
]
// Per tier: the suggested level of each zone, its item level (enemies scale with it, and drops roll
// at it), its boss level and suggested power. The deepest tower zone's item level sits four under its
// level, so a bare hero there still clears a pack in about 10 s, like every other zone.
const TIERS = {
  1: { level: [1, 8, 14], ilvl: [1, 8, 14], bossLevel: [5, 10, 14], suggestedPower: [130, 260, 400] },
  2: { level: [20, 26, 32], ilvl: [20, 26, 32], bossLevel: [22, 28, 34], suggestedPower: [540, 730, 940] },
  3: { level: [38, 44, 50], ilvl: [38, 44, 46], bossLevel: [40, 46, 52], suggestedPower: [1030, 1340, 1420] },
}

// Each region's zones in order: the name (game.zone.<name>), the commons and the boss.
const REGION_ZONES = {
  'floresta-js': [
    ['clareira', ['slime', 'cogumelo-bug', 'morcego-bug', 'goblin-loop'], 'rei-slime'],
    ['copas', ['lobo-syntax', 'mosca-null', 'aranha-fio', 'esqueleto-array'], 'aranha-assincrona'],
    ['raizes', ['golem-if', 'espectro-callback', 'esqueleto-array', 'aranha-fio'], 'hidra-undefined'],
  ],
  'biblioteca-linguagens': [
    ['estantes', ['cogumelo-verbo', 'morcego-virgula', 'mosca-acento', 'goblin-crase'], 'rei-dicionario'],
    ['arquivo', ['lobo-rima', 'mosca-acento', 'esqueleto-arcaismo', 'morcego-virgula'], 'aranha-metafora'],
    ['cripta', ['golem-gramatica', 'espectro-metafora', 'esqueleto-arcaismo', 'lobo-rima'], 'hidra-ambiguidade'],
  ],
  'cidade-humanas': [
    ['mercado', ['goblin-feudo', 'cogumelo-censo', 'morcego-boato', 'mosca-propaganda'], 'rei-absoluto'],
    ['muralhas', ['lobo-imperio', 'mosca-propaganda', 'esqueleto-fossil', 'goblin-feudo'], 'aranha-burocracia'],
    ['palacio', ['golem-muralha', 'espectro-revolucao', 'esqueleto-fossil', 'lobo-imperio'], 'hidra-guerra'],
  ],
  'caverna-sql': [
    ['galerias', ['slime-select', 'morcego-join', 'aranha-trigger', 'mosca-nulo'], 'rei-query'],
    ['indices', ['esqueleto-tabela', 'mosca-nulo', 'aranha-trigger', 'morcego-join'], 'aranha-join'],
    ['nucleo', ['golem-indice', 'espectro-deadlock', 'esqueleto-tabela', 'aranha-trigger'], 'hidra-deadlock'],
  ],
  'jardim-natureza': [
    ['estufa', ['slime-celula', 'cogumelo-fungo', 'mosca-virus', 'aranha-teia'], 'rei-mitose'],
    ['pantano', ['lobo-predador', 'mosca-virus', 'aranha-teia', 'cogumelo-fungo'], 'aranha-cadeia'],
    ['bosque', ['golem-raiz', 'espectro-mutacao', 'lobo-predador', 'aranha-teia'], 'hidra-mutante'],
  ],
  'torre-matematica': [
    ['escadaria', ['goblin-divisao', 'morcego-pi', 'mosca-fracao', 'esqueleto-vetor'], 'rei-matriz'],
    ['observatorio', ['esqueleto-vetor', 'mosca-fracao', 'morcego-pi', 'golem-equacao'], 'aranha-fractal'],
    ['cupula', ['golem-equacao', 'espectro-infinito', 'esqueleto-vetor', 'goblin-divisao'], 'hidra-exponencial'],
  ],
}

const round2 = (value) => Math.round(value * 100) / 100

// What one plain kill pays in zone index k (0..2) of a tier.
export const zoneXp = (tier, k) => round2(XP_BASE * ZONE_STEP ** k * TIER_STEP ** (tier - 1))

function zonesOf(world) {
  const numbers = TIERS[world.tier]
  return Object.fromEntries(
    REGION_ZONES[world.id].map(([name, enemies, boss], k) => {
      const zone = world.zones.find((each) => each.id === `z${k + 1}`)
      const level = numbers.level[k]
      return [
        zone.id,
        {
          id: zone.id,
          name,
          world: world.id,
          tier: world.tier,
          minLevel: level,
          ilvl: numbers.ilvl[k],
          gold: Math.round(LADDER[k].gold * GOLD_STEP ** (world.tier - 1)),
          xp: zoneXp(world.tier, k),
          pack: LADDER[k].pack,
          packAttack: LADDER[k].packAttack,
          spawnMs: LADDER[k].spawnMs,
          elitePacks: LADDER[k].elitePacks,
          rect: zone.rect,
          enemies,
          boss,
          bossLevel: numbers.bossLevel[k],
          suggestedPower: numbers.suggestedPower[k],
        },
      ]
    }),
  )
}

// Every region with hunt zones, the Forest first (the default the panels fall back to).
export const HUNT_WORLDS = WORLDS.filter((world) => world.id in REGION_ZONES).map((world) => world.id)

export const ZONES = Object.fromEntries(WORLDS.filter((world) => world.id in REGION_ZONES).map((world) => [world.id, zonesOf(world)]))

// The zone def of a region's hunt zone, or null (own keys only, never the prototype).
export const zoneDef = (worldId, zoneId) =>
  Object.hasOwn(ZONES, worldId ?? '') && Object.hasOwn(ZONES[worldId], zoneId ?? '') ? ZONES[worldId][zoneId] : null

// progress: { [worldId]: { normal: string[], pesadelo: [], inferno: [] } } (beaten zone ids).
// Every zone of every difficulty is open from the start: danger is the only limit. A weak hero just
// dies or earns little. minLevel (the zone's suggested level) and bossLevel stay as guidance.
export function zoneState(progress, worldId, difficulty, _level) {
  const zones = ZONES[worldId]
  if (!zones || !DIFFICULTIES[difficulty]) return []
  const beaten = progress?.[worldId]?.[difficulty] ?? []
  return Object.values(zones).map((zone) => ({
    id: zone.id,
    unlocked: true,
    beaten: beaten.includes(zone.id),
    minLevel: zone.minLevel,
    bossLevel: zone.bossLevel,
  }))
}
